import sys
import io
from sqlalchemy.orm import Session
from app.database import SessionLocal, Base, engine
from app.generate_samples import create_sample_layer_a_xlsx, create_sample_layer_b_xlsx, create_sample_layer_c_csv
from app.models import Student, StudentAttendanceLedger, Finance
from app.ojt import sync_ojt_attendance
from app.main import generate_pdf_report

def run_tests():
    print("--- STARTING DETERMINISTIC AUTOMATED INTEGRATION TESTS (PHASE 3) ---")
    
    # 1. Clear database and create tables fresh
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    
    # 2. Get samples
    layer_a_bytes = create_sample_layer_a_xlsx().read()
    layer_b_bytes = create_sample_layer_b_xlsx().read()
    layer_c_bytes = create_sample_layer_c_csv().read()
    
    # --- TEST 1: Universal sync parsing (Admissions Layer A) ---
    print("[TEST 1] Ingesting Admissions Layer A demographics...")
    from app.etl import process_sync_workbook
    with open("temp_layerA.xlsx", "wb") as f:
        f.write(layer_a_bytes)
    res_a = process_sync_workbook("temp_layerA.xlsx", db, override=False)
    assert res_a["success"] is True, f"Layer A ingest failed: {res_a}"
    print(f"  -> SUCCESS! Ingested demographics. Records parsed: {res_a['records_parsed']}")

    # --- TEST 2: Admissions Layer B Ingestion ---
    print("[TEST 2] Ingesting Admissions Layer B compliance/finance details...")
    with open("temp_layerB.xlsx", "wb") as f:
        f.write(layer_b_bytes)
    res_b = process_sync_workbook("temp_layerB.xlsx", db, override=True)
    assert res_b["success"] is True, f"Layer B ingest failed: {res_b}"
    print(f"  -> SUCCESS! Ingested compliance. Records parsed: {res_b['records_parsed']}")

    # --- TEST 3: Ingesting Layer C Daily Logs ---
    print("[TEST 3] Ingesting Daily Attendance Ledger logs...")
    res_c = sync_ojt_attendance(layer_c_bytes, "temp_layerC.csv", db, override=False)
    assert res_c["success"] is True, f"Layer C sync failed: {res_c}"
    print(f"  -> SUCCESS! Ingested daily attendance. Records processed: {res_c['records_processed']}")

    # --- TEST 4: Collision Intercepting & Rollback ---
    print("[TEST 4] Testing Idempotency & Attendance Duplicate collision intercepts...")
    res_c_dup = sync_ojt_attendance(layer_c_bytes, "temp_layerC.csv", db, override=False)
    assert res_c_dup.get("conflict") is True, f"Expected duplicate conflict error, got: {res_c_dup}"
    print(f"  -> SUCCESS! Duplicate checked. Blocked dual-upload collision cleanly.")

    # --- TEST 5: PDF Print Layout compiling with ReportLab ---
    print("[TEST 5] Testing ReportLab Tabular PDF print compilation...")
    logs = db.query(StudentAttendanceLedger).all()
    pdf_buf = generate_pdf_report(logs)
    pdf_bytes = pdf_buf.read()
    assert len(pdf_bytes) > 0, "PDF generation compiled empty stream!"
    print(f"  -> SUCCESS! Compiled grid-aligned PDF. Bytes generated: {len(pdf_bytes)}")

    print("--- ALL PHASE 3 AUTOMATED TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    run_tests()
