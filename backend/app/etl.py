import re
import io
import pandas as pd
from typing import Dict, List, Tuple
from sqlalchemy.orm import Session
from .models import Student, AdmissionAcademic, Compliance, Finance

# Geographic standardization mapping
STATE_MAPPING = {
    "MH": "Maharashtra",
    "MS": "Maharashtra",
    "DL": "Delhi",
    "UP": "Uttar Pradesh",
    "KA": "Karnataka",
    "TN": "Tamil Nadu",
    "TS": "Telangana",
    "TG": "Telangana",
    "AP": "Andhra Pradesh",
    "WB": "West Bengal",
    "HR": "Haryana",
    "PB": "Punjab",
    "GJ": "Gujarat",
    "MP": "Madhya Pradesh",
    "BR": "Bihar",
    "JH": "Jharkhand",
    "OD": "Odisha",
    "UK": "Uttarakhand",
}

def clean_academic_percentage(val) -> Tuple[float, bool]:
    if pd.isna(val):
        return 0.0, False
    val_str = str(val).strip()
    pursuing_keywords = ["appear", "pursuing", "awaited", "result", "studying"]
    if any(kw in val_str.lower() for kw in pursuing_keywords):
        return 0.0, True
    val_cleaned = re.sub(r"[%\s℅]", "", val_str)
    try:
        return float(val_cleaned), False
    except ValueError:
        return 0.0, False

def normalize_geographic_data(name: str, mapping: Dict[str, str] = STATE_MAPPING) -> str:
    if not name or pd.isna(name):
        return "Not Specified"
    cleaned = str(name).strip()
    upper_cleaned = cleaned.upper()
    if upper_cleaned in mapping:
        return mapping[upper_cleaned]
    return cleaned.title()

def normalize_columns(columns: List[str]) -> Dict[str, str]:
    return {
        col: str(col).lower()
        .replace("_", "")
        .replace(" ", "")
        .replace("/", "")
        .replace("%", "")
        .replace(".", "")
        .replace("(", "")
        .replace(")", "")
        for col in columns
    }

def detect_source_layer(df: pd.DataFrame) -> str:
    """
    Detects whether a DataFrame represents Source Layer A (Induction) or Source Layer B (Document/Compliance).
    """
    cols_clean = [str(c).lower().replace("_", "").replace(" ", "").replace(".", "").replace("(", "").replace(")", "") for c in df.columns]
    
    # Layer A characteristics: demographics, student keys, academic grades
    layer_a_keywords = ["gender", "dob", "birth", "tenth", "10th", "grade", "stream", "joining", "doj", "fathername", "mothername", "religion", "quessbatchno"]
    if any(any(kw in col for kw in layer_a_keywords) for col in cols_clean):
        return "LayerA"
        
    # Layer B characteristics: LC state, pending paperwork or banking summaries
    layer_b_keywords = ["lc", "leaving", "pending", "missing", "bank", "account", "ifsc"]
    if any(any(kw in col for kw in layer_b_keywords) for col in cols_clean):
        return "LayerB"
        
    return "Unknown"

def clean_cell_str(val) -> str:
    if pd.isna(val):
        return None
    s = str(val).strip()
    if s.lower() in ["nan", "none", "nil", "null", "nan.0"]:
        return None
    return s

def process_sync_workbook(file_path: str, db: Session, override: bool = False) -> Dict[str, any]:
    """
    Processes user upload for Source Layer A or Source Layer B (Excel or CSV dynamically).
    Enforces atomic transactions and unique ticket integrity checks.
    """
    try:
        if file_path.endswith(".csv"):
            df = pd.read_csv(file_path)
            layer = detect_source_layer(df)
        else:
            xls = pd.ExcelFile(file_path)
            sheets = xls.sheet_names
            selected_sheet = sheets[0]
            for s in sheets:
                s_clean = s.lower().replace(" ", "").replace("_", "")
                if s_clean in ["induction", "inductiondata"]:
                    selected_sheet = s
                    break
                if s_clean in ["documentpending", "documentpendinglist", "compliance"]:
                    selected_sheet = s
                    break
            df = pd.read_excel(xls, sheet_name=selected_sheet)
            layer = detect_source_layer(df)
    except Exception as e:
        return {"success": False, "error": f"Invalid spreadsheet format: {str(e)}"}
    
    if layer == "Unknown":
        return {
            "success": False,
            "error": "Unrecognized spreadsheet format. The file columns must match Source Layer A (Induction) or Source Layer B (Document List)."
        }

    cols = normalize_columns(df.columns)
    ticket_col = next((c for c, clean in cols.items() if "ticket" in clean), None)
    
    if not ticket_col:
        return {
            "success": False,
            "error": "Column mapping failed: A unique 'Ticket No' column must be declared."
        }
        
    # Filter rows with clean non-empty ticket numbers
    df["clean_ticket"] = df[ticket_col].astype(str).str.strip()
    df = df[df["clean_ticket"].notna() & (df["clean_ticket"] != "") & (df["clean_ticket"] != "nan")]
    
    if df.empty:
        return {"success": False, "error": "The uploaded spreadsheet contains zero valid student rows."}

    tickets_in_file = df["clean_ticket"].tolist()
    
    # --- IDEMPOTENCY UNIQUE CONSTRAINTS CHECK ---
    existing_students = db.query(Student).filter(Student.ticket_no.in_(tickets_in_file)).all()
    
    if existing_students and not override:
        # Collect conflict details for the HTTP 409 payloads
        conflicts = []
        for s in existing_students:
            batch_val = s.academics.quess_batch_no if s.academics else "Unknown"
            conflicts.append({
                "ticket_no": s.ticket_no,
                "full_name": s.full_name or "New Sync Profile",
                "quess_batch_no": batch_val
            })
        return {
            "success": False,
            "conflict": True,
            "error": "Previously synchronized records detected.",
            "conflicts": conflicts
        }

    records_processed = 0
    validation_errors = 0
    seeding_errors = []
    
    db.begin_nested() # Create transaction checkpoint
    
    for idx, row in df.iterrows():
        try:
            ticket_no = str(row["clean_ticket"])
            
            # Retrieve or construct student base
            student_obj = db.query(Student).filter(Student.ticket_no == ticket_no).first()
            is_new = False
            if not student_obj:
                student_obj = Student(ticket_no=ticket_no)
                is_new = True
                
            if layer == "LayerA":
                # --- SOURCE LAYER A: DEMOGRAPHICS & STUDENT KEYS ---
                full_name = clean_cell_str(row.get(next((c for c, cl in cols.items() if "fullnameasperaadharcard" in cl or "fullname" in cl or "name" in cl), "full_name")))
                if not full_name:
                    full_name = "Unknown Student"
                    
                father_name = clean_cell_str(row.get(next((c for c, cl in cols.items() if "fathername" in cl), "father_name")))
                last_name = clean_cell_str(row.get(next((c for c, cl in cols.items() if "lastnamesirname" in cl or "sirname" in cl), "last_name")))
                mother_name = clean_cell_str(row.get(next((c for c, cl in cols.items() if "mothername" in cl), "mother_name")))
                
                gender = clean_cell_str(row.get(next((c for c, cl in cols.items() if "gender" in cl), "gender")))
                if gender:
                    gender = gender.strip().title()
                else:
                    gender = "Not Specified"
                    
                religion = clean_cell_str(row.get(next((c for c, cl in cols.items() if "religion" in cl), "religion")))
                cast_category = clean_cell_str(row.get(next((c for c, cl in cols.items() if "castcategory" in cl), "cast_category")))
                blood_group = clean_cell_str(row.get(next((c for c, cl in cols.items() if "bloodgroup" in cl), "blood_group")))
                mother_tongue = clean_cell_str(row.get(next((c for c, cl in cols.items() if "monthertounge" in cl or "mothertongue" in cl), "mother_tongue")))
                marital_status = clean_cell_str(row.get(next((c for c, cl in cols.items() if "maritalstatus" in cl), "marital_status")))
                
                dob = clean_cell_str(row.get(next((c for c, cl in cols.items() if "dateofbirthasperaadhar" in cl or "dob" in cl), "dob")))
                if dob and dob.endswith("00:00:00"):
                    dob = dob.split(" ")[0]
                    
                contact_no = clean_cell_str(row.get(next((c for c, cl in cols.items() if "contactnumberaadharlinkno" in cl or "contact" in cl or "phone" in cl or "mobile" in cl), "contact_no")))
                email = clean_cell_str(row.get(next((c for c, cl in cols.items() if "email" in cl), "email")))
                
                raw_district = clean_cell_str(row.get(next((c for c, cl in cols.items() if "district" in cl), "district")))
                district = normalize_geographic_data(raw_district)
                
                raw_state = clean_cell_str(row.get(next((c for c, cl in cols.items() if "state" in cl), "state")))
                state = normalize_geographic_data(raw_state)
                
                # Commit basic demographic changes
                student_obj.full_name = full_name
                student_obj.father_name = father_name
                student_obj.last_name = last_name
                student_obj.mother_name = mother_name
                student_obj.gender = gender
                student_obj.religion = religion
                student_obj.cast_category = cast_category
                student_obj.blood_group = blood_group
                student_obj.mother_tongue = mother_tongue
                student_obj.marital_status = marital_status
                student_obj.dob = dob
                student_obj.contact_no = contact_no
                student_obj.email = email
                student_obj.district = district
                student_obj.state = state
                
                if is_new:
                    db.add(student_obj)
                    db.flush()
                
                # Fetch/Construct academics relational tables
                acad_obj = db.query(AdmissionAcademic).filter(AdmissionAcademic.student_id == student_obj.student_id).first()
                if not acad_obj:
                    acad_obj = AdmissionAcademic(student_id=student_obj.student_id)
                    db.add(acad_obj)
                    
                quess_batch_no = clean_cell_str(row.get(next((c for c, cl in cols.items() if "quessbatchno" in cl or "batch" in cl), "quess_batch_no")))
                if not quess_batch_no:
                    quess_batch_no = "B-2026"
                    
                sr_no = clean_cell_str(row.get(next((c for c, cl in cols.items() if "srno" in cl), "sr_no")))
                prn = clean_cell_str(row.get(next((c for c, cl in cols.items() if "prn" in cl), "prn")))
                doj = clean_cell_str(row.get(next((c for c, cl in cols.items() if "doj" in cl), "doj")))
                doa_in_pcu = clean_cell_str(row.get(next((c for c, cl in cols.items() if "doainpcu" in cl), "doa_in_pcu")))
                medical_no = clean_cell_str(row.get(next((c for c, cl in cols.items() if "medicalno" in cl), "medical_no")))
                apprentice_no = clean_cell_str(row.get(next((c for c, cl in cols.items() if "aprenticeno" in cl or "apprenticeno" in cl), "apprentice_no")))
                
                date_of_joining = doj or clean_cell_str(row.get(next((c for c, cl in cols.items() if "joining" in cl or "dateofjoining" in cl), "date_of_joining")))
                if date_of_joining and date_of_joining.endswith("00:00:00"):
                    date_of_joining = date_of_joining.split(" ")[0]
                    
                date_of_admission = clean_cell_str(row.get(next((c for c, cl in cols.items() if "admission" in cl or "dateofadmission" in cl), "date_of_admission")))
                if date_of_admission and date_of_admission.endswith("00:00:00"):
                    date_of_admission = date_of_admission.split(" ")[0]
                    
                stream_branch = clean_cell_str(row.get(next((c for c, cl in cols.items() if "stream" in cl or "trade" in cl or "branch" in cl), "stream_branch")))
                
                raw_10th = row.get(next((c for c, cl in cols.items() if "10" in cl or "ssc" in cl or "tenth" in cl), "tenth_percentage"))
                tenth_pct, tenth_pursuing = clean_academic_percentage(raw_10th)
                
                raw_12th = row.get(next((c for c, cl in cols.items() if "12" in cl or "hsc" in cl or "twelfth" in cl or "iti" in cl), "twelfth_iti_percentage"))
                twelfth_pct, twelfth_pursuing = clean_academic_percentage(raw_12th)
                
                student_obj.is_degree_pursuing = tenth_pursuing or twelfth_pursuing
                
                prior_institute = clean_cell_str(row.get(next((c for c, cl in cols.items() if "prior" in cl or "previous" in cl or "school" in cl or "institute" in cl), "prior_institute")))
                
                raw_gaps = row.get(next((c for c, cl in cols.items() if "gap" in cl), "enrollment_gaps"))
                try:
                    enrollment_gaps = int(float(raw_gaps)) if not pd.isna(raw_gaps) else 0
                except ValueError:
                    enrollment_gaps = 0
                    
                qualification = clean_cell_str(row.get(next((c for c, cl in cols.items() if "qualification" in cl or "education" in cl), "qualification_education")))
                if not qualification:
                    if stream_branch and any(kw in stream_branch.lower() for kw in ["iti", "welder", "machinist", "fitter", "electrician"]):
                        qualification = "ITI"
                    else:
                        qualification = "12th"
                
                acad_obj.quess_batch_no = quess_batch_no
                acad_obj.qualification_education = qualification
                acad_obj.date_of_joining = date_of_joining
                acad_obj.date_of_admission = date_of_admission
                acad_obj.stream_branch = stream_branch
                acad_obj.tenth_percentage = tenth_pct
                acad_obj.twelfth_iti_percentage = twelfth_pct
                acad_obj.prior_institute = prior_institute
                acad_obj.enrollment_gaps = enrollment_gaps
                acad_obj.sr_no = sr_no
                acad_obj.prn = prn
                acad_obj.doj = doj
                acad_obj.doa_in_pcu = doa_in_pcu
                acad_obj.medical_no = medical_no
                acad_obj.apprentice_no = apprentice_no

            else:
                # --- SOURCE LAYER B: COMPLIANCE STATUS & BANK DETAILS ---
                raw_lc = str(row.get(next((c for c, cl in cols.items() if "lc" in cl or "leaving" in cl), "is_lc_submitted"))).strip().lower()
                is_lc_submitted = raw_lc in ["yes", "y", "true", "1", "submitted", "done"]
                
                raw_pending = str(row.get(next((c for c, cl in cols.items() if "pending" in cl or "missing" in cl), "pending_documents_array"))).strip()
                pending_docs = []
                if raw_pending and raw_pending.lower() != "nan" and raw_pending.lower() != "none" and raw_pending.lower() != "nil":
                    pending_docs = [d.strip() for d in re.split(r"[,;|]", raw_pending) if d.strip()]
                    
                admission_status = str(row.get(next((c for c, cl in cols.items() if "admstatus" in cl or "admissionstatus" in cl), "admission_status"))).strip().title()
                if admission_status.lower() == "nan" or not admission_status:
                    admission_status = "Pending"
                    
                bank_name = clean_cell_str(row.get(next((c for c, cl in cols.items() if "bank" in cl), "bank_name")))
                account_no = clean_cell_str(row.get(next((c for c, cl in cols.items() if "account" in cl or "acc" in cl), "account_no")))
                if account_no and "." in account_no and "e" in account_no.lower():
                    try:
                        account_no = str(int(float(account_no)))
                    except ValueError:
                        pass
                        
                ifsc_code = clean_cell_str(row.get(next((c for c, cl in cols.items() if "ifsc" in cl), "ifsc_code")))
                if ifsc_code:
                    ifsc_code = ifsc_code.upper()
                    
                raw_operational_status = str(row.get(next((c for c, cl in cols.items() if "opstatus" in cl or "operationalstatus" in cl or ("status" in cl and cl != "admissionstatus")), "status"))).strip()
                raw_reason = str(row.get(next((c for c, cl in cols.items() if "reason" in cl or "dropout" in cl), "dropout_reason"))).strip()
                
                dropout_reason = None
                if raw_reason and raw_reason.lower() != "nan" and raw_reason.lower() != "none" and raw_reason.lower() != "nil":
                    dropout_reason = raw_reason
                
                if raw_operational_status.lower() in ["inactive", "separated", "dropout", "left"] or dropout_reason:
                    status = "Separated"
                    if not dropout_reason:
                        dropout_reason = "Left Program / Inactive Status"
                elif is_lc_submitted and not any("identity" in d.lower() or "aadhaar" in d.lower() or "pan" in d.lower() for d in pending_docs):
                    status = "Active"
                else:
                    status = "Pending Completion"
                
                student_obj.status = status
                student_obj.dropout_reason = dropout_reason
                
                if is_new:
                    db.add(student_obj)
                    db.flush()
                
                # Compliance updates
                comp_obj = db.query(Compliance).filter(Compliance.student_id == student_obj.student_id).first()
                if not comp_obj:
                    comp_obj = Compliance(student_id=student_obj.student_id)
                    db.add(comp_obj)
                
                comp_obj.is_lc_submitted = is_lc_submitted
                comp_obj.pending_documents_array = pending_docs
                comp_obj.admission_status = admission_status
                
                # Finance updates
                fin_obj = db.query(Finance).filter(Finance.student_id == student_obj.student_id).first()
                if not fin_obj:
                    fin_obj = Finance(student_id=student_obj.student_id)
                    db.add(fin_obj)
                
                fin_obj.bank_name = bank_name
                fin_obj.account_no = account_no
                fin_obj.ifsc_code = ifsc_code

            db.flush()
            records_processed += 1
        except Exception as e:
            validation_errors += 1
            seeding_errors.append(f"Row {idx} Failed (Ticket: {row.get('clean_ticket', 'Unknown')}): {str(e)}")
            
    if seeding_errors and records_processed == 0:
        db.rollback()
        return {"success": False, "error": f"Seed transaction aborted. First error: {seeding_errors[0]}"}
        
    db.commit()
    return {
        "success": True,
        "layer": layer,
        "records_parsed": records_processed,
        "validation_errors": validation_errors,
        "seeding_errors": seeding_errors
    }
