# Starter Prompts สำหรับระบบ LEMCS

รวมคำสั่ง (Prompts) สำหรับให้ผู้ใช้ Copy-Paste ส่งให้ AI Agent (Gemini, Cursor, Copilot Workspace, Claude) เพื่อเริ่มพัฒนาระบบตามละ Phase อย่างถูกต้อง

## 🚀 เริ่มต้นโปรเจกต์ (Quickstart)
**คำอธิบาย:** ใช้เมื่อเพิ่ง clone โค้ดลงมาครั้งแรก
```text
/workflow quickstart
โปรดรันตัว Quickstart workflow ของระบบ LEMCS เพื่อ setup โครงสร้างเริ่มต้น (Docker, Backend, Frontend) และตรวจสอบว่าทุกส่วนทำงานได้อย่างถูกต้อง
```

## 🏗️ เริ่มพัฒนา Phase 1: Infrastructure & Auth
**คำอธิบาย:** เริ่มต้นระบบหลังบ้าน, ฐานข้อมูล, และระบบ Login
```text
/workflow phase1-infra
ฉันต้องการให้คุณเริ่มพัฒนา Phase 1 ของระบบ LEMCS (Infrastructure & Authentication)
1. ให้อ่านไฟล์ `docs/phase1-infrastructure.md` ก่อนทำ
2. ทำตาม Workflow ทีละขั้นตอน
3. ใช้ FastAPI สำหรับ Backend และ Next.js PWA สำหรับ Frontend
4. อย่าลืมรัน `docker-compose up -d` เบื้องหลัง
```

## 📝 เริ่มพัฒนา Phase 2: Assessment Engine
**คำอธิบาย:** สร้างระบบแบบประเมิน ST-5, PHQ-A, CDI และระบบคิดคะแนน
```text
/workflow phase2-assessment
เริ่มทำงาน Phase 2 ของ LEMCS (Assessment Engine) ได้เลย
- อ้างอิงเอกสารใน `docs/phase2-assessment-engine.md` และอ่านตรรกะการคิดคะแนนจาก `LEMCS_DEV.md`
- ระวังเรื่อง Suicide Risk (PHQ-A ข้อ 9)
- ทำหน้า UI (Mobile-First 375px) ให้สามารถทำแบบทดสอบได้ทีละข้อ (Slide animation)
```

## 📱 เริ่มพัฒนา Phase 3: PWA Frontend
**คำอธิบาย:** การตั้งค่า PWA และออกแบบหน้า Dashboard นักเรียน
```text
/workflow phase3-pwa
ดำเนินการต่อที่ Phase 3 ของ LEMCS (PWA Frontend)
- ทำให้อ่าน Spec จาก `docs/phase3-pwa-frontend.md`
- ต้องตั้งค่า PWA (manifest, service worker) ให้สามารถลงเครื่องและทำงาน Offline ได้
- หน้า Login และ Dashboard นักเรียนต้อง Responsive
```

## 📊 เริ่มพัฒนา Phase 4: Reporting Dashboard
**คำอธิบาย:** สร้างระบบรายงานสำหรับ Admin และการแยกสิทธิ์ (RBAC)
```text
/workflow phase4-reports
เริ่มต้นพัฒนาระบบรายงาน Phase 4 (Reporting Dashboard) 
- ให้อ่าน `docs/phase4-reporting.md`
- สร้างหน้า Dashboard สำหรับผู้บริหารและแอดมิน โดยใช้ Chart.js
- ข้อมูลต้องถูกกรอง (Filtered) ตาม Role ของผู้ที่ Login เข้ามา
- ระบบพิมพ์รายงานออกเป็น PDF (WeasyPrint) และ Excel
```

## 🚨 เริ่มพัฒนา Phase 5: Alert System
**คำอธิบาย:** ทำระบบแจ้งเตือนเมื่อนักเรียนมีความเสี่ยง (LINE Notify, In-app)
```text
/workflow phase5-alerts
เริ่มทำส่วนสุดท้ายของระบบ LEMCS: Phase 5 (Alert System & Notifications)
- ข้อมูลอยู่บน `docs/phase5-alerts.md`
- ต้องมีการส่ง LINE Notify ไปยังครู/ผู้บริหาร เมื่อเจอกรณีวิกฤต (Critical)
- สร้างหน้าระบบ Case Management (In-progress, closed)
- เตรียม Script ทำ Daily Backup
```

---

## 🛠️ Prompt สำหรับ Debug / ช่วยแก้ปัญหา
```text
โปรดอ่านไฟล์ SKILL.md และช่วยฉันหาสาเหตุของปัญหาในระบบ LEMCS ที่ฉันเจอตอนนี้:
[อธิบายปัญหาตรงนี้ เช่น: `นักเรียนทำ PHQ-A เสร็จแล้วหน้าจอขาว` ]

รบกวนเช็คไฟล์ log ใน Docker ให้ด้วย
```
