---
description: LEMCS Phase 1 — Infrastructure & Auth Setup
---

# Phase 1 Workflow: Infrastructure & Auth

ทำตามขั้นตอนเหล่านี้ทีละข้อ (Step-by-Step) ห้ามข้าม:

1. **อ่านสเปคและเตรียมความพร้อม**: เปิดไฟล์ `docs/phase1-infrastructure.md` และทบทวนโครงสร้างที่ต้องการ
2. **สร้างไฟลสำคัญ์**:
   - `docker-compose.yml` (Nginx, API, DB, Minio, Redis)
   - `.env.example` เตรียมตัวแปรแวดล้อม
3. **กำหนดฐานข้อมูล (Database)**:
   - สร้าง script Migration หรือไฟล์ SQLAlchemy ORM Models ให้ครบถ้วนตามเอกสาร
   - ทำระบบ Auth และ Router เบื้องต้นใน FastAPI
4. **ขึ้นระบบ (Bring up Infrastructure)**:
   // turbo
   รันคำสั่ง `docker-compose up -d --build` ใน Terminal
5. **ตรวจสอบความพร้อม (Health Check)**:
   // turbo
   ทดสอบ request ไปที่ `GET http://localhost:8000/health` ว่าคืนค่าสถานะ `200 OK`
6. **ทำแบบฟอร์มหน้า Login**:
   สร้าง `frontend/app/(auth)/login/page.tsx` ด้วย DaisyUI (เน้น Responsive มือถือ 375px)
7. **แจ้งผล (Report)**: แจ้ง User เมื่อทุกอย่างเสร็จสมบูรณ์ และขออนุญาตข้ามไป Phase ถัดไป
