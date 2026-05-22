import React, { useState } from "react";

export default function UploadDashboard({ onUploadSuccess }) {
  const [activeTab, setActiveTab] = useState("layerA"); // 'layerA', 'layerB', 'layerC'
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [syncState, setSyncState] = useState({ status: "idle", progress: "", data: null });
  
  // Conflict resolution state
  const [conflictData, setConflictData] = useState(null); // stores { conflicts: [...] } if 409 caught
  const [currentFileContext, setCurrentFileContext] = useState(null); // stores file for override retry

  const API_BASE = "http://localhost:8000/api/v1";

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      triggerSync(file, activeTab, false);
    }
  };

  const handleSelectFile = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      triggerSync(file, activeTab, false);
    }
  };

  const triggerSync = async (file, layerType, isOverride = false) => {
    setSyncState({ status: "loading", progress: "Syncing spreadsheet records...", data: null });
    setConflictData(null);
    setCurrentFileContext(file);

    const formData = new FormData();
    formData.append("file", file);

    // UNIVERSAL SYNCHRONIZER UPLOAD GATEWAY
    const url = `${API_BASE}/sync/upload?override=${isOverride}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setSyncState({
          status: "success",
          progress: layerType === "layerC" 
            ? "OJT Daily Attendance logs synced permanently!" 
            : `Source ${layerType === "layerA" ? "Layer A" : "Layer B"} records synced permanently!`,
          data: data,
        });
        setSelectedFile(null);
        if (onUploadSuccess) onUploadSuccess();
      } else if (response.status === 409) {
        // COLLISION INTERCEPTED
        const errorDetail = data.detail || {};
        setConflictData(errorDetail);
        setSyncState({
          status: "error",
          progress: "Sync Blocked: Duplicate records or attendance logs intercepted.",
          data: data,
        });
      } else {
        setSyncState({
          status: "error",
          progress: data.detail || data.error || "Synchronisation pipeline aborted.",
          data: data,
        });
      }
    } catch (error) {
      setSyncState({
        status: "error",
        progress: "Network connectivity failed during synchronization.",
        data: null,
      });
    }
  };

  const handleOverrideExecute = () => {
    if (currentFileContext) {
      triggerSync(currentFileContext, activeTab, true);
    }
  };

  const handleAbortExecute = () => {
    setConflictData(null);
    setCurrentFileContext(null);
    setSelectedFile(null);
    setSyncState({ status: "idle", progress: "Transaction aborted by user.", data: null });
  };

  // UI mappings for layers
  const layerMeta = {
    layerA: {
      title: "Source Layer A: Induction Data",
      desc: "Upload student identity, demographics, qualifications (12th vs ITI) and initial academic grades.",
      download: `${API_BASE}/samples/download/layerA`,
      color: "brand",
      border: "border-brand-500/40",
      text: "text-brand-400"
    },
    layerB: {
      title: "Source Layer B: Document Pending List",
      desc: "Upload compliance Leaving Certificate (LC) statuses, pending paperwork lists, and finance bank details.",
      download: `${API_BASE}/samples/download/layerB`,
      color: "amber",
      border: "border-amber-500/40",
      text: "text-amber-400"
    },
    layerC: {
      title: "Source Layer C: OJT Form Responses",
      desc: "Upload transactional field daily attendance logs to build the attendance ledger matrix.",
      download: `${API_BASE}/samples/download/layerC`,
      color: "sky",
      border: "border-sky-500/40",
      text: "text-sky-400"
    }
  };

  const currentMeta = layerMeta[activeTab];

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl border border-dark-border mb-8 animate-slide-up relative">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-dark-border pb-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <span className="w-3 h-3 bg-brand-500 rounded-full animate-pulse-slow"></span>
            ERP Data Ingestion Gateway
          </h2>
          <p className="text-slate-400 text-sm mt-1">Ingest operational spreadsheets to permanently sync registration ledgers.</p>
        </div>
        
        {/* Template Downloads */}
        <div className="flex flex-wrap gap-2 mt-4 sm:mt-0">
          <a
            href={layerMeta.layerA.download}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 hover:border-emerald-400 text-emerald-400 text-xs font-semibold hover:bg-emerald-900/20 transition-all hover-scale"
          >
            📥 Source Layer A Template
          </a>
          <a
            href={layerMeta.layerB.download}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-500/30 hover:border-amber-400 text-amber-400 text-xs font-semibold hover:bg-amber-900/20 transition-all hover-scale"
          >
            📥 Source Layer B Template
          </a>
          <a
            href={layerMeta.layerC.download}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-950/40 border border-sky-500/30 hover:border-sky-400 text-sky-400 text-xs font-semibold hover:bg-sky-900/20 transition-all hover-scale"
          >
            📥 Source Layer C Template
          </a>
        </div>
      </div>

      {/* CORE LAYER TABS */}
      <div className="flex border-b border-dark-border mb-6">
        <button
          onClick={() => { setActiveTab("layerA"); setConflictData(null); setSyncState({ status: "idle" }); }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "layerA" ? "border-brand-500 text-brand-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Source Layer A: Demographics
        </button>
        <button
          onClick={() => { setActiveTab("layerB"); setConflictData(null); setSyncState({ status: "idle" }); }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "layerB" ? "border-amber-500 text-amber-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Source Layer B: Compliance
        </button>
        <button
          onClick={() => { setActiveTab("layerC"); setConflictData(null); setSyncState({ status: "idle" }); }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "layerC" ? "border-sky-500 text-sky-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Source Layer C: OJT Attendance Ledger
        </button>
      </div>

      {/* DROP-ZONE INTERFACE */}
      <div>
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            isDragActive
              ? "border-brand-400 bg-brand-950/20 glow-emerald"
              : `border-dark-border bg-dark-panel/40 hover:${currentMeta.border}`
          }`}
        >
          <input
            type="file"
            id="file-sync-upload"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleSelectFile}
          />
          
          <svg className={`w-12 h-12 ${currentMeta.text} mx-auto mb-4`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          
          <label htmlFor="file-sync-upload" className="cursor-pointer">
            <span className={`${currentMeta.text} font-semibold hover:underline`}>Click to upload</span> or drag and drop
            <h4 className="text-slate-200 font-bold text-sm mt-3">{currentMeta.title}</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xl mx-auto">{currentMeta.desc}</p>
          </label>
          
          {selectedFile && (
            <div className="mt-4 px-3 py-1.5 bg-dark-card rounded-lg inline-flex items-center gap-2 border border-dark-border text-slate-300 text-xs">
              <span>📁 {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)</span>
            </div>
          )}
        </div>

        {/* LOG PANEL PROGRESS / ERROR SCREEN */}
        {syncState.status !== "idle" && (
          <div className={`mt-6 rounded-xl p-4 border transition-all ${
            syncState.status === "loading" ? "bg-slate-900/50 border-slate-700/50" :
            syncState.status === "success" ? "bg-emerald-950/20 border-emerald-500/20" :
            "bg-rose-950/20 border-rose-500/20"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-200">Execution Transactional Ingestion Log:</span>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                syncState.status === "loading" ? "bg-slate-800 text-slate-300 animate-pulse" :
                syncState.status === "success" ? "bg-emerald-500/10 text-emerald-400" :
                "bg-rose-500/10 text-rose-400"
              }`}>
                {syncState.status.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-slate-300 mb-2">{syncState.progress}</p>
            
            {syncState.data && syncState.status === "success" && (
              <div className="text-xs space-y-1.5 border-t border-dark-border pt-2 text-slate-400 mt-2">
                <div className="flex justify-between">
                  <span>Workbook Rows Synchronised:</span>
                  <span className="text-brand-400 font-semibold">
                    {syncState.data.records_parsed !== undefined ? syncState.data.records_parsed : syncState.data.records_processed}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Data Layer Routing:</span>
                  <span className="text-sky-400 font-semibold">{syncState.data.layer || "Daily Attendance Ledger"}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==============================================================
          CONFLICT RESOLUTION DIALOG MODAL (HTTP 409 GATES)
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
                The spreadsheet uploaded contains records that are already registered in the relational database.
                Below is a detailed log of conflicting identities identified in the transaction block:
              </p>

              {/* Conflict lists */}
              <div className="bg-dark-bg/60 rounded-xl border border-dark-border/60 p-3 max-h-48 overflow-y-auto mb-5 space-y-2">
                {conflictData.conflicts && conflictData.conflicts.map((con, index) => (
                  <div key={index} className="flex justify-between items-center text-xs border-b border-dark-border/40 pb-1.5 last:border-b-0 last:pb-0">
                    <span className="font-semibold text-slate-200">🎫 {con.ticket_no} - {con.full_name}</span>
                    <span className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono">
                      Metric: {con.quess_batch_no}
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
                onClick={handleAbortExecute}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all hover-scale"
              >
                [CANCEL] Rollback Ingestion
              </button>
              <button
                onClick={handleOverrideExecute}
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
