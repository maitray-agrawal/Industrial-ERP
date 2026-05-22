import io
import re
import pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session
from .models import Student, StudentAttendanceLedger, Finance

def clean_cell_str(val) -> str:
    if pd.isna(val):
        return None
    s = str(val).strip()
    if s.lower() in ["nan", "none", "nil", "null", "nan.0"]:
        return None
    return s

def sync_ojt_attendance(file_content: bytes, filename: str, db: Session, override: bool = False) -> dict:
    """
    Parses Source Layer C: OJT Form Responses containing daily transactional logs,
    supporting multi-variant header layouts, fuzzy columns mapping, and robust fallbacks.
    Enforces atomic transactions and unique database ticket-date collisions.
    """
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_content))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file_content))
        else:
            return {"success": False, "error": "Invalid format. Only Excel or CSV are supported."}
    except Exception as e:
        return {"success": False, "error": f"Failed to open attendance file: {str(e)}"}

    # Dynamic schema column identification
    cols = {
        str(col).lower()
        .replace("_", "")
        .replace(" ", "")
        .replace("/", "")
        .replace(".", "")
        .replace("(", "")
        .replace(")", ""): col for col in df.columns
    }
    
    # 1. Primary Direct Lookups
    ticket_col = next((cols[k] for k in ["ticketno", "ticketnumber", "ticket"] if k in cols), None)
    date_col = next((cols[k] for k in ["date", "calendardate", "timestamp", "day", "punchdate", "logdate"] if k in cols), None)
    status_col = next((cols[k] for k in ["attendancestatus", "status", "attendance", "workstatus", "work_status", "attendancestatusoption"] if k in cols), None)
    
    # 2. Fuzzy Fallbacks (Only if primary direct lookups fail)
    if not ticket_col:
        ticket_col = next((cols[k] for k in cols if "ticket" in k or "tk" in k or "prn" in k or "aprentice" in k), None)
    if not date_col:
        date_col = next((cols[k] for k in cols if "date" in k or "day" in k or "time" in k or "cal" in k or "punch" in k), None)
    if not status_col:
        status_col = next((cols[k] for k in cols if "status" in k or "attend" in k or "present" in k or "work" in k), None)
        
    # Check if student identifier is STILL missing
    if not ticket_col:
        return {
            "success": False,
            "error": "Column mapping failed: A unique student identifier ('Ticket No' or 'Ticket Number') must be declared."
        }

    # Extract fallback date from filename or default to today if date column is absent
    filename_date = None
    if not date_col:
        date_match = re.search(r"(\d{4}-\d{2}-\d{2})", filename)
        if date_match:
            filename_date = date_match.group(1)
        else:
            filename_date = datetime.now().strftime("%Y-%m-%d")

    # Filter empty or nan ticket rows
    df["clean_ticket"] = df[ticket_col].astype(str).str.strip()
    df = df[df["clean_ticket"].notna() & (df["clean_ticket"] != "") & (df["clean_ticket"] != "nan")]

    if df.empty:
        return {"success": False, "error": "The uploaded spreadsheet contains zero valid attendance rows."}

    # --- DUAL UPLOADING CONFLICT SCANNING ---
    conflicts = []
    for idx, row in df.iterrows():
        ticket_no = str(row["clean_ticket"])
        
        # Resolve date
        if date_col:
            raw_date = row[date_col]
            date_str = "Not Specified"
            if raw_date and not pd.isna(raw_date):
                try:
                    date_str = str(raw_date).split(" ")[0].strip()
                except Exception:
                    date_str = str(raw_date)
        else:
            date_str = filename_date

        # Check if record already exists for ticket and date in database
        ledger_entry = db.query(StudentAttendanceLedger).filter(
            StudentAttendanceLedger.ticket_no == ticket_no,
            StudentAttendanceLedger.date == date_str
        ).first()

        if ledger_entry:
            s_name = "Registered Student"
            student = db.query(Student).filter(Student.ticket_no == ticket_no).first()
            if student:
                s_name = student.full_name or s_name
            
            conflicts.append({
                "ticket_no": ticket_no,
                "full_name": s_name,
                "quess_batch_no": date_str
            })

    if conflicts and not override:
        return {
            "success": False,
            "conflict": True,
            "error": "Dual re-upload collision intercepted in attendance ledger.",
            "conflicts": conflicts
        }

    records_processed = 0
    updates_log = []
    
    db.begin_nested() # Create transaction checkpoint
    
    for idx, row in df.iterrows():
        ticket_no = str(row["clean_ticket"])
        student = db.query(Student).filter(Student.ticket_no == ticket_no).first()
        if not student:
            continue
            
        # Resolve date
        if date_col:
            raw_date = row[date_col]
            date_str = "Not Specified"
            if raw_date and not pd.isna(raw_date):
                try:
                    date_str = str(raw_date).split(" ")[0].strip()
                except Exception:
                    date_str = str(raw_date)
        else:
            date_str = filename_date

        # Resolve status
        if status_col:
            raw_status = str(row[status_col]).strip().title()
            status = "Present"
            if raw_status.lower() in ["absent", "abs", "a", "0", "false"]:
                status = "Absent"
            elif raw_status.lower() in ["separated", "sep", "left", "dropout"]:
                status = "Separated"
        else:
            status = "Present"
            
        # Metadata & Work-Center Attributes
        psa_text = clean_cell_str(row.get(cols.get("psatext")))
        cost_centre = clean_cell_str(row.get(cols.get("costcentre")))
        cost_centre_text = clean_cell_str(row.get(cols.get("costcentretext")))
        working_cost_centre = clean_cell_str(row.get(cols.get("workingcostcentre")))
        access_control_group = clean_cell_str(row.get(cols.get("accesscontrolgroup")))
        
        # Log Metrics
        shift = clean_cell_str(row.get(cols.get("shift"))) or "Regular"
        in_time = clean_cell_str(row.get(cols.get("intime") or cols.get("punchin") or cols.get("in")))
        out_time = clean_cell_str(row.get(cols.get("outtime") or cols.get("punchout") or cols.get("out")))
        
        raw_hours = row.get(cols.get("totalhours"))
        total_hours = None
        if raw_hours and not pd.isna(raw_hours):
            try:
                total_hours = float(raw_hours)
            except Exception:
                total_hours = None
                
        remarks = clean_cell_str(row.get(cols.get("remarks")))
        punctuality_status = clean_cell_str(row.get(cols.get("punctualitystatus")))
        punch_type = clean_cell_str(row.get(cols.get("punchtype")))
        work_status = clean_cell_str(row.get(cols.get("workstatus")))
        
        timestamp_logged = datetime.now().isoformat()
        
        # Retrieve or construct record
        ledger_entry = db.query(StudentAttendanceLedger).filter(
            StudentAttendanceLedger.ticket_no == ticket_no,
            StudentAttendanceLedger.date == date_str
        ).first()
        
        if not ledger_entry:
            ledger_entry = StudentAttendanceLedger(
                student_id=student.student_id,
                ticket_no=ticket_no,
                date=date_str
            )
            db.add(ledger_entry)
            
        ledger_entry.status = status
        ledger_entry.shift = shift
        ledger_entry.in_time = in_time
        ledger_entry.out_time = out_time
        ledger_entry.timestamp_logged = timestamp_logged
        ledger_entry.shop_floor = cost_centre_text or psa_text or "Shop Floor"
        ledger_entry.line_manager_name = clean_cell_str(row.get(next((cols[k] for k in ["linemanager", "linemanagername", "supervisor"] if k in cols), "line_manager_name"))) or "Line Manager"
        
        # Extended attributes
        ledger_entry.psa_text = psa_text
        ledger_entry.cost_centre = cost_centre
        ledger_entry.cost_centre_text = cost_centre_text
        ledger_entry.working_cost_centre = working_cost_centre
        ledger_entry.access_control_group = access_control_group
        ledger_entry.total_hours = total_hours
        ledger_entry.remarks = remarks
        ledger_entry.punctuality_status = punctuality_status
        ledger_entry.punch_type = punch_type
        ledger_entry.work_status = work_status
        
        records_processed += 1
        updates_log.append({
            "ticket_no": ticket_no,
            "full_name": student.full_name,
            "date": date_str,
            "status": status,
            "shift": shift,
            "in_time": in_time,
            "out_time": out_time
        })

    db.flush()
    
    # --- RECALCULATE PAYOUT ELIGIBILITY ---
    students_updated = db.query(Student).all()
    for s in students_updated:
        finance = db.query(Finance).filter(Finance.student_id == s.student_id).first()
        if finance:
            present_count = db.query(StudentAttendanceLedger).filter(
                StudentAttendanceLedger.student_id == s.student_id,
                StudentAttendanceLedger.status == "Present"
            ).count()
            finance.attendance_payout_eligible = present_count >= 15

    db.commit()
    return {
        "success": True,
        "records_processed": records_processed,
        "updates": updates_log
    }
