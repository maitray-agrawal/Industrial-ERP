import io
import pandas as pd

def create_sample_layer_a_xlsx() -> io.BytesIO:
    """
    Creates an in-memory sample representing Source Layer A (Induction Data).
    Contains raw demographics, batch, academics, and qualification indicators.
    """
    layer_a_data = {
        "Ticket No": ["T-1001", "T-1002", "T-1003", "T-1004", "T-1005", "T-1006"],
        "Student Name": ["Aarav Sharma", "Priya Patel", "Vikram Singh", "Anjali Deshmukh", "Rahul Verma", "Sneha Reddy"],
        "Gender": ["Male", "Female", "Male", "Female", "Male", "Female"],
        "DOB": ["2002-05-14", "2003-08-22", "2001-12-05", "2003-03-19", "2002-10-30", "2004-01-15"],
        "Contact No": ["9876543210", "8765432109", "7654321098", "9812345678", "8823456789", "7734567890"],
        "Email": [
            "aarav@example.com", "priya@example.com", "vikram@example.com", 
            "anjali@example.com", "rahul@example.com", "sneha@example.com"
        ],
        "District Name": ["   pune ", "Mumbai", "New Delhi", " Nagpur ", "Bangalore", "Hyderabad"],
        "State": ["MH", "MH", "DL", "MH", "KA", "TS"],
        "Quess Batch No": ["B-2026-A", "B-2026-A", "B-2026-B", "B-2026-B", "B-2026-A", "B-2026-C"],
        "Date of Joining": ["2026-01-10", "2026-01-10", "2026-01-15", "2026-01-15", "2026-01-10", "2026-02-01"],
        "Date of Admission": ["2026-01-12", "2026-01-12", "2026-01-18", "2026-01-17", "2026-01-11", "2026-02-04"],
        "Stream/Trade": ["Machinist", "Electrical", "Electronics", "Machinist", "Fitter", "Computer ITI"],
        "10th Percentage": ["84.50%", "78.20%", "89.10 ℅", "65.40%", "Appear", "92.00%"],
        "12th/ITI Percentage": ["79.30%", "Appear", "82.40%", "58.00%", "72.10%", "85.60%"],
        "Prior Institute": [
            "Pune Technical High", "St. Marys Mumbai", "Delhi Science Academy", 
            "Nagpur City School", "Bangalore Boys School", "Hyderabad Girls Poly"
        ],
        "Enrollment Gaps": [0, 0, 1, 2, 0, 0],
        "Qualification Education": ["12th", "12th", "12th", "12th", "ITI", "ITI"]
    }
    
    df = pd.DataFrame(layer_a_data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Induction Data", index=False)
    output.seek(0)
    return output

def create_sample_layer_b_xlsx() -> io.BytesIO:
    """
    Creates an in-memory sample representing Source Layer B (Document Pending List).
    Contains document checklists, bank metadata, and attrition markers.
    """
    layer_b_data = {
        "Ticket No": ["T-1001", "T-1002", "T-1003", "T-1004", "T-1005", "T-1006"],
        "LC Submitted": ["Yes", "No", "Yes", "No", "Yes", "Yes"],
        "Pending Documents": ["None", "Leaving Certificate, Aadhaar Copy", "None", "Leaving Certificate, Photo", "Marksheet copy", "None"],
        "Admission Status": ["Confirmed", "Provisional", "Confirmed", "Pending", "Confirmed", "Confirmed"],
        "Bank Name": ["HDFC Bank", "State Bank of India", "ICICI Bank", "HDFC Bank", "Axis Bank", "State Bank of India"],
        "Account No": ["50100234129845", "11029384756", "002938471029", "50100345129876", "912010048291023", "33019283746"],
        "IFSC Code": ["HDFC0000104", "SBIN0001234", "ICIC0000029", "HDFC0000104", "UTIB0000056", "SBIN0004567"],
        "Status": ["Active", "Active", "Active", "Inactive", "Active", "Active"],
        "Reason": ["None", "None", "None", "Family Relocation", "None", "None"]
    }
    
    df = pd.DataFrame(layer_b_data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Document Pending List", index=False)
    output.seek(0)
    return output

def create_sample_layer_c_csv() -> io.BytesIO:
    """
    Creates an in-memory sample representing Source Layer C (OJT Form Responses).
    Tracks row-by-row daily attendance ledger entries with Shift, In, and Out times.
    """
    ticket_nos = []
    dates = []
    statuses = []
    shifts = []
    in_times = []
    out_times = []
    floors = []
    supervisors = []
    
    # Generate 17 records for T-1001 (16 Present, 1 Absent, Payout Eligible)
    for i in range(1, 18):
        day_str = f"2026-05-{i:02d}"
        ticket_nos.append("T-1001")
        dates.append(day_str)
        if i < 17:
            statuses.append("Present")
            in_times.append("08:30 AM")
            out_times.append("05:30 PM")
        else:
            statuses.append("Absent")
            in_times.append("")
            out_times.append("")
        shifts.append("Day Shift")
        floors.append("Shop Floor CNC-01")
        supervisors.append("Line Manager John")
        
    # Generate 5 records for T-1002 (All Present, Ineligible)
    for i in range(1, 6):
        day_str = f"2026-05-{i:02d}"
        ticket_nos.append("T-1002")
        dates.append(day_str)
        statuses.append("Present")
        shifts.append("General Shift")
        in_times.append("09:00 AM")
        out_times.append("06:00 PM")
        floors.append("Shop Floor Assembly")
        supervisors.append("Line Manager Jane")
        
    # Generate 10 records for T-1003 (All Present, Ineligible)
    for i in range(1, 11):
        day_str = f"2026-05-{i:02d}"
        ticket_nos.append("T-1003")
        dates.append(day_str)
        statuses.append("Present")
        shifts.append("Night Shift")
        in_times.append("08:00 PM")
        out_times.append("05:00 AM")
        floors.append("Shop Floor Foundry")
        supervisors.append("Line Manager John")

    df = pd.DataFrame({
        "Ticket No": ticket_nos,
        "Date": dates,
        "Attendance Status": statuses,
        "Shift": shifts,
        "In Time": in_times,
        "Out Time": out_times,
        "Shop Floor": floors,
        "Line Manager Name": supervisors
    })
    
    output = io.BytesIO()
    df.to_csv(output, index=False)
    output.seek(0)
    return output
