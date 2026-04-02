from pydantic import BaseModel
from typing import Any, Dict, List
from datetime import datetime

class AssessmentSubmitRequest(BaseModel):
    assessment_type: str   # "ST5" | "PHQA" | "CDI"
    responses: Dict[str, Any]  # {"q1": 2, "q2": 1, ...}

class AutosaveRequest(BaseModel):
    assessment_type: str
    responses: Dict[str, Any]

class AssessmentResponse(BaseModel):
    id: str
    assessment_type: str
    score: int
    severity_level: str
    suicide_risk: bool
    recommendations: List[str]
    created_at: datetime
