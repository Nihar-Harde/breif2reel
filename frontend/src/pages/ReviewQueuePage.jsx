import React, { useEffect, useState } from "react";
import { fetchNiches, listCampaigns, updateCampaignStatus } from "../api";
import { InspectionSheet } from "../components/InspectionSheet";
import { StatusBadge } from "../components/StatusBadge";
import {
  Inbox,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  Film,
  Sparkles,
  RefreshCw,
  Folder,
  SlidersHorizontal,
} from "lucide-react";

const STATUS_FILTERS = [
  { value: "", label: "All Statuses" },
  { value: "needs_review", label: "Needs Review" },
  { value: "approved", label: "Approved" },
  { value: "generating", label: "Generating" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
];

export function ReviewQueuePage() {
  const [niches, setNiches] = useState([]);
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ nicheId: "", status: "", search: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  const loadData = async (activeFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const data = await listCampaigns({
        nicheId: activeFilters.nicheId || undefined,
        status: activeFilters.status || undefined,
      });
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNiches()
      .then((data) => setNiches(data.items || []))
      .catch((err) => setError(err.message));
    loadData();
  }, []);

  // Periodic poll every 5s
  useEffect(() => {
    const timer = setInterval(() => {
      loadData(filters);
    }, 5000);
    return () => clearInterval(timer);
  }, [filters]);

  const handleAction = async (campaignId, action) => {
    try {
      await updateCampaignStatus(campaignId, action === "approve" ? "approved" : "rejected");
      setSelectedCampaignId(null);
      loadData(filters);
    } catch {
      setSelectedCampaignId(null);
      loadData(filters);
    }
  };

  const getNicheName = (nicheId) => {
    const n = niches.find((x) => x.id === nicheId);
    return n ? n.name : nicheId ? `${nicheId.slice(0, 8)}...` : "Global";
  };

  const filteredItems = items.filter((item) => {
    if (!filters.search) return true;
    const term = filters.search.toLowerCase();
    return (
      item.product_name?.toLowerCase().includes(term) ||
      item.id?.toLowerCase().includes(term) ||
      item.target_audience?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e6e0d4]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#1c1917] flex items-center gap-2">
            <span>Review Queue & Inspection</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] font-semibold tabular-nums">
              {filteredItems.length} campaigns
            </span>
          </h1>
          <p className="text-xs text-[#57534e] mt-1">
            Audit generated vertical reels, evaluate automated Critic rubrics, and approve for multi-platform distribution.
          </p>
        </div>

        <button
          onClick={() => loadData(filters)}
          className="btn btn-secondary flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#c2410c]" : ""}`} />
          <span>Sync Queue</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] text-xs">
          {error}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="surface-panel p-3.5 flex flex-wrap items-center justify-between gap-3 bg-[#ffffff] border border-[#e6e0d4]">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
          {/* Search box */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-[#78716c] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search product or ID..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input-base !pl-8 !py-1.5 !text-xs"
            />
          </div>

          {/* Niche selector */}
          <div className="w-48">
            <select
              value={filters.nicheId}
              onChange={(e) => {
                const next = { ...filters, nicheId: e.target.value };
                setFilters(next);
                loadData(next);
              }}
              className="select-base !py-1.5 !text-xs"
            >
              <option value="">All Brand Niches</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status selector */}
          <div className="w-44">
            <select
              value={filters.status}
              onChange={(e) => {
                const next = { ...filters, status: e.target.value };
                setFilters(next);
                loadData(next);
              }}
              className="select-base !py-1.5 !text-xs"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Queue Table / High-Density List */}
      <div className="surface-panel overflow-hidden border border-[#e6e0d4] bg-[#ffffff] shadow-sm">
        {loading && items.length === 0 ? (
          <div className="p-12 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 skeleton-shimmer" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center">
            <Inbox className="w-8 h-8 text-[#78716c] mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-[#1c1917]">
              No campaigns found
            </h3>
            <p className="text-xs text-[#78716c] mt-1">
              Adjust your filters or dispatch a new campaign brief.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign & Product</th>
                  <th>Niche</th>
                  <th>Status</th>
                  <th>Critic Quality</th>
                  <th>Tone / Goal</th>
                  <th>Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const criticScore = item.traceability?.critic_scores?.overall;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedCampaignId(item.id)}
                      className="cursor-pointer group"
                    >
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-[#fff7ed] border border-[#fed7aa] flex items-center justify-center text-[#c2410c] flex-shrink-0 group-hover:scale-105 transition-transform">
                            <Film className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-[#1c1917] group-hover:text-[#c2410c] transition-colors text-xs">
                              {item.product_name}
                            </div>
                            <div className="text-[10px] font-mono text-[#78716c] mt-0.5">
                              ID: {item.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="inline-flex items-center gap-1 text-xs text-[#57534e]">
                          <Folder className="w-3 h-3 text-[#78716c]" />
                          {getNicheName(item.niche_id)}
                        </span>
                      </td>

                      <td>
                        <StatusBadge status={item.status} />
                      </td>

                      <td>
                        {criticScore != null ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-mono font-bold tabular-nums ${
                                criticScore >= 80
                                  ? "text-[#15803d]"
                                  : criticScore >= 70
                                  ? "text-[#d97706]"
                                  : "text-[#b91c1c]"
                              }`}
                            >
                              {criticScore}/100
                            </span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                criticScore >= 70 ? "bg-[#15803d]" : "bg-[#b91c1c]"
                              }`}
                              title={
                                criticScore >= 70
                                  ? "Quality Gate Passed"
                                  : "Action Required"
                              }
                            />
                          </div>
                        ) : (
                          <span className="text-[#a8a29e] font-mono text-xs">—</span>
                        )}
                      </td>

                      <td>
                        <div className="text-xs text-[#1c1917] capitalize font-medium">
                          {item.tone}
                        </div>
                        <div className="text-[10px] text-[#78716c] capitalize">
                          {item.campaign_goal}
                        </div>
                      </td>

                      <td className="font-mono text-[11px] text-[#57534e] tabular-nums">
                        {new Date(item.updated_at).toLocaleDateString()}
                      </td>

                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedCampaignId(item.id)}
                            className="btn btn-secondary !py-1 !px-2.5 !text-[11px] flex items-center gap-1"
                            title="Inspect reel & traceability"
                          >
                            <Eye className="w-3 h-3 text-[#78716c]" />
                            <span>Inspect</span>
                          </button>

                          {item.status === "needs_review" && (
                            <>
                              <button
                                onClick={() => handleAction(item.id, "approve")}
                                className="btn btn-success !py-1 !px-2 !text-[11px]"
                                title="One-click approve"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleAction(item.id, "reject")}
                                className="btn btn-destructive !py-1 !px-2 !text-[11px]"
                                title="Reject"
                              >
                                <XCircle className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Inspection Sheet */}
      {selectedCampaignId && (
        <InspectionSheet
          campaignId={selectedCampaignId}
          onClose={() => setSelectedCampaignId(null)}
          onAction={handleAction}
        />
      )}
    </div>
  );
}
