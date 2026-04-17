import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, Text, Date,
    ForeignKey, DateTime, func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship

class Base(DeclarativeBase):
    pass

class Affiliation(Base):
    __tablename__ = "affiliations"
    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)

class District(Base):
    __tablename__ = "districts"
    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    affiliation_id = Column(Integer, ForeignKey("affiliations.id"))

class School(Base):
    __tablename__ = "schools"
    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    district_id = Column(Integer, ForeignKey("districts.id"))
    school_type = Column(Text)

class Student(Base):
    __tablename__ = "students"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_code = Column(Text, unique=True, nullable=False)
    national_id = Column(Text)        # AES-256 encrypted
    national_id_hash = Column(Text)   # SHA-256 for searching/login
    first_name = Column(Text, nullable=False)
    last_name = Column(Text, nullable=False)
    gender = Column(Text)
    birthdate = Column(Date)
    grade = Column(Text)
    classroom = Column(Text)
    school_id = Column(Integer, ForeignKey("schools.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    school = relationship("School")

class User(Base):
    """
    Roles:
      - systemadmin:     ทีม Dev / แอดมินข้อมูลระบบ (ดูและจัดการทุกอย่าง)
      - superadmin:      ศึกษาธิการจังหวัดเลย (ดูทุกสังกัด ฟิลเตอร์ทุกระดับ)
      - commissionadmin: แอดมินระดับเขตพื้นที่/สังกัด (ดูเฉพาะโรงเรียนในสังกัด)
      - schooladmin:     แอดมินระดับโรงเรียน (ดูเฉพาะโรงเรียนตัวเอง)
      - student:         ผู้ทำแบบประเมิน
    """
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=True)
    username = Column(Text, unique=True)
    hashed_password = Column(Text)
    role = Column(Text, nullable=False)  # systemadmin|superadmin|commissionadmin|schooladmin|student
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=True)
    affiliation_id = Column(Integer, ForeignKey("affiliations.id"), nullable=True)  # สังกัด (สำหรับ commissionadmin)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)        # เขตพื้นที่ (สำหรับ commissionadmin)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True))

    student = relationship("Student")
    school = relationship("School")
    affiliation = relationship("Affiliation")
    district = relationship("District")

class Assessment(Base):
    __tablename__ = "assessments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    assessment_type = Column(Text, nullable=False)
    responses = Column(JSONB, nullable=False)
    score = Column(Integer, nullable=False)
    severity_level = Column(Text, nullable=False)
    suicide_risk = Column(Boolean, default=False)
    academic_year = Column(Text)
    term = Column(Integer)
    filled_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # NULL = นักเรียนกรอกเอง
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student")

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"))
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"))
    alert_level = Column(Text)
    status = Column(Text, default="new")
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    student = relationship("Student")
    assessment = relationship("Assessment")
    assignee = relationship("User", foreign_keys=[assigned_to])

class Notification(Base):
    """In-app notifications สำหรับ admin dashboard"""
    __tablename__ = "notifications"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    link = Column(Text)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AuditLog(Base):
    """Audit log สำหรับการเข้าถึงข้อมูล"""
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    action = Column(Text, nullable=False)
    resource = Column(Text)
    details = Column(JSONB)
    ip_address = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
