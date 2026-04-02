from typing import TypedDict

# ข้อที่ใช้: ก=0, ข=1, ค=2
CDI_GROUP_A = {1, 3, 4, 6, 9, 12, 14, 17, 19, 20, 22, 23, 26, 27}

# ข้อที่กลับด้าน: ก=2, ข=1, ค=0
CDI_GROUP_B = {2, 5, 7, 8, 10, 11, 13, 15, 16, 18, 21, 24, 25}

SCORE_MAP_A = {"ก": 0, "ข": 1, "ค": 2}
SCORE_MAP_B = {"ก": 2, "ข": 1, "ค": 0}

class CDIResult(TypedDict):
    score: int
    severity_level: str   # normal | clinical
    suicide_risk: bool

def score_cdi(responses: dict) -> CDIResult:
    """
    responses = {"q1": "ก", "q2": "ข", ..., "q27": "ค"}
    27 ข้อ แบ่ง 2 กลุ่มคะแนน
    """
    total = 0
    for q_num in range(1, 28):
        answer = responses.get(f"q{q_num}", "ก")
        if q_num in CDI_GROUP_A:
            total += SCORE_MAP_A.get(answer, 0)
        else:
            total += SCORE_MAP_B.get(answer, 0)

    level = "clinical" if total >= 15 else "normal"
    
    # CDI ข้อ 9: "ก. ฉันไม่ได้คิดเรื่องตาย" (0), "ข. ฉันคิดเรื่องตายแต่ไม่อยากทำ" (1), "ค. ฉันอยากตาย" (2)
    # ถ้าตอบข้อ ค. ถือเป็น Suicide Risk
    suicide_risk = responses.get("q9", "ก") == "ค"

    return CDIResult(score=total, severity_level=level, suicide_risk=suicide_risk)
