import os
import uuid
import logging
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from schemas import (
    UploadPolicyResponse, AskRequest, AskResponse, Evidence,
    PolicyRules, EstimateRequest, EstimateResponse, CostBreakdownRange,
    CalculationStep
)
from pdf_processor import PDFProcessor
from chunker import PageAwareChunker
from retriever import PolicySession, session_store
from llm import llm_client
from rule_extractor import PolicyRuleExtractor
from cost_data import CostDataManager
from calculator import CostCalculator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fin01_api")

app = FastAPI(
    title="FIN01 – Policy-to-Patient API",
    description="Insurance Policy Intelligence Assistant for HackMatrix 5.0 (Problem FIN-01)",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cost_manager = CostDataManager()
chunker = PageAwareChunker()

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "app": "FIN01 - Policy-to-Patient",
        "version": "1.0.0",
        "llm_ready": llm_client.is_available(),
        "active_policies": len(session_store.list_all())
    }

@app.post("/upload-policy", response_model=UploadPolicyResponse)
async def upload_policy(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF documents are supported.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    pages, warnings = PDFProcessor.extract_from_bytes(file_bytes)
    chunks = chunker.chunk_pages(pages)

    policy_id = str(uuid.uuid4())[:8]
    session = PolicySession(
        policy_id=policy_id,
        filename=file.filename,
        pages=pages,
        chunks=chunks
    )
    session_store.save(session)

    # Automatically trigger rule extraction in background / session cache
    try:
        extractor = PolicyRuleExtractor(session)
        extractor.extract_rules()
    except Exception as e:
        logger.warning(f"Initial rule extraction warning: {e}")

    return UploadPolicyResponse(
        success=True,
        policy_id=policy_id,
        filename=file.filename,
        total_pages=len(pages),
        pages=pages,
        warnings=warnings
    )

@app.post("/load-sample", response_model=UploadPolicyResponse)
def load_sample_policy(policy_type: str = Query("standard", description="standard or missing_copay")):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    filename = "sample_health_policy.pdf" if policy_type == "standard" else "sample_policy_missing_copay.pdf"
    sample_path = os.path.join(base_dir, "samples", filename)

    if not os.path.exists(sample_path):
        raise HTTPException(status_code=404, detail=f"Sample policy not found at {sample_path}")

    pages, warnings = PDFProcessor.extract_from_path(sample_path)
    chunks = chunker.chunk_pages(pages)

    policy_id = f"sample-{policy_type}-{str(uuid.uuid4())[:6]}"
    session = PolicySession(
        policy_id=policy_id,
        filename=filename,
        pages=pages,
        chunks=chunks
    )
    session_store.save(session)

    # Pre-extract rules
    extractor = PolicyRuleExtractor(session)
    extractor.extract_rules()

    return UploadPolicyResponse(
        success=True,
        policy_id=policy_id,
        filename=f"Aegis Shield Health Policy ({policy_type})",
        total_pages=len(pages),
        pages=pages,
        warnings=warnings
    )

@app.post("/ask", response_model=AskResponse)
def ask_policy(req: AskRequest):
    session = session_store.get(req.policy_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Policy '{req.policy_id}' not found. Please upload or load a policy first.")

    # Retrieve top 5 semantic chunks
    retrieved = session.index.search(req.question, top_k=5)
    if not retrieved:
        return AskResponse(
            answer="No relevant content found in the policy document.",
            coverage_status="UNCLEAR",
            conditions=[],
            exclusions=[],
            evidence=[],
            confidence="LOW",
            confidence_reason="No matching text retrieved from policy chunks.",
            missing_info=["Policy text or clauses matching the query"]
        )

    context_str = "\n\n".join([
        f"[Source: Page {chunk.page} | Section: {chunk.section}]\n{chunk.text}"
        for chunk, score in retrieved
    ])

    system_prompt = """You are an expert insurance policy intelligence auditor.
Answer the user's question STRICTLY based on the provided policy excerpts.
HARD RULES:
1. NEVER hallucinate or assume terms not in the excerpts.
2. If the excerpts do not contain enough information to be certain, set coverage_status to "UNCLEAR" and confidence to "LOW".
3. coverage_status MUST be one of: "COVERED", "POTENTIALLY_COVERED", "NOT_COVERED", "UNCLEAR".
4. For every claim you make, cite the page number, section heading, and a short snippet (max 25 words).
5. Output ONLY valid JSON adhering to this schema:
{
  "answer": "string explanation",
  "coverage_status": "COVERED"|"POTENTIALLY_COVERED"|"NOT_COVERED"|"UNCLEAR",
  "conditions": ["condition 1", "condition 2"],
  "exclusions": ["exclusion 1"],
  "evidence": [{"page": 1, "section": "Section Name", "snippet": "max 25 words quotation"}],
  "confidence": "HIGH"|"MEDIUM"|"LOW",
  "confidence_reason": "string reason",
  "missing_info": ["string missing details if any"]
}"""

    # Include recent chat history
    history_context = ""
    if session.chat_history:
        recent = session.chat_history[-3:]
        history_context = "Recent conversation context:\n" + "\n".join([f"{h['role']}: {h['content']}" for h in recent]) + "\n\n"

    user_prompt = f"""{history_context}Relevant Policy Excerpts:
--------------------
{context_str}
--------------------

User Question: {req.question}"""

    result = llm_client.generate_json(system_prompt, user_prompt)

    # Validate / normalize result
    evidence_list = []
    if "evidence" in result and isinstance(result["evidence"], list):
        for ev in result["evidence"]:
            if isinstance(ev, dict) and "page" in ev:
                evidence_list.append(Evidence(
                    page=int(ev.get("page", 1)),
                    section=str(ev.get("section", "General")),
                    snippet=str(ev.get("snippet", ""))[:180]
                ))

    # If no evidence parsed but chunks exist, add the top retrieved chunk as evidence
    if not evidence_list and retrieved:
        top_c, _ = retrieved[0]
        words = top_c.text.split()
        snippet = " ".join(words[:22]) + ("..." if len(words) > 22 else "")
        evidence_list.append(Evidence(
            page=top_c.page,
            section=top_c.section,
            snippet=snippet
        ))

    response = AskResponse(
        answer=result.get("answer", "Answer unavailable from the provided policy clauses."),
        coverage_status=result.get("coverage_status", "UNCLEAR"),
        conditions=result.get("conditions", []),
        exclusions=result.get("exclusions", []),
        evidence=evidence_list,
        confidence=result.get("confidence", "MEDIUM"),
        confidence_reason=result.get("confidence_reason", "Extracted from retrieved policy clauses."),
        missing_info=result.get("missing_info", [])
    )

    # Record in session history
    session.chat_history.append({"role": "user", "content": req.question})
    session.chat_history.append({"role": "assistant", "content": response.answer})

    return response

@app.post("/extract-rules/{policy_id}")
@app.get("/rules/{policy_id}")
def get_or_extract_rules(policy_id: str):
    session = session_store.get(policy_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Policy '{policy_id}' not found.")

    if not session.rules:
        extractor = PolicyRuleExtractor(session)
        extractor.extract_rules()

    return session.rules

@app.post("/rules/{policy_id}/override")
def override_rules(policy_id: str, overrides: Dict[str, Any]):
    session = session_store.get(policy_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Policy '{policy_id}' not found.")

    if not session.rules:
        extractor = PolicyRuleExtractor(session)
        extractor.extract_rules()

    updated = PolicyRuleExtractor.apply_overrides(session.rules, overrides)
    session.rules = updated
    return updated

@app.get("/treatments")
def list_treatments():
    return cost_manager.get_treatments()

@app.get("/cities")
def list_cities():
    return cost_manager.get_cities()

@app.get("/cost")
def get_treatment_cost(treatment: str, city: Optional[str] = None):
    cost_info = cost_manager.get_cost(treatment, city)
    if not cost_info:
        raise HTTPException(status_code=404, detail=f"Treatment '{treatment}' not found in cost benchmarks.")
    return cost_info

@app.post("/estimate", response_model=EstimateResponse)
def estimate_cost(req: EstimateRequest):
    session = session_store.get(req.policy_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Policy '{req.policy_id}' not found.")

    # 1. Fetch benchmark cost data
    cost_data = cost_manager.get_cost(req.treatment, req.city)
    if not cost_data:
        raise HTTPException(status_code=404, detail=f"Cost data not found for treatment '{req.treatment}'.")

    # 2. Extract rules if not yet cached
    if not session.rules:
        extractor = PolicyRuleExtractor(session)
        extractor.extract_rules()

    # 3. Apply any user overrides
    active_rules = dict(session.rules)
    if req.overrides:
        active_rules = PolicyRuleExtractor.apply_overrides(active_rules, req.overrides)

    avg_bill = cost_data["avg_cost"]
    min_bill = cost_data["min_cost"]
    max_bill = cost_data["max_cost"]

    # 4. Deterministic Python Calculation
    calc_result = CostCalculator.calculate(
        treatment_cost=avg_bill,
        rules=active_rules,
        policy_age_months=req.policy_age_months,
        treatment_name=req.treatment,
        room_rent_actual=req.room_rent_actual,
        overrides=req.overrides
    )

    # 5. Calculate range breakdown for min and max cost if eligible
    ranges = None
    if calc_result["status"] == "CALCULATED":
        min_res = CostCalculator.calculate(
            treatment_cost=min_bill,
            rules=active_rules,
            policy_age_months=req.policy_age_months,
            treatment_name=req.treatment,
            room_rent_actual=req.room_rent_actual,
            overrides=req.overrides
        )
        max_res = CostCalculator.calculate(
            treatment_cost=max_bill,
            rules=active_rules,
            policy_age_months=req.policy_age_months,
            treatment_name=req.treatment,
            room_rent_actual=req.room_rent_actual,
            overrides=req.overrides
        )

        ranges = {
            "low": CostBreakdownRange(
                treatment_cost=min_bill,
                insurer_pays=min_res["insurer_pays"],
                out_of_pocket=min_res["out_of_pocket"]
            ),
            "avg": CostBreakdownRange(
                treatment_cost=avg_bill,
                insurer_pays=calc_result["insurer_pays"],
                out_of_pocket=calc_result["out_of_pocket"]
            ),
            "high": CostBreakdownRange(
                treatment_cost=max_bill,
                insurer_pays=max_res["insurer_pays"],
                out_of_pocket=max_res["out_of_pocket"]
            ),
        }

    return EstimateResponse(
        status=calc_result["status"],
        treatment=cost_data["treatment"],
        city=cost_data["city"],
        is_national_average=cost_data["is_national_average"],
        base_cost=avg_bill,
        insurer_pays=calc_result["insurer_pays"],
        out_of_pocket=calc_result["out_of_pocket"],
        is_eligible=calc_result["is_eligible"],
        steps=calc_result["steps"],
        missing_fields=calc_result["missing_fields"],
        message=calc_result["message"],
        ranges=ranges
    )
