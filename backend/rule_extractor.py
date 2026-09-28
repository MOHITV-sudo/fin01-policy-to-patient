import logging
from typing import Dict, Any, List, Optional
from schemas import PolicyRules, ExtractedField, Evidence
from retriever import PolicySession
from llm import llm_client

logger = logging.getLogger(__name__)

RULE_PROMPT_SYSTEM = """You are a senior health insurance policy underwriting auditor.
Extract structured insurance rules from the provided policy clauses.
CRITICAL RULES:
1. ONLY extract values explicitly mentioned in the text.
2. If a rule (such as co-payment, deductible, or sub-limit) is NOT mentioned or says reserved/unspecified, set "value": null, "evidence": null, "confidence": "LOW". DO NOT GUESS.
3. Numeric values should be numbers (e.g. 500000, 20, 10000, 24). Do not include currency symbols in 'value'.
4. For every extracted field, include:
   - "value": the extracted value (or null)
   - "evidence": {"page": <page_number>, "section": "<section_name>", "snippet": "<short quote max 25 words>"} (or null if missing)
   - "confidence": "HIGH", "MEDIUM", or "LOW"
5. Respond ONLY with valid JSON matching the exact schema."""

class PolicyRuleExtractor:
    def __init__(self, session: PolicySession):
        self.session = session

    def extract_rules(self) -> Dict[str, Any]:
        # Targeted queries to retrieve the most relevant chunks
        queries = [
            "What is the policy sum insured and overall coverage limit?",
            "What is the deductible amount per claim?",
            "What is the co-payment percentage or co-pay clause?",
            "What is the room rent limit per day or ICU charges?",
            "What are the waiting periods? Initial, specific illnesses like knee replacement, cataract, hernia, and pre-existing diseases?",
            "What are the sub-limits on specific procedures like knee replacement, cataract, hernia, gallbladder, appendectomy?",
            "What are the general exclusions in the policy?",
            "What are the claim notice and documentation requirements?"
        ]

        relevant_chunks = {}
        for q in queries:
            results = self.session.index.search(q, top_k=3)
            for chunk, score in results:
                relevant_chunks[chunk.chunk_id] = chunk

        # Build context from chunks
        context_blocks = []
        for c in relevant_chunks.values():
            context_blocks.append(f"[Page {c.page} | Section: {c.section}]\n{c.text}")

        context_text = "\n\n".join(context_blocks)

        user_prompt = f"""Here are the relevant excerpts from the insurance policy:
--------------------
{context_text}
--------------------

Extract the policy rules into the following JSON format:
{{
  "sum_insured": {{"value": number or null, "evidence": {{"page": int, "section": str, "snippet": str}} or null, "confidence": "HIGH"|"MEDIUM"|"LOW"}},
  "coverage_limit": {{"value": number or null, "evidence": {{"page": int, "section": str, "snippet": str}} or null, "confidence": "HIGH"|"MEDIUM"|"LOW"}},
  "deductible": {{"value": number or null, "evidence": {{"page": int, "section": str, "snippet": str}} or null, "confidence": "HIGH"|"MEDIUM"|"LOW"}},
  "copay_percent": {{"value": number or null, "evidence": {{"page": int, "section": str, "snippet": str}} or null, "confidence": "HIGH"|"MEDIUM"|"LOW"}},
  "room_rent_limit_per_day": {{"value": number or null, "evidence": {{"page": int, "section": str, "snippet": str}} or null, "confidence": "HIGH"|"MEDIUM"|"LOW"}},
  "waiting_period_months": {{"value": number or null, "evidence": {{"page": int, "section": str, "snippet": str}} or null, "confidence": "HIGH"|"MEDIUM"|"LOW"}},
  "specific_waiting_periods": {{"value": {{"procedure_name": months_integer}} or {{}}, "evidence": {{"page": int, "section": str, "snippet": str}} or null, "confidence": "HIGH"|"MEDIUM"|"LOW"}},
  "sub_limits": {{"value": {{"procedure_name": amount_number}} or {{}}, "evidence": {{"page": int, "section": str, "snippet": str}} or null, "confidence": "HIGH"|"MEDIUM"|"LOW"}},
  "exclusions": {{"value": ["exclusion 1", "exclusion 2"] or [], "evidence": {{"page": int, "section": str, "snippet": str}} or null, "confidence": "HIGH"|"MEDIUM"|"LOW"}},
  "claim_requirements": {{"value": ["req 1", "req 2"] or [], "evidence": {{"page": int, "section": str, "snippet": str}} or null, "confidence": "HIGH"|"MEDIUM"|"LOW"}}
}}"""

        extracted = llm_client.generate_json(RULE_PROMPT_SYSTEM, user_prompt)
        # Ensure all standard fields exist
        standard_keys = [
            "sum_insured", "coverage_limit", "deductible", "copay_percent",
            "room_rent_limit_per_day", "waiting_period_months",
            "specific_waiting_periods", "sub_limits", "exclusions", "claim_requirements"
        ]

        normalized_rules = {}
        for key in standard_keys:
            if key in extracted and isinstance(extracted[key], dict):
                item = extracted[key]
                normalized_rules[key] = {
                    "value": item.get("value"),
                    "evidence": item.get("evidence"),
                    "confidence": item.get("confidence", "LOW"),
                    "source": "policy",
                    "is_override": False
                }
            else:
                normalized_rules[key] = {
                    "value": None,
                    "evidence": None,
                    "confidence": "LOW",
                    "source": "policy",
                    "is_override": False
                }

        self.session.rules = normalized_rules
        return normalized_rules

    @staticmethod
    def apply_overrides(rules: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
        merged = dict(rules)
        for k, v in overrides.items():
            if v is not None and k in merged:
                merged[k] = {
                    "value": v,
                    "evidence": {
                        "page": 0,
                        "section": "User Input",
                        "snippet": "Manually supplied user override"
                    },
                    "confidence": "HIGH",
                    "source": "user-provided",
                    "is_override": True
                }
            elif v is not None:
                merged[k] = {
                    "value": v,
                    "evidence": {
                        "page": 0,
                        "section": "User Input",
                        "snippet": "Manually supplied user override"
                    },
                    "confidence": "HIGH",
                    "source": "user-provided",
                    "is_override": True
                }
        return merged
