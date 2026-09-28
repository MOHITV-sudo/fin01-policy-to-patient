import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import PolicyUpload from "./components/PolicyUpload";
import ExtractedRulesCard from "./components/ExtractedRulesCard";
import PolicyQA from "./components/PolicyQA";
import CostEstimator from "./components/CostEstimator";
import CalculationResults from "./components/CalculationResults";
import UncertaintyAlert from "./components/UncertaintyAlert";
import {
  uploadPolicyFile,
  loadSamplePolicyApi,
  askPolicyQuestion,
  getPolicyRules,
  overridePolicyRules,
  fetchTreatments,
  fetchCities,
  estimateClaimCost,
} from "./api/client";
import { ShieldCheck, Sparkles, CheckCircle, AlertTriangle, X } from "lucide-react";

export default function App() {
  const [activePolicy, setActivePolicy] = useState(null);
  const [rules, setRules] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);

  // Q&A state
  const [asking, setAsking] = useState(false);
  const [qaHistory, setQaHistory] = useState([]);

  // Cost Estimator state
  const [treatments, setTreatments] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedTreatment, setSelectedTreatment] = useState("Knee Replacement");
  const [selectedCity, setSelectedCity] = useState("Pune");
  const [policyAgeMonths, setPolicyAgeMonths] = useState(36);
  const [roomRentActual, setRoomRentActual] = useState("");
  const [overrides, setOverrides] = useState({});
  const [estimating, setEstimating] = useState(false);
  const [estimateResult, setEstimateResult] = useState(null);

  // Toast Notification state
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Initial load of treatments & cities
  useEffect(() => {
    async function initData() {
      try {
        const [tList, cList] = await Promise.all([fetchTreatments(), fetchCities()]);
        setTreatments(tList);
        setCities(cList);
        if (tList.length > 0 && !tList.includes("Knee Replacement")) {
          setSelectedTreatment(tList[0]);
        }
        if (cList.length > 0 && !cList.includes("Pune")) {
          setSelectedCity(cList[0]);
        }
      } catch (err) {
        console.error("Initial data load error:", err);
      }
    }
    initData();
  }, []);

  // Upload handler
  const handleUpload = async (file) => {
    setUploading(true);
    setEstimateResult(null);
    try {
      const res = await uploadPolicyFile(file);
      setActivePolicy(res);
      showToast(`Analyzed ${res.total_pages} pages successfully!`, "success");

      // Fetch rules
      const r = await getPolicyRules(res.policy_id);
      setRules(r);
    } catch (err) {
      showToast(err.message || "Failed to upload and analyze PDF", "error");
    } finally {
      setUploading(false);
    }
  };

  // Sample policy loader
  const handleLoadSample = async (policyType = "standard") => {
    setLoadingSample(true);
    setEstimateResult(null);
    try {
      const res = await loadSamplePolicyApi(policyType);
      setActivePolicy(res);
      const r = await getPolicyRules(res.policy_id);
      setRules(r);
      setOverrides({});
      showToast(
        policyType === "standard"
          ? "Standard Sample Policy loaded (4 pages with full schedule)!"
          : "Loaded sample with missing co-pay to demonstrate uncertainty safety!",
        "success"
      );
    } catch (err) {
      showToast(err.message || "Failed to load sample policy", "error");
    } finally {
      setLoadingSample(false);
    }
  };

  // Q&A handler
  const handleAsk = async (questionText) => {
    if (!activePolicy) {
      showToast("Please upload or load a policy first.", "warning");
      return;
    }
    setAsking(true);
    try {
      const res = await askPolicyQuestion(activePolicy.policy_id, questionText);
      setQaHistory((prev) => [
        {
          question: questionText,
          answer: res.answer,
          coverage_status: res.coverage_status,
          conditions: res.conditions,
          exclusions: res.exclusions,
          evidence: res.evidence,
          confidence: res.confidence,
          confidence_reason: res.confidence_reason,
        },
        ...prev,
      ]);
    } catch (err) {
      showToast(err.message || "Failed to query policy", "error");
    } finally {
      setAsking(false);
    }
  };

  // Rule override handler
  const handleOverride = async (newOverrides) => {
    if (!activePolicy) return;
    try {
      const updated = await overridePolicyRules(activePolicy.policy_id, newOverrides);
      setRules(updated);
      setOverrides((prev) => ({ ...prev, ...newOverrides }));
      showToast("Policy rules updated with user overrides!", "success");
      // Trigger re-estimate if an estimate was already performed
      if (estimateResult) {
        runEstimate(newOverrides);
      }
    } catch (err) {
      showToast(err.message || "Failed to update overrides", "error");
    }
  };

  // Cost Estimation handler
  const runEstimate = async (extraOverrides = null) => {
    if (!activePolicy) {
      showToast("Please upload or load a policy document first.", "warning");
      return;
    }
    setEstimating(true);
    try {
      const activeOverrides = {
        ...overrides,
        ...(extraOverrides || {}),
      };

      const payload = {
        policy_id: activePolicy.policy_id,
        treatment: selectedTreatment,
        city: selectedCity,
        policy_age_months: policyAgeMonths,
        room_rent_actual: roomRentActual ? parseFloat(roomRentActual) : null,
        overrides: Object.keys(activeOverrides).length > 0 ? activeOverrides : null,
      };

      const res = await estimateClaimCost(payload);
      setEstimateResult(res);

      if (res.status === "CALCULATED") {
        showToast("Settlement breakdown calculated successfully!", "success");
      } else if (res.status === "NOT_COVERED") {
        showToast("Claim is not payable under policy terms.", "warning");
      } else if (res.status === "INSUFFICIENT_INFORMATION") {
        showToast("Point estimate withheld: Required rule missing.", "warning");
      }
    } catch (err) {
      showToast(err.message || "Calculation failed", "error");
    } finally {
      setEstimating(false);
    }
  };

  // Supply missing parameter from UncertaintyAlert
  const handleSupplyMissing = (supplied) => {
    handleOverride(supplied);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header
        onLoadSample={handleLoadSample}
        loadingSample={loadingSample}
        activePolicy={activePolicy}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Toast Alert */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 text-xs font-medium animate-bounce ${
              toast.type === "success"
                ? "bg-emerald-950 border-emerald-500 text-emerald-200"
                : toast.type === "error"
                ? "bg-rose-950 border-rose-500 text-rose-200"
                : "bg-amber-950 border-amber-500 text-amber-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Section 1: Ingestion & Rules Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <PolicyUpload
              onUpload={handleUpload}
              uploading={uploading}
              activePolicy={activePolicy}
              onLoadSample={handleLoadSample}
              loadingSample={loadingSample}
            />
          </div>
          <div className="lg:col-span-7">
            {rules ? (
              <ExtractedRulesCard rules={rules} onOverride={handleOverride} />
            ) : (
              <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center h-full">
                <ShieldCheck className="w-10 h-10 text-slate-700 mb-2" />
                <p className="text-sm font-semibold text-slate-400">Rules Extraction Idle</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Upload a policy PDF or click "Load Sample Policy" to inspect financial limits and waiting periods.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Semantic Q&A */}
        <div>
          <PolicyQA
            policyId={activePolicy?.policy_id}
            onAsk={handleAsk}
            asking={asking}
            qaHistory={qaHistory}
          />
        </div>

        {/* Section 3: Cost Estimator */}
        <div>
          <CostEstimator
            policyId={activePolicy?.policy_id}
            onEstimate={() => runEstimate()}
            estimating={estimating}
            treatments={treatments}
            cities={cities}
            policyAgeMonths={policyAgeMonths}
            setPolicyAgeMonths={setPolicyAgeMonths}
            selectedTreatment={selectedTreatment}
            setSelectedTreatment={setSelectedTreatment}
            selectedCity={selectedCity}
            setSelectedCity={setSelectedCity}
            roomRentActual={roomRentActual}
            setRoomRentActual={setRoomRentActual}
            overrides={overrides}
            setOverrides={setOverrides}
          />
        </div>

        {/* Section 4: Uncertainty Alert or Results */}
        {estimateResult && estimateResult.status === "INSUFFICIENT_INFORMATION" && (
          <UncertaintyAlert
            missingFields={estimateResult.missing_fields}
            message={estimateResult.message}
            onSupplyMissing={handleSupplyMissing}
          />
        )}

        {estimateResult && estimateResult.status !== "INSUFFICIENT_INFORMATION" && (
          <CalculationResults result={estimateResult} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p>FIN01 – Policy-to-Patient | HackMatrix 5.0 Submission (Problem FIN-01)</p>
          <p className="text-[11px] text-slate-600">
            PyMuPDF • Sentence-Transformers Semantic Retrieval • Pure Python Deterministic Calculation Engine
          </p>
        </div>
      </footer>
    </div>
  );
}
