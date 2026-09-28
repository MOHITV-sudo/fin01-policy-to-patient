import React, { useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

export default function PolicyUpload({ onUpload, uploading, activePolicy, onLoadSample, loadingSample }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        onUpload(file);
      } else {
        alert("Please upload a PDF document.");
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-400" />
            1. Policy Document Ingestion
          </h2>
          <p className="text-xs text-slate-400">
            PyMuPDF page-aware extraction, chunking & semantic retrieval indexing
          </p>
        </div>
        {activePolicy && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {activePolicy.total_pages} Pages Indexed
          </span>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
          dragOver
            ? "border-teal-400 bg-teal-500/5 scale-[0.99]"
            : "border-slate-700/80 hover:border-slate-600 bg-slate-950/40"
        }`}
      >
        <input
          type="file"
          id="pdf-input"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-teal-400 group-hover:scale-110 transition">
            <UploadCloud className="w-6 h-6 animate-pulse" />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-200">
              Drag & drop your health insurance policy PDF here
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports standard retail and group medical insurance policies
            </p>
          </div>

          <div className="flex items-center gap-3 mt-1">
            <label
              htmlFor="pdf-input"
              className={`px-4 py-2 text-xs font-semibold rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 cursor-pointer shadow-md shadow-teal-500/10 transition ${
                uploading ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              {uploading ? "Analyzing Pages..." : "Browse PDF File"}
            </label>

            <span className="text-xs text-slate-500">or</span>

            <button
              type="button"
              onClick={() => onLoadSample("standard")}
              disabled={loadingSample || uploading}
              className="text-xs text-teal-400 hover:text-teal-300 font-medium underline underline-offset-4"
            >
              1-Click Demo Sample
            </button>
          </div>
        </div>
      </div>

      {uploading && (
        <div className="mt-4 p-3 bg-teal-950/30 border border-teal-800/40 rounded-xl flex items-center gap-3 text-xs text-teal-300 animate-pulse">
          <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Processing document pages with PyMuPDF and computing embeddings...</span>
        </div>
      )}

      {activePolicy && !uploading && (
        <div className="mt-4 p-3.5 bg-slate-800/50 border border-slate-700/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-teal-400 shrink-0" />
            <div>
              <span className="font-medium text-slate-200">{activePolicy.filename}</span>
              <span className="text-slate-400 ml-2">({activePolicy.total_pages} pages processed)</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-[11px] font-mono">
              ID: {activePolicy.policy_id}
            </span>
          </div>
        </div>
      )}

      {activePolicy?.warnings && activePolicy.warnings.length > 0 && (
        <div className="mt-3 p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">Document Notice</p>
            {activePolicy.warnings.map((w, idx) => (
              <p key={idx} className="text-amber-200/80">{w}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
