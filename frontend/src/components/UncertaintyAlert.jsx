import React, { useState } from "react";
import { AlertTriangle, ArrowRight, ShieldAlert } from "lucide-react";

export default function UncertaintyAlert({ missingFields, message, onSupplyMissing }) {
  const [inputs, setInputs] = useState({
    copay_percent: "20",
    coverage_limit: "500000",
    deductible: "10000"
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const overrides = {};
    if (missingFields.some(f => f.toLowerCase().includes("co-pay") || f.toLowerCase().includes("copay"))) {
      overrides.copay_percent = parseFloat(inputs.copay_percent);
    }
    if (missingFields.some(f => f.toLowerCase().includes("limit") || f.toLowerCase().includes("sum insured"))) {
      overrides.coverage_limit = parseFloat(inputs.coverage_limit);
    }
    onSupplyMissing(overrides);
  };

  return (
    <div className="bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl backdrop-blur-sm animate-fadeIn">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                AUDIT SAFETY LOCK
              </span>
              <h3 className="text-sm font-bold text-amber-200">
                Point Estimate Refused: Insufficient Policy Information
              </h3>
            </div>

            <p className="text-xs text-amber-300/90 mt-1 font-mono font-medium">
              {message || `Unable to produce a reliable estimate. Missing: ${missingFields.join(", ")}. Please verify with the insurer.`}
            </p>

            <p className="text-xs text-slate-400 mt-1">
              Deterministic calculation rule #2: The system refuses to hallucinate or guess financial parameters.
              To see how the estimate changes, supply the missing parameter below as a user-provided override.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="pt-2 flex flex-wrap items-end gap-3">
            {missingFields.some(f => f.toLowerCase().includes("co-pay") || f.toLowerCase().includes("copay")) && (
              <div>
                <label className="text-[11px] font-semibold text-amber-300 block mb-1">
                  Supply Co-Payment (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={inputs.copay_percent}
                    onChange={(e) => setInputs({ ...inputs, copay_percent: e.target.value })}
                    className="w-36 bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    placeholder="e.g. 20"
                    required
                  />
                  <span className="absolute right-3 top-1.5 text-xs text-slate-400">%</span>
                </div>
              </div>
            )}

            {missingFields.some(f => f.toLowerCase().includes("limit") || f.toLowerCase().includes("sum insured")) && (
              <div>
                <label className="text-[11px] font-semibold text-amber-300 block mb-1">
                  Supply Coverage Limit (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={inputs.coverage_limit}
                  onChange={(e) => setInputs({ ...inputs, coverage_limit: e.target.value })}
                  className="w-44 bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  placeholder="e.g. 500000"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-500/20"
            >
              <span>Supply Value & Calculate</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
