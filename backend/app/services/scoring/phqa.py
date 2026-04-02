from typing import TypedDict

class PHQAResult(TypedDict):
    score: int
    severity_level: str   # none | mild | moderate | severe | very_severe
    suicide_risk: bool

def score_phqa(responses: dict) -> PHQAResult:
    """
    responses = {"q1": 1, "q2": 0, ..., "q9": 0, "bq1": False, "bq2": False}
    คะแนนต่อข้อ q1-q9: 0-3, รวมสูงสุด 27
    bq1, bq2 = boolean (True = ใช่ = risk)
    """
    # คำนวณคะแนนหลัก (Q1-Q9 เท่านั้น)
    score = sum(int(responses.get(f"q{i}", 0)) for i in range(1, 10))
    score = max(0, min(27, score))

    if score <= 4:
        level = "none"
    elif score <= 9:
        level = "mild"
    elif score <= 14:
        level = "moderate"
    elif score <= 19:
        level = "severe"
    else:
        level = "very_severe"

    # ตรวจ suicide risk
    suicide_risk = (
        int(responses.get("q9", 0)) >= 1 or
        bool(responses.get("bq1", False)) is True or
        bool(responses.get("bq2", False)) is True
    )

    return PHQAResult(score=score, severity_level=level, suicide_risk=suicide_risk)
