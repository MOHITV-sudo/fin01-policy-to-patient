import React, { useState } from "react";
import { Shield, FileCheck, Info, ChevronDown, ChevronUp, Edit3, Check } from "lucide-react";
import { formatINR } from "../api/client";

function RuleField({ label, field, unit = "" }) {
  const [showSnippet, setShowSnippet] = useState(false);
  const isMissing = field?.value === null || field?.value === undefined;
  const isOverride = field?.is_override || field?.source === "user-provided";
  const confidence = field?.confidence || "LOW";
  const ev = field?.evidence;

  return (
    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between hover:border-slate-700 transition">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <div className="flex items-center gap-1.5">
          {isOverride && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20">
              user-provided
            </span>
          )}
          {ev?.page > 0 && (
            <button
              type="button"
              onClick={() => setShowSnippet(!showSnippet)}
              className="px-1.5 py-0.5 rounded text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition flex items-center gap-0.5 font-mono"
              title="Click to view evidence citation snippet"
            >
              P.{ev.page}
            </button>
          )}
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
              confidence === "HIGH"
                ? "bg-emerald-500/10 text-emerald-400"
                : confidence === "MEDIUM"
                ? "bg-yellow-500/10 text-yellow-400"
                : "bg-rose-500/10 text-rose-400"
            }`}
          >
            {confidence}
          </span>
        </div>
      </div>

      <div className="text-base font-bold text-white tracking-tight">
        {isMissing ? (
          <span className="text-amber-400 font-medium text-xs italic">Not Specified</span>
        ) : typeof field.value === "number" ? (
          unit === "%" ? `${field.value}%` : unit === "months" ? `${field.value} Months` : formatINR(field.value)
        ) : (
          String(field.value)
        )}
      </div>

      {showSnippet && ev && (
        <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-300 bg-slate-900/90 p-2 rounded-lg">
          <p className="font-semibold text-teal-400 mb-0.5">{ev.section || "Policy Clause"}</p>
          <p className="italic text-slate-300">"{ev.snippet}"</p>
        </div>
      )}
    </div>
  );
}

export default function ExtractedRulesCard({ rules, onOverride }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [customCopay, setCustomCopay] = useState("");
  const [customDeductible, setCustomDeductible] = useState("");
  const [customLimit, setCustomLimit] = useState("");

  if (!rules) return null;

  const handleApplyOverride = (e) => {
    e.preventDefault();
    const payload = {};
    if (customCopay !== "") payload.copay_percent = parseFloat(customCopay);
    if (customDeductible !== "") payload.deductible = parseFloat(customDeductible);
    if (customLimit !== "") payload.coverage_limit = parseFloat(customLimit);

    if (Object.keys(payload).length > 0) {
      onOverride(payload);
    }
    setEditing(false);
  };

  const specificWait = rules.specific_waiting_periods?.value || {};
  const subLimits = rules.sub_limits?.value || {};
  const exclusions = rules.exclusions?.value || [];

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            2. Extracted Policy Rules
          </h2>
          <p className="text-xs text-slate-400">
            Rules extracted with page citations & evidence snippets
          </p>
        </div>

        <button
          onClick={() => setEditing(!editing)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
        >
          <Edit3 className="w-3.5 h-3.5 text-teal-400" />
          {editing ? "Cancel Overrides" : "Manual Overrides"}
        </button>
      </div>

      {editing && (
        <form onSubmit={handleApplyOverride} className="mb-4 p-4 bg-teal-950/20 border border-teal-800/40 rounded-xl space-y-3">
          <p className="text-xs font-semibold text-teal-300">Override Extracted Parameters (User-Provided):</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Co-Payment (%)</label>
              <input
                type="number"
                placeholder={rules.copay_percent?.value ?? "e.g. 20"}
                value={customCopay}
                onChange={(e) => setCustomCopay(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Deductible (₹)</label>
              <input
                type="number"
                placeholder={rules.deductible?.value ?? "e.g. 10000"}
                value={customDeductible}
                onChange={(e) => setCustomDeductible(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Coverage Limit (₹)</label>
              <input
                type="number"
                placeholder={rules.coverage_limit?.value ?? "e.g. 500000"}
                value={customLimit}
                onChange={(e) => setCustomLimit(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
          </div>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg transition"
          >
            <Check className="w-3.5 h-3.5" />
            Save & Merge Overrides
          </button>
        </form>
      )}

      {/* Primary Financial Rules Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <RuleField label="Sum Insured" field={rules.sum_insured} />
        <RuleField label="Coverage Limit" field={rules.coverage_limit} />
        <RuleField label="Deductible" field={rules.deductible} />
        <RuleField label="Co-Payment" field={rules.copay_percent} unit="%" />
        <RuleField label="Room Rent Limit" field={rules.room_rent_limit_per_day} />
        <RuleField label="General Waiting" field={rules.waiting_period_months} unit="months" />
        <div className="col-span-2 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>Procedure Waiting Periods</span>
            {rules.specific_waiting_periods?.evidence?.page > 0 && (
              <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-1 rounded">
                P.{rules.specific_waiting_periods.evidence.page}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(specificWait).length > 0 ? (
              Object.entries(specificWait).map(([proc, months]) => (
                <span key={proc} className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-200 border border-slate-700 capitalize">
                  {proc}: <strong className="text-teal-400">{months} mo</strong>
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">None extracted</span>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Sub-limits & Exclusions */}
      <div className="mt-4 pt-3 border-t border-slate-800/80">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-xs font-medium text-slate-400 hover:text-slate-200 transition"
        >
          <span>View Specific Procedure Sub-Limits & Exclusions</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expanded && (
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-300 mb-1.5">Procedure Sub-Limits:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(subLimits).length > 0 ? (
                  Object.entries(subLimits).map(([proc, amt]) => (
                    <span key={proc} className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                      {proc}: <strong className="text-emerald-400">{formatINR(amt)}</strong>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">No sub-limits extracted</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-slate-300 mb-1.5">Extracted Exclusions:</p>
              <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                {exclusions.length > 0 ? (
                  exclusions.map((ex, i) => <li key={i}>{ex}</li>)
                ) : (
                  <li>No specific exclusions listed</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
