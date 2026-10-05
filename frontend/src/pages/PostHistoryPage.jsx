import React, { useEffect, useState } from "react";
import { fetchPostHistory } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import { IconInstagram, IconYouTube } from "../components/SocialIcons";
import {
  History,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Share2,
  Film,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

export function PostHistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ platform: "", status: "", search: "" });
  const [copiedId, setCopiedId] = useState(null);

  const loadPosts = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchPostHistory({
        platform: filters.platform || undefined,
        status: filters.status || undefined,
      });
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [filters.platform, filters.status]);

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case "instagram":
        return <IconInstagram className="w-3.5 h-3.5 text-pink-400" />;
      case "youtube":
        return <IconYouTube className="w-3.5 h-3.5 text-red-400" />;
      default:
        return <Share2 className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  const getExternalLink = (platform, externalId) => {
    if (!externalId) return null;
    if (platform === "instagram") {
      return `https://www.instagram.com/reel/${externalId}/`;
    }
    if (platform === "youtube") {
      return `https://www.youtube.com/shorts/${externalId}`;
    }
    return null;
  };

  const filteredItems = items.filter((p) => {
    if (!filters.search) return true;
    const term = filters.search.toLowerCase();
    return (
      p.product_name?.toLowerCase().includes(term) ||
      p.campaign_id?.toLowerCase().includes(term) ||
      p.external_post_id?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e6e0d4]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#1c1917] flex items-center gap-2">
            <span>Publishing Timeline & Post History</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] tabular-nums">
              {filteredItems.length} records
            </span>
          </h1>
          <p className="text-xs text-[#57534e] mt-1">
            Complete audit trail of autonomous video dispatches to Instagram Reels and YouTube Shorts.
          </p>
        </div>

        <button
          onClick={loadPosts}
          className="btn btn-secondary flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#c2410c]" : ""}`} />
          <span>Refresh History</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] text-[#991b1b] text-xs">
          {error}
        </div>
      )}

      {/* Filter toolbar */}
      <div className="surface-panel p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-[#78716c] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search campaign or post ID..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input-base !pl-8 !py-1.5 !text-xs"
            />
          </div>

          {/* Platform selector */}
          <div className="w-44">
            <select
              value={filters.platform}
              onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
              className="select-base !py-1.5 !text-xs"
            >
              <option value="">All Platforms</option>
              <option value="instagram">Instagram Reels</option>
              <option value="youtube">YouTube Shorts</option>
              <option value="facebook">Facebook Video</option>
            </select>
          </div>

          {/* Status selector */}
          <div className="w-40">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="select-base !py-1.5 !text-xs"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* High-Density Data Table */}
      <div className="surface-panel overflow-hidden border border-[#e6e0d4]">
        {loading && items.length === 0 ? (
          <div className="p-12 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 skeleton-shimmer" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center">
            <History className="w-8 h-8 text-[#a8a29e] mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-[#1c1917]">
              No publishing records found
            </h3>
            <p className="text-xs text-[#78716c] mt-1">
              Once campaigns are approved and published, direct links and telemetry will log here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product / Campaign</th>
                  <th>Platform</th>
                  <th>Status</th>
                  <th>External Post ID</th>
                  <th>Published Timestamp</th>
                  <th className="text-right">Deep Link</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((post) => {
                  const extLink = getExternalLink(post.platform, post.external_post_id);
                  return (
                    <tr key={post.id} className="group">
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-[#fff7ed] border border-[#fed7aa] flex items-center justify-center text-[#c2410c] flex-shrink-0">
                            <Film className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-[#1c1917] text-xs">
                              {post.product_name}
                            </div>
                            <div className="text-[10px] font-mono text-[#78716c] mt-0.5">
                              Campaign: {post.campaign_id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#f5f2eb] border border-[#e6e0d4] text-xs text-[#1c1917]">
                          {getPlatformIcon(post.platform)}
                          <span className="capitalize">{post.platform}</span>
                        </div>
                      </td>

                      <td>
                        <StatusBadge status={post.status} />
                        {post.error_message && (
                          <div className="text-[10px] text-[#b91c1c] mt-1 max-w-xs truncate" title={post.error_message}>
                            Err: {post.error_message}
                          </div>
                        )}
                      </td>

                      <td>
                        {post.external_post_id ? (
                          <div className="flex items-center gap-1.5 font-mono text-xs text-[#1c1917]">
                            <span>{post.external_post_id}</span>
                            <button
                              onClick={() => handleCopyId(post.external_post_id)}
                              className="text-[#78716c] hover:text-[#1c1917]"
                              title="Copy external ID"
                            >
                              {copiedId === post.external_post_id ? (
                                <Check className="w-3 h-3 text-[#15803d]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[#a8a29e] font-mono text-xs">—</span>
                        )}
                      </td>

                      <td className="font-mono text-[11px] text-[#57534e] tabular-nums">
                        {post.published_at
                          ? new Date(post.published_at).toLocaleString()
                          : new Date(post.created_at).toLocaleString()}
                      </td>

                      <td className="text-right">
                        {extLink ? (
                          <a
                            href={extLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary !py-1 !px-2.5 !text-[11px] inline-flex items-center gap-1.5 hover:text-[#c2410c]"
                          >
                            <span>View Post</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[#a8a29e] text-xs font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
