import React, { useEffect, useState } from "react";
import { fetchAccounts, fetchNiches } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import { IconInstagram, IconYouTube } from "../components/SocialIcons";
import {
  Users2,
  Share2,
  RefreshCw,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Folder,
  Sliders,
  ExternalLink,
} from "lucide-react";

export function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [niches, setNiches] = useState([]);
  const [selectedNiche, setSelectedNiche] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [nichesData, accountsData] = await Promise.all([
        fetchNiches(),
        fetchAccounts(selectedNiche || undefined),
      ]);
      setNiches(nichesData.items || []);
      setAccounts(accountsData.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedNiche]);

  const getNicheName = (nicheId) => {
    const n = niches.find((x) => x.id === nicheId);
    return n ? n.name : "Default Workspace";
  };

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case "instagram":
        return <IconInstagram className="w-4 h-4 text-pink-400" />;
      case "youtube":
        return <IconYouTube className="w-4 h-4 text-red-400" />;
      default:
        return <Share2 className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e6e0d4]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#1c1917] flex items-center gap-2">
            <span>Connected Channels & Publishing Accounts</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] tabular-nums">
              {accounts.length} active
            </span>
          </h1>
          <p className="text-xs text-[#57534e] mt-1">
            Authenticated social destinations configured for automated reel dispatch (B7 / FR-ACCOUNT-03).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadData}
            className="btn btn-secondary flex items-center gap-1.5"
            title="Refresh accounts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#c2410c]" : ""}`} />
            <span>Sync Status</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] text-[#991b1b] text-xs">
          {error}
        </div>
      )}

      {/* Filter toolbar */}
      <div className="surface-panel p-3.5 flex items-center justify-between gap-4">
        <div className="w-64">
          <label className="label-micro">Filter by Brand Niche</label>
          <select
            value={selectedNiche}
            onChange={(e) => setSelectedNiche(e.target.value)}
            className="select-base !py-1.5 !text-xs"
          >
            <option value="">All Registered Niches</option>
            {niches.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-[#78716c] font-mono">
          OAuth 2.0 Token Vault Active
        </div>
      </div>

      {/* Account Cards Grid */}
      {loading && accounts.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 skeleton-shimmer" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="surface-panel p-16 text-center border border-[#e6e0d4]">
          <Users2 className="w-8 h-8 text-[#a8a29e] mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-[#1c1917]">
            No accounts connected for this filter
          </h3>
          <p className="text-xs text-[#78716c] mt-1 max-w-sm mx-auto">
            Configure platform OAuth credentials in your backend configuration to dispatch vertical reels.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="surface-panel p-5 flex flex-col justify-between hover:border-[#c2410c]/40 transition-all"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded bg-[#f5f2eb] border border-[#e6e0d4] flex items-center justify-center flex-shrink-0">
                      {getPlatformIcon(acc.platform)}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#1c1917] flex items-center gap-1.5">
                        <span>@{acc.username || "connected_channel"}</span>
                      </h4>
                      <span className="text-[10px] font-mono text-[#78716c] capitalize">
                        {acc.platform} Creator Channel
                      </span>
                    </div>
                  </div>

                  <StatusBadge status={acc.status || "active"} />
                </div>

                <div className="space-y-2 py-3 border-t border-b border-[#e6e0d4] text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#78716c]">Brand Niche:</span>
                    <span className="text-[#1c1917] font-medium flex items-center gap-1">
                      <Folder className="w-3 h-3 text-[#78716c]" />
                      {getNicheName(acc.niche_id)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-[#78716c]">Channel ID:</span>
                    <span className="text-[#57534e] truncate max-w-[160px]">
                      {acc.platform_account_id}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between text-[11px] text-[#78716c]">
                <span className="font-mono">
                  Synced: {new Date(acc.created_at).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-1.5 text-[#15803d] font-medium font-mono text-[10px]">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Verified</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
