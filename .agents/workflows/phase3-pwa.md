---
description: LEMCS Phase 3 — PWA Frontend
---

# Phase 3 Workflow: PWA Frontend พื้นฐานการใช้งานหน้าเว็บ

การทำระบบนี้จะต้องทำบน Mobile-First Approach เพื่อความง่ายและสะดวกต่อนักเรียน
1. **ออกแบบ UI หน้า Login (`login/page.tsx`)**:
   - ใช้ DaisyUI components (text-input, button-primary)
   - ไม่ให้มี Horizontal Scrollbar ในหน้าจอ 375px เด็ดขาด
2. **สร้าง Student Dashboard (`dashboard/page.tsx`)**:
   - เพิ่ม `AssessmentHistory` และ `PendingAssessments` components ให้ครบ
3. **จัดทำ Admin Layout**:
   - แถบนำทางด้านข้าง (Sidebar Navigation) ซ่อนในหน้าจอมือถือ
   - Top Header bar ที่สามารถ Refresh Token ของเจ้าหน้าที่ได้
4. **Offline PWA Support**:
   - สร้าง `manifest.json` เพื่อทำ A2HS
   - จัดทำ Service Worker Cache ไว้สำหรับทำงานหน้าเว็บกรณีอินเทอร์เน็ตหลุด
   // turbo
   `npm run build` เพื่อให้ PWA ถูก generate.
