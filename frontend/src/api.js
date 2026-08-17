const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
const TEAM_API_KEY = import.meta.env.VITE_TEAM_API_KEY || "breif2reel-team-key-v1";

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

export async function fetchNiches() {
  const response = await safeFetch(`${API_BASE_URL}/niches`, {
    headers: authHeaders(),
  });
  return parseResponse(response);
}

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

