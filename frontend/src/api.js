const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
const TEAM_API_KEY = import.meta.env.VITE_TEAM_API_KEY || "";

async function parseResponse(response) {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

export async function fetchNiches() {
  const response = await fetch(`${API_BASE_URL}/niches`);
  return parseResponse(response);
}

export async function createCampaign(payload) {
  const response = await fetch(`${API_BASE_URL}/campaigns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TEAM_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function generateCampaign(campaignId) {
  const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TEAM_API_KEY}`,
    },
  });
  return parseResponse(response);
}

export async function listCampaigns({ nicheId, status }) {
  const params = new URLSearchParams();
  if (nicheId) params.set("niche_id", nicheId);
  if (status) params.set("status", status);
  const query = params.toString();
  const response = await fetch(`${API_BASE_URL}/campaigns${query ? `?${query}` : ""}`);
  return parseResponse(response);
}

export async function getCampaign(campaignId) {
  const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}`);
  return parseResponse(response);
}

