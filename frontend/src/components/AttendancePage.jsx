import React, { useState, useEffect, useCallback } from "react";

export default function AttendancePage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Target Ingestion File context
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [conflictData, setConflictData] = useState(null);

  // Deep Filters State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [shift, setShift] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [status, setStatus] = useState("");

  const API_BASE = "http://localhost:8000/api/v1";

  const fetchAttendanceLogs = useCallback(async () => {
    setIsLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (shift) params.append("shift", shift);
      if (workplace) params.append("workplace", workplace);
      if (status) params.append("status", status);
      // We pass export_type=excel just to peek the logs in a json format or query them
      // Wait, let's look up using the search-card or query filters or export route.
      // Since export route with no type can return JSON, or let's fetch matching logs!
      // In main.py, GET /api/v1/attendance/export returns a file. To show logs on screen, 
      // let's query all students and build an attendance ledger view, or query directly!
      // Let's call /api/v1/students/search-card to display all student records, and render their attendance logs!
      const response = await fetch(`${API_BASE}/students/search-card`);
      if (response.ok) {
        const students = await response.json();
        // Flatten all attendance logs
        let allLogs = [];
        students.forEach(s => {
          if (s.attendance_ledger) {
            s.attendance_ledger.forEach(log => {
              allLogs.push({
                ...log,
                student_name: s.full_name,
                ticket_no: s.ticket_no
              });
            });
          }
        });

        // Apply deep client-side filtering matching backend export specifications
        if (startDate) {
          allLogs = allLogs.filter(l => l.date >= startDate);
        }
        if (endDate) {
          allLogs = allLogs.filter(l => l.date <= endDate);
        }
        if (shift) {
          allLogs = allLogs.filter(l => l.shift === shift);
        }
        if (workplace) {
          allLogs = allLogs.filter(l => 
            (l.shop_floor && l.shop_floor.toLowerCase().includes(workplace.toLowerCase())) ||
            (l.line_manager_name && l.line_manager_name.toLowerCase().includes(workplace.toLowerCase()))
          );
        }
        if (status) {
          allLogs = allLogs.filter(l => l.status === status);
        }

        setLogs(allLogs);
      }
    } catch (e) {
      setMessage("Failed to retrieve OJT daily ledger logs.");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, shift, workplace, status]);

  useEffect(() => {
    fetchAttendanceLogs();
  }, [fetchAttendanceLogs]);

  // Handle spreadsheet sync upload internally
  const handleFileUpload = async (e, forceOverride = false) => {
    const file = e.target.files?.[0] || uploadFile;
    if (!file) return;

    setUploadFile(file);
    setUploading(true);
    setConflictData(null);
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    const url = `${API_BASE}/sync/upload?override=${forceOverride}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("🎉 Daily OJT Attendance spreadsheet synchronized successfully!");
        setUploadFile(null);
        fetchAttendanceLogs();
      } else if (response.status === 409) {
        // Handle database unique key conflict
        setConflictData(data.detail);
      } else {
        setMessage(data.detail || "Spreadsheet upload aborted by sync pipeline.");
      }
    } catch (err) {
      setMessage("Network connection aborted during synchronization.");
    } finally {
      setUploading(false);
    }
  };

  // Trigger Excel or PDF compiled exports from backend export gateway
  const triggerExport = (type) => {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    if (shift) params.append("shift", shift);
    if (workplace) params.append("workplace", workplace);
    if (status) params.append("status", status);
    params.append("export_type", type);

    window.open(`${API_BASE}/attendance/export?${params.toString()}`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in relative">
      
      {/* HEADER CONTROLS BANNER */}
      <div className="glass-panel p-6 rounded-3xl border border-dark-border/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-sky-500 rounded-full animate-pulse-slow"></span>
            Isolated Attendance Console
          </h2>
          <p className="text-slate-400 text-xs mt-1">Unified OJT transaction log grid, shift segmentation, and print export compilers.</p>
        </div>

        {/* Sync file upload button */}
        <div className="flex items-center gap-3">
          <label className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-dark-border cursor-pointer transition-all hover-scale flex items-center gap-2">
            📤 Sync Daily OJT Spreadsheet
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
              onChange={(e) => handleFileUpload(e, false)} 
            />
          </label>
        </div>
      </div>

      {/* TARGET COMPREHENSIVE ATTENDANCE FILTERING DRAWER & EXPORT ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* SIDE DRAWER FILTERS */}
        <div className="glass-panel p-6 rounded-2xl border border-dark-border/60 space-y-5 bg-dark-panel/60">
          <div className="flex justify-between items-center border-b border-dark-border/40 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Category Filter Drawer</h3>
            <button 
              onClick={() => { setStartDate(""); setEndDate(""); setShift(""); setWorkplace(""); setStatus(""); }}
              className="text-[10px] text-brand-400 hover:text-brand-300 font-bold"
            >
              Reset Filters
            </button>
          </div>

          {/* Date spans */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Calendar Date Span</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
            />
            <span className="text-[10px] text-slate-500 block text-center">to</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
            />
          </div>

          {/* Shift selector */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Rostered Shift Designation</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-xs text-slate-300 outline-none"
            >
              <option value="">All Shifts</option>
              <option value="A">Shift A</option>
              <option value="B">Shift B</option>
              <option value="C">Shift C</option>
              <option value="G">Shift G (General)</option>
              <option value="Day Shift">Day Shift</option>
              <option value="Night Shift">Night Shift</option>
            </select>
          </div>

          {/* Cost Centre / PSA Workplace */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Workplace Identifier</label>
            <input 
              type="text" 
              value={workplace} 
              placeholder="e.g. Weld Shop, Shop Floor A..."
              onChange={(e) => setWorkplace(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
            />
          </div>

          {/* Work Status variant */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Presence Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-xs text-slate-300 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Separated">Separated</option>
            </select>
          </div>

          {/* One-click Export Banner */}
          <div className="border-t border-dark-border/40 pt-4 mt-2 space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Export Ledger Automation</label>
            <button
              onClick={() => triggerExport("excel")}
              className="w-full py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 hover:border-emerald-400 text-emerald-400 text-xs font-bold transition-all hover-scale flex items-center justify-center gap-1.5"
            >
              📊 Compile & Export Excel
            </button>
            <button
              onClick={() => triggerExport("pdf")}
              className="w-full py-2.5 rounded-xl bg-sky-950/40 border border-sky-500/30 hover:border-sky-400 text-sky-400 text-xs font-bold transition-all hover-scale flex items-center justify-center gap-1.5"
            >
              📄 Compile & Print PDF
            </button>
          </div>
        </div>

        {/* LEDGER DATA TABLE */}
        <div className="lg:col-span-3 space-y-4">
          
          {message && (
            <div className="p-3 bg-dark-panel border border-dark-border text-xs text-center text-brand-400 rounded-xl">
              {message}
            </div>
          )}

          <div className="glass-panel p-6 rounded-2xl border border-dark-border/60">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-200">DAILY TRANSACTIONAL GRIDS ({logs.length} Matches)</h3>
              {isLoading && (
                <span className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin inline-block"></span>
              )}
            </div>

            {logs.length > 0 ? (
              <div className="border border-dark-border rounded-xl overflow-hidden bg-dark-bg/25">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/60 text-slate-400 border-b border-dark-border font-bold tracking-wide">
                        <th className="p-3">TICKET NO</th>
                        <th className="p-3">STUDENT NAME</th>
                        <th className="p-3">DATE</th>
                        <th className="p-3">ROSTERED SHIFT</th>
                        <th className="p-3">IN PUNCH</th>
                        <th className="p-3">OUT PUNCH</th>
                        <th className="p-3">TOTAL HOURS</th>
                        <th className="p-3">PUNCH TYPE</th>
                        <th className="p-3">SHOP FLOOR</th>
                        <th className="p-3">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-border/40 text-slate-300">
                      {logs.map((log, idx) => {
                        const hasError = log.status === "Present" && (!log.in_time || !log.out_time || log.in_time === "nan" || log.out_time === "nan");
                        return (
                          <tr key={idx} className="hover:bg-dark-panel/40 transition-all">
                            <td className="p-3 font-mono">{log.ticket_no}</td>
                            <td className="p-3 font-bold text-slate-200">{log.student_name}</td>
                            <td className="p-3 font-mono">{log.date}</td>
                            <td className="p-3 text-slate-400 font-semibold">{log.shift || "Regular"}</td>
                            <td className="p-3 font-mono">{log.in_time || "—"}</td>
                            <td className="p-3 font-mono">{log.out_time || "—"}</td>
                            <td className="p-3 font-semibold text-slate-400">{log.total_hours !== null && log.total_hours !== undefined ? `${log.total_hours} hrs` : "—"}</td>
                            <td className="p-3 font-mono text-[10px] text-slate-400">{log.punch_type || "—"}</td>
                            <td className="p-3 text-slate-400 truncate max-w-[120px]">{log.shop_floor || "Shop Floor A"}</td>
                            <td className="p-3">
                              {hasError ? (
                                <span className="bg-rose-950/40 border border-rose-500/30 text-rose-300 font-bold text-[9px] px-2 py-0.5 rounded">
                                  ⚠️ Punch Error
                                </span>
                              ) : (
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] border ${
                                  log.status === "Present" 
                                    ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/20" 
                                    : "bg-rose-950/40 text-rose-400 border-rose-500/20"
                                }`}>
                                  {log.status}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-dark-border rounded-xl text-slate-500 bg-dark-bg/10">
                ⚠️ No attendance log sheets match the current search filters.
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ==============================================================
          CONFLICT RESOLUTION MODAL
          ============================================================== */}
      {conflictData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-dark-bg/85 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-xl rounded-2xl border border-rose-500/30 p-6 shadow-2xl bg-dark-panel flex flex-col justify-between animate-slide-up">
            
            <div>
              <div className="flex items-center gap-3 text-rose-400 border-b border-dark-border pb-3 mb-4">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Dual Re-Upload Conflict Intercepted</h3>
                  <p className="text-xs text-rose-400/80">Database transaction safety check blocked synchronization.</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 mb-3">
                The daily ledger logs uploaded contain entries that are already registered.
              </p>

              {/* Conflict lists */}
              <div className="bg-dark-bg/60 rounded-xl border border-dark-border/60 p-3 max-h-48 overflow-y-auto mb-5 space-y-2">
                {conflictData.conflicts && conflictData.conflicts.map((con, index) => (
                  <div key={index} className="flex justify-between items-center text-xs border-b border-dark-border/40 pb-1.5 last:border-b-0 last:pb-0">
                    <span className="font-semibold text-slate-200">🎫 {con.ticket_no} - {con.full_name}</span>
                    <span className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono">
                      Log Date: {con.quess_batch_no}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-dark-card border border-dark-border p-3 rounded-lg text-xs text-slate-400 mb-6">
                <strong>[CANCEL]: Abort Ingestion</strong> – Aborts the entire transaction, leaving the database records completely clean and unchanged.
                <br /><br />
                <strong>[UPSERT / UPDATE]: Override & Update</strong> – Forces a re-upload, updating mutable fields for existing entries while keeping intact their other relational states.
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-dark-border pt-4">
              <button
                onClick={() => setConflictData(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all hover-scale"
              >
                [CANCEL] Rollback Ingestion
              </button>
              <button
                onClick={() => handleFileUpload(null, true)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-brand-500 hover:from-emerald-500 hover:to-brand-400 text-white text-xs font-bold transition-all shadow-glass-emerald hover-scale"
              >
                [UPSERT/UPDATE] Overwrite Records
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
