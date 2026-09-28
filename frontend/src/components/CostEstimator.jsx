import React, { useState, useEffect } from "react";
import { Calculator, MapPin, Activity, Clock, Sliders, ChevronDown, ChevronUp, AlertCircle, Database } from "lucide-react";
import { fetchTreatments, fetchCities, formatINR } from "../api/client";

export default function CostEstimator({
  policyId,
  onEstimate,
  estimating,
  treatments = [],
  cities = [],
  policyAgeMonths,
  setPolicyAgeMonths,
  selectedTreatment,
  setSelectedTreatment,
  selectedCity,
  setSelectedCity,
  roomRentActual,
  setRoomRentActual,
  overrides,
  setOverrides
}) {
  const [showOverrides, setShowOverrides] = useState(false);

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Calculator className="w-4 h-4 text-teal-400" />
            4. Out-of-Pocket Cost Estimator
          </h2>
          <p className="text-xs text-slate-400">
            Deterministic Python calculation engine based on benchmark hospital billing
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 self-start sm:self-auto">
          <Database className="w-3 h-3" />
          <span>SYNTHETIC BENCHMARK DATA</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Treatment Select */}
        <div>
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1 mb-1.5">
            <Activity className="w-3.5 h-3.5 text-teal-400" />
            Treatment / Procedure
          </label>
          <select
            value={selectedTreatment}
            onChange={(e) => setSelectedTreatment(e.target.value)}
            disabled={estimating}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
          >
            {treatments.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* City Select */}
        <div>
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1 mb-1.5">
            <MapPin className="w-3.5 h-3.5 text-teal-400" />
            Hospital City
          </label>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            disabled={estimating}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
          >
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Policy Age in Months */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              Policy Age
            </label>
            <span className="text-xs font-bold text-teal-400 font-mono">
              {policyAgeMonths} Months
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="60"
              value={policyAgeMonths}
              onChange={(e) => setPolicyAgeMonths(parseInt(e.target.value) || 0)}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
            />
            <input
              type="number"
              min="0"
              max="120"
              value={policyAgeMonths}
              onChange={(e) => setPolicyAgeMonths(parseInt(e.target.value) || 0)}
              className="w-16 bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-white text-center font-mono"
            />
          </div>
        </div>

        {/* Optional Actual Room Rent */}
        <div>
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1 mb-1.5">
            Room Rent / Day (Optional)
          </label>
          <input
            type="number"
            placeholder="e.g. 5000"
            value={roomRentActual}
            onChange={(e) => setRoomRentActual(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Manual Overrides Accordion */}
      <div className="mb-4 pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={() => setShowOverrides(!showOverrides)}
          className="flex items-center justify-between w-full text-xs font-medium text-slate-400 hover:text-slate-200 transition py-1"
        >
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            Manual Rule Overrides (Test Edge Cases & Missing Info)
          </span>
          {showOverrides ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showOverrides && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800 animate-fadeIn">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Override Co-Pay (%)</label>
              <input
                type="number"
                placeholder="e.g. 20"
                value={overrides.copay_percent ?? ""}
                onChange={(e) =>
                  setOverrides({
                    ...overrides,
                    copay_percent: e.target.value === "" ? null : parseFloat(e.target.value),
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Override Deductible (₹)</label>
              <input
                type="number"
                placeholder="e.g. 10000"
                value={overrides.deductible ?? ""}
                onChange={(e) =>
                  setOverrides({
                    ...overrides,
                    deductible: e.target.value === "" ? null : parseFloat(e.target.value),
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Override Coverage Limit (₹)</label>
              <input
                type="number"
                placeholder="e.g. 200000"
                value={overrides.coverage_limit ?? ""}
                onChange={(e) =>
                  setOverrides({
                    ...overrides,
                    coverage_limit: e.target.value === "" ? null : parseFloat(e.target.value),
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Calculate Button */}
      <button
        type="button"
        onClick={onEstimate}
        disabled={estimating || !policyId}
        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {estimating ? (
          <>
            <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
            <span>Calculating Deterministic Settlement...</span>
          </>
        ) : (
          <>
            <Calculator className="w-4 h-4" />
            <span>Calculate Out-of-Pocket Estimate</span>
          </>
        )}
      </button>
    </div>
  );
}
