---
description: LEMCS Quickstart Setup
---

# LEMCS Quickstart Workflow

ใช้สำหรับรัน Project ครั้งแรกหลังจาก Clone โค้ดลงมา

1. **คัดลอกไฟล์ Environment Variables**:
   // turbo
   `cp .env.example .env`
2. **แจ้ง User ให้ตั้งค่า Secrets ใน .env**: รบกวน User เติม Token/Password ในไฟล์ .env ด้วยตนเอง
3. **Build Backend และ Frontend Containers**:
   // turbo
   `docker-compose build --no-cache`
4. **นำระบบทั้งหมดขึ้นมา (Bring up All Services)**:
   // turbo
   `docker-compose up -d`
5. **รอ 10 วินาทีและเช็คสถานะการเข้าถึงฐานข้อมูล**:
   // turbo
   `docker-compose ps` และดูว่ามีคอนเทนเนอร์ตัวใดหยุดไปไหม
6. **ทำการนำ Alembic Model ขึ้น Database**:
   // turbo
   `docker-compose exec backend alembic upgrade head`
7. **ทดสอบ Health Endpoint**:
   // turbo
   `curl -s http://localhost:8000/health` (คาดหวังว่าจะได้ { "status": "ok" })
