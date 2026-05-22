from pydantic import BaseModel, EmailStr
from typing import List, Optional

class AttendanceLedgerBase(BaseModel):
    ticket_no: str
    date: str
    status: str
    shift: Optional[str] = None
    in_time: Optional[str] = None
    out_time: Optional[str] = None
    timestamp_logged: str
    shop_floor: Optional[str] = None
    line_manager_name: Optional[str] = None
    
    # Metadata & Work-Center Attributes
    psa_text: Optional[str] = None
    cost_centre: Optional[str] = None
    cost_centre_text: Optional[str] = None
    working_cost_centre: Optional[str] = None
    access_control_group: Optional[str] = None
    
    # Extra daily log metrics
    total_hours: Optional[float] = None
    remarks: Optional[str] = None
    punctuality_status: Optional[str] = None
    punch_type: Optional[str] = None
    work_status: Optional[str] = None

    class Config:
        from_attributes = True

class AttendanceLedgerResponse(AttendanceLedgerBase):
    attendance_id: int
    student_id: int

class AcademicBase(BaseModel):
    quess_batch_no: str
    qualification_education: Optional[str] = None
    date_of_joining: Optional[str] = None
    date_of_admission: Optional[str] = None
    stream_branch: Optional[str] = None
    tenth_percentage: Optional[float] = None
    twelfth_iti_percentage: Optional[float] = None
    prior_institute: Optional[str] = None
    enrollment_gaps: int = 0
    
    # Extra keys requested in specifications
    sr_no: Optional[str] = None
    prn: Optional[str] = None
    doj: Optional[str] = None
    doa_in_pcu: Optional[str] = None
    medical_no: Optional[str] = None
    apprentice_no: Optional[str] = None

    class Config:
        from_attributes = True

class ComplianceBase(BaseModel):
    is_lc_submitted: bool = False
    pending_documents_array: Optional[List[str]] = None
    admission_status: str = "Pending"

    class Config:
        from_attributes = True

class FinanceBase(BaseModel):
    bank_name: Optional[str] = None
    account_no: Optional[str] = None
    ifsc_code: Optional[str] = None
    attendance_payout_eligible: bool = False

    class Config:
        from_attributes = True

class StudentBase(BaseModel):
    ticket_no: str
    full_name: str
    father_name: Optional[str] = None
    last_name: Optional[str] = None
    mother_name: Optional[str] = None
    gender: str
    religion: Optional[str] = None
    cast_category: Optional[str] = None
    blood_group: Optional[str] = None
    mother_tongue: Optional[str] = None
    marital_status: Optional[str] = None
    dob: str
    contact_no: Optional[str] = None
    email: Optional[EmailStr] = None
    district: Optional[str] = None
    state: Optional[str] = None
    is_degree_pursuing: bool = False
    status: str = "Active"
    dropout_reason: Optional[str] = None

class StudentResponse(StudentBase):
    student_id: int
    academics: Optional[AcademicBase] = None
    compliance: Optional[ComplianceBase] = None
    finance: Optional[FinanceBase] = None
    attendance_ledger: Optional[List[AttendanceLedgerResponse]] = []

    class Config:
        from_attributes = True

class OJTSyncResponse(BaseModel):
    status: str
    message: str
    records_processed: int
    updates: List[dict]

class IngestionConflictDetail(BaseModel):
    ticket_no: str
    full_name: str
    quess_batch_no: str

class IngestionConflictResponse(BaseModel):
    error: str
    conflicts: List[IngestionConflictDetail]
    message: str
