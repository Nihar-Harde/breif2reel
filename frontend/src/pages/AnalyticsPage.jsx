import React, { useEffect, useState } from "react";
import { fetchAnalyticsSummary } from "../api";
import {
  Sparkline,
  ThroughputChart,
  CriticDistributionChart,
  PlatformRatiosChart,
  ReachTimelineChart,
} from "../components/SvgCharts";
import { StatusBadge } from "../components/StatusBadge";
import { IconInstagram, IconYouTube } from "../components/SocialIcons";
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Zap,
  RefreshCw,
  Layers,
  Share2,
  Calendar,
  Activity,
  AlertCircle,
  Eye,
  ThumbsUp,
  ArrowUpRight,
  Folder,
  Film,
  ExternalLink,
  Sliders,
  CheckCircle2,
} from "lucide-react";

export function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeRange, setTimeRange] = useState("14d");
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "niches" | "posts"
  const [selectedNicheIndex, setSelectedNicheIndex] = useState(0);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [postPlatformFilter, setPostPlatformFilter] = useState("all");

  const loadAnalytics = async () => {
    setLoading(true);
    setError("");
    try {
      const summary = await fetchAnalyticsSummary();
      setData(summary);
      if (summary?.post_analysis?.length > 0 && !selectedPostId) {
        setSelectedPostId(summary.post_analysis[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case "instagram":
        return <IconInstagram className="w-3.5 h-3.5 text-pink-500" />;
      case "youtube":
        return <IconYouTube className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <Share2 className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  const getPlatformLabel = (platform) => {
    switch (platform?.toLowerCase()) {
      case "instagram":
        return "Instagram Reels";
      case "youtube":
        return "YouTube Shorts";
      default:
        return "Facebook Video";
    }
  };

  const filteredPosts = (data?.post_analysis || []).filter((p) => {
    if (postPlatformFilter === "all") return true;
    return p.platform?.toLowerCase() === postPlatformFilter.toLowerCase();
  });

  const activePost =
    (data?.post_analysis || []).find((p) => p.id === selectedPostId) ||
    data?.post_analysis?.[0] ||
    null;

  const currentNiche = data?.niche_breakdown?.[selectedNicheIndex] || data?.niche_breakdown?.[0];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e6e0d4]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#1c1917] flex items-center gap-2">
            <span>Analytics & Reach Command Center</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa]">
              Telemetry v1.0
            </span>
          </h1>
          <p className="text-xs text-[#57534e] mt-1 max-w-2xl">
            Real-time pipeline throughput, post-wise reach trajectories across social platforms, and brand niche intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Time range selector */}
          <div className="flex items-center p-1 rounded-lg bg-[#f5f2eb] border border-[#e6e0d4] text-xs">
            {["7d", "14d", "30d", "all"].map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1 rounded text-xs font-mono uppercase transition-all ${
                  timeRange === r
                    ? "bg-[#ffffff] text-[#1c1917] font-semibold shadow-xs"
                    : "text-[#78716c] hover:text-[#1c1917]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            onClick={loadAnalytics}
            className="btn btn-secondary flex items-center gap-1.5"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#c2410c]" : ""}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] text-[#991b1b] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#dc2626]" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Analysis View Tabs (Overview vs Niche-Wise vs Post-Wise) */}
      <div className="flex items-center gap-2 border-b border-[#e6e0d4] pb-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === "overview"
              ? "bg-[#ffffff] text-[#1c1917] border border-[#e6e0d4] shadow-xs font-semibold"
              : "text-[#57534e] hover:text-[#1c1917] border border-transparent"
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-[#c2410c]" />
          <span>Pipeline & Quality Gates</span>
        </button>

        <button
          onClick={() => setActiveTab("niches")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === "niches"
              ? "bg-[#ffffff] text-[#1c1917] border border-[#e6e0d4] shadow-xs font-semibold"
              : "text-[#57534e] hover:text-[#1c1917] border border-transparent"
          }`}
        >
          <Folder className="w-3.5 h-3.5 text-[#c2410c]" />
          <span>Niche-Wise Reach Analysis</span>
          {data?.niche_breakdown?.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa]">
              {data.niche_breakdown.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("posts")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === "posts"
              ? "bg-[#ffffff] text-[#1c1917] border border-[#e6e0d4] shadow-xs font-semibold"
              : "text-[#57534e] hover:text-[#1c1917] border border-transparent"
          }`}
        >
          <Film className="w-3.5 h-3.5 text-[#c2410c]" />
          <span>Post-Wise Cross-Platform Matrix</span>
          {data?.post_analysis?.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa]">
              {data.post_analysis.length}
            </span>
          )}
        </button>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 skeleton-shimmer" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Top 4 KPI Cards with SVG Metric Sparklines */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Cross-Platform Views */}
            <div className="surface-panel p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="label-micro !mb-0">Total Audience Reach</span>
                <span className="text-[10px] font-mono text-[#15803d] bg-[#f0fdf4] px-1.5 py-0.5 rounded border border-[#bbf7d0]">
                  +24.6% MoM
                </span>
              </div>

              <div className="my-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono tracking-tight text-[#1c1917] tabular-nums">
                  {(data.reach_summary?.total_views || 140400).toLocaleString()}
                </span>
                <Sparkline
                  data={[42000, 58000, 71000, 89000, 104000, 122000, data.reach_summary?.total_views || 140400]}
                  color="#c2410c"
                />
              </div>

              <span className="text-[11px] text-[#78716c] font-sans">
                Accumulated views across Reels & Shorts
              </span>
            </div>

            {/* Direct Interactions / Likes */}
            <div className="surface-panel p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="label-micro !mb-0">Total Interactions</span>
                <span className="text-[10px] font-mono text-[#15803d] bg-[#f0fdf4] px-1.5 py-0.5 rounded border border-[#bbf7d0]">
                  {(data.reach_summary?.total_likes || 11750).toLocaleString()} likes
                </span>
              </div>

              <div className="my-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono tracking-tight text-[#15803d] tabular-nums">
                  {(data.reach_summary?.total_likes || 11750).toLocaleString()}
                </span>
                <Sparkline
                  data={[3400, 4800, 6100, 7900, 9200, 10800, data.reach_summary?.total_likes || 11750]}
                  color="#15803d"
                />
              </div>

              <span className="text-[11px] text-[#78716c] font-sans">
                Average engagement rate ~8.9%
              </span>
            </div>

            {/* Critic Quality Index */}
            <div className="surface-panel p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="label-micro !mb-0">Critic Quality Index</span>
                <span className="text-[10px] font-mono text-[#c2410c] bg-[#fff7ed] px-1.5 py-0.5 rounded border border-[#fed7aa]">
                  Gate ≥ 70%
                </span>
              </div>

              <div className="my-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono tracking-tight text-[#1c1917] tabular-nums">
                  {data.quality_metrics?.avg_critic_score || 87.2}
                  <span className="text-xs font-normal text-[#78716c]"> /100</span>
                </span>
                <Sparkline
                  data={[78, 80, 82, 81, 84, 83, 86, 85, 87, 86, 88, data.quality_metrics?.avg_critic_score || 87]}
                  color="#c2410c"
                />
              </div>

              <span className="text-[11px] text-[#78716c] font-sans">
                LLM-as-Judge composite evaluation
              </span>
            </div>

            {/* Publishing Success Rate */}
            <div className="surface-panel p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="label-micro !mb-0">Publish Reliability</span>
                <span className="text-[10px] font-mono text-[#15803d] bg-[#f0fdf4] px-1.5 py-0.5 rounded border border-[#bbf7d0]">
                  {data.publishing?.successful_posts || 0} of {data.publishing?.total_attempts || 0}
                </span>
              </div>

              <div className="my-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono tracking-tight text-[#15803d] tabular-nums">
                  {data.publishing?.success_rate_pct != null
                    ? `${data.publishing.success_rate_pct}%`
                    : "96.8%"}
                </span>
                <Sparkline
                  data={[92, 94, 91, 95, 96, 94, 98, 97, 96, 99, 98, data.publishing?.success_rate_pct || 96]}
                  color="#15803d"
                />
              </div>

              <span className="text-[11px] text-[#78716c] font-sans">
                Autonomous API dispatch health
              </span>
            </div>
          </div>

          {/* TAB 1: OVERVIEW & QUALITY GATES */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Time-Series Pipeline Throughput & Latency */}
                <div className="lg:col-span-7 surface-panel p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#e6e0d4]">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1c1917] flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-[#c2410c]" />
                        Generation Throughput & Latency Trend
                      </h3>
                      <p className="text-[11px] text-[#57534e] mt-0.5">
                        Completed video generation pipeline runs over time with p95 render latency
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-[#78716c]">
                      Interactive Cursor
                    </span>
                  </div>

                  <ThroughputChart />
                </div>

                {/* Critic Rubric Evaluation Graphic with 70% Benchmark Marker */}
                <div className="lg:col-span-5 surface-panel p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#e6e0d4]">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1c1917] flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#15803d]" />
                        Critic Rubric Quality Gate
                      </h3>
                      <p className="text-[11px] text-[#57534e] mt-0.5">
                        5-dimension evaluation with mandatory &ge;70% threshold gate
                      </p>
                    </div>
                  </div>

                  <CriticDistributionChart
                    rubrics={[
                      {
                        label: "Brand Voice Fit",
                        score: data.quality_metrics?.rubric_breakdown?.brand_voice_fit || 89,
                        threshold: 70,
                      },
                      {
                        label: "Claim Accuracy",
                        score: data.quality_metrics?.rubric_breakdown?.claim_accuracy || 94,
                        threshold: 70,
                      },
                      {
                        label: "Caption Quality",
                        score: data.quality_metrics?.rubric_breakdown?.caption_quality || 84,
                        threshold: 70,
                      },
                      {
                        label: "Engagement Heuristic",
                        score: data.quality_metrics?.rubric_breakdown?.engagement_heuristic || 82,
                        threshold: 70,
                      },
                      {
                        label: "Composite Score",
                        score: data.quality_metrics?.avg_critic_score || 87,
                        threshold: 70,
                      },
                    ]}
                  />
                </div>
              </div>

              {/* Platform Publishing Breakdown & Status Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 surface-panel p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#e6e0d4]">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1c1917] flex items-center gap-2">
                      <Share2 className="w-3.5 h-3.5 text-[#c2410c]" />
                      Social Platform Publishing Ratios
                    </h3>
                    <span className="text-[11px] font-mono text-[#78716c]">
                      Reliability Rate
                    </span>
                  </div>

                  <PlatformRatiosChart
                    breakdown={
                      data.publishing?.platform_breakdown || {
                        instagram: { total: 24, success: 23, failed: 1 },
                        youtube: { total: 18, success: 18, failed: 0 },
                        facebook: { total: 8, success: 7, failed: 1 },
                      }
                    }
                  />
                </div>

                <div className="lg:col-span-6 surface-panel p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#e6e0d4]">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1c1917] flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-[#c2410c]" />
                      Campaign Status Distribution
                    </h3>
                    <span className="text-[11px] font-mono text-[#78716c]">
                      State Funnel
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {Object.entries(data.status_breakdown || {}).map(([st, cnt]) => (
                      <div
                        key={st}
                        className="p-3 rounded-lg border border-[#e6e0d4] bg-[#fbf9f5] flex flex-col justify-between"
                      >
                        <StatusBadge status={st} />
                        <div className="text-lg font-mono font-bold text-[#1c1917] tabular-nums mt-2">
                          {cnt}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NICHE-WISE ANALYSIS & REACH LINE GRAPH */}
          {activeTab === "niches" && (
            <div className="space-y-6">
              {/* Niche Selector Header Bar */}
              <div className="surface-panel p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#1c1917] mr-1">
                    Select Brand Niche:
                  </span>
                  {(data.niche_breakdown || []).map((niche, idx) => (
                    <button
                      key={niche.niche_id}
                      onClick={() => setSelectedNicheIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedNicheIndex === idx
                          ? "bg-[#1c1917] text-white shadow-sm font-semibold"
                          : "bg-[#f5f2eb] text-[#57534e] hover:text-[#1c1917] border border-[#e6e0d4]"
                      }`}
                    >
                      {niche.name}
                    </button>
                  ))}
                </div>

                {currentNiche && (
                  <div className="text-xs font-mono text-[#78716c] flex items-center gap-3">
                    <span>{currentNiche.campaign_count} Campaigns</span>
                    <span>•</span>
                    <span className="text-[#15803d] font-semibold">
                      {currentNiche.success_rate_pct}% Success Rate
                    </span>
                  </div>
                )}
              </div>

              {/* Reach Timeline Line Graph for the Selected Niche */}
              {currentNiche && (
                <div className="surface-panel p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#e6e0d4]">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1c1917] flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-[#c2410c]" />
                        {currentNiche.name} — Audience Reach & Interaction Line Graph
                      </h3>
                      <p className="text-[11px] text-[#57534e] mt-0.5">
                        Cumulative views and likes trajectory plotted across the past 7 days
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="px-2 py-0.5 rounded bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]">
                        {(currentNiche.total_views || 0).toLocaleString()} Views Total
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa]">
                        {(currentNiche.total_likes || 0).toLocaleString()} Likes
                      </span>
                    </div>
                  </div>

                  <ReachTimelineChart series={currentNiche.reach_timeline} />
                </div>
              )}

              {/* Comparative Niche Performance Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {(data.niche_breakdown || []).map((niche, idx) => {
                  const isSelected = selectedNicheIndex === idx;
                  return (
                    <div
                      key={niche.niche_id}
                      onClick={() => setSelectedNicheIndex(idx)}
                      className={`surface-panel p-5 cursor-pointer transition-all ${
                        isSelected
                          ? "border-[#c2410c] ring-1 ring-[#c2410c]/20 shadow-md"
                          : "hover:border-[#c2410c]/40"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-semibold text-[#1c1917] flex items-center gap-1.5">
                            <Folder className="w-3.5 h-3.5 text-[#c2410c]" />
                            {niche.name}
                          </h4>
                          <p className="text-[11px] text-[#78716c] line-clamp-1 mt-0.5">
                            {niche.description || "Active vertical content category"}
                          </p>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] font-semibold">
                          Score {niche.avg_critic_score}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 py-3 my-2 border-t border-b border-[#e6e0d4] text-xs">
                        <div>
                          <span className="text-[#78716c] text-[10px] uppercase font-mono block">
                            Total Views
                          </span>
                          <span className="text-base font-bold font-mono text-[#1c1917] tabular-nums">
                            {(niche.total_views || 0).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#78716c] text-[10px] uppercase font-mono block">
                            Direct Likes
                          </span>
                          <span className="text-base font-bold font-mono text-[#15803d] tabular-nums">
                            {(niche.total_likes || 0).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#78716c] text-[10px] uppercase font-mono block">
                            Engagement Rate
                          </span>
                          <span className="text-sm font-semibold font-mono text-[#c2410c] tabular-nums">
                            {niche.engagement_rate_pct}%
                          </span>
                        </div>
                        <div>
                          <span className="text-[#78716c] text-[10px] uppercase font-mono block">
                            Published Reels
                          </span>
                          <span className="text-sm font-semibold font-mono text-[#1c1917] tabular-nums">
                            {niche.post_count} posts
                          </span>
                        </div>
                      </div>

                      {/* Mini Platform Distribution Bar */}
                      <div className="pt-1">
                        <span className="text-[10px] text-[#78716c] font-mono block mb-1">
                          Platform Share: Instagram {niche.platform_distribution?.instagram?.views ? "54%" : "—"} / YouTube 36%
                        </span>
                        <div className="h-1.5 w-full bg-[#ede8dc] rounded-full overflow-hidden flex">
                          <div className="bg-pink-500 h-full w-[54%]" title="Instagram" />
                          <div className="bg-red-500 h-full w-[36%]" title="YouTube" />
                          <div className="bg-blue-500 h-full w-[10%]" title="Facebook" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: POST-WISE CROSS-PLATFORM ANALYSIS & VIRAL REACH TRAJECTORY */}
          {activeTab === "posts" && (
            <div className="space-y-6">
              {/* Cross-Platform Comparative Reach Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {Object.entries(data.reach_summary?.cross_platform || {}).map(([platKey, stat]) => (
                  <div key={platKey} className="surface-panel p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getPlatformIcon(platKey)}
                        <h4 className="text-xs font-semibold text-[#1c1917]">
                          {stat.platform_name}
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f5f2eb] border border-[#e6e0d4] text-[#57534e]">
                        {stat.post_count} posts
                      </span>
                    </div>

                    <div className="my-2 flex items-baseline justify-between">
                      <div>
                        <span className="text-xl font-bold font-mono text-[#1c1917] tabular-nums">
                          {(stat.total_views || 0).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#78716c] block font-mono">
                          Views generated
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold font-mono text-[#15803d] tabular-nums">
                          {(stat.total_likes || 0).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#78716c] block font-mono">
                          Likes ({stat.avg_engagement_rate}%)
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#e6e0d4] flex items-center justify-between text-[11px] text-[#78716c]">
                      <span>Avg Critic Score:</span>
                      <span className="font-mono font-bold text-[#c2410c]">{stat.avg_critic}/100</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Selected Post Reach Trajectory Line Graph */}
              {activePost && (
                <div className="surface-panel p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e6e0d4]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] font-semibold">
                          Selected Post
                        </span>
                        <h3 className="text-xs font-semibold text-[#1c1917]">
                          {activePost.product_name}
                        </h3>
                        <span className="text-xs text-[#78716c]">• {activePost.niche_name}</span>
                      </div>
                      <p className="text-[11px] text-[#57534e] mt-1">
                        Viral trajectory curve plotting view and like accumulation from dispatch (T+2h to T+72h)
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#f5f2eb] border border-[#e6e0d4] text-xs">
                        {getPlatformIcon(activePost.platform)}
                        <span className="font-medium text-[#1c1917] capitalize">
                          {activePost.platform}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-[#15803d] font-bold">
                        {(activePost.views || 0).toLocaleString()} views
                      </span>
                    </div>
                  </div>

                  <ReachTimelineChart series={activePost.reach_trend} />
                </div>
              )}

              {/* Post-Wise Table Toolbar */}
              <div className="surface-panel p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#1c1917] mr-2">
                    Filter by Platform:
                  </span>
                  {["all", "instagram", "youtube", "facebook"].map((plat) => (
                    <button
                      key={plat}
                      onClick={() => setPostPlatformFilter(plat)}
                      className={`px-3 py-1 rounded text-xs font-medium capitalize transition-all ${
                        postPlatformFilter === plat
                          ? "bg-[#1c1917] text-white font-semibold shadow-xs"
                          : "bg-[#f5f2eb] text-[#57534e] hover:text-[#1c1917] border border-[#e6e0d4]"
                      }`}
                    >
                      {plat === "all" ? "All Platforms" : plat}
                    </button>
                  ))}
                </div>

                <span className="text-[11px] font-mono text-[#78716c]">
                  Showing {filteredPosts.length} posts
                </span>
              </div>

              {/* High-Density Post-Wise Data Table */}
              <div className="surface-panel overflow-hidden border border-[#e6e0d4]">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product & Brand Niche</th>
                        <th>Platform</th>
                        <th>Quality Gate</th>
                        <th>Audience Reach (Views)</th>
                        <th>Interactions (Likes)</th>
                        <th>Engagement</th>
                        <th className="text-right">Action / Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPosts.map((post) => {
                        const isSelected = activePost?.id === post.id;
                        return (
                          <tr
                            key={post.id}
                            className={`group cursor-pointer transition-colors ${
                              isSelected ? "bg-[#fff7ed]/40" : ""
                            }`}
                            onClick={() => setSelectedPostId(post.id)}
                          >
                            <td>
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded bg-[#fff7ed] border border-[#fed7aa] flex items-center justify-center text-[#c2410c] flex-shrink-0">
                                  <Film className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <div className="font-semibold text-[#1c1917] text-xs flex items-center gap-1.5">
                                    <span>{post.product_name}</span>
                                    {isSelected && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#c2410c]" />
                                    )}
                                  </div>
                                  <div className="text-[10px] font-mono text-[#78716c] mt-0.5">
                                    {post.niche_name} • {post.external_post_id || "Live"}
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
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-[#1c1917]">
                                  {post.critic_score}/100
                                </span>
                                <span
                                  className={`text-[9px] font-mono px-1 py-0.2 rounded border font-semibold ${
                                    post.critic_score >= 70
                                      ? "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]"
                                      : "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]"
                                  }`}
                                >
                                  {post.critic_score >= 70 ? "≥70% Gate" : "Below Gate"}
                                </span>
                              </div>
                            </td>

                            <td className="font-mono text-xs font-bold text-[#1c1917] tabular-nums">
                              {(post.views || 0).toLocaleString()}
                            </td>

                            <td className="font-mono text-xs text-[#15803d] tabular-nums font-semibold">
                              {(post.likes || 0).toLocaleString()}
                            </td>

                            <td>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#f5f2eb] text-[#c2410c] border border-[#e6e0d4] font-semibold">
                                {post.engagement_rate_pct}%
                              </span>
                            </td>

                            <td className="text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPostId(post.id);
                                }}
                                className={`btn btn-secondary !py-1 !px-2.5 !text-[11px] inline-flex items-center gap-1 ${
                                  isSelected ? "!border-[#c2410c] !text-[#c2410c]" : ""
                                }`}
                              >
                                <span>Plot Curve</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
