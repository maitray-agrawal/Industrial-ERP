from fastapi import FastAPI, Depends, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
import io
import os
import pandas as pd

# ReportLab PDF compiler dependencies
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from .database import engine, Base, get_db, SessionLocal
from .models import Student, AdmissionAcademic, Compliance, Finance, StudentAttendanceLedger
from .schemas import StudentResponse, IngestionConflictResponse
from .etl import process_sync_workbook, detect_source_layer
from .ojt import sync_ojt_attendance

# Build database schema (SQLite)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Aether Enterprise ERP API Gateway",
    description="Refactored High-Performance ERP Systems Backend with universal synchronizer and dynamic ReportLab PDF compiler",
    version="3.0.0"
)

# Enable CORS for frontend linkage
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    # Automatically sync the live OJT spreadsheet if it exists on boot
    db = SessionLocal()
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        csv_path = os.path.join(base_dir, "..", "live_ojt_sheet.csv")
        xlsx_path = os.path.join(base_dir, "..", "live_ojt_sheet.xlsx")
        live_path = csv_path if os.path.exists(csv_path) else (xlsx_path if os.path.exists(xlsx_path) else None)
        if live_path:
            with open(live_path, "rb") as f:
                contents = f.read()
            filename = os.path.basename(live_path)
            sync_ojt_attendance(contents, filename, db, override=True)
            print("INFO: Live OJT spreadsheet loaded and parsed automatically on boot.")
    except Exception as e:
        print(f"ERROR: Failed auto-syncing live OJT sheet on startup: {e}")
    finally:
        db.close()

@app.post("/api/v1/database/clear")
def clear_database(db: Session = Depends(get_db)):
    """
    Wipes the active database entirely and recreates empty schemas, clearing any sample data.
    """
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return {"success": True, "message": "Database successfully wiped clean. All sample data cleared."}

@app.post("/api/v1/sync/live-trigger")
def trigger_live_ojt_sync(db: Session = Depends(get_db)):
    """
    Triggers automatic daily sync from the live spreadsheet saved on the disk.
    If no live file exists, returns a status warning.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, "..", "live_ojt_sheet.csv")
    xlsx_path = os.path.join(base_dir, "..", "live_ojt_sheet.xlsx")
    
    live_path = csv_path if os.path.exists(csv_path) else (xlsx_path if os.path.exists(xlsx_path) else None)
    if not live_path:
        return {"success": False, "message": "No live OJT spreadsheet has been uploaded yet."}
        
    try:
        with open(live_path, "rb") as f:
            contents = f.read()
        filename = os.path.basename(live_path)
        result = sync_ojt_attendance(contents, filename, db, override=True)
        return {
            "success": result.get("success", False),
            "message": "Live OJT spreadsheet synchronized automatically!",
            "details": result
        }
    except Exception as e:
        return {"success": False, "message": f"Failed to sync live spreadsheet: {str(e)}"}

def generate_pdf_report(logs: List[StudentAttendanceLedger]) -> io.BytesIO:
    """
    Tabular PDF print layout compiler using ReportLab.
    Enforces precise grid alignment, page landscape margins, and overall aggregates box.
    """
    output = io.BytesIO()
    doc = SimpleDocTemplate(
        output, 
        pagesize=landscape(letter), 
        rightMargin=30, 
        leftMargin=30, 
        topMargin=30, 
        bottomMargin=30
    )
    story = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'TitleStyle', parent=styles['Heading1'], fontSize=16, textColor=colors.HexColor('#0F172A'), spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'SubtitleStyle', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#475569'), spaceAfter=15
    )
    
    story.append(Paragraph("AETHER ENTERPRISE STUDENT LIFECYCLE ERP", title_style))
    story.append(Paragraph("DAILY OJT SEGMENTED ATTENDANCE LEDGER PRINT REPORT", subtitle_style))
    
    # Grid contents
    headers = ["Ticket No", "Student Name", "Date", "Shift", "Workplace Floor", "In Time", "Out Time", "Status"]
    data = [headers]
    
    presents = 0
    absents = 0
    separated = 0
    
    for log in logs:
        name = log.student.full_name if log.student else "Registered Student"
        in_t = log.in_time or "—"
        out_t = log.out_time or "—"
        data.append([
            log.ticket_no,
            name,
            log.date,
            log.shift or "Regular",
            log.shop_floor or "Shop Floor",
            in_t,
            out_t,
            log.status
        ])
        
        if log.status == "Present":
            presents += 1
        elif log.status == "Absent":
            absents += 1
        else:
            separated += 1
            
    # Layout metrics table style
    t = Table(data, colWidths=[60, 130, 70, 75, 120, 60, 60, 65])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E293B')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('TOPPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 8),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('TEXTCOLOR', (0,1), (-1,-1), colors.HexColor('#334155')),
        ('BOTTOMPADDING', (0,1), (-1,-1), 4),
        ('TOPPADDING', (0,1), (-1,-1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 15))
    
    # Totals Summary Box
    summary_text = f"<b>Total Segmented Logs:</b> {len(logs)} | <b>Presents:</b> {presents} | <b>Absents:</b> {absents} | <b>Separated:</b> {separated}"
    summary_style = ParagraphStyle(
        'SummaryStyle',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#0F172A'),
        backColor=colors.HexColor('#F1F5F9'),
        borderColor=colors.HexColor('#CBD5E1'),
        borderWidth=1,
        borderPadding=8
    )
    story.append(Paragraph(summary_text, summary_style))
    
    doc.build(story)
    output.seek(0)
    return output

@app.post("/api/v1/sync/upload")
def sync_universal_spreadsheet(
    file: UploadFile = File(...),
    override: bool = Query(False, description="Flag to force overwrite and update mutable fields in database"),
    db: Session = Depends(get_db)
):
    """
    UNIVERSAL SYNCHRONIZER UPLOAD GATEWAY.
    Processes any user binary spreadsheet (.xlsx, .xls, .csv), detects the data structure,
    and runs the appropriate parser atomically. Enforces duplicate reject boundaries.
    """
    if not file.filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Only Excel or CSV spreadsheets are accepted.")

    contents = file.file.read()
    
    # Peek columns to route spreadsheet
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse spreadsheet content: {str(e)}")

    cols_clean = [str(c).lower().replace("_", "").replace(" ", "") for c in df.columns]
    ojt_keywords = ["shift", "intime", "outtime", "punch", "attendancestatus", "costcentre", "psatext"]
    is_ojt_ledger = any(any(kw in col for kw in ojt_keywords) for col in cols_clean) or ("date" in cols_clean and "status" in cols_clean)

    if is_ojt_ledger:
        # Route to OJT Parser!
        result = sync_ojt_attendance(contents, file.filename, db, override=override)
    else:
        # Write to temp file for workbook sheets detection
        temp_path = f"sync_temp_{file.filename}"
        try:
            with open(temp_path, "wb") as f:
                f.write(contents)
            result = process_sync_workbook(temp_path, db, override=override)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    # COLLISION DETECTED - HTTP 409
    if result.get("conflict"):
        raise HTTPException(
            status_code=409, 
            detail={
                "error": "Dual re-upload conflict intercepted.",
                "conflicts": result.get("conflicts", []),
                "message": "Previously synchronized records found in database. Choose to cancel or override mutable fields."
            }
        )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    if is_ojt_ledger:
        # Save OJT spreadsheet to disk permanently
        ext = ".csv" if file.filename.endswith(".csv") else ".xlsx"
        base_dir = os.path.dirname(os.path.abspath(__file__))
        live_path = os.path.join(base_dir, "..", f"live_ojt_sheet{ext}")
        try:
            with open(live_path, "wb") as f:
                f.write(contents)
            # Delete other format to prevent duplicate live files
            other_ext = ".xlsx" if ext == ".csv" else ".csv"
            other_path = os.path.join(base_dir, "..", f"live_ojt_sheet{other_ext}")
            if os.path.exists(other_path):
                os.remove(other_path)
        except Exception as e:
            print(f"ERROR saving live sheet: {e}")

    return result

# Legacy route mapped for backwards compatibility
@app.post("/api/v1/admissions/sync")
def legacy_sync_admissions(file: UploadFile = File(...), override: bool = Query(False), db: Session = Depends(get_db)):
    return sync_universal_spreadsheet(file=file, override=override, db=db)

# Core Admission Upload Route mapped to universal sync
@app.post("/api/v1/admissions/upload")
def admissions_upload_spreadsheet(
    file: UploadFile = File(...),
    override: bool = Query(False, description="Flag to force override and update mutable fields in database"),
    db: Session = Depends(get_db)
):
    return sync_universal_spreadsheet(file=file, override=override, db=db)

# Legacy route mapped for backwards compatibility
@app.post("/api/v1/attendance/sync")
def legacy_sync_attendance(file: UploadFile = File(...), db: Session = Depends(get_db)):
    return sync_universal_spreadsheet(file=file, override=True, db=db)

@app.put("/api/v1/students/update")
def update_student_profile(
    ticket_no: str = Query(..., description="Unique student ticket identifier to update"),
    full_name: Optional[str] = Query(None, description="Update name"),
    status: Optional[str] = Query(None, description="Update operational status"),
    quess_batch_no: Optional[str] = Query(None, description="Update batch"),
    qualification_education: Optional[str] = Query(None, description="Update qualification"),
    db: Session = Depends(get_db)
):
    """
    Explicit RESTful PUT gate to modify existing student mutable relational fields.
    """
    student = db.query(Student).filter(Student.ticket_no == ticket_no.strip()).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student T-No {ticket_no} not registered in database.")
        
    if full_name:
        student.full_name = full_name.strip()
    if status:
        student.status = status.strip()
        
    if student.academics:
        if quess_batch_no:
            student.academics.quess_batch_no = quess_batch_no.strip()
        if qualification_education:
            student.academics.qualification_education = qualification_education.strip()
            
    db.commit()
    return {"success": True, "message": f"Student T-No {ticket_no} synchronized updates executed."}

@app.get("/api/v1/students/search-card", response_model=List[StudentResponse])
def search_students_card(
    query_str: Optional[str] = Query(None, description="Composite scan lookup bar matching Quess Batch, Ticket, or Full Name"),
    qualification_education: Optional[str] = Query(None, description="Filter operational category: 12th vs ITI"),
    trade_stream_branch: Optional[str] = Query(None, description="Filter operational category: Trade/Stream branch"),
    admission_status: Optional[str] = Query(None, description="Filter operational category: Pending vs Confirmed"),
    document_delinquency: Optional[str] = Query(None, description="Filter LC/Identity paperwork status: Pending vs Submitted vs Missing"),
    db: Session = Depends(get_db)
):
    """
    TRIPLE-ATTRIBUTE SEARCH ROUTER & MULTI-FEATURE QUERY GATEWAY.
    Executes prefix and partial matching scan lookups across ticket_no, quess_batch_no, or full_name.
    """
    query = db.query(Student).outerjoin(AdmissionAcademic).outerjoin(Compliance).outerjoin(Finance)
    
    # 1. COMPOSITE KEY INDEX LOOKUP (Batch, Ticket, Name)
    if query_str and query_str.strip():
        term = query_str.strip()
        upper_term = term.upper()
        
        if upper_term.startswith("T-"):
            query = query.filter(Student.ticket_no == term)
        elif upper_term.startswith("B-"):
            query = query.filter(AdmissionAcademic.quess_batch_no.ilike(f"%{term}%"))
        else:
            query = query.filter(Student.full_name.ilike(f"%{term}%"))

    # 2. MULTI-FEATURE COMPONENT FILTERING
    if qualification_education:
        if "12th" in qualification_education:
            query = query.filter(AdmissionAcademic.qualification_education.ilike("%12th%"))
        else:
            query = query.filter(AdmissionAcademic.qualification_education == qualification_education)
        
    if trade_stream_branch:
        query = query.filter(AdmissionAcademic.stream_branch.ilike(f"%{trade_stream_branch}%"))
        
    if admission_status:
        if admission_status.lower() in ["completed", "confirmed"]:
            query = query.filter(Compliance.admission_status.in_(["Confirmed", "Completed"]))
        elif admission_status.lower() in ["pending", "process pending"]:
            query = query.filter(Compliance.admission_status.in_(["Pending", "Provisional"]))
        else:
            query = query.filter(Compliance.admission_status == admission_status)
        
    if document_delinquency:
        if document_delinquency.lower() in ["pending", "lc_pending"]:
            query = query.filter(Compliance.is_lc_submitted == False)
        elif document_delinquency.lower() in ["submitted", "lc_submitted"]:
            query = query.filter(Compliance.is_lc_submitted == True)
        elif document_delinquency.lower() == "missing":
            query = query.filter(
                or_(
                    Compliance.is_lc_submitted == False,
                    Compliance.pending_documents_array != None
                )
            )

    return query.order_by(Student.full_name).all()

# Legacy query alias
@app.get("/api/v1/students/query", response_model=List[StudentResponse])
def legacy_query(query_str: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return search_students_card(query_str=query_str, db=db)

@app.get("/api/v1/attendance/export")
def export_attendance_matrix_report(
    ticket_no: Optional[str] = Query(None, description="Filter for specific student ticket"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    shift: Optional[str] = Query(None),
    workplace: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    export_type: str = Query("excel", description="excel or pdf"),
    db: Session = Depends(get_db)
):
    """
    DEEP MULTI-ATTRIBUTE EXPORT UTILITY.
    Applies search filter scopes dynamically, and compiles either a pivoted
    Excel spreadsheet matrix or a color-coded, tabular ReportLab PDF print layout.
    """
    query = db.query(StudentAttendanceLedger).join(Student)
    
    # Dynamic segmentation filters
    if ticket_no:
        query = query.filter(StudentAttendanceLedger.ticket_no == ticket_no)
    if start_date:
        query = query.filter(StudentAttendanceLedger.date >= start_date)
    if end_date:
        query = query.filter(StudentAttendanceLedger.date <= end_date)
    if shift:
        query = query.filter(StudentAttendanceLedger.shift == shift)
    if workplace:
        query = query.filter(
            or_(
                StudentAttendanceLedger.shop_floor.ilike(f"%{workplace}%"),
                StudentAttendanceLedger.line_manager_name.ilike(f"%{workplace}%")
            )
        )
    if status:
        query = query.filter(StudentAttendanceLedger.status == status)

    logs = query.order_by(StudentAttendanceLedger.date).all()
    
    if not logs:
        raise HTTPException(status_code=404, detail="No active daily OJT attendance logs matching filters were found.")

    if export_type.lower() == "pdf":
        output = generate_pdf_report(logs)
        return StreamingResponse(
            output,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=OJT_Attendance_Segment_Report.pdf"}
        )
        
    else:
        # --- GENERATE EXCEL PIVOT MATRIX ---
        data = []
        for log in logs:
            name = log.student.full_name if log.student else "Registered Student"
            data.append({
                "Ticket No": log.ticket_no,
                "Student Name": name,
                "Date": log.date,
                "Status": log.status,
                "Shift": log.shift or "Regular",
                "Workplace": log.shop_floor or "Shop Floor"
            })
            
        df = pd.DataFrame(data)
        
        pivot_df = df.pivot_table(
            index=["Ticket No", "Student Name", "Workplace"],
            columns="Date",
            values="Status",
            aggfunc="first"
        ).fillna("Absent")
        
        pivot_df = pivot_df.reset_index()
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            pivot_df.to_excel(writer, sheet_name="Filtered Ledger Matrix", index=False)
            
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=OJT_Attendance_Ledger_Matrix.xlsx"}
        )

# Support legacy export-sheet route
@app.get("/api/v1/attendance/export-sheet")
def export_sheet_legacy(db: Session = Depends(get_db)):
    return export_attendance_matrix_report(db=db, export_type="excel")

@app.get("/api/v1/samples/download/layerA")
def download_layer_a_sample():
    from .generate_samples import create_sample_layer_a_xlsx
    buf = create_sample_layer_a_xlsx()
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=sample_source_layerA_induction.xlsx"}
    )

@app.get("/api/v1/samples/download/layerB")
def download_layer_b_sample():
    from .generate_samples import create_sample_layer_b_xlsx
    buf = create_sample_layer_b_xlsx()
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=sample_source_layerB_compliance.xlsx"}
    )

@app.get("/api/v1/samples/download/layerC")
def download_layer_c_sample():
    from .generate_samples import create_sample_layer_c_csv
    buf = create_sample_layer_c_csv()
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sample_source_layerC_attendance.csv"}
    )

# Force Uvicorn daemon hot-reload for database descriptor update

