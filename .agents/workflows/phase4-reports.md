---
description: LEMCS Phase 4 — Reporting Dashboard
---

# Phase 4 Workflow: Reporting Dashboard สำหรับผู้บริหารและแอดมิน

เป้าหมายคือให้เจ้าหน้าที่สามารถเช็คผลการประเมินได้
1. **ระบบ Filter**:
   - รับค่าจาก UI Component `FilterBar.tsx` กรองรายโรงเรียน วันที่ ประเภท และระดับชั้น
2. **สร้าง StatsCards**:
   - อ่านข้อมูล `get_report_data()` ส่งไป UI ด้านหน้า
   - ประมวลผลและแบ่งแยกสี (🔴, 🟡, 🟢) ไว้ชัดเจน
3. **Render หน้า Chart.js**:
   - เอาผลมารวม (Aggregate Data) ไปลงระบบกราฟของ Dashboard
   - ให้สิทธิ์ Role Based: แอดมินจังหวัดเห็นทั้งหมด ส่วนครูเห็นเฉพาะผู้เรียนในห้องพักตัวเอง
4. **เพิ่ม Function การส่งออก**:
   - ใช้ `weasyprint` ทำ PDF Export
   - ใช้ `openpyxl` ออกหน้า Excel Export
   - ทดสอบผลลัพธ์ว่าใช้ฟอนต์ Noto Sans Thai ถูกต้อง
