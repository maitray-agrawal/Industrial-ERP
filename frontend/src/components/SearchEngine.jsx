import React, { useState, useEffect, useCallback } from "react";

export default function SearchEngine({ onStudentSelect, selectedStudent, refreshTrigger }) {
  const [queryStr, setQueryStr] = useState("");
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Structural checkboxes
  const [qualification, setQualification] = useState("");
  const [trade, setTrade] = useState("");

  const API_BASE = "http://localhost:8000/api/v1";

  const fetchStudents = useCallback(async () => {
    if (!queryStr.trim() && !qualification && !trade) {
      setStudents([]);
      return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (queryStr.trim()) params.append("query_str", queryStr.trim());
      if (qualification) params.append("qualification_education", qualification);
      if (trade) params.append("trade_stream_branch", trade);

      const response = await fetch(`${API_BASE}/students/search-card?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setStudents(data);
      }
    } catch (error) {
      console.error("Search query execution failure:", error);
    } finally {
      setIsLoading(false);
    }
  }, [queryStr, qualification, trade]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchStudents();
    }, 200);
    return () => clearTimeout(handler);
  }, [queryStr, qualification, trade, refreshTrigger]);

  const handleSelectStudent = (student) => {
    if (onStudentSelect) {
      onStudentSelect(student);
    }
    // Clear list to close dropdown suggestions
    setStudents([]);
  };

  return (
    <div className={`transition-all duration-500 w-full max-w-2xl mx-auto ${
      !selectedStudent 
        ? "min-h-[50vh] flex flex-col justify-center items-center" 
        : "mb-6"
    }`}>
      
      <div className="w-full glass-panel p-6 rounded-3xl shadow-2xl border border-dark-border bg-dark-panel/90 relative hover-scale">
        <div className="text-center mb-5">
          <h2 className="text-xl font-bold tracking-wider text-slate-200">ENTERPRISE STUDENT REGISTRATION GATEWAY</h2>
          <p className="text-xs text-slate-400 mt-1">Unified partial lookup by Batch Code (B-...), Ticket ID (T-...), or Name.</p>
          <button
            onClick={async () => {
              if (window.confirm("🚨 WARNING: Are you sure you want to permanently clear all registered student and OJT attendance records from database?")) {
                const response = await fetch(`${API_BASE}/database/clear`, { method: "POST" });
                if (response.ok) {
                  alert("Database wiped successfully. Seed sample data deleted.");
                  window.location.reload();
                } else {
                  alert("Failed to wipe database.");
                }
              }
            }}
            className="mt-2 text-[10px] bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 font-bold px-3 py-1 rounded-lg border border-rose-500/20 transition-all hover-scale"
          >
            🧹 Delete Sample Data & Wipe Database
          </button>
        </div>

        {/* COMPOSITE SEARCH BAR FRAME */}
        <div className="relative flex items-center bg-dark-bg/95 border border-dark-border focus-within:border-brand-500 rounded-2xl transition-all pr-3 focus-within:ring-2 focus-within:ring-brand-500/10">
          <input
            type="text"
            value={queryStr}
            onChange={(e) => setQueryStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                fetchStudents();
              }
            }}
            placeholder="Type T-1001, B-2026-A, Aarav Sharma..."
            className="w-full bg-transparent px-5 py-4 text-sm text-slate-200 placeholder-slate-500 outline-none"
          />
          
          <div className="flex items-center gap-2">
            {queryStr && (
              <button
                onClick={() => {
                  setQueryStr("");
                  setStudents([]);
                }}
                className="p-1.5 text-slate-400 hover:text-rose-400 text-xs transition-all font-bold"
                title="Clear search input"
              >
                ✕
              </button>
            )}

            {isLoading && (
              <span className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin inline-block"></span>
            )}
            
            {/* Inline Sleek Micro-Filter Toggle Icon */}
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                isFilterOpen || qualification || trade
                  ? "bg-brand-500/10 border-brand-500/30 text-brand-400"
                  : "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200"
              }`}
              title="Toggle filter scope drawer"
            >
              ⚙️ Filter
            </button>
          </div>
        </div>

        {/* QUICK-FILTER PILLS DISPLAY */}
        {(qualification || trade) && (
          <div className="flex flex-wrap gap-2 mt-3 text-[10px] items-center">
            <span className="text-slate-500 font-bold uppercase tracking-wider">Active Filters:</span>
            {qualification && (
              <span className="bg-brand-500/15 text-brand-400 border border-brand-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                🎓 {qualification === "12th" ? "12th Grade" : "ITI Diploma"}
                <button onClick={() => setQualification("")} className="hover:text-rose-400 ml-1 font-black">✕</button>
              </span>
            )}
            {trade && (
              <span className="bg-sky-500/15 text-sky-400 border border-sky-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                🔧 {trade}
                <button onClick={() => setTrade("")} className="hover:text-rose-400 ml-1 font-black">✕</button>
              </span>
            )}
            <button 
              onClick={() => { setQualification(""); setTrade(""); }}
              className="text-brand-400 hover:text-brand-300 font-bold underline ml-1"
            >
              Reset All
            </button>
          </div>
        )}

        {/* ELEGANT DROPDOWN DRAWER FOR FILTER CHECKBOXES */}
        {isFilterOpen && (
          <div className="mt-4 p-4 rounded-xl border border-dark-border/80 bg-dark-bg/60 space-y-4 animate-slide-up text-xs">
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold border-b border-dark-border/40 pb-2">
              <span>NARROW HOME SEARCH SCOPE</span>
              <button 
                onClick={() => { setQualification(""); setTrade(""); }}
                className="text-brand-400 hover:text-brand-300 font-semibold"
              >
                Clear Filters
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Qualification options */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-2 uppercase tracking-wider">Qualification</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input 
                      type="radio" 
                      name="qual"
                      checked={qualification === ""} 
                      onChange={() => setQualification("")} 
                      className="accent-brand-500" 
                    />
                    <span>All Qualifications</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input 
                      type="radio" 
                      name="qual"
                      checked={qualification === "12th"} 
                      onChange={() => setQualification("12th")} 
                      className="accent-brand-500" 
                    />
                    <span>12th Grade (HSC)</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input 
                      type="radio" 
                      name="qual"
                      checked={qualification === "ITI"} 
                      onChange={() => setQualification("ITI")} 
                      className="accent-brand-500" 
                    />
                    <span>ITI Diploma</span>
                  </label>
                </div>
              </div>

              {/* Stream / Branch options */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-2 uppercase tracking-wider">Trade / Stream Branch</label>
                <select
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  className="w-full bg-dark-panel border border-dark-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none"
                >
                  <option value="">All Trades</option>
                  <option value="Machinist">Machinist</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Fitter">Fitter</option>
                  <option value="Computer ITI">Computer ITI</option>
                  <option value="Electronics">Electronics</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* DROPDOWN AUTOCOMPLETE SUGGESTIONS FEED */}
        {students.length > 0 && (
          <div className="absolute left-0 right-0 z-50 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-dark-border bg-dark-bg/95 shadow-2xl p-2 space-y-1.5 custom-scrollbar">
            {students.map((student) => (
              <div
                key={student.student_id}
                onClick={() => handleSelectStudent(student)}
                className="p-3 hover:bg-slate-800/60 rounded-xl cursor-pointer flex justify-between items-center transition-all text-xs border border-transparent hover:border-dark-border/40"
              >
                <div>
                  <span className="font-bold text-slate-200">{student.full_name}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Batch: {student.academics?.quess_batch_no} • {student.academics?.stream_branch || "General"}
                  </span>
                </div>
                <span className="font-mono text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-300">
                  {student.ticket_no}
                </span>
              </div>
            ))}
          </div>
        )}

        {queryStr.trim() && students.length === 0 && !isLoading && (
          <div className="absolute left-0 right-0 z-50 mt-2 rounded-2xl border border-rose-500/20 bg-dark-bg p-4 text-center text-xs text-slate-400 shadow-2xl space-y-1">
            <p>⚠️ No student profiles matched your search terms.</p>
            <p className="text-[10px] text-slate-500">Tip: Check the ticket format (e.g. <strong>T-1001</strong>) or search for single words like <strong>Aarav</strong> or batch prefix <strong>B-2026</strong>.</p>
          </div>
        )}
      </div>

    </div>
  );
}
