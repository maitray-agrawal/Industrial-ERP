from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from .database import Base

class Student(Base):
    __tablename__ = "students"

    student_id = Column(Integer, primary_key=True, autoincrement=True)
    ticket_no = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    father_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    mother_name = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    religion = Column(String, nullable=True)
    cast_category = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)
    mother_tongue = Column(String, nullable=True)
    marital_status = Column(String, nullable=True)
    dob = Column(String, nullable=True)
    contact_no = Column(String, nullable=True)
    email = Column(String, nullable=True)
    district = Column(String, nullable=True)
    state = Column(String, nullable=True)
    is_degree_pursuing = Column(Boolean, default=False, nullable=False)
    status = Column(String, default="Active", nullable=False)  # Active, Separated, Pending Completion
    dropout_reason = Column(String, nullable=True)

    # Relationships
    academics = relationship(
        "AdmissionAcademic",
        back_populates="student",
        uselist=False,
        cascade="all, delete-orphan",
    )
    compliance = relationship(
        "Compliance",
        back_populates="student",
        uselist=False,
        cascade="all, delete-orphan",
    )
    finance = relationship(
        "Finance",
        back_populates="student",
        uselist=False,
        cascade="all, delete-orphan",
    )
    attendance_ledger = relationship(
        "StudentAttendanceLedger",
        back_populates="student",
        cascade="all, delete-orphan",
        foreign_keys="[StudentAttendanceLedger.student_id]"
    )

class AdmissionAcademic(Base):
    __tablename__ = "admissions_academics"

    student_id = Column(
        Integer,
        ForeignKey("students.student_id", ondelete="CASCADE"),
        primary_key=True,
    )
    quess_batch_no = Column(String, index=True, nullable=False)
    qualification_education = Column(String, nullable=True)  # "12th" or "ITI"
    date_of_joining = Column(String, nullable=True)
    date_of_admission = Column(String, nullable=True)
    stream_branch = Column(String, nullable=True)
    tenth_percentage = Column(Float, nullable=True)
    twelfth_iti_percentage = Column(Float, nullable=True)
    prior_institute = Column(String, nullable=True)
    enrollment_gaps = Column(Integer, default=0, nullable=False)
    
    # Extra keys requested in specifications
    sr_no = Column(String, nullable=True)
    prn = Column(String, nullable=True)
    doj = Column(String, nullable=True)
    doa_in_pcu = Column(String, nullable=True)
    medical_no = Column(String, nullable=True)
    apprentice_no = Column(String, nullable=True)

    student = relationship("Student", back_populates="academics")

class Compliance(Base):
    __tablename__ = "compliance"

    student_id = Column(
        Integer,
        ForeignKey("students.student_id", ondelete="CASCADE"),
        primary_key=True,
    )
    is_lc_submitted = Column(Boolean, default=False, nullable=False)
    pending_documents_array = Column(JSON, nullable=True)  # List of documents
    admission_status = Column(String, default="Pending", nullable=False)  # Provisional, Confirmed, Pending

    student = relationship("Student", back_populates="compliance")

class Finance(Base):
    __tablename__ = "finance"

    student_id = Column(
        Integer,
        ForeignKey("students.student_id", ondelete="CASCADE"),
        primary_key=True,
    )
    bank_name = Column(String, nullable=True)
    account_no = Column(String, nullable=True)
    ifsc_code = Column(String, nullable=True)
    attendance_payout_eligible = Column(Boolean, default=False, nullable=False)

    student = relationship("Student", back_populates="finance")

class StudentAttendanceLedger(Base):
    __tablename__ = "Student_Attendance_Ledger"

    attendance_id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(
        Integer,
        ForeignKey("students.student_id", ondelete="CASCADE"),
        nullable=False,
    )
    ticket_no = Column(
        String,
        ForeignKey("students.ticket_no", ondelete="CASCADE"),
        nullable=False,
    )
    date = Column(String, nullable=False)  # YYYY-MM-DD
    status = Column(String, nullable=False)  # "Present" or "Absent"
    shift = Column(String, nullable=True)
    in_time = Column(String, nullable=True)
    out_time = Column(String, nullable=True)
    timestamp_logged = Column(String, nullable=False)
    shop_floor = Column(String, nullable=True)
    line_manager_name = Column(String, nullable=True)
    
    # Metadata & Work-Center Attributes
    psa_text = Column(String, nullable=True)
    cost_centre = Column(String, nullable=True)
    cost_centre_text = Column(String, nullable=True)
    working_cost_centre = Column(String, nullable=True)
    access_control_group = Column(String, nullable=True)
    
    # Extra daily log metrics
    total_hours = Column(Float, nullable=True)
    remarks = Column(String, nullable=True)
    punctuality_status = Column(String, nullable=True)
    punch_type = Column(String, nullable=True)
    work_status = Column(String, nullable=True)

    __table_args__ = (UniqueConstraint("ticket_no", "date", name="uq_ticket_date"),)

    student = relationship("Student", back_populates="attendance_ledger", foreign_keys=[student_id])
