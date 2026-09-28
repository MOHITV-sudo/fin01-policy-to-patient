import os
import sys
import pytest

# Ensure backend directory is in python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from calculator import CostCalculator
from schemas import PolicyRules
from pdf_processor import PDFProcessor
from chunker import PageAwareChunker

# -------------------------------------------------------------
# Test Scenario: Reference Example from Specification
# bill 250000, deductible 10000, limit 200000, copay 20% ->
# eligible 240000 -> capped 200000 -> copay 40000 -> insurer 160000 -> OOP 90000.
# -------------------------------------------------------------
def test_reference_example():
    rules = {
        "sum_insured": {"value": 500000, "evidence": {"page": 1, "section": "Schedule", "snippet": "₹5,00,000"}},
        "coverage_limit": {"value": 200000, "evidence": {"page": 1, "section": "Schedule", "snippet": "₹2,00,000"}},
        "deductible": {"value": 10000, "evidence": {"page": 1, "section": "Schedule", "snippet": "₹10,000"}},
        "copay_percent": {"value": 20, "evidence": {"page": 1, "section": "Schedule", "snippet": "20% co-payment"}},
    }

    result = CostCalculator.calculate(
        treatment_cost=250000.0,
        rules=rules,
        policy_age_months=36,
        treatment_name="General Surgery"
    )

    assert result["status"] == "CALCULATED"
    assert result["is_eligible"] is True
    assert result["insurer_pays"] == 160000.0
    assert result["out_of_pocket"] == 90000.0
    assert len(result["steps"]) >= 5


# -------------------------------------------------------------
# Scenario 1: Fully Covered
# -------------------------------------------------------------
def test_scenario_1_fully_covered():
    rules = {
        "sum_insured": {"value": 300000, "evidence": {"page": 1}},
        "coverage_limit": {"value": 300000, "evidence": {"page": 1}},
        "deductible": {"value": 0, "evidence": {"page": 1}},
        "copay_percent": {"value": 0, "evidence": {"page": 1}},
        "waiting_period_months": {"value": 1, "evidence": {"page": 3}},
    }

    bill = 50000.0
    result = CostCalculator.calculate(
        treatment_cost=bill,
        rules=rules,
        policy_age_months=12,
        treatment_name="Emergency Hospitalization"
    )

    assert result["status"] == "CALCULATED"
    assert result["is_eligible"] is True
    assert result["insurer_pays"] == 50000.0
    assert result["out_of_pocket"] == 0.0


# -------------------------------------------------------------
# Scenario 2: Limit Exceeded
# -------------------------------------------------------------
def test_scenario_2_limit_exceeded():
    rules = {
        "sum_insured": {"value": 200000, "evidence": {"page": 1}},
        "coverage_limit": {"value": 200000, "evidence": {"page": 1}},
        "deductible": {"value": 0, "evidence": {"page": 1}},
        "copay_percent": {"value": 0, "evidence": {"page": 1}},
    }

    bill = 350000.0
    result = CostCalculator.calculate(
        treatment_cost=bill,
        rules=rules,
        policy_age_months=24,
        treatment_name="Cardiology Procedure"
    )

    assert result["status"] == "CALCULATED"
    assert result["insurer_pays"] == 200000.0
    assert result["out_of_pocket"] == 150000.0


# -------------------------------------------------------------
# Scenario 3: Co-Pay Applied
# -------------------------------------------------------------
def test_scenario_3_copay_applied():
    rules = {
        "sum_insured": {"value": 500000, "evidence": {"page": 1}},
        "coverage_limit": {"value": 500000, "evidence": {"page": 1}},
        "deductible": {"value": 0, "evidence": {"page": 1}},
        "copay_percent": {"value": 20, "evidence": {"page": 1}},
    }

    bill = 100000.0
    result = CostCalculator.calculate(
        treatment_cost=bill,
        rules=rules,
        policy_age_months=24,
        treatment_name="General Hospitalization"
    )

    assert result["status"] == "CALCULATED"
    # 20% of 100,000 = 20,000 copay; insurer pays 80,000
    assert result["insurer_pays"] == 80000.0
    assert result["out_of_pocket"] == 20000.0


# -------------------------------------------------------------
# Scenario 4: Waiting Period Not Satisfied
# -------------------------------------------------------------
def test_scenario_4_waiting_period_not_satisfied():
    rules = {
        "sum_insured": {"value": 500000, "evidence": {"page": 1}},
        "coverage_limit": {"value": 500000, "evidence": {"page": 1}},
        "deductible": {"value": 10000, "evidence": {"page": 1}},
        "copay_percent": {"value": 20, "evidence": {"page": 1}},
        "specific_waiting_periods": {
            "value": {"knee replacement": 24, "cataract": 24},
            "evidence": {"page": 3}
        }
    }

    bill = 220000.0
    result = CostCalculator.calculate(
        treatment_cost=bill,
        rules=rules,
        policy_age_months=10,  # 10 months < 24 months requirement
        treatment_name="Knee Replacement"
    )

    assert result["status"] == "NOT_COVERED"
    assert result["is_eligible"] is False
    assert result["insurer_pays"] == 0.0
    assert result["out_of_pocket"] == 220000.0
    assert "Waiting period" in result["message"]


# -------------------------------------------------------------
# Scenario 5: Missing Info -> Refusal to Estimate
# -------------------------------------------------------------
def test_scenario_5_missing_info_refusal():
    # Copay is missing (None)
    rules = {
        "sum_insured": {"value": 500000, "evidence": {"page": 1}},
        "coverage_limit": {"value": 500000, "evidence": {"page": 1}},
        "deductible": {"value": 10000, "evidence": {"page": 1}},
        "copay_percent": {"value": None, "evidence": None, "confidence": "LOW"},
    }

    bill = 220000.0
    result = CostCalculator.calculate(
        treatment_cost=bill,
        rules=rules,
        policy_age_months=24,
        treatment_name="Knee Replacement"
    )

    assert result["status"] == "INSUFFICIENT_INFORMATION"
    assert result["insurer_pays"] is None
    assert result["out_of_pocket"] is None
    assert "co-pay percentage" in result["missing_fields"]
    assert "Unable to produce a reliable estimate" in result["message"]
    assert "Please verify with the insurer" in result["message"]


# -------------------------------------------------------------
# User Overrides Test: Providing missing info restores calculation
# -------------------------------------------------------------
def test_user_override_restores_calculation():
    # Policy has missing copay
    rules = {
        "sum_insured": {"value": 500000, "evidence": {"page": 1}},
        "coverage_limit": {"value": 200000, "evidence": {"page": 1}},
        "deductible": {"value": 10000, "evidence": {"page": 1}},
        "copay_percent": {"value": None, "evidence": None},
    }

    # User manually inputs 20% copay
    result = CostCalculator.calculate(
        treatment_cost=250000.0,
        rules=rules,
        policy_age_months=36,
        treatment_name="Surgery",
        overrides={"copay_percent": 20.0}
    )

    assert result["status"] == "CALCULATED"
    assert result["insurer_pays"] == 160000.0
    assert result["out_of_pocket"] == 90000.0


# -------------------------------------------------------------
# PDF Processing & Chunking Verification
# -------------------------------------------------------------
def test_sample_pdf_extraction_and_chunking():
    sample_pdf_path = os.path.join(backend_dir, "..", "samples", "sample_health_policy.pdf")
    assert os.path.exists(sample_pdf_path), "Sample policy PDF file must exist"

    pages, warnings = PDFProcessor.extract_from_path(sample_pdf_path)
    assert len(pages) == 4, f"Expected 4 pages, got {len(pages)}"
    for p in pages:
        assert p.has_text is True
        assert p.word_count > 20

    chunker = PageAwareChunker()
    chunks = chunker.chunk_pages(pages)
    assert len(chunks) >= 4
    # Ensure section headings are carried forward
    sections = [c.section for c in chunks]
    assert any("SECTION" in s.upper() or "SCHEDULE" in s.upper() or "BENEFIT" in s.upper() for s in sections)
    # Ensure page numbers are preserved
    chunk_pages = {c.page for c in chunks}
    assert 1 in chunk_pages
    assert 4 in chunk_pages
