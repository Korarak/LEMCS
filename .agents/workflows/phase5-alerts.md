---
description: LEMCS Phase 5 — Alert System & Notifications
---

# Phase 5 Workflow: Alert System 🚨 ระบบแจ้งเตือนผู้ป่วยวิกฤต

สร้างระบบตั้งเตือนตามความเสี่ยงของผู้เรียน
1. **จัดทำแจ้งเตือน**: 
   - รับ Trigger ตรรกะคะแนน PHQ-A กับ CDI
   - "Critical" สำหรับนักเรียนคะแนนสูงลิ่ว หรือเสี่ยงทำร้ายตัวเอง
2. **LINE Notify Integration**:
   - ถ้าเจอวิกฤต ส่งสัญญาณ POST ผ่าน Token ไปยัง Line กลุ่มครูแนะแนว
   - จัดรูปแบบข้อความแจ้งเตือน (แต่ปิดบังชื่อจริง เพื่อผลประโยชน์ของ PDPA)
3. **In-app Notification Dashboard**:
   - พัฒนาระบบ Case Management (Admin) จากสถานะ "New" เลื่อนไป "In_Progress" สู่ "Closed"
4. **ทำ Daily Backup สู่ MinIO**:
   - ทำคำสั่ง cron สคริปต์รายวันที่ทำการ pg_dump แล้วบีบอัดเป็น gz 
   - ทดสอบผ่าน `docker-compose up -d backup-scheduler`
