# Phase 2 — Assessment Engine
## LEMCS Developer Guide

> ก่อนอ่านไฟล์นี้: Phase 1 ต้องผ่าน checklist ครบแล้ว และอ่าน `LEMCS_DEV.md` แล้ว
> Scoring logic ครบถ้วนอยู่ใน `LEMCS_DEV.md` หัวข้อ "Scoring Logic"

---

## เป้าหมายของ Phase 2

- [x] Scoring service: ST-5, PHQ-A, CDI
- [x] Assessment API endpoints (available, start, autosave, submit)
- [x] หน้าทำแบบประเมิน (1 คำถาม/หน้า, mobile-first, slide animation)
- [x] Auto-save ทุก 30 วินาที
- [x] หน้าผลการประเมิน + crisis resources ถ้า suicide risk

---

## ขั้นตอน 1: Scoring Services

### backend/app/services/scoring/st5.py

```python
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
    score = sum(responses.get(f"q{i}", 0) for i in range(1, 6))
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
```

### backend/app/services/scoring/phqa.py

```python
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
    score = sum(responses.get(f"q{i}", 0) for i in range(1, 10))
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
        responses.get("q9", 0) >= 1 or
        responses.get("bq1", False) is True or
        responses.get("bq2", False) is True
    )

    return PHQAResult(score=score, severity_level=level, suicide_risk=suicide_risk)
```

### backend/app/services/scoring/cdi.py

```python
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
    return CDIResult(score=total, severity_level=level, suicide_risk=False)
```

### backend/app/services/scoring/__init__.py

```python
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
```

---

## ขั้นตอน 2: Assessment Router

### backend/app/routers/assessments.py

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_student
from app.schemas.assessment import (
    AssessmentSubmitRequest, AssessmentResponse, AutosaveRequest
)
from app.services.scoring import calculate_score
from app.services.alert_service import check_and_trigger_alert

router = APIRouter()

@router.get("/available")
async def get_available_assessments(
    current_user = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    """รายการแบบประเมินที่นักเรียนต้องทำในภาคเรียนนี้"""
    # Query assessments ที่ยังไม่ได้ทำในภาคเรียนปัจจุบัน
    # Return list ของ {type, name_th, question_count, estimated_minutes}
    ...

@router.post("/autosave")
async def autosave_draft(
    body: AutosaveRequest,
    current_user = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    """บันทึก draft อัตโนมัติ (ไม่คำนวณคะแนน)"""
    # บันทึกใน Redis: draft:{user_id}:{assessment_type}
    import redis.asyncio as aioredis
    import json
    from app.config import settings

    redis_client = aioredis.from_url(settings.REDIS_URL)
    await redis_client.setex(
        f"draft:{current_user.id}:{body.assessment_type}",
        3600,  # 1 ชั่วโมง
        json.dumps(body.responses)
    )
    return {"saved": True}

@router.post("/submit", response_model=AssessmentResponse)
async def submit_assessment(
    body: AssessmentSubmitRequest,
    current_user = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    """ส่งคำตอบ + คำนวณคะแนน + บันทึก + trigger alert"""

    # 1. คำนวณคะแนน
    result = calculate_score(body.assessment_type, body.responses)

    # 2. บันทึกลง database
    assessment = Assessment(
        student_id=current_user.id,
        assessment_type=body.assessment_type,
        responses=body.responses,
        score=result["score"],
        severity_level=result["severity_level"],
        suicide_risk=result.get("suicide_risk", False),
        academic_year=get_current_academic_year(),
        term=get_current_term(),
    )
    db.add(assessment)
    await db.flush()  # ได้ id

    # 3. ลบ draft
    await redis_client.delete(f"draft:{current_user.id}:{body.assessment_type}")

    # 4. Trigger alert (ถ้าจำเป็น)
    await check_and_trigger_alert(db, assessment, current_user)

    # 5. Return ผลทันที
    return AssessmentResponse(
        id=str(assessment.id),
        assessment_type=body.assessment_type,
        score=result["score"],
        severity_level=result["severity_level"],
        suicide_risk=result.get("suicide_risk", False),
        recommendations=get_recommendations(body.assessment_type, result["severity_level"]),
        created_at=assessment.created_at,
    )
```

### Pydantic Schemas

```python
# backend/app/schemas/assessment.py
from pydantic import BaseModel
from typing import Any
from datetime import datetime

class AssessmentSubmitRequest(BaseModel):
    assessment_type: str   # "ST5" | "PHQA" | "CDI"
    responses: dict[str, Any]  # {"q1": 2, "q2": 1, ...}

class AutosaveRequest(BaseModel):
    assessment_type: str
    responses: dict[str, Any]

class AssessmentResponse(BaseModel):
    id: str
    assessment_type: str
    score: int
    severity_level: str
    suicide_risk: bool
    recommendations: list[str]
    created_at: datetime
```

---

## ขั้นตอน 3: Alert Service

```python
# backend/app/services/alert_service.py
from app.models.db_models import Assessment, Alert, User
from app.services.notification_service import send_line_notify, send_email

ALERT_RULES = {
    "PHQA": {
        10: {"level": "warning",  "notify_roles": ["teacher", "counselor"]},
        15: {"level": "urgent",   "notify_roles": ["teacher", "counselor", "school_admin"]},
        20: {"level": "critical", "notify_roles": ["all"]},
    },
    "CDI": {
        15: {"level": "warning",  "notify_roles": ["teacher", "counselor"]},
        20: {"level": "urgent",   "notify_roles": ["teacher", "counselor", "school_admin"]},
    },
}

async def check_and_trigger_alert(db, assessment: Assessment, student):
    suicide_risk = assessment.suicide_risk

    # Suicide risk = ส่งทันที ไม่รอ
    if suicide_risk:
        await create_alert(db, assessment, "critical", ["all"], immediate=True)
        return

    rules = ALERT_RULES.get(assessment.assessment_type, {})
    triggered_config = None
    for threshold in sorted(rules.keys()):
        if assessment.score >= threshold:
            triggered_config = rules[threshold]

    if triggered_config:
        await create_alert(db, assessment, triggered_config["level"],
                          triggered_config["notify_roles"])

async def create_alert(db, assessment, level, notify_roles, immediate=False):
    alert = Alert(
        student_id=assessment.student_id,
        assessment_id=assessment.id,
        alert_level=level,
        status="new",
    )
    db.add(alert)
    await db.flush()

    # ดึงรายชื่อผู้รับแจ้งเตือน
    recipients = await get_notification_recipients(db, assessment.student_id, notify_roles)

    # ส่งแจ้งเตือน
    for recipient in recipients:
        message = build_alert_message(assessment, level, recipient)
        if recipient.line_token:
            await send_line_notify(recipient.line_token, message)
        if recipient.email:
            await send_email(recipient.email, "แจ้งเตือนนักเรียนต้องการความช่วยเหลือ", message)
```

---

## ขั้นตอน 4: คำแนะนำหลังประเมิน (Thai Language)

```python
# backend/app/services/recommendation_service.py

RECOMMENDATIONS = {
    "ST5": {
        "normal": [
            "คุณมีระดับความเครียดอยู่ในเกณฑ์ปกติ 😊",
            "ดูแลสุขภาพจิตต่อไป ออกกำลังกาย พักผ่อนให้เพียงพอ",
        ],
        "mild": [
            "คุณมีความเครียดเล็กน้อย ไม่ต้องกังวล",
            "ลองพักผ่อน ทำกิจกรรมที่ชอบ หรือคุยกับเพื่อนสนิท",
        ],
        "moderate": [
            "คุณมีระดับความเครียดปานกลาง",
            "แนะนำให้พูดคุยกับครูแนะแนวหรือผู้ปกครอง",
            "ฝึกหายใจลึกๆ และจัดการเวลาให้ดีขึ้น",
        ],
        "severe": [
            "คุณมีระดับความเครียดสูง",
            "⚠️ ควรพบครูแนะแนวโดยเร็วที่สุด",
            "หากรู้สึกไม่ไหว โทรสายด่วนสุขภาพจิต 1323 (24 ชั่วโมง)",
        ],
    },
    "PHQA": {
        "none": [
            "ไม่พบสัญญาณของภาวะซึมเศร้า 😊",
            "ดูแลสุขภาพจิตต่อไป นอนหลับพักผ่อนให้เพียงพอ",
        ],
        "mild": [
            "มีอาการเล็กน้อย ลองออกกำลังกายและพูดคุยกับคนที่ไว้ใจ",
        ],
        "moderate": [
            "แนะนำให้พบครูแนะแนวหรือนักจิตวิทยา",
            "อย่าอยู่คนเดียวนาน ทำกิจกรรมร่วมกับเพื่อน",
        ],
        "severe": [
            "⚠️ ควรพบผู้เชี่ยวชาญด้านสุขภาพจิตโดยเร็ว",
            "โทรสายด่วน 1323 ได้ตลอด 24 ชั่วโมง",
        ],
        "very_severe": [
            "🚨 กรุณาพบแพทย์หรือนักจิตวิทยาทันที",
            "โทรสายด่วนสุขภาพจิต 1323 หรือแจ้งผู้ปกครองทันที",
        ],
    },
    "CDI": {
        "normal": ["ไม่พบสัญญาณของภาวะซึมเศร้า ดูแลสุขภาพต่อไป 😊"],
        "clinical": [
            "⚠️ พบสัญญาณที่ควรได้รับการดูแลเพิ่มเติม",
            "ครูแนะแนวจะติดต่อมาเพื่อพูดคุยกับคุณเร็วๆ นี้",
            "หากรู้สึกไม่สบายใจ คุยกับครูหรือผู้ปกครองได้เลย",
        ],
    },
}

CRISIS_RESOURCES = [
    "📞 สายด่วนสุขภาพจิต: **1323** (24 ชั่วโมง)",
    "📞 สายด่วนช่วยเหลือเด็ก: **1387**",
    "📞 กรมสุขภาพจิต: **02-149-5555**",
]

def get_recommendations(assessment_type: str, severity_level: str) -> list[str]:
    return RECOMMENDATIONS.get(assessment_type, {}).get(severity_level, [])
```

---

## ขั้นตอน 5: Frontend — หน้าทำแบบประเมิน

### app/(student)/assess/[type]/page.tsx

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import QuestionCard from "@/components/assessment/QuestionCard";
import ProgressBar from "@/components/assessment/ProgressBar";
import { useAssessmentQuestions } from "@/hooks/useAssessmentQuestions";
import { api } from "@/lib/api";

export default function AssessmentPage() {
  const router = useRouter();
  const { type } = useParams<{ type: string }>();
  const { questions, isLoading } = useAssessmentQuestions(type);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, number | string | boolean>>({});
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-save ทุก 30 วินาที
  useEffect(() => {
    const interval = setInterval(async () => {
      if (Object.keys(responses).length > 0) {
        await api.post("/assessments/autosave", { assessment_type: type, responses });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [responses, type]);

  // Save เมื่อออกจากหน้า
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (Object.keys(responses).length > 0) {
        await api.post("/assessments/autosave", { assessment_type: type, responses });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [responses, type]);

  const handleAnswer = useCallback((questionKey: string, value: number | string | boolean) => {
    setResponses(prev => ({ ...prev, [questionKey]: value }));

    // Animation แล้วไปคำถามถัดไป
    setIsAnimating(true);
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
      setIsAnimating(false);
    }, 300);
  }, [currentIndex, questions.length]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await api.post("/assessments/submit", {
        assessment_type: type,
        responses,
      });
      router.push(`/result/${result.data.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><span className="loading loading-spinner loading-lg text-primary" /></div>;

  const currentQuestion = questions[currentIndex];

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      {/* Progress Bar */}
      <ProgressBar current={currentIndex + 1} total={questions.length} />

      {/* Question Card */}
      <div className={`flex-1 flex items-center justify-center p-4 transition-all duration-300 ${isAnimating ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}`}>
        <QuestionCard
          question={currentQuestion}
          questionNumber={currentIndex + 1}
          onAnswer={handleAnswer}
          selectedValue={responses[currentQuestion?.key]}
        />
      </div>

      {/* ปุ่ม Submit (แสดงที่คำถามสุดท้าย) */}
      {currentIndex === questions.length - 1 && (
        <div className="p-4">
          <button
            className="btn btn-primary btn-block btn-lg"
            onClick={handleSubmit}
            disabled={isSubmitting || Object.keys(responses).length < questions.length}
          >
            {isSubmitting ? <span className="loading loading-spinner" /> : "ส่งคำตอบ"}
          </button>
        </div>
      )}
    </div>
  );
}
```

### components/assessment/QuestionCard.tsx

```typescript
interface QuestionCardProps {
  question: {
    key: string;
    text: string;
    options: { label: string; value: number | string | boolean }[];
  };
  questionNumber: number;
  onAnswer: (key: string, value: number | string | boolean) => void;
  selectedValue?: number | string | boolean;
}

export default function QuestionCard({ question, questionNumber, onAnswer, selectedValue }: QuestionCardProps) {
  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-lg">
      <div className="card-body gap-6">
        <p className="text-sm text-base-content/60">ข้อ {questionNumber}</p>
        <h2 className="text-xl font-semibold text-base-content leading-relaxed">
          {question.text}
        </h2>

        <div className="flex flex-col gap-3">
          {question.options.map((option) => (
            <button
              key={String(option.value)}
              className={`btn btn-lg justify-start text-left normal-case ${
                selectedValue === option.value
                  ? "btn-primary"
                  : "btn-outline"
              }`}
              onClick={() => onAnswer(question.key, option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## ขั้นตอน 6: หน้าผลการประเมิน

### app/(student)/result/[id]/page.tsx

```typescript
import { notFound } from "next/navigation";
import ResultCard from "@/components/assessment/ResultCard";
import CrisisResources from "@/components/assessment/CrisisResources";
import { getAssessmentResult } from "@/lib/api";

export default async function ResultPage({ params }: { params: { id: string } }) {
  const result = await getAssessmentResult(params.id);
  if (!result) notFound();

  return (
    <div className="min-h-screen bg-base-200 p-4 flex flex-col gap-4">
      {/* ⚠️ Suicide Risk: แสดง crisis resources เป็นอันดับแรก */}
      {result.suicide_risk && <CrisisResources urgent={true} />}

      <ResultCard result={result} />

      {/* ปุ่มกลับหน้าหลัก */}
      <a href="/dashboard" className="btn btn-outline btn-block">
        กลับหน้าหลัก
      </a>
    </div>
  );
}
```

### components/assessment/CrisisResources.tsx

```typescript
interface CrisisResourcesProps {
  urgent?: boolean;
}

export default function CrisisResources({ urgent = false }: CrisisResourcesProps) {
  return (
    <div className={`alert ${urgent ? "alert-error" : "alert-warning"} flex flex-col items-start gap-2`}>
      <h3 className="font-bold text-lg">
        {urgent ? "🚨 ขอความช่วยเหลือทันที" : "💙 เราพร้อมช่วยเหลือคุณ"}
      </h3>
      <ul className="list-none space-y-2 w-full">
        <li>
          <a href="tel:1323" className="btn btn-error btn-block text-white">
            📞 สายด่วนสุขภาพจิต 1323 (24 ชั่วโมง)
          </a>
        </li>
        <li>
          <a href="tel:1387" className="btn btn-outline btn-block">
            📞 สายด่วนช่วยเหลือเด็ก 1387
          </a>
        </li>
      </ul>
      <p className="text-sm opacity-80">คุณไม่ได้อยู่คนเดียว มีคนพร้อมช่วยเหลือคุณเสมอ</p>
    </div>
  );
}
```

---

## ข้อมูลคำถาม (ต้อง hardcode ใน frontend สำหรับ offline)

```typescript
// frontend/lib/questions.ts

export const ASSESSMENT_QUESTIONS = {
  ST5: [
    { key: "q1", text: "คุณรู้สึกไม่สบายใจ กังวล หรือเครียดบ้างไหม?",
      options: [{label:"ไม่เลย",value:0},{label:"บางครั้ง",value:1},{label:"บ่อยครั้ง",value:2},{label:"เกือบทุกวัน",value:3}] },
    { key: "q2", text: "คุณรู้สึกหงุดหงิด รำคาญใจ หรือโกรธง่ายบ้างไหม?",
      options: [{label:"ไม่เลย",value:0},{label:"บางครั้ง",value:1},{label:"บ่อยครั้ง",value:2},{label:"เกือบทุกวัน",value:3}] },
    { key: "q3", text: "คุณรู้สึกเหนื่อยในการใช้ชีวิตหรือรู้สึกว่าตัวเองมีภาระมากเกินไปบ้างไหม?",
      options: [{label:"ไม่เลย",value:0},{label:"บางครั้ง",value:1},{label:"บ่อยครั้ง",value:2},{label:"เกือบทุกวัน",value:3}] },
    { key: "q4", text: "คุณมีปัญหาการนอนหลับ เช่น นอนไม่หลับ ตื่นกลางดึก หรือหลับมากผิดปกติบ้างไหม?",
      options: [{label:"ไม่เลย",value:0},{label:"บางครั้ง",value:1},{label:"บ่อยครั้ง",value:2},{label:"เกือบทุกวัน",value:3}] },
    { key: "q5", text: "คุณรู้สึกว่าความเครียดส่งผลต่อการเรียน การใช้ชีวิต หรือความสัมพันธ์กับคนรอบข้างบ้างไหม?",
      options: [{label:"ไม่เลย",value:0},{label:"บางครั้ง",value:1},{label:"บ่อยครั้ง",value:2},{label:"เกือบทุกวัน",value:3}] },
  ],

  PHQA: [
    { key: "q1", text: "รู้สึกหมดความสนใจหรือไม่มีความสุขในการทำสิ่งต่างๆ",
      options: [{label:"ไม่มีเลย",value:0},{label:"มีบางวัน",value:1},{label:"มีบ่อย",value:2},{label:"มีเกือบทุกวัน",value:3}] },
    { key: "q2", text: "รู้สึกหดหู่ เศร้า หรือสิ้นหวัง",
      options: [{label:"ไม่มีเลย",value:0},{label:"มีบางวัน",value:1},{label:"มีบ่อย",value:2},{label:"มีเกือบทุกวัน",value:3}] },
    { key: "q3", text: "นอนหลับยาก หรือหลับๆ ตื่นๆ หรือหลับมากเกินไป",
      options: [{label:"ไม่มีเลย",value:0},{label:"มีบางวัน",value:1},{label:"มีบ่อย",value:2},{label:"มีเกือบทุกวัน",value:3}] },
    { key: "q4", text: "รู้สึกเหนื่อยง่าย หรือไม่มีแรง",
      options: [{label:"ไม่มีเลย",value:0},{label:"มีบางวัน",value:1},{label:"มีบ่อย",value:2},{label:"มีเกือบทุกวัน",value:3}] },
    { key: "q5", text: "เบื่ออาหาร หรือกินมากเกินไป",
      options: [{label:"ไม่มีเลย",value:0},{label:"มีบางวัน",value:1},{label:"มีบ่อย",value:2},{label:"มีเกือบทุกวัน",value:3}] },
    { key: "q6", text: "รู้สึกแย่กับตัวเอง หรือรู้สึกว่าตัวเองล้มเหลว หรือทำให้ครอบครัวผิดหวัง",
      options: [{label:"ไม่มีเลย",value:0},{label:"มีบางวัน",value:1},{label:"มีบ่อย",value:2},{label:"มีเกือบทุกวัน",value:3}] },
    { key: "q7", text: "มีสมาธิในการทำสิ่งต่างๆ ยากขึ้น เช่น อ่านหนังสือหรือดูทีวี",
      options: [{label:"ไม่มีเลย",value:0},{label:"มีบางวัน",value:1},{label:"มีบ่อย",value:2},{label:"มีเกือบทุกวัน",value:3}] },
    { key: "q8", text: "เคลื่อนไหวหรือพูดช้าลง หรือกระสับกระส่าย อยู่ไม่นิ่ง",
      options: [{label:"ไม่มีเลย",value:0},{label:"มีบางวัน",value:1},{label:"มีบ่อย",value:2},{label:"มีเกือบทุกวัน",value:3}] },
    { key: "q9", text: "คิดว่าตายไปแล้วจะดีกว่า หรือคิดอยากทำร้ายตัวเอง",
      options: [{label:"ไม่มีเลย",value:0},{label:"มีบางวัน",value:1},{label:"มีบ่อย",value:2},{label:"มีเกือบทุกวัน",value:3}] },
    // Bonus Questions
    { key: "bq1", text: "ในปีที่ผ่านมา คุณเคยคิดอยากฆ่าตัวตายหรือไม่?",
      options: [{label:"ไม่ใช่",value:false},{label:"ใช่",value:true}] },
    { key: "bq2", text: "ในปีที่ผ่านมา คุณเคยพยายามฆ่าตัวตายหรือไม่?",
      options: [{label:"ไม่ใช่",value:false},{label:"ใช่",value:true}] },
  ],
  // CDI — 27 ข้อ ครบถ้วน
  CDI: [
    { key: "q1", text: "ข้อ 1", options: [{label:"ก. ฉันรู้สึกเศร้าบางครั้ง",value:"ก"},{label:"ข. ฉันรู้สึกเศร้าบ่อยๆ",value:"ข"},{label:"ค. ฉันรู้สึกเศร้าตลอดเวลา",value:"ค"}] },
    { key: "q2", text: "ข้อ 2", options: [{label:"ก. ไม่มีอะไรดีเลย",value:"ก"},{label:"ข. ฉันไม่แน่ใจว่าอะไรจะดีขึ้น",value:"ข"},{label:"ค. อะไรๆ จะดีขึ้นสำหรับฉัน",value:"ค"}] },
    { key: "q3", text: "ข้อ 3", options: [{label:"ก. ฉันทำสิ่งต่างๆ ได้ดีเกือบทุกอย่าง",value:"ก"},{label:"ข. ฉันทำผิดพลาดหลายอย่าง",value:"ข"},{label:"ค. ฉันทำทุกอย่างผิดหมด",value:"ค"}] },
    { key: "q4", text: "ข้อ 4", options: [{label:"ก. ฉันสนุกกับหลายสิ่ง",value:"ก"},{label:"ข. ฉันสนุกกับบางสิ่ง",value:"ข"},{label:"ค. ไม่มีอะไรสนุกเลย",value:"ค"}] },
    { key: "q5", text: "ข้อ 5", options: [{label:"ก. ฉันเป็นคนเลวตลอดเวลา",value:"ก"},{label:"ข. ฉันเป็นคนเลวบ่อยครั้ง",value:"ข"},{label:"ค. ฉันเป็นคนเลวบางครั้ง",value:"ค"}] },
    { key: "q6", text: "ข้อ 6", options: [{label:"ก. ฉันแทบไม่เคยคิดว่าจะมีอะไรร้ายเกิดกับฉัน",value:"ก"},{label:"ข. ฉันกังวลว่าจะมีอะไรร้ายเกิดกับฉัน",value:"ข"},{label:"ค. ฉันแน่ใจว่าจะมีอะไรร้ายเกิดกับฉัน",value:"ค"}] },
    { key: "q7", text: "ข้อ 7", options: [{label:"ก. ฉันเกลียดตัวเอง",value:"ก"},{label:"ข. ฉันไม่ชอบตัวเอง",value:"ข"},{label:"ค. ฉันชอบตัวเอง",value:"ค"}] },
    { key: "q8", text: "ข้อ 8", options: [{label:"ก. สิ่งร้ายๆ ทั้งหมดเป็นความผิดของฉัน",value:"ก"},{label:"ข. สิ่งร้ายๆ หลายอย่างเป็นความผิดของฉัน",value:"ข"},{label:"ค. สิ่งร้ายๆ มักไม่ใช่ความผิดของฉัน",value:"ค"}] },
    { key: "q9", text: "ข้อ 9", options: [{label:"ก. ฉันไม่ได้คิดเรื่องตาย",value:"ก"},{label:"ข. ฉันคิดเรื่องตายแต่ไม่อยากทำ",value:"ข"},{label:"ค. ฉันอยากตาย",value:"ค"}] },
    { key: "q10", text: "ข้อ 10", options: [{label:"ก. ฉันอยากร้องไห้ทุกวัน",value:"ก"},{label:"ข. ฉันอยากร้องไห้บ่อยๆ",value:"ข"},{label:"ค. ฉันอยากร้องไห้เป็นบางครั้ง",value:"ค"}] },
    { key: "q11", text: "ข้อ 11", options: [{label:"ก. มีบางอย่างกวนใจฉันตลอดเวลา",value:"ก"},{label:"ข. มีบางอย่างกวนใจฉันบ่อย",value:"ข"},{label:"ค. มีบางอย่างกวนใจฉันเป็นบางครั้ง",value:"ค"}] },
    { key: "q12", text: "ข้อ 12", options: [{label:"ก. ฉันชอบอยู่กับคนอื่น",value:"ก"},{label:"ข. ฉันไม่อยากอยู่กับคนอื่นบ่อย",value:"ข"},{label:"ค. ฉันไม่อยากอยู่กับใครเลย",value:"ค"}] },
    { key: "q13", text: "ข้อ 13", options: [{label:"ก. ฉันตัดสินใจไม่ได้",value:"ก"},{label:"ข. ฉันตัดสินใจได้ยาก",value:"ข"},{label:"ค. ฉันตัดสินใจได้ง่าย",value:"ค"}] },
    { key: "q14", text: "ข้อ 14", options: [{label:"ก. ฉันมีรูปร่างหน้าตาดี",value:"ก"},{label:"ข. มีบางอย่างเกี่ยวกับรูปร่างหน้าตาที่ฉันไม่ชอบ",value:"ข"},{label:"ค. ฉันดูน่าเกลียด",value:"ค"}] },
    { key: "q15", text: "ข้อ 15", options: [{label:"ก. ฉันต้องบังคับตัวเองตลอดเวลาให้ทำการบ้าน",value:"ก"},{label:"ข. ฉันต้องบังคับตัวเองบ่อยๆ ให้ทำการบ้าน",value:"ข"},{label:"ค. การทำการบ้านไม่ใช่ปัญหาสำหรับฉัน",value:"ค"}] },
    { key: "q16", text: "ข้อ 16", options: [{label:"ก. ฉันนอนหลับยากทุกคืน",value:"ก"},{label:"ข. ฉันนอนหลับยากหลายคืน",value:"ข"},{label:"ค. ฉันนอนหลับได้ดี",value:"ค"}] },
    { key: "q17", text: "ข้อ 17", options: [{label:"ก. ฉันเหนื่อยบางครั้ง",value:"ก"},{label:"ข. ฉันเหนื่อยบ่อย",value:"ข"},{label:"ค. ฉันเหนื่อยตลอดเวลา",value:"ค"}] },
    { key: "q18", text: "ข้อ 18", options: [{label:"ก. เกือบทุกวันฉันไม่อยากกินอาหาร",value:"ก"},{label:"ข. หลายวันฉันไม่อยากกินอาหาร",value:"ข"},{label:"ค. ฉันกินได้ดีปกติ",value:"ค"}] },
    { key: "q19", text: "ข้อ 19", options: [{label:"ก. ฉันไม่กังวลเรื่องเจ็บปวดต่างๆ",value:"ก"},{label:"ข. ฉันกังวลเรื่องเจ็บปวดบ่อย",value:"ข"},{label:"ค. ฉันกังวลเรื่องเจ็บปวดตลอดเวลา",value:"ค"}] },
    { key: "q20", text: "ข้อ 20", options: [{label:"ก. ฉันไม่รู้สึกเหงา",value:"ก"},{label:"ข. ฉันรู้สึกเหงาบ่อย",value:"ข"},{label:"ค. ฉันรู้สึกเหงาตลอดเวลา",value:"ค"}] },
    { key: "q21", text: "ข้อ 21", options: [{label:"ก. ฉันไม่เคยสนุกกับโรงเรียน",value:"ก"},{label:"ข. ฉันสนุกกับโรงเรียนเป็นบางครั้ง",value:"ข"},{label:"ค. ฉันสนุกกับโรงเรียนบ่อย",value:"ค"}] },
    { key: "q22", text: "ข้อ 22", options: [{label:"ก. ฉันมีเพื่อนหลายคน",value:"ก"},{label:"ข. ฉันมีเพื่อนบ้างแต่อยากมีมากกว่านี้",value:"ข"},{label:"ค. ฉันไม่มีเพื่อนเลย",value:"ค"}] },
    { key: "q23", text: "ข้อ 23", options: [{label:"ก. การเรียนของฉันดี",value:"ก"},{label:"ข. การเรียนของฉันไม่ดีเหมือนแต่ก่อน",value:"ข"},{label:"ค. ฉันเรียนแย่มากในวิชาที่เคยเรียนได้ดี",value:"ค"}] },
    { key: "q24", text: "ข้อ 24", options: [{label:"ก. ฉันไม่มีทางเก่งเท่าเด็กคนอื่นๆ",value:"ก"},{label:"ข. ฉันเก่งเท่าเด็กคนอื่นๆ ถ้าฉันต้องการ",value:"ข"},{label:"ค. ฉันเก่งเท่าเด็กคนอื่นๆ",value:"ค"}] },
    { key: "q25", text: "ข้อ 25", options: [{label:"ก. ไม่มีใครรักฉันจริงๆ",value:"ก"},{label:"ข. ฉันไม่แน่ใจว่ามีใครรักฉัน",value:"ข"},{label:"ค. ฉันแน่ใจว่ามีคนรักฉัน",value:"ค"}] },
    { key: "q26", text: "ข้อ 26", options: [{label:"ก. ฉันทำตามที่คนอื่นบอกเสมอ",value:"ก"},{label:"ข. ฉันไม่ค่อยทำตามที่คนอื่นบอก",value:"ข"},{label:"ค. ฉันไม่เคยทำตามที่คนอื่นบอก",value:"ค"}] },
    { key: "q27", text: "ข้อ 27", options: [{label:"ก. ฉันเข้ากับคนอื่นได้ดี",value:"ก"},{label:"ข. ฉันทะเลาะกับคนอื่นบ่อย",value:"ข"},{label:"ค. ฉันทะเลาะกับคนอื่นตลอดเวลา",value:"ค"}] },
  ],
};
```

> **⚠️ คำถาม CDI ด้านบน**: ข้อความแต่ละข้ออาจต้องปรับตาม PDF ต้นฉบับ (`assessments/cdi.pdf`)
> AI Agent: ให้อ่านไฟล์ `cdi.pdf` แล้วเปรียบเทียบข้อความก่อน deploy

---

## ขั้นตอน 7: ProgressBar Component

### components/assessment/ProgressBar.tsx

```typescript
interface ProgressBarProps {
  current: number;  // ข้อปัจจุบัน (1-indexed)
  total: number;    // จำนวนข้อทั้งหมด
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className="sticky top-0 bg-base-100 z-10 px-4 py-3 border-b border-base-200">
      <div className="flex justify-between text-xs text-base-content/60 mb-1">
        <span>ข้อ {current} / {total}</span>
        <span>{percentage}%</span>
      </div>
      <progress
        className="progress progress-primary w-full"
        value={current}
        max={total}
      />
    </div>
  );
}
```

---

## ขั้นตอน 8: ResultCard Component

### components/assessment/ResultCard.tsx

```typescript
const SEVERITY_STYLES: Record<string, { bg: string; badge: string; emoji: string }> = {
  normal:      { bg: "bg-success/10", badge: "badge-success", emoji: "😊" },
  none:        { bg: "bg-success/10", badge: "badge-success", emoji: "😊" },
  mild:        { bg: "bg-info/10",    badge: "badge-info",    emoji: "🙂" },
  moderate:    { bg: "bg-warning/10", badge: "badge-warning", emoji: "😟" },
  severe:      { bg: "bg-error/10",   badge: "badge-error",   emoji: "😔" },
  very_severe: { bg: "bg-error/10",   badge: "badge-error",   emoji: "😢" },
  clinical:    { bg: "bg-error/10",   badge: "badge-error",   emoji: "😔" },
};

const SEVERITY_LABELS: Record<string, string> = {
  normal: "ปกติ", none: "ไม่มีอาการ", mild: "น้อย",
  moderate: "ปานกลาง", severe: "มาก", very_severe: "รุนแรงมาก",
  clinical: "ต้องเข้ารับการดูแล",
};

const ASSESSMENT_NAMES: Record<string, string> = {
  ST5: "แบบประเมินความเครียด (ST-5)",
  PHQA: "แบบประเมินภาวะซึมเศร้า (PHQ-A)",
  CDI: "แบบประเมินภาวะซึมเศร้า (CDI)",
};

interface ResultCardProps {
  result: {
    assessment_type: string;
    score: number;
    severity_level: string;
    suicide_risk: boolean;
    recommendations: string[];
    created_at: string;
  };
}

export default function ResultCard({ result }: ResultCardProps) {
  const style = SEVERITY_STYLES[result.severity_level] || SEVERITY_STYLES.moderate;

  return (
    <div className={`card shadow-xl ${style.bg}`}>
      <div className="card-body items-center text-center gap-4">
        <span className="text-5xl">{style.emoji}</span>

        <h2 className="text-lg font-bold">
          {ASSESSMENT_NAMES[result.assessment_type]}
        </h2>

        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold">{result.score}</span>
          <span className="text-base-content/60 text-sm">คะแนน</span>
        </div>

        <span className={`badge ${style.badge} badge-lg gap-1`}>
          {SEVERITY_LABELS[result.severity_level]}
        </span>

        {/* คำแนะนำ */}
        {result.recommendations.length > 0 && (
          <div className="text-left w-full mt-4 space-y-2">
            <h3 className="font-semibold text-sm">คำแนะนำ:</h3>
            <ul className="space-y-1">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-base-content/80 flex gap-2">
                  <span>•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-base-content/40 mt-2">
          ประเมินเมื่อ {new Date(result.created_at).toLocaleDateString("th-TH", {
            year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
          })}
        </p>
      </div>
    </div>
  );
}
```

---

## ขั้นตอน 9: Available Assessments Endpoint (Complete)

```python
# backend/app/routers/assessments.py — get_available (เพิ่ม implementation)

from sqlalchemy import select, and_
from app.models.db_models import Assessment

ASSESSMENT_INFO = {
    "ST5":  {"name_th": "แบบประเมินความเครียด (ST-5)",      "question_count": 5,  "estimated_minutes": 5},
    "PHQA": {"name_th": "แบบประเมินภาวะซึมเศร้า (PHQ-A)", "question_count": 11, "estimated_minutes": 8},
    "CDI":  {"name_th": "แบบประเมินภาวะซึมเศร้า (CDI)",     "question_count": 27, "estimated_minutes": 10},
}

@router.get("/available")
async def get_available_assessments(
    current_user = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    academic_year = get_current_academic_year()
    term = get_current_term()

    # ดึง assessment ที่นักเรียน เคยทำไปแล้ว ในภาคเรียนนี้
    result = await db.execute(
        select(Assessment.assessment_type).where(
            and_(
                Assessment.student_id == current_user.id,
                Assessment.academic_year == academic_year,
                Assessment.term == term,
            )
        )
    )
    completed_types = {row[0] for row in result.fetchall()}

    # ทุก type ที่ยังไม่ได้ทำ
    available = []
    for atype, info in ASSESSMENT_INFO.items():
        if atype not in completed_types:
            available.append({"type": atype, **info})

    return available

def get_current_academic_year() -> str:
    """
    ปีการศึกษาไทย: มิ.ย. 2567 — มี.ค. 2568 = ปีการศึกษา 2567
    """
    from datetime import datetime
    now = datetime.now()
    year = now.year + 543  # แปลง ค.ศ. → พ.ศ.
    if now.month < 6:      # ก่อนมิถุนายน = ยังเป็นปีก่อน
        year -= 1
    return str(year)

def get_current_term() -> int:
    """ภาคเรียนที่ 1 = มิ.ย.-ต.ค., ภาคเรียนที่ 2 = พ.ย.-มี.ค."""
    from datetime import datetime
    month = datetime.now().month
    return 1 if 6 <= month <= 10 else 2
```

---

## Checklist Phase 2

- [ ] `score_st5({"q1":3,"q2":3,"q3":3,"q4":3,"q5":3})` → score=15, level="severe"
- [ ] `score_st5({"q1":0,"q2":1,"q3":1,"q4":0,"q5":0})` → score=2, level="normal"
- [ ] `score_phqa({"q9":1})` → suicide_risk=True
- [ ] `score_phqa({"bq1":True})` → suicide_risk=True
- [ ] `score_phqa({"q1":3,"q2":3,"q3":3,"q4":3,"q5":3,"q6":3,"q7":3,"q8":3,"q9":0})` → score=24, level="very_severe"
- [ ] `score_cdi({"q1":"ค","q2":"ก",...})` → ใช้ group A/B scoring ถูกต้อง
- [ ] CDI group A ข้อ 1: ก=0, ข=1, ค=2 ✓
- [ ] CDI group B ข้อ 2: ก=2, ข=1, ค=0 ✓
- [ ] GET /assessments/available → return เฉพาะ type ที่ยังไม่ได้ทำ
- [ ] POST /assessments/submit → return score + severity_level ทันที
- [ ] Suicide risk → alert level "critical" ถูก create ทันที
- [ ] Auto-save ทำงานทุก 30 วินาที (ตรวจใน Redis)
- [ ] หน้าทำแบบประเมิน → แสดง 1 คำถามต่อหน้าจอ บนมือถือ 375px
- [ ] ProgressBar แสดงจำนวนข้อถูกต้อง
- [ ] หน้าผลการประเมิน → ResultCard แสดง score + severity + recommendations
- [ ] หน้าผลการประเมิน → แสดง crisis resources เมื่อ suicide_risk=True
- [ ] CDI คำถาม 27 ข้อ ครบ + ข้อความตรงกับ PDF ต้นฉบับ
