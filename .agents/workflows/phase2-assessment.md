---
description: LEMCS Phase 2 — Assessment Engine
---

# Phase 2 Workflow: Assessment Engine

ระบบจะจัดการเกี่ยวกับแบบจำลองคะแนน แบบประเมินผล และหน้าทำแบบสอบถาม

1. **ทำความเข้าใจกฎของคะแนน (Scoring Logic)**: อ่านจาก `LEMCS_DEV.md` ให้เข้าใจว่า ST-5, PHQ-A และ CDI รวมคะแนนกันอย่างไร โดยเฉพาะ **Suicide Risk**
2. **สร้าง Scoring API**: สร้างไฟล์ Python รับผิดชอบการให้คะแนน ST5, PHQA, CDI
3. **สร้าง Database endpoints**:
   - `GET /api/assessments/available`
   - `POST /api/assessments/submit`
   - อัพเดทคะแนนลงใน Table Assessments ของ PostgreSQL
4. **ทำหน้าจอแบบประเมิน (Frontend)**:
   - สลับหน้าข้อคำถาม (1 ข้อหน้าเดียว)
   - มี Progress Bar (`ProgressBar.tsx`) ด้านบน
5. **หน้าแสดงผล**:
   - หน้า `ResultCard.tsx` โชว์ระดับความเสี่ยงด้วยสีต่างๆ
6. **อัพเดท Task Progress**: รายงานความคืบหน้าให้ผู้ใช้ทราบ
