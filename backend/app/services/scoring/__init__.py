from app.services.scoring.st5 import score_st5
from app.services.scoring.phqa import score_phqa
from app.services.scoring.cdi import score_cdi

SCORERS = {
    "ST5": score_st5,
    "PHQA": score_phqa,
    "CDI": score_cdi,
}

def calculate_score(assessment_type: str, responses: dict) -> dict:
    scorer = SCORERS.get(assessment_type.upper())
    if not scorer:
        raise ValueError(f"ไม่รู้จักประเภทแบบประเมิน: {assessment_type}")
    return scorer(responses)
