const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
const TEAM_API_KEY = import.meta.env.VITE_TEAM_API_KEY || "";
if (!TEAM_API_KEY) {
  console.warn("[breif2reel] VITE_TEAM_API_KEY is not set — API requests will fail auth. Add it to frontend/.env");
}

/**
 * Wraps the native fetch to catch network-level errors (e.g. backend not
 * running) and re-throw with a human-readable message instead of the
 * browser's generic "Failed to fetch".
 */
async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (err instanceof TypeError && /failed to fetch|networkerror|network request failed/i.test(err.message)) {
      throw new Error(
        "Cannot reach the backend server. Make sure the backend is running on " +
          API_BASE_URL.replace(/\/api\/v1$/, "") +
          " and try again."
      );
    }
    throw err;
  }
}

async function parseResponse(response) {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

/** Default headers sent with every request. */
function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${TEAM_API_KEY}`,
    ...extra,
  };
}

// ───────────────────────────────────────────────
// System Health
// ───────────────────────────────────────────────

export async function checkHealth() {
  const rootUrl = API_BASE_URL.replace(/\/api\/v1$/, "");
  const startTime = performance.now();
  try {
    const response = await fetch(`${rootUrl}/health`, {
      method: "GET",
      headers: authHeaders(),
    });
    const latency = Math.round(performance.now() - startTime);
    if (!response.ok) {
      return { status: "degraded", code: response.status, latency };
    }
    const data = await response.json();
    return { status: data.status === "ok" ? "operational" : "degraded", latency };
  } catch (err) {
    return { status: "offline", error: err.message, latency: null };
  }
}

// ───────────────────────────────────────────────
// Niches
// ───────────────────────────────────────────────

export async function fetchNiches() {
  const response = await safeFetch(`${API_BASE_URL}/niches`, {
    headers: authHeaders(),
  });
  return parseResponse(response);
}

// ───────────────────────────────────────────────
// Campaigns
// ───────────────────────────────────────────────

export async function createCampaign(payload) {
  const response = await safeFetch(`${API_BASE_URL}/campaigns`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function generateCampaign(campaignId) {
  const response = await safeFetch(`${API_BASE_URL}/campaigns/${campaignId}/generate`, {
    method: "POST",
    headers: authHeaders(),
  });
  return parseResponse(response);
}

export async function listCampaigns({ nicheId, status }) {
  const params = new URLSearchParams();
  if (nicheId) params.set("niche_id", nicheId);
  if (status) params.set("status", status);
  const query = params.toString();
  const response = await safeFetch(`${API_BASE_URL}/campaigns${query ? `?${query}` : ""}`, {
    headers: authHeaders(),
  });
  return parseResponse(response);
}

export async function getCampaign(campaignId) {
  const response = await safeFetch(`${API_BASE_URL}/campaigns/${campaignId}`, {
    headers: authHeaders(),
  });
  return parseResponse(response);
}

/**
 * Update campaign status (approve / reject).
 * NOTE: This endpoint may not exist yet on the backend — the frontend is
 * ready for it.  The backend route would be:
 *   PATCH /api/v1/campaigns/{id}/status  { "status": "approved" | "rejected" }
 */
export async function updateCampaignStatus(campaignId, newStatus) {
  const response = await safeFetch(`${API_BASE_URL}/campaigns/${campaignId}/status`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ status: newStatus }),
  });
  return parseResponse(response);
}

// ───────────────────────────────────────────────
// Brand Assets
// ───────────────────────────────────────────────

export async function listBrandAssets(nicheId) {
  const response = await safeFetch(`${API_BASE_URL}/niches/${nicheId}/brand-assets`, {
    headers: authHeaders(),
  });
  return parseResponse(response);
}

export async function uploadTextBrandAsset(nicheId, text) {
  const response = await safeFetch(`${API_BASE_URL}/niches/${nicheId}/brand-assets/text`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ text, source_type: "text" }),
  });
  return parseResponse(response);
}

export async function uploadFileBrandAsset(nicheId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await safeFetch(`${API_BASE_URL}/niches/${nicheId}/brand-assets/upload`, {
    method: "POST",
    headers: authHeaders(), // Don't set Content-Type — browser sets it with boundary
    body: formData,
  });
  return parseResponse(response);
}

export async function deleteBrandAsset(nicheId, assetId) {
  const response = await safeFetch(`${API_BASE_URL}/niches/${nicheId}/brand-assets/${assetId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return parseResponse(response);
}

// ───────────────────────────────────────────────
// Post History & Analytics (B7, B9, B10)
// ───────────────────────────────────────────────

export async function fetchPostHistory({ platform, status, limit } = {}) {
  const params = new URLSearchParams();
  if (platform) params.set("platform", platform);
  if (status) params.set("status", status);
  if (limit) params.set("limit", limit);
  const query = params.toString();
  const response = await safeFetch(`${API_BASE_URL}/posts/history${query ? `?${query}` : ""}`, {
    headers: authHeaders(),
  });
  return parseResponse(response);
}

export async function fetchAnalyticsSummary() {
  const response = await safeFetch(`${API_BASE_URL}/analytics/summary`, {
    headers: authHeaders(),
  });
  return parseResponse(response);
}

export async function fetchAccounts(nicheId) {
  const params = new URLSearchParams();
  if (nicheId) params.set("niche_id", nicheId);
  const query = params.toString();
  const response = await safeFetch(`${API_BASE_URL}/accounts${query ? `?${query}` : ""}`, {
    headers: authHeaders(),
  });
  return parseResponse(response);
}

