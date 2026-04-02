from typing import TypedDict

class ST5Result(TypedDict):
    score: int
    severity_level: str   # normal | mild | moderate | severe
    suicide_risk: bool

def score_st5(responses: dict) -> ST5Result:
    """
    responses = {"q1": 0, "q2": 1, "q3": 2, "q4": 3, "q5": 1}
    คะแนนต่อข้อ: 0-3, รวมสูงสุด 15
    """
    score = sum(int(responses.get(f"q{i}", 0)) for i in range(1, 6))
    score = max(0, min(15, score))  # clamp

    if score <= 4:
        level = "normal"
    elif score <= 7:
        level = "mild"
    elif score <= 11:
        level = "moderate"
    else:
        level = "severe"

    return ST5Result(score=score, severity_level=level, suicide_risk=False)
