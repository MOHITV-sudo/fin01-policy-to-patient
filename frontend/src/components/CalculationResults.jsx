import React from "react";
import { CheckCircle, AlertCircle, ArrowDownRight, FileText, Info, Percent } from "lucide-react";
import { formatINR } from "../api/client";

export default function CalculationResults({ result }) {
  if (!result) return null;

  const isEligible = result.is_eligible;
  const isNotCovered = result.status === "NOT_COVERED";
  const insurerPays = result.insurer_pays ?? 0;
  const outOfPocket = result.out_of_pocket ?? 0;
  const baseCost = result.base_cost ?? (insurerPays + outOfPocket);

  const insurerPct = baseCost > 0 ? Math.round((insurerPays / baseCost) * 100) : 0;
  const oopPct = baseCost > 0 ? Math.round((outOfPocket / baseCost) * 100) : 100;

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-6 animate-fadeIn">
      {/* Top Banner Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Estimate Breakdown
          </span>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>{result.treatment}</span>
            <span className="text-sm font-normal text-slate-400">in {result.city}</span>
            {result.is_national_average && (
              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                National Avg
              </span>
            )}
          </h3>
        </div>

        <div>
          {isNotCovered ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              CLAIM NOT ADMISSIBLE
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              ESTIMATE CALCULATED
            </span>
          )}
        </div>
      </div>

      {/* Prominent High-Level Numbers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Bill */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400">Estimated Total Bill</span>
          <div className="text-2xl font-extrabold text-white mt-1">
            {formatINR(baseCost)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1">Based on hospital benchmarks</span>
        </div>

        {/* Insurer Pays */}
        <div className="bg-gradient-to-br from-emerald-950/40 to-slate-950 border border-emerald-500/30 rounded-xl p-4 flex flex-col justify-between shadow-lg shadow-emerald-500/5">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-400">
            <span>Insurer Pays (Estimated)</span>
            <span className="font-bold">{insurerPct}%</span>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-1 tracking-tight">
            {formatINR(insurerPays)}
          </div>
          <span className="text-[11px] text-emerald-300/70 mt-1">Admissible covered liability</span>
        </div>

        {/* Patient Out-of-Pocket */}
        <div className="bg-gradient-to-br from-sky-950/40 to-slate-950 border border-sky-500/30 rounded-xl p-4 flex flex-col justify-between shadow-lg shadow-sky-500/5">
          <div className="flex items-center justify-between text-xs font-medium text-sky-400">
            <span>You Pay Out-of-Pocket</span>
            <span className="font-bold">{oopPct}%</span>
          </div>
          <div className="text-3xl font-extrabold text-sky-400 mt-1 tracking-tight">
            {formatINR(outOfPocket)}
          </div>
          <span className="text-[11px] text-sky-300/70 mt-1">Deductible + Copay + Over-limit</span>
        </div>
      </div>

      {/* Visual Split Bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
          <span>Cost Settlement Share</span>
          <span>
            Insurer: <strong className="text-emerald-400">{insurerPct}%</strong> | Patient:{" "}
            <strong className="text-sky-400">{oopPct}%</strong>
          </span>
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${insurerPct}%` }}
            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500"
          ></div>
          <div
            style={{ width: `${oopPct}%` }}
            className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full transition-all duration-500"
          ></div>
        </div>
      </div>

      {/* Low / Avg / High Ranges */}
      {result.ranges && (
        <div>
          <h4 className="text-xs font-semibold text-slate-300 mb-2.5">
            Cost Benchmark Scenarios (Min, Average & High Billing):
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-400 font-medium">Minimum Bill Scenario</span>
              <p className="text-sm font-bold text-white mt-0.5">{formatINR(result.ranges.low.treatment_cost)}</p>
              <div className="mt-2 text-[11px] space-y-0.5 text-slate-300 border-t border-slate-800/80 pt-1.5">
                <div className="flex justify-between">
                  <span>Insurer:</span>
                  <span className="font-bold text-emerald-400">{formatINR(result.ranges.low.insurer_pays)}</span>
                </div>
                <div className="flex justify-between">
                  <span>You pay:</span>
                  <span className="font-bold text-sky-400">{formatINR(result.ranges.low.out_of_pocket)}</span>
                </div>
              </div>
            </div>

            <div className="bg-teal-950/20 border border-teal-800/50 rounded-xl p-3">
              <span className="text-teal-300 font-medium">Average Expected Scenario</span>
              <p className="text-sm font-bold text-white mt-0.5">{formatINR(result.ranges.avg.treatment_cost)}</p>
              <div className="mt-2 text-[11px] space-y-0.5 text-slate-300 border-t border-teal-900/40 pt-1.5">
                <div className="flex justify-between">
                  <span>Insurer:</span>
                  <span className="font-bold text-emerald-400">{formatINR(result.ranges.avg.insurer_pays)}</span>
                </div>
                <div className="flex justify-between">
                  <span>You pay:</span>
                  <span className="font-bold text-sky-400">{formatINR(result.ranges.avg.out_of_pocket)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-400 font-medium">High / Complications Scenario</span>
              <p className="text-sm font-bold text-white mt-0.5">{formatINR(result.ranges.high.treatment_cost)}</p>
              <div className="mt-2 text-[11px] space-y-0.5 text-slate-300 border-t border-slate-800/80 pt-1.5">
                <div className="flex justify-between">
                  <span>Insurer:</span>
                  <span className="font-bold text-emerald-400">{formatINR(result.ranges.high.insurer_pays)}</span>
                </div>
                <div className="flex justify-between">
                  <span>You pay:</span>
                  <span className="font-bold text-sky-400">{formatINR(result.ranges.high.out_of_pocket)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step-by-Step Calculation Audit Trail */}
      <div>
        <h4 className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-teal-400" />
          Deterministic Calculation Audit Trail (Python Engine):
        </h4>

        <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80 bg-slate-950/40">
          {result.steps.map((step, idx) => (
            <div key={idx} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/40 transition">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-slate-800 text-teal-400 text-[10px] font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-slate-200">{step.label}</span>
                  {step.source_page && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      Page {step.source_page}
                    </span>
                  )}
                </div>
                <p className="text-slate-400 pl-6 text-[11px]">{step.note}</p>
              </div>

              {step.amount !== null && step.amount !== undefined && (
                <div className="self-end sm:self-auto font-mono font-bold text-white shrink-0 pl-6 sm:pl-0">
                  {formatINR(step.amount)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legal Disclaimer */}
      <div className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
        <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-300">Disclaimer:</strong> Estimate only. Final claim settlement depends on insurer verification and applicable policy conditions. Medical inflation and hospital billing variances apply.
        </p>
      </div>
    </div>
  );
}
