# RBAC — Role-Based Access Control
## LEMCS (Loei Educational MindCare System)

> เอกสารอ้างอิงระบบกำหนดสิทธิ์การเข้าถึงข้อมูลตามบทบาท

---

## โครงสร้างองค์กร

```
ศึกษาธิการจังหวัดเลย (superadmin)
├── สังกัด: สำนักงานคณะกรรมการการอาชีวศึกษา
│   └── เขต: สำนักงานอาชีวศึกษาจังหวัดเลย (commissionadmin)
│       ├── วิทยาลัยเทคนิคเลย (schooladmin)
│       └── วิทยาลัยอาชีวศึกษาเลย (schooladmin)
│
├── สังกัด: สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน
│   ├── เขต: สพป.เลย เขต 1 (commissionadmin)
│   │   ├── โรงเรียนเมืองเลย (schooladmin)
│   │   └── โรงเรียนอนุบาลเลย (schooladmin)
│   ├── เขต: สพป.เลย เขต 2 (commissionadmin)
│   │   └── โรงเรียนชุมชนวังสะพุง (schooladmin)
│   ├── เขต: สพป.เลย เขต 3 (commissionadmin)
│   │   └── โรงเรียนบ้านเชียงคาน (schooladmin)
│   └── เขต: สพม.เลย-หนองบัวลำภู (commissionadmin)
│       ├── โรงเรียนเลยพิทยาคม (schooladmin)
│       └── โรงเรียนเลยอนุกูลวิทยา (schooladmin)
│
├── สังกัด: สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน
│   └── เขต: สำนักงานการศึกษาเอกชนจังหวัดเลย (commissionadmin)
│       └── โรงเรียนแสงตะวันพัฒนา (schooladmin)
│
└── สังกัด: กรมส่งเสริมการเรียนรู้
    └── เขต: สำนักงานส่งเสริมการเรียนรู้ จ.เลย (commissionadmin)
        └── สกร. อ.เมืองเลย (schooladmin)
```

---

## ตาราง Role

| Role | คำอธิบาย | ขอบเขตข้อมูล |
|---|---|---|
| `systemadmin` | ทีม Dev / แอดมินข้อมูล | จัดการทุกอย่าง (Import สังกัด, เขต, โรงเรียน, นักเรียน) |
| `superadmin` | ศึกษาธิการจังหวัดเลย | ดูข้อมูลทั้งหมด ฟิลเตอร์ได้ทุกระดับ |
| `commissionadmin` | แอดมินเขตพื้นที่/สังกัด | ดูเฉพาะโรงเรียนในเขต/สังกัดของตัวเอง |
| `schooladmin` | แอดมินโรงเรียน | ดูเฉพาะโรงเรียนตัวเอง |
| `student` | ผู้ทำแบบประเมิน | เห็นเฉพาะผลของตัวเอง |

---

## Database: ตาราง `users`

| Column | Type | หมายเหตุ |
|---|---|---|
| `role` | TEXT | `systemadmin\|superadmin\|commissionadmin\|schooladmin\|student` |
| `school_id` | FK → schools | สำหรับ `schooladmin` |
| `affiliation_id` | FK → affiliations | สำหรับ `commissionadmin` (ผูกสังกัด) |
| `district_id` | FK → districts | สำหรับ `commissionadmin` (ผูกเขตพื้นที่) |

---

## Permission Matrix

| Feature | systemadmin | superadmin | commissionadmin | schooladmin | student |
|---|:---:|:---:|:---:|:---:|:---:|
| จัดการ Import ข้อมูล | ✅ | ❌ | ❌ | ❌ | ❌ |
| จัดการ User | ✅ | ❌ | ❌ | ❌ | ❌ |
| ดู Dashboard (ทุกสังกัด) | ✅ | ✅ | ❌ | ❌ | ❌ |
| ดู Dashboard (เฉพาะสังกัด) | ✅ | ✅ | ✅ | ❌ | ❌ |
| ดู Dashboard (เฉพาะ รร.) | ✅ | ✅ | ✅ | ✅ | ❌ |
| ดูรายงาน/Export | ✅ | ✅ | ✅ | ✅ | ❌ |
| จัดการ Alerts | ✅ | ✅ | ✅ | ✅ | ❌ |
| ทำแบบประเมิน | ❌ | ❌ | ❌ | ❌ | ✅ |
| ดูผลประเมินตัวเอง | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Query Scoping Logic (`deps.py`)

```python
# commissionadmin → ดูเฉพาะโรงเรียนที่อยู่ใน district ของตัวเอง
if user.role == "commissionadmin":
    scope.district_id = user.district_id   # หรือ user.affiliation_id
    scope.school_id = optional_filter      # เลือกโรงเรียนย่อยภายในเขตได้

# schooladmin → lock เฉพาะ school_id
if user.role == "schooladmin":
    scope.school_id = user.school_id

# superadmin / systemadmin → ไม่จำกัด ฟิลเตอร์ได้ทุกอย่าง
```
