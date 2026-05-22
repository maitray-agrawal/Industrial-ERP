import React, { useState } from "react";

export default function ProfileFlashcard({ student, onNavigateToAttendance }) {
  const [activeTab, setActiveTab] = useState("identity"); // 'identity', 'academics', 'compliance', 'performance'
  const [isEditing, setIsEditing] = useState(false);
  
  // Local custom range attendance states
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  
  // Local edit form state
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [qualification, setQualification] = useState("");
  const [patchState, setPatchState] = useState({ loading: false, message: "" });

  const API_BASE = "http://localhost:8000/api/v1";

  if (!student) return null;

  const { academics, compliance, finance, attendance_ledger = [] } = student;

  // Calculate age based on local target year 2026
  let age = "N/A";
  if (student.dob) {
    try {
      const birthYear = new Date(student.dob).getFullYear();
      if (!isNaN(birthYear)) {
        age = 2026 - birthYear;
      }
    } catch (e) {
      age = "N/A";
    }
  }

  // Attendance aggregates for Section D
  const totalDaysTracked = attendance_ledger.length;
  const presentDays = attendance_ledger.filter(l => l.status === "Present").length;
  const presentRatio = totalDaysTracked > 0 ? ((presentDays / totalDaysTracked) * 100).toFixed(2) : 0;

  // Custom visual theme styling based on name initials hash
  const charSum = student.full_name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = charSum % 360;
  const avatarStyle = {
    background: `linear-gradient(135deg, hsl(${hue}, 80%, 45%), hsl(${(hue + 60) % 360}, 80%, 30%))`,
  };

  const initials = student.full_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const stateBadgeColor = 
    student.status === "Active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 glow-emerald" :
    student.status === "Pending Completion" ? "bg-amber-500/10 text-amber-400 border-amber-500/30 glow-amber" :
    "bg-rose-500/10 text-rose-400 border-rose-500/30 glow-rose";

  const hasLC = compliance?.is_lc_submitted;
  const pendingDocs = compliance?.pending_documents_array || [];
  
  // Compliance warnings check
  const hasIdentityFailure = pendingDocs.some(doc => {
    const d = doc.toLowerCase();
    return d.includes("aadhaar") || d.includes("pan") || d.includes("identity");
  });

  const handleOpenEdit = () => {
    setFullName(student.full_name);
    setStatus(student.status);
    setBatchNo(academics?.quess_batch_no || "");
    setQualification(academics?.qualification_education || "");
    setPatchState({ loading: false, message: "" });
    setIsEditing(true);
  };

  const handleSavePatch = async () => {
    setPatchState({ loading: true, message: "Saving profile sync..." });
    try {
      const params = new URLSearchParams();
      params.append("ticket_no", student.ticket_no);
      if (fullName) params.append("full_name", fullName);
      if (status) params.append("status", status);
      if (batchNo) params.append("quess_batch_no", batchNo);
      if (qualification) params.append("qualification_education", qualification);

      const response = await fetch(`${API_BASE}/students/update?${params.toString()}`, {
        method: "PUT"
      });
      const data = await response.json();
      
      if (response.ok) {
        setPatchState({ loading: false, message: "Profile patches synced! Refreshing..." });
        setTimeout(() => {
          setIsEditing(false);
          window.location.reload();
        }, 1000);
      } else {
        setPatchState({ loading: false, message: data.detail || "Sync failed." });
      }
    } catch (e) {
      setPatchState({ loading: false, message: "Network connection failure." });
    }
  };

  return (
    <div className="space-y-6 animate-slide-up max-w-4xl mx-auto mt-6 relative">
      
      {/* CARD TOP TOOLBAR */}
      <div className="flex justify-between items-center bg-dark-panel/40 p-4 rounded-xl border border-dark-border/60">
        <div className="flex items-center gap-3">
          <div style={avatarStyle} className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md">
            {initials}
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">SELECTED STUDENT REGISTRY</span>
            <strong className="text-xs text-slate-200">{student.full_name} ({student.ticket_no})</strong>
          </div>
        </div>
        <button
          onClick={handleOpenEdit}
          className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-dark-border hover-scale"
        >
          ✏️ Modify Parameters
        </button>
      </div>

      {/* FOUR CLEAR LAYOUT NAVIGATION TABS */}
      <div className="flex border-b border-dark-border bg-dark-panel/20 rounded-t-xl p-1 gap-1">
        <button
          onClick={() => setActiveTab("identity")}
          className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${
            activeTab === "identity" 
              ? "bg-slate-800 text-brand-400 border border-dark-border" 
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          👤 Section A: Demographic Identity
        </button>
        <button
          onClick={() => setActiveTab("academics")}
          className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${
            activeTab === "academics" 
              ? "bg-slate-800 text-brand-400 border border-dark-border" 
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          🎓 Section B: Academic Background
        </button>
        <button
          onClick={() => setActiveTab("compliance")}
          className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${
            activeTab === "compliance" 
              ? "bg-slate-800 text-brand-400 border border-dark-border" 
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          📄 Section C: Document Compliance
        </button>
        <button
          onClick={() => setActiveTab("performance")}
          className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${
            activeTab === "performance" 
              ? "bg-slate-800 text-brand-400 border border-dark-border" 
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          📊 Section D: Performance Metrics
        </button>
      </div>

      {/* TAB PANEL CONTENT INTERFACE */}
      <div className="glass-panel rounded-b-2xl p-6 shadow-xl border-x border-b border-dark-border min-h-[300px]">
        
        {/* ==============================================================
            SECTION A: DEMOGRAPHIC IDENTITY CONTEXT
            ============================================================== */}
        {activeTab === "identity" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-start border-b border-dark-border pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-200">Demographic Identity Context</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Basic contact registry details and masked compliance indicators.</p>
              </div>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border bg-opacity-10 ${stateBadgeColor}`}>
                ● {student.status}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">STUDENT FULL NAME</span>
                <span className="font-bold text-slate-200">{student.full_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">TICKET IDENTIFIER</span>
                <span className="font-mono font-bold text-brand-400">{student.ticket_no}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">QUESS BATCH NUMBER</span>
                <span className="font-bold text-slate-200">{academics?.quess_batch_no || "B-2026"}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">DATE OF BIRTH (As per Aadhar)</span>
                <span className="font-semibold text-slate-200">{student.dob || "Not Specified"}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">AGE</span>
                <span className="font-bold text-brand-400">{age} Years Old</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">AADHAR LINK NO.</span>
                <span className="font-semibold text-slate-200">📞 {student.contact_no || "Not Registered"}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">FATHER NAME</span>
                <span className="font-semibold text-slate-300">{student.father_name || "Not Specified"}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">MOTHER NAME</span>
                <span className="font-semibold text-slate-300">{student.mother_name || "Not Specified"}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">MARITAL STATUS</span>
                <span className="font-semibold text-slate-300">{student.marital_status || "Not Specified"}</span>
              </div>
            </div>

            {/* Strict Redacted ID Identity Blocks */}
            <div className="border-t border-dark-border/40 pt-5 mt-4">
              <span className="text-[10px] font-bold text-slate-400 block mb-3 uppercase tracking-wider">Identity Registry Cross-References (Compliance Masked)</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-dark-bg/60 border border-dark-border p-3.5 rounded-xl flex justify-between items-center text-xs">
                  <span className="text-slate-400">🛡️ Aadhar Card Identity Token:</span>
                  <span className="font-mono bg-slate-900 px-3 py-1 rounded text-rose-400 font-bold border border-rose-500/10">
                    [Aadhaar Redacted]
                  </span>
                </div>
                <div className="bg-dark-bg/60 border border-dark-border p-3.5 rounded-xl flex justify-between items-center text-xs">
                  <span className="text-slate-400">💳 PAN Card Registry Token:</span>
                  <span className="font-mono bg-slate-900 px-3 py-1 rounded text-rose-400 font-bold border border-rose-500/10">
                    [PAN Redacted]
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-dark-border/40 pt-4 text-xs">
              <span className="text-slate-400 block mb-1">GEOGRAPHIC RESIDENCE</span>
              <span className="font-semibold text-slate-200">
                📍 {student.district || "Not Specified"}, {student.state || "Not Specified"}
              </span>
            </div>
          </div>
        )}

        {/* ==============================================================
            SECTION B: ACADEMIC BACKGROUND
            ============================================================== */}
        {activeTab === "academics" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center border-b border-dark-border pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-200">Academic Background</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Normalized performance scoring and gap-year logs.</p>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded font-bold border border-dark-border">
                Category: {academics?.qualification_education || "12th"}
              </span>
            </div>

            {student.is_degree_pursuing && (
              <div className="bg-purple-950/20 border border-purple-500/20 p-3.5 rounded-xl text-xs text-purple-300 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-ping"></span>
                <span><strong>Awaited Degree:</strong> Student is actively pursuing external regular/degree classes.</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Score Bars */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-bold">
                    <span className="text-slate-400">10TH (SSC) PERCENTAGE</span>
                    <span className="text-emerald-400">{academics?.tenth_percentage ? `${academics.tenth_percentage.toFixed(2)}%` : "Awaited"}</span>
                  </div>
                  <div className="w-full bg-dark-bg h-2 rounded-full overflow-hidden border border-dark-border">
                    <div 
                      className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${academics?.tenth_percentage || 0}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-bold">
                    <span className="text-slate-400">12TH / ITI DIPLOMA SCORE</span>
                    <span className="text-sky-400">
                      {student.is_degree_pursuing ? "Result Awaited" : academics?.twelfth_iti_percentage ? `${academics.twelfth_iti_percentage.toFixed(2)}%` : "Awaited"}
                    </span>
                  </div>
                  <div className="w-full bg-dark-bg h-2 rounded-full overflow-hidden border border-dark-border">
                    <div 
                      className="bg-gradient-to-r from-sky-600 to-sky-400 h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${academics?.twelfth_iti_percentage || 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Institute details */}
              <div className="bg-dark-bg/40 border border-dark-border/60 p-4 rounded-xl grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">PRIOR INSTITUTION</span>
                  <span className="font-semibold text-slate-200">{academics?.prior_institute || "Not Registered"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">ENROLLMENT GAP</span>
                  {academics?.enrollment_gaps > 0 ? (
                    <span className="font-bold text-amber-400">⚠️ {academics.enrollment_gaps} Year Gap</span>
                  ) : (
                    <span className="text-slate-400">No Education Gap</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">STREAM / TRADE BRANCH</span>
                  <span className="font-semibold text-slate-200">{academics?.stream_branch || "General"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">SR NO / PRN</span>
                  <span className="font-mono text-slate-300">
                    {academics?.sr_no || "—"} / {academics?.prn || "—"}
                  </span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==============================================================
            SECTION C: DOCUMENT COMPLIANCE TRACKING
            ============================================================== */}
        {activeTab === "compliance" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center border-b border-dark-border pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-200">Document Compliance Status</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Detailed onboarding verification checklist matrices.</p>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded font-bold border border-dark-border">
                Onboarding: {compliance?.admission_status || "Provisional"}
              </span>
            </div>

            <div className="space-y-4">
              
              {/* Checklist details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3.5 bg-dark-bg/60 border border-dark-border rounded-xl text-xs">
                  <span className="text-slate-300">School Leaving Certificate (LC/TC)</span>
                  {hasLC ? (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                      🟢 Submitted
                    </span>
                  ) : (
                    <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-lg text-[10px] font-bold animate-pulse-slow">
                      🚨 Missing LC/TC
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-3.5 bg-dark-bg/60 border border-dark-border rounded-xl text-xs">
                  <span className="text-slate-300">Core KYC Verification Status</span>
                  {hasIdentityFailure ? (
                    <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                      ⚠️ Pending Identity Check
                    </span>
                  ) : (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                      ✓ Aadhaar/PAN Verified
                    </span>
                  )}
                </div>
              </div>

              {/* CRITICAL DELINQUENCY ALERTS BOX */}
              {pendingDocs.length > 0 ? (
                <div className="bg-rose-950/20 border border-rose-500/30 p-4 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    ❌ CRITICAL DELINQUENCIES DETECTED ({pendingDocs.length} items pending)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {pendingDocs.map((doc, idx) => (
                      <span 
                        key={idx} 
                        className="bg-rose-950/60 border border-rose-500/40 text-rose-200 text-[10px] font-semibold px-2.5 py-1 rounded-lg shadow-sm"
                      >
                        ⚠️ Missing {doc}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-950/10 border border-emerald-500/20 p-3.5 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                  🛡️ All base induction documentation checklist gates verified and secure.
                </div>
              )}

            </div>
          </div>
        )}

        {/* ==============================================================
            SECTION D: CONSOLIDATED PERFORMANCE METRICS
            ============================================================== */}
        {activeTab === "performance" && (() => {
          // Dynamic custom range calculations
          let filteredLedger = attendance_ledger;
          if (customStart) {
            filteredLedger = filteredLedger.filter(l => l.date >= customStart);
          }
          if (customEnd) {
            filteredLedger = filteredLedger.filter(l => l.date <= customEnd);
          }
          const rangeTotalDays = filteredLedger.length;
          const rangePresentDays = filteredLedger.filter(l => l.status === "Present").length;
          const rangeRatio = rangeTotalDays > 0 ? ((rangePresentDays / rangeTotalDays) * 100).toFixed(2) : 0;

          return (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b border-dark-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-200">Consolidated Performance Metrics</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Aggregated OJT daily tracker counts and interactive date filters.</p>
                </div>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded font-bold border border-dark-border">
                  Total Tracked: {rangeTotalDays} Days
                </span>
              </div>

              {/* Custom Date Filters */}
              <div className="bg-dark-bg/60 border border-dark-border/80 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">🎯 Custom Attendance Date Filter Range</span>
                  {(customStart || customEnd) && (
                    <button 
                      onClick={() => { setCustomStart(""); setCustomEnd(""); }}
                      className="text-[10px] text-brand-400 hover:text-brand-300 font-semibold underline"
                    >
                      ✕ Reset Range
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">START DATE</label>
                    <input 
                      type="date" 
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-xs text-slate-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">END DATE</label>
                    <input 
                      type="date" 
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-xs text-slate-300 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-dark-bg/60 border border-dark-border p-5 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">
                    {customStart || customEnd ? "Range Attendance Ratio" : "Overall Attendance Ratio"}
                  </span>
                  <span className={`text-3xl font-black ${rangeRatio >= 85 ? "text-emerald-400" : "text-amber-400"}`}>
                    {rangeRatio}%
                  </span>
                </div>

                <div className="bg-dark-bg/60 border border-dark-border p-5 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">
                    {customStart || customEnd ? "Range Present Days" : "Total Present Days"}
                  </span>
                  <span className="text-3xl font-black text-slate-200">
                    {rangePresentDays} <span className="text-sm font-semibold text-slate-500">/ {rangeTotalDays}</span>
                  </span>
                </div>
              </div>

              {/* Dynamic matching logs list */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-2 uppercase tracking-wider">
                  {customStart || customEnd ? "📝 Filtered Daily Workstation Logs" : "📝 Active OJT Attendance Ledger Rows"}
                </span>
                {filteredLedger.length > 0 ? (
                  <div className="border border-dark-border rounded-xl overflow-hidden bg-dark-bg/25">
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-900/60 text-slate-400 border-b border-dark-border font-bold">
                            <th className="p-2">DATE</th>
                            <th className="p-2">SHIFT</th>
                            <th className="p-2">IN TIME</th>
                            <th className="p-2">OUT TIME</th>
                            <th className="p-2">TOTAL HOURS</th>
                            <th className="p-2">STATUS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border/40 text-slate-300">
                          {filteredLedger.map((log, idx) => (
                            <tr key={idx} className="hover:bg-dark-panel/40">
                              <td className="p-2 font-mono">{log.date}</td>
                              <td className="p-2 text-slate-400">{log.shift || "Regular"}</td>
                              <td className="p-2 font-mono">{log.in_time || "—"}</td>
                              <td className="p-2 font-mono">{log.out_time || "—"}</td>
                              <td className="p-2 font-semibold text-slate-400">{log.total_hours !== null && log.total_hours !== undefined ? `${log.total_hours} hrs` : "—"}</td>
                              <td className="p-2">
                                <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] border ${
                                  log.status === "Present" 
                                    ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/20" 
                                    : "bg-rose-950/40 text-rose-400 border-rose-500/20"
                                }`}>
                                  {log.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-dark-border rounded-xl text-slate-500 text-xs">
                    ⚠️ No daily attendance logs matching filters found.
                  </div>
                )}
              </div>

              {/* Payout highlights */}
              <div className="flex justify-between items-center p-4 bg-dark-bg/40 border border-dark-border rounded-xl text-xs mt-4">
                <div>
                  <span className="font-semibold text-slate-300">Stipend Attendance Payout Status:</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Requires minimum 15 days active OJT attendance logs.</p>
                </div>
                <span className={`font-bold px-3 py-1.5 rounded-lg text-[10px] border ${
                  finance?.attendance_payout_eligible 
                    ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/20" 
                    : "bg-rose-950/60 text-rose-400 border-rose-500/20"
                }`}>
                  {finance?.attendance_payout_eligible ? "✓ PAYOUT APPROVED" : "⚠️ BLOCKED (<15 Days)"}
                </span>
              </div>

              {/* Action Buttons: View Detailed Console or Export Custom Range */}
              <div className="pt-4 border-t border-dark-border/40 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.append("ticket_no", student.ticket_no);
                    if (customStart) params.append("start_date", customStart);
                    if (customEnd) params.append("end_date", customEnd);
                    params.append("export_type", "excel");
                    window.open(`${API_BASE}/attendance/export?${params.toString()}`);
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 hover:border-emerald-400 text-emerald-400 text-xs font-bold transition-all hover-scale flex items-center justify-center gap-1.5"
                >
                  📊 Export Range to Excel
                </button>
                <button
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.append("ticket_no", student.ticket_no);
                    if (customStart) params.append("start_date", customStart);
                    if (customEnd) params.append("end_date", customEnd);
                    params.append("export_type", "pdf");
                    window.open(`${API_BASE}/attendance/export?${params.toString()}`);
                  }}
                  className="w-full py-2.5 rounded-xl bg-sky-950/40 border border-sky-500/30 hover:border-sky-400 text-sky-400 text-xs font-bold transition-all hover-scale flex items-center justify-center gap-1.5"
                >
                  📄 Export Range to PDF
                </button>
              </div>

              <div className="flex justify-center mt-2">
                <button
                  onClick={onNavigateToAttendance}
                  className="text-slate-400 hover:text-slate-200 text-xs font-semibold underline"
                >
                  👁 View Detailed Historical Log Grids inside Attendance console
                </button>
              </div>
            </div>
          );
        })()}

      </div>

      {/* ==============================================================
          MANUAL SYNC UPDATE MODAL
          ============================================================== */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-dark-bg/85 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-brand-500/30 p-6 shadow-2xl bg-dark-panel flex flex-col justify-between animate-slide-up">
            
            <div>
              <div className="flex justify-between items-center border-b border-dark-border pb-3 mb-4">
                <h3 className="text-base font-bold text-slate-100">Modify Parameters</h3>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">STUDENT FULL NAME</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-dark-bg border border-dark-border focus:border-brand-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">OPERATIONAL STATUS</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-dark-bg border border-dark-border focus:border-brand-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Pending Completion">Pending Completion</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">QUESS BATCH NUMBER</label>
                  <input
                    type="text"
                    value={batchNo}
                    onChange={(e) => setBatchNo(e.target.value)}
                    className="w-full bg-dark-bg border border-dark-border focus:border-brand-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">QUALIFICATION EDUCATION</label>
                  <select
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="w-full bg-dark-bg border border-dark-border focus:border-brand-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none"
                  >
                    <option value="12th">12th Grade</option>
                    <option value="ITI">ITI Diploma</option>
                  </select>
                </div>
              </div>

              {patchState.message && (
                <div className="mt-4 p-2 bg-dark-bg border border-dark-border rounded text-[10px] text-center text-brand-400">
                  {patchState.message}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-dark-border pt-4 mt-6">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePatch}
                disabled={patchState.loading}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-brand-500 text-white text-xs font-bold transition-all hover-scale"
              >
                {patchState.loading ? "Saving..." : "Sync Patch"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
