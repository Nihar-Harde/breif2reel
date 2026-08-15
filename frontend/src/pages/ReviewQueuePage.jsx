import { useEffect, useState } from "react";
import { fetchNiches, listCampaigns } from "../api";

const statusBadge = {
  draft: "bg-slate-100 text-slate-700",
  generating: "bg-amber-100 text-amber-700",
  needs_review: "bg-blue-100 text-blue-700",
  scheduled: "bg-purple-100 text-purple-700",
  published: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
  rejected: "bg-zinc-200 text-zinc-700",
  approved: "bg-indigo-100 text-indigo-700",
};

export function ReviewQueuePage() {
  const [niches, setNiches] = useState([]);
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ nicheId: "", status: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadCampaigns = async (nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const data = await listCampaigns({
        nicheId: nextFilters.nicheId || undefined,
        status: nextFilters.status || undefined,
      });
      setItems(data.items || []);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNiches()
      .then((data) => setNiches(data.items || []))
      .catch((fetchError) => setError(fetchError.message));
    loadCampaigns();
  }, []);

// --- START: auto-polling for review queue (adds live updates) ---
useEffect(() => {
  // Poll every 3s to refresh the list so generated campaigns show up quickly.
  // Uses the current filters so list reflects selected niche/status.
  const timer = setInterval(() => {
    loadCampaigns(filters);
  }, 3000);

  // Run an immediate refresh when the effect mounts so user sees latest list
  loadCampaigns(filters);

  return () => clearInterval(timer);
  // include loadCampaigns and filters in deps to ensure latest values are used
}, [filters]); 
// --- END: auto-polling for review queue ---
  
  const onFilterChange = (event) => {
    const { name, value } = event.target;
    const nextFilters = { ...filters, [name]: value };
    setFilters(nextFilters);
    loadCampaigns(nextFilters);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Review Queue</h1>
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Niche</span>
          <select
            name="nicheId"
            value={filters.nicheId}
            onChange={onFilterChange}
            className="rounded border border-slate-300 px-3 py-2"
          >
            <option value="">All niches</option>
            {niches.map((niche) => (
              <option key={niche.id} value={niche.id}>
                {niche.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Status</span>
          <select
            name="status"
            value={filters.status}
            onChange={onFilterChange}
            className="rounded border border-slate-300 px-3 py-2"
          >
            <option value="">All statuses</option>
            {Object.keys(statusBadge).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-700">Loading campaigns...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Product</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Niche ID</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={4}>
                    No campaigns found.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.product_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.niche_id}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadge[item.status]}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{new Date(item.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

