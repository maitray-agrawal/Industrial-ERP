# Decoupled Enterprise Student Lifecycle ERP System

A premium, state-of-the-art Decoupled Enterprise Resource Planning (ERP) platform designed to ingest, process, and visualize complex industrial student lifecycles, plant workstation metrics, onboarding document compliance, and daily On-the-Job Training (OJT) logs.

Built with a robust **Python FastAPI** relational backend, physical **SQLite** persistence, and a highly responsive, clean **React.js + Tailwind CSS** frontend interface.

---

## 🚀 Key Architectural Features

### 📦 1. Universal Spreadsheet Sync Ingestion Engine
*   **Layer A & B Demographics:** Atomically ingests master workbook structures, segregating raw student identity registries and onboarding profiles.
*   **Fuzzy Header Mapping:** Seamlessly syncs spreadsheets from various plant branches using fuzzy regex matching to resolve column variations (e.g. `Calendar Date` vs `Date`, `Ticket Number` vs `Ticket No`).
*   **Duplicate Safeguards:** Intercepts database collisions (`(Ticket No, Calendar Date)`) with a user override selection modal to force update (`PUT`) or abort cleanly.

### 📅 2. Live Daily OJT Spreadsheet Sync (Zero Daily Uploads)
*   **Persistent Storage:** Ingested daily sheets are saved permanently to the server disk (`live_ojt_sheet`).
*   **Automated Startup Boot Sync:** On server reboot, the system automatically checks for the live sheet and parses new entries dynamically.
*   **Cron-Friendly API:** External schedulers can trigger `POST /api/v1/sync/live-trigger` to refresh attendance logs automatically daily.

### 👤 3. Dynamic 4-Tab Student Profile Workspace
*   **👤 Section A (Demographics):** Complete general contacts, birth statistics, and strict identity redaction rules masking sensitive fields (`[Aadhaar Redacted]` & `[PAN Redacted]`).
*   **🎓 Section B (Academics):** Standardized SSC, 12th/ITI score bars, prior institutions, and gap-year alert flags.
*   **📄 Section C (Compliance):** Checklist matrix tracking LC/TC submissions and missing KYC paperwork.
*   **📊 Section D (Performance & Custom Filters):** Aggregates present ratio and tracked days, integrating an interactive date-range workspace.

### 🔍 4. Custom Date Range Selector & Exports
*   **On-the-fly Recalculation:** Instantly updates present ratio, tracked days, and displays a dynamic log table grid matching a custom range.
*   **Multi-Format Extracts:** Generates and downloads custom range OJT attendance reports instantly as a pivoted **Excel Spreadsheet Matrix** or a tabular **ReportLab PDF Print Layout**.

---

## 🛠️ Technology Stack

| Tier | Technology | Description |
| :--- | :--- | :--- |
| **Backend API** | Python / FastAPI | High-performance, async-enabled endpoint router |
| **Database ORM** | SQLite / SQLAlchemy | Transaction-safe local persistence with compound unique indexes |
| **PDF Compiler** | ReportLab | Color-coded landscape tabular PDF layout generator |
| **Frontend UI** | React.js / Vite | Responsive, micro-animated client-side workspace |
| **Styling** | Tailwind CSS | Sleek slate-zinc base styling palette |

---

## 📂 Project Structure

```
├── backend/
│   ├── app/
│   │   ├── database.py       # SQLAlchemy engine & SQLite config
│   │   ├── etl.py            # Admissions Layer A & B workbook parsing
│   │   ├── main.py           # Endpoint routers, startup hooks, PDF compilers
│   │   ├── models.py         # Relational database schemas
│   │   ├── ojt.py            # OJT daily attendance sync & fuzzy matches
│   │   └── schemas.py        # Pydantic validation layers
│   ├── verify_phase3.py      # Automated integration testing suite
│   └── requirements.txt      # Python dependencies list
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchEngine.jsx       # Center Search Bar with database purge button
│   │   │   ├── ProfileFlashcard.jsx   # 4-Tab student card with dynamic date ranges
│   │   │   ├── AttendancePage.jsx     # Isolated attendance console
│   │   │   └── UploadDashboard.jsx    # Admissions syncing gateway
│   │   ├── App.jsx           # Main routing & state controller
│   │   └── index.css         # Custom animations & Tailwind overrides
└── .gitignore                # Production-level Git exclusion matrix
```

---

## ⚡ Quick Start & Deployment Guide

### 1. Start the Backend API
Navigate to the `backend/` directory, set up your virtual environment, and run the server:

```bash
cd backend
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the live-reloading FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The API documentation will be available at: **`http://localhost:8000/docs`**

---

### 2. Start the React Frontend Console
Navigate to the `frontend/` directory, install packages, and boot the Vite development server:

```bash
cd frontend
# Install node packages
npm install

# Start Vite server
npm run dev
```
Open your browser and visit: **`http://localhost:5173/`**

---

## 🧹 Database Purge & Fresh Setup
To erase the mock/testing datasets and prepare the system for live production:
1. Open the homepage at `http://localhost:5173/`.
2. Click the **🧹 Delete Sample Data & Wipe Database** button inside the Search Portal.
3. Confirm the action to atomically clear all tables. The database is now ready for your actual production spreadsheet uploads!
