const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function formatINR(val) {
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function uploadPolicyFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/upload-policy`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function loadSamplePolicyApi(policyType = "standard") {
  const res = await fetch(`${API_BASE}/load-sample?policy_type=${policyType}`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to load sample policy" }));
    throw new Error(err.detail || "Failed to load sample policy");
  }
  return res.json();
}

export async function askPolicyQuestion(policyId, question) {
  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ policy_id: policyId, question }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Q&A request failed" }));
    throw new Error(err.detail || "Q&A request failed");
  }
  return res.json();
}

export async function getPolicyRules(policyId) {
  const res = await fetch(`${API_BASE}/rules/${policyId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to retrieve rules" }));
    throw new Error(err.detail || "Failed to retrieve rules");
  }
  return res.json();
}

export async function overridePolicyRules(policyId, overrides) {
  const res = await fetch(`${API_BASE}/rules/${policyId}/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(overrides),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to override rules" }));
    throw new Error(err.detail || "Failed to override rules");
  }
  return res.json();
}

export async function fetchTreatments() {
  const res = await fetch(`${API_BASE}/treatments`);
  return res.json();
}

export async function fetchCities() {
  const res = await fetch(`${API_BASE}/cities`);
  return res.json();
}

export async function fetchCost(treatment, city) {
  const url = new URL(`${API_BASE}/cost`);
  url.searchParams.set("treatment", treatment);
  if (city) url.searchParams.set("city", city);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to fetch cost" }));
    throw new Error(err.detail || "Cost not found");
  }
  return res.json();
}

export async function estimateClaimCost(payload) {
  const res = await fetch(`${API_BASE}/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Calculation failed" }));
    throw new Error(err.detail || "Calculation failed");
  }
  return res.json();
}
