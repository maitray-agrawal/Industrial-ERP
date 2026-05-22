import React, { useState, useEffect } from "react";
import UploadDashboard from "./components/UploadDashboard";
import SearchEngine from "./components/SearchEngine";
import ProfileFlashcard from "./components/ProfileFlashcard";
import AttendancePage from "./components/AttendancePage";

export default function App() {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [showIngestion, setShowIngestion] = useState(false);

  // Pure history listener routing state machine
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  };

  const handleUploadSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
  };

  return (
    <div className="min-h-screen bg-dark-bg text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      
      {/* TOP HEADER CONTROLS */}
      <header className="glass-panel border-b border-dark-border py-4 px-6 sticky top-0 z-50 shadow-glass">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigateTo("/")}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center font-bold text-white shadow-md text-lg">
              Ω
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-100 flex items-center gap-2">
                Aether ERP
                <span className="text-[10px] bg-brand-950/60 border border-brand-500/30 text-brand-400 font-bold px-2 py-0.5 rounded">
                  Enterprise v3.0
                </span>
              </h1>
              <p className="text-[10px] text-slate-400">Student Lifecycle & Operational Ingestion Engine</p>
            </div>
          </div>
          
          {/* NAVIGATION BAR ROUTERS */}
          <nav className="hidden md:flex items-center gap-4 text-xs font-bold text-slate-300">
            <button
              onClick={() => navigateTo("/")}
              className={`px-3 py-2 rounded-lg transition-all ${
                currentPath === "/" 
                  ? "bg-slate-800 text-brand-400 border border-dark-border" 
                  : "hover:text-slate-100"
              }`}
            >
              🏠 Portal Search
            </button>
            
            <button
              onClick={() => navigateTo("/attendance")}
              className={`px-3 py-2 rounded-lg transition-all ${
                currentPath === "/attendance" 
                  ? "bg-slate-800 text-sky-400 border border-dark-border" 
                  : "hover:text-slate-100"
              }`}
            >
              📊 Attendance Console
            </button>

            <button
              onClick={() => setShowIngestion(!showIngestion)}
              className={`px-3 py-2 rounded-lg transition-all border ${
                showIngestion
                  ? "bg-brand-950/30 border-brand-500/30 text-brand-400"
                  : "bg-slate-900 border-dark-border hover:bg-slate-800"
              }`}
            >
              📦 Ingestion Gateway {showIngestion ? "▲" : "▼"}
            </button>
          </nav>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              API Connected
            </span>
          </div>

        </div>
      </header>

      {/* SLIDE-DOWN INGESTION DRAWER PANEL */}
      {showIngestion && (
        <div className="bg-dark-panel/90 border-b border-dark-border p-6 shadow-2xl animate-slide-down">
          <div className="max-w-7xl mx-auto">
            <UploadDashboard onUploadSuccess={handleUploadSuccess} />
          </div>
        </div>
      )}

      {/* MAIN ROUTER SWITCH VIEWS */}
      <main className="flex-1 w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {currentPath === "/attendance" ? (
          
          /* ISOLATED ATTENDANCE MANAGEMENT ARCHITECTURE VIEW */
          <AttendancePage />

        ) : (
          
          /* HOMEPAGE VIEW: MINIMALIST GLOBALLY CENTERED SEARCH ENGINE & CARD RENDERING CORE */
          <div className="space-y-6 animate-fade-in">
            
            {/* Center positioned search viewport */}
            <SearchEngine 
              onStudentSelect={handleStudentSelect} 
              selectedStudent={selectedStudent}
              refreshTrigger={refreshTrigger} 
            />

            {/* Stands alone demographic card rendered on search hit */}
            {selectedStudent && (
              <ProfileFlashcard 
                student={selectedStudent} 
                onNavigateToAttendance={() => navigateTo("/attendance")} 
              />
            )}

          </div>

        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-dark-border/40 py-6 text-center text-xs text-slate-500 mt-12 bg-dark-bg/60">
        <p>© 2026 Enterprise Student Lifecycle ERP System. Decoupled Architecture, Built from Scratch with FastAPI & React.</p>
      </footer>
    </div>
  );
}
