"""
LEMCS Seed Script — ข้อมูลจำลองสมจริง จ.เลย
ใช้ได้ทั้ง local dev และ docker: python -m scripts.seed
"""
import asyncio
import random
from datetime import date, datetime, timedelta

# ── Thai name pools ────────────────────────────────────────────────────────────
FIRST_NAMES_M = [
    "ธนพล","ภูวดล","วรเมธ","อภิชาติ","ธีรภัทร","เกียรติศักดิ์","พงศกร","ภัทรพล",
    "กิตติ","สมชาย","สุรชัย","ประพันธ์","วิทยา","เอกชัย","ชาญชัย","พิทักษ์",
    "นันทวัฒน์","ณัฐพล","พีรพล","อดิศักดิ์","ศักดิ์ชัย","วัชระ","ปิยะพงษ์","กฤษณะ",
    "อนุชา","สุทธิพงษ์","ชิษณุพงศ์","ธนวัฒน์","ศุภชัย","รัฐพล","ปิยะวัฒน์","ณัฐวุฒิ",
    "ทวีชัย","ก้องเกียรติ","วสันต์","มนัส","ชยันต์","สิทธิชัย","ระพีพัฒน์","อภิวัฒน์",
]
FIRST_NAMES_F = [
    "สมหญิง","ณัฐชา","พิมพ์ใจ","กานต์ธิดา","ศิริพร","จินตนา","ปาริชาต","สุภาวดี",
    "มาลินี","ชลิตา","วรรณิดา","พรรณิภา","กัลยาณี","นภาพร","สุดารัตน์","อัจฉรา",
    "วิภาวดี","สุมาลี","ปิยะนุช","นันทนา","จิราพร","พัชรินทร์","ศิริลักษณ์","รัตนา",
    "กาญจนา","เบญจมาศ","นัฐธิดา","ปิยดา","วาสนา","ฐิติมา","สายชล","มยุรา",
    "ดวงฤดี","พิไลวรรณ","อัมพร","ลลิตา","ธนิษฐา","กมลรัตน์","สุพรรษา","ชมพูนุท",
]
LAST_NAMES = [
    "ใจดี","มั่งมี","สุขสม","ศรีเลย","วงศ์พานิช","พรหมจันทร์","ชัยวัฒน์","แก้วมณี",
    "ศรีสะอาด","ลุนศรี","บุญเรือง","สิทธิชัย","ทองดี","จันทร์สว่าง","ภูเวียง",
    "หนองบัว","สังขะพงษ์","ดวงดี","ภักดี","เทพประสิทธิ์","วิเชียรชัย","ป้องขันธ์",
    "สีหานาม","ผิวขำ","แสงชมพู","อุทัยรัตน์","คำมุงคุณ","ศรีสุข","ชาวเหนือ",
    "แก้วกาหลง","พิมพา","อ่วมจันทร์","บัวผัน","สุวรรณชัย","คำภูมี","บุปผา",
    "อรุณรัตน์","สีลาดเลา","หาญสมุทร","เพียรดี","คำบ้านฝาง","หล้าป้อง",
]

GRADES_PRIMARY   = ["ป.4", "ป.5", "ป.6"]
GRADES_SECONDARY = ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"]
GRADES_VOC       = ["ปวช.1", "ปวช.2", "ปวช.3"]
GRADES_SKR       = ["ป.4", "ป.5", "ป.6", "ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"]
CLASSROOMS       = ["1", "2", "3", "4", "5"]

TODAY = date(2026, 4, 3)


def random_name(gender):
    pool = FIRST_NAMES_M if gender == "male" else FIRST_NAMES_F
    return random.choice(pool), random.choice(LAST_NAMES)


def age_to_birthdate(age_min, age_max):
    age = random.randint(age_min, age_max)
    year = TODAY.year - age
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return date(year, month, day)


async def main():
    from app.database import engine, AsyncSessionLocal
    from app.models.db_models import (
        Base, Affiliation, District, School, Student, User, Assessment, Alert,
    )
    from app.services.encryption import hash_pii, encrypt_pii
    from sqlalchemy import select, text as sa_text
    import bcrypt

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:

        # ── Affiliations ──────────────────────────────────────────────
        affiliations_data = [
            (1, "สำนักงานคณะกรรมการการอาชีวศึกษา"),
            (2, "สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน"),
            (3, "สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน"),
            (4, "กรมส่งเสริมการเรียนรู้"),
        ]
        for aid, name in affiliations_data:
            if not (await db.execute(
                select(Affiliation).where(Affiliation.id == aid)
            )).scalar_one_or_none():
                db.add(Affiliation(id=aid, name=name))
        await db.commit()

        # ── Districts ─────────────────────────────────────────────────
        districts_data = [
            (1, "สำนักงานอาชีวศึกษาจังหวัดเลย", 1),
            (2, "สำนักงานเขตพื้นที่การศึกษาประถมศึกษาเลย เขต 1", 2),
            (3, "สำนักงานเขตพื้นที่การศึกษาประถมศึกษาเลย เขต 2", 2),
            (4, "สำนักงานเขตพื้นที่การศึกษาประถมศึกษาเลย เขต 3", 2),
            (5, "สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาเลย-หนองบัวลำภู", 2),
            (6, "สำนักงานการศึกษาเอกชนจังหวัดเลย", 3),
            (7, "สำนักงานส่งเสริมการเรียนรู้จังหวัดเลย", 4),
        ]
        for did, name, aff_id in districts_data:
            if not (await db.execute(
                select(District).where(District.id == did)
            )).scalar_one_or_none():
                db.add(District(id=did, name=name, affiliation_id=aff_id))
        await db.commit()

        # ── Schools ───────────────────────────────────────────────────
        schools_data = [
            (1,  "วิทยาลัยเทคนิคเลย",                 1, "อาชีวศึกษา",  GRADES_VOC),
            (2,  "วิทยาลัยอาชีวศึกษาเลย",              1, "อาชีวศึกษา",  GRADES_VOC),
            (3,  "โรงเรียนอนุบาลเลย",                  2, "ประถมศึกษา",  GRADES_PRIMARY),
            (4,  "โรงเรียนเมืองเลย",                   2, "ประถมศึกษา",  GRADES_PRIMARY),
            (5,  "โรงเรียนบ้านนาน้ำมัน",               2, "ประถมศึกษา",  GRADES_PRIMARY),
            (6,  "โรงเรียนชุมชนบ้านวังสะพุง",           3, "ประถมศึกษา",  GRADES_PRIMARY),
            (7,  "โรงเรียนบ้านเชียงคาน",               4, "ประถมศึกษา",  GRADES_PRIMARY),
            (8,  "โรงเรียนบ้านท่าลี่",                 4, "ประถมศึกษา",  GRADES_PRIMARY),
            (9,  "โรงเรียนเลยพิทยาคม",                 5, "มัธยมศึกษา",  GRADES_SECONDARY),
            (10, "โรงเรียนเลยอนุกูลวิทยา",             5, "มัธยมศึกษา",  GRADES_SECONDARY),
            (11, "โรงเรียนนาด้วงวิทยา",                5, "มัธยมศึกษา",  GRADES_SECONDARY),
            (12, "โรงเรียนเชียงคานวิทยาคม",             5, "มัธยมศึกษา",  GRADES_SECONDARY),
            (13, "โรงเรียนศรีสองรักษ์วิทยา",            5, "มัธยมศึกษา",  GRADES_SECONDARY),
            (14, "โรงเรียนแสงตะวันพัฒนา",              6, "เอกชน",
             GRADES_PRIMARY + GRADES_SECONDARY),
            (15, "โรงเรียนดาวเรืองวิทยา",              6, "เอกชน",
             GRADES_PRIMARY + GRADES_SECONDARY),
            (16, "สำนักงานส่งเสริมการเรียนรู้อำเภอเมืองเลย", 7, "สกร.", GRADES_SKR),
            (17, "วิทยาลัยการอาชีพวังสะพุง",           1, "อาชีวศึกษา",  GRADES_VOC),
        ]
        school_meta = {}
        for sid, name, did, stype, grades in schools_data:
            school_meta[sid] = (stype, grades)
            if not (await db.execute(
                select(School).where(School.id == sid)
            )).scalar_one_or_none():
                db.add(School(id=sid, name=name, district_id=did, school_type=stype))
        await db.commit()

        # ── Admin Users ───────────────────────────────────────────────
        hashed_pw = bcrypt.hashpw("password123".encode(), bcrypt.gensalt()).decode()
        demo_users = [
            # System level
            {"username": "admin",      "role": "systemadmin",     "school_id": None, "affiliation_id": None, "district_id": None},
            {"username": "superadmin", "role": "superadmin",      "school_id": None, "affiliation_id": None, "district_id": None},
            # Commission (district) level
            {"username": "avc_admin",  "role": "commissionadmin", "school_id": None, "affiliation_id": 1, "district_id": 1},
            {"username": "spp1_admin", "role": "commissionadmin", "school_id": None, "affiliation_id": 2, "district_id": 2},
            {"username": "spp2_admin", "role": "commissionadmin", "school_id": None, "affiliation_id": 2, "district_id": 3},
            {"username": "spp3_admin", "role": "commissionadmin", "school_id": None, "affiliation_id": 2, "district_id": 4},
            {"username": "spm_admin",  "role": "commissionadmin", "school_id": None, "affiliation_id": 2, "district_id": 5},
            {"username": "prv_admin",  "role": "commissionadmin", "school_id": None, "affiliation_id": 3, "district_id": 6},
            {"username": "skr_admin",  "role": "commissionadmin", "school_id": None, "affiliation_id": 4, "district_id": 7},
            # School level (one per school)
            {"username": "vtl_admin",  "role": "schooladmin", "school_id": 1,  "affiliation_id": None, "district_id": None},
            {"username": "voc_admin",  "role": "schooladmin", "school_id": 2,  "affiliation_id": None, "district_id": None},
            {"username": "anl_admin",  "role": "schooladmin", "school_id": 3,  "affiliation_id": None, "district_id": None},
            {"username": "ml_admin",   "role": "schooladmin", "school_id": 4,  "affiliation_id": None, "district_id": None},
            {"username": "nnm_admin",  "role": "schooladmin", "school_id": 5,  "affiliation_id": None, "district_id": None},
            {"username": "wsp_admin",  "role": "schooladmin", "school_id": 6,  "affiliation_id": None, "district_id": None},
            {"username": "ck_admin",   "role": "schooladmin", "school_id": 7,  "affiliation_id": None, "district_id": None},
            {"username": "tl_admin",   "role": "schooladmin", "school_id": 8,  "affiliation_id": None, "district_id": None},
            {"username": "lp_admin",   "role": "schooladmin", "school_id": 9,  "affiliation_id": None, "district_id": None},
            {"username": "la_admin",   "role": "schooladmin", "school_id": 10, "affiliation_id": None, "district_id": None},
            {"username": "ndw_admin",  "role": "schooladmin", "school_id": 11, "affiliation_id": None, "district_id": None},
            {"username": "ckw_admin",  "role": "schooladmin", "school_id": 12, "affiliation_id": None, "district_id": None},
            {"username": "ssk_admin",  "role": "schooladmin", "school_id": 13, "affiliation_id": None, "district_id": None},
            {"username": "stw_admin",  "role": "schooladmin", "school_id": 14, "affiliation_id": None, "district_id": None},
            {"username": "drw_admin",  "role": "schooladmin", "school_id": 15, "affiliation_id": None, "district_id": None},
            {"username": "nfe_admin",  "role": "schooladmin", "school_id": 16, "affiliation_id": None, "district_id": None},
            {"username": "vtw_admin",  "role": "schooladmin", "school_id": 17, "affiliation_id": None, "district_id": None},
        ]

        for u in demo_users:
            existing = (await db.execute(
                select(User).where(User.username == u["username"])
            )).scalar_one_or_none()
            if existing:
                existing.role = u["role"]
                existing.affiliation_id = u["affiliation_id"]
                existing.district_id = u["district_id"]
                existing.school_id = u["school_id"]
                if not existing.hashed_password:
                    existing.hashed_password = hashed_pw
            else:
                last_login = None
                if random.random() > 0.25:
                    last_login = datetime.now() - timedelta(
                        days=random.randint(0, 45),
                        hours=random.randint(7, 22),
                    )
                db.add(User(
                    username=u["username"],
                    hashed_password=hashed_pw,
                    role=u["role"],
                    school_id=u["school_id"],
                    affiliation_id=u["affiliation_id"],
                    district_id=u["district_id"],
                    is_active=True,
                    last_login=last_login,
                ))
        await db.commit()

        # ── Students ──────────────────────────────────────────────────
        school_age_range = {
            1: (15, 18), 2: (15, 18), 17: (15, 18),
            3: (9, 12),  4: (9, 12),  5:  (9, 12),
            6: (9, 12),  7: (9, 12),  8:  (9, 12),
            9: (12, 17), 10: (12, 17), 11: (12, 17),
            12: (12, 17), 13: (12, 17),
            14: (10, 16), 15: (10, 16),
            16: (17, 22),
        }
        students_per_school = {
            1: 18, 2: 14, 3: 22, 4: 18, 5: 10,
            6: 12, 7: 10, 8:  8, 9: 28, 10: 24,
            11: 14, 12: 16, 13: 12, 14: 10, 15: 8,
            16: 6, 17: 12,
        }

        student_ids = []
        nid_counter = 1420000000001

        for school_id, count in students_per_school.items():
            stype, grades = school_meta[school_id]
            age_min, age_max = school_age_range[school_id]

            for i in range(count):
                scode = f"S{school_id:02d}{i+1:04d}"
                existing = (await db.execute(
                    select(Student).where(Student.student_code == scode)
                )).scalar_one_or_none()
                if existing:
                    student_ids.append(existing.id)
                    continue

                gender = random.choice(["male", "female"])
                fname, lname = random_name(gender)
                bdate = age_to_birthdate(age_min, age_max)

                if stype == "อาชีวศึกษา":
                    grade = random.choice(GRADES_VOC)
                elif stype == "ประถมศึกษา":
                    grade = random.choice(GRADES_PRIMARY)
                elif stype == "มัธยมศึกษา":
                    grade = random.choice(GRADES_SECONDARY)
                elif stype in ("กศน.", "สกร."):
                    grade = random.choice(GRADES_SKR)
                else:
                    age_now = TODAY.year - bdate.year
                    grade = random.choice(
                        GRADES_PRIMARY if age_now < 12 else GRADES_SECONDARY
                    )

                nid = str(nid_counter)
                nid_counter += 1

                stu = Student(
                    student_code=scode,
                    first_name=fname,
                    last_name=lname,
                    gender=gender,
                    birthdate=bdate,
                    grade=grade,
                    classroom=random.choice(CLASSROOMS),
                    school_id=school_id,
                    national_id=encrypt_pii(nid),
                    national_id_hash=hash_pii(nid),
                    is_active=True,
                )
                db.add(stu)
                await db.flush()
                student_ids.append(stu.id)

        await db.commit()

        # ── Assessments ───────────────────────────────────────────────
        existing_count = (
            await db.execute(sa_text("SELECT COUNT(*) FROM assessments"))
        ).scalar()

        if existing_count < 50:
            result = await db.execute(
                select(Student).where(Student.is_active == True)
            )
            all_students = result.scalars().all()

            # Severity distributions (realistic Thai school population)
            st5_sev_w  = [45, 28, 16, 11]          # normal, mild, moderate, severe
            phqa_sev_w = [40, 25, 18, 12, 5]        # none, mild, mod, severe, very_severe
            cdi_sev_w  = [65, 35]                    # normal, clinical

            st5_scores  = {"normal":(0,4), "mild":(5,8), "moderate":(9,11), "severe":(12,15)}
            phqa_scores = {"none":(0,4), "mild":(5,9), "moderate":(10,14),
                           "severe":(15,19), "very_severe":(20,27)}
            cdi_scores  = {"normal":(0,14), "clinical":(15,30)}

            for stu in all_students:
                age_now = TODAY.year - stu.birthdate.year - (
                    (TODAY.month, TODAY.day) < (stu.birthdate.month, stu.birthdate.day)
                )
                n = random.choices([1, 2, 3], weights=[40, 40, 20])[0]

                for j in range(n):
                    days_ago = random.randint(j * 30, j * 30 + 60)
                    ts = datetime.now() - timedelta(
                        days=days_ago,
                        hours=random.randint(7, 18),
                        minutes=random.randint(0, 59),
                    )
                    term = 2 if days_ago < 90 else 1

                    # ST-5 (all ages)
                    sev5 = random.choices(
                        ["normal", "mild", "moderate", "severe"], weights=st5_sev_w
                    )[0]
                    lo, hi = st5_scores[sev5]
                    db.add(Assessment(
                        student_id=stu.id,
                        assessment_type="ST5",
                        responses={"answers": [random.randint(0, 3) for _ in range(5)]},
                        score=random.randint(lo, hi),
                        severity_level=sev5,
                        suicide_risk=False,
                        academic_year="2567",
                        term=term,
                        created_at=ts - timedelta(minutes=30),
                    ))

                    # Depression: CDI (age 7-17) or PHQ-A (age 18+), age < 7 → ST-5 only
                    if 7 <= age_now <= 17:
                        sev_c = random.choices(["normal", "clinical"], weights=cdi_sev_w)[0]
                        lo, hi = cdi_scores[sev_c]
                        a = Assessment(
                            student_id=stu.id,
                            assessment_type="CDI",
                            responses={"answers": [
                                random.choice(["ก", "ข", "ค"]) for _ in range(27)
                            ]},
                            score=random.randint(lo, hi),
                            severity_level=sev_c,
                            suicide_risk=False,
                            academic_year="2567",
                            term=term,
                            created_at=ts,
                        )
                        db.add(a)
                        await db.flush()
                        if sev_c == "clinical":
                            db.add(Alert(
                                student_id=stu.id,
                                assessment_id=a.id,
                                alert_level="high",
                                status=random.choice(
                                    ["new", "new", "in_progress", "resolved"]
                                ),
                            ))

                    elif 11 <= age_now <= 20:
                        sev_p = random.choices(
                            ["none", "mild", "moderate", "severe", "very_severe"],
                            weights=phqa_sev_w,
                        )[0]
                        lo, hi = phqa_scores[sev_p]
                        q9 = (
                            1
                            if sev_p in ("severe", "very_severe") and random.random() < 0.35
                            else 0
                        )
                        a = Assessment(
                            student_id=stu.id,
                            assessment_type="PHQA",
                            responses={"answers": [
                                random.randint(0, 3) for _ in range(8)
                            ] + [q9]},
                            score=random.randint(lo, hi),
                            severity_level=sev_p,
                            suicide_risk=(q9 >= 1),
                            academic_year="2567",
                            term=term,
                            created_at=ts,
                        )
                        db.add(a)
                        await db.flush()
                        if sev_p in ("severe", "very_severe") or q9 >= 1:
                            db.add(Alert(
                                student_id=stu.id,
                                assessment_id=a.id,
                                alert_level="critical" if q9 >= 1 else "high",
                                status=random.choice(["new", "new", "in_progress"]),
                            ))

            await db.commit()

        # ── Summary ───────────────────────────────────────────────────
        ts = (await db.execute(sa_text("SELECT COUNT(*) FROM students"))).scalar()
        ta = (await db.execute(sa_text("SELECT COUNT(*) FROM assessments"))).scalar()
        tl = (await db.execute(sa_text("SELECT COUNT(*) FROM alerts"))).scalar()
        tu = (await db.execute(
            sa_text("SELECT COUNT(*) FROM users WHERE role != 'student'")
        )).scalar()

        print("\n  LEMCS Seed complete!")
        print(f"   Schools     : 17 (อาชีวศึกษา 3, ประถม 6, มัธยม 5, เอกชน 2, กศน. 1)")
        print(f"   Students    : {ts}")
        print(f"   Admin users : {tu}  (password: password123)")
        print(f"   Assessments : {ta}")
        print(f"   Alerts      : {tl}")
        print()
        print("   Admins:")
        print("     System   : admin, superadmin")
        print("     District : avc_admin, spp1_admin, spp2_admin, spp3_admin, spm_admin, prv_admin, skr_admin")
        print("     School   : vtl_admin, voc_admin, anl_admin, ml_admin, nnm_admin,")
        print("                wsp_admin, ck_admin, tl_admin, lp_admin, la_admin,")
        print("                ndw_admin, ckw_admin, ssk_admin, stw_admin, drw_admin,")
        print("                nfe_admin, vtw_admin")


if __name__ == "__main__":
    asyncio.run(main())
