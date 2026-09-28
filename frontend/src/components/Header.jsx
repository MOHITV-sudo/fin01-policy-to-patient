import React from "react";
import { ShieldCheck, FileText, Sparkles, AlertCircle } from "lucide-react";

export default function Header({ onLoadSample, loadingSample, activePolicy }) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20 text-slate-950 font-bold">
            <ShieldCheck className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-white tracking-tight">FIN01</span>
              <span className="text-slate-400 text-sm font-medium">| Policy-to-Patient</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                HackMatrix 5.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              AI Insurance Policy Intelligence & Deterministic Out-of-Pocket Calculator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => onLoadSample("standard")}
            disabled={loadingSample}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            {loadingSample ? "Loading..." : "Load Sample Policy"}
          </button>

          <button
            onClick={() => onLoadSample("missing_copay")}
            disabled={loadingSample}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition disabled:opacity-50"
            title="Demonstrates graceful uncertainty handling when co-pay is missing"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            Sample (Missing Co-Pay)
          </button>

          {activePolicy && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {activePolicy.policy_id}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
