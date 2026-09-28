from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field

class Evidence(BaseModel):
    page: int
    section: str = "General"
    snippet: str

class ExtractedField(BaseModel):
    value: Any = None
    evidence: Optional[Evidence] = None
    confidence: str = "LOW"  # "HIGH", "MEDIUM", "LOW"
    source: str = "policy"   # "policy" or "user-provided"
    is_override: bool = False

class PolicyRules(BaseModel):
    sum_insured: ExtractedField = Field(default_factory=ExtractedField)
    coverage_limit: ExtractedField = Field(default_factory=ExtractedField)
    deductible: ExtractedField = Field(default_factory=ExtractedField)
    copay_percent: ExtractedField = Field(default_factory=ExtractedField)
    room_rent_limit_per_day: ExtractedField = Field(default_factory=ExtractedField)
    waiting_period_months: ExtractedField = Field(default_factory=ExtractedField)
    specific_waiting_periods: ExtractedField = Field(default_factory=lambda: ExtractedField(value={}))
    sub_limits: ExtractedField = Field(default_factory=lambda: ExtractedField(value={}))
    exclusions: ExtractedField = Field(default_factory=lambda: ExtractedField(value=[]))
    claim_requirements: ExtractedField = Field(default_factory=lambda: ExtractedField(value=[]))

class PageContent(BaseModel):
    page_number: int
    text: str
    char_count: int
    word_count: int
    has_text: bool
    warning: Optional[str] = None

class Chunk(BaseModel):
    chunk_id: str
    text: str
    page: int
    section: str

class UploadPolicyResponse(BaseModel):
    success: bool
    policy_id: str
    filename: str
    total_pages: int
    pages: List[PageContent]
    warnings: List[str] = []

class AskRequest(BaseModel):
    policy_id: str
    question: str

class AskResponse(BaseModel):
    answer: str
    coverage_status: str  # "COVERED", "POTENTIALLY_COVERED", "NOT_COVERED", "UNCLEAR"
    conditions: List[str] = []
    exclusions: List[str] = []
    evidence: List[Evidence] = []
    confidence: str = "LOW"  # "HIGH", "MEDIUM", "LOW"
    confidence_reason: str = ""
    missing_info: List[str] = []

class TreatmentCostItem(BaseModel):
    treatment: str
    city: str
    min_cost: float
    avg_cost: float
    max_cost: float

class CalculationStep(BaseModel):
    label: str
    amount: Optional[float] = None
    note: str
    source_page: Optional[int] = None

class EstimateRequest(BaseModel):
    policy_id: str
    treatment: str
    city: Optional[str] = None
    policy_age_months: int = 0
    room_rent_actual: Optional[float] = None
    overrides: Optional[Dict[str, Any]] = None

class CostBreakdownRange(BaseModel):
    treatment_cost: float
    insurer_pays: Optional[float] = None
    out_of_pocket: Optional[float] = None

class EstimateResponse(BaseModel):
    status: str  # "CALCULATED", "NOT_COVERED", "INSUFFICIENT_INFORMATION"
    treatment: str
    city: str
    is_national_average: bool = False
    base_cost: Optional[float] = None
    insurer_pays: Optional[float] = None
    out_of_pocket: Optional[float] = None
    is_eligible: bool = True
    steps: List[CalculationStep] = []
    missing_fields: List[str] = []
    message: Optional[str] = None
    ranges: Optional[Dict[str, CostBreakdownRange]] = None
