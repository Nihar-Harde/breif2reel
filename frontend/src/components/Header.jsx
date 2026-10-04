import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { checkHealth } from "../api";
import { Plus, RefreshCw, Activity, ShieldCheck, Sparkles, Terminal } from "lucide-react";

const ROUTE_LABELS = {
  "/": "Campaign Studio",
  "/review-queue": "Review Queue & Traceability",
  "/brand-assets": "Brand Guidelines & RAG Knowledge",
  "/post-history": "Publishing Timeline & History",
  "/accounts": "Connected Channels & Accounts",
  "/analytics": "Quality & Throughput Analytics",
};

export function Header({ onRefresh }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [health, setHealth] = useState({ status: "checking", latency: null });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHealth = async () => {
    try {
      const res = await checkHealth();
      setHealth(res);
    } catch {
      setHealth({ status: "offline", latency: null });
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchHealth();
    if (onRefresh) await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const currentLabel = ROUTE_LABELS[location.pathname] || "Dashboard";

  return (
    <header className="h-14 border-b border-[#e6e0d4] bg-[#ffffff]/90 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between select-none shadow-[0_1px_2px_rgba(60,50,40,0.03)]">
      {/* Breadcrumb Section */}
      <div className="flex items-center gap-2.5 text-xs text-[#78716c]">
        <span className="flex items-center gap-1.5 font-semibold text-[#1c1917]">
          <Terminal className="w-3.5 h-3.5 text-[#c2410c]" />
          <span>brief2reel</span>
        </span>
        <span className="text-[#d6d0c4]">/</span>
        <span className="text-[#78716c]">engine</span>
        <span className="text-[#d6d0c4]">/</span>
        <span className="text-[#1c1917] font-semibold tracking-tight">
          {currentLabel}
        </span>
      </div>

      {/* Right Toolbar */}
      <div className="flex items-center gap-3">
        {/* Real-time Backend API Status Badge */}
        <div
          title={
            health.status === "operational"
              ? `Backend API operational (${health.latency}ms)`
              : health.status === "degraded"
              ? "Backend API responding with errors"
              : "Cannot reach backend API"
          }
          className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#fbf9f5] border border-[#e6e0d4] text-[11px] font-mono shadow-sm"
        >
          <span className="relative flex h-2 w-2">
            {health.status === "operational" && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                health.status === "operational"
                  ? "bg-emerald-600"
                  : health.status === "degraded"
                  ? "bg-amber-600"
                  : health.status === "checking"
                  ? "bg-stone-400 animate-pulse"
                  : "bg-rose-600"
              }`}
            />
          </span>
          <span className="text-[#1c1917] font-semibold">
            {health.status === "operational"
              ? "API 200 OK"
              : health.status === "degraded"
              ? "API Degraded"
              : health.status === "checking"
              ? "Checking..."
              : "API Offline"}
          </span>
          {health.latency !== null && (
            <span className="text-[#78716c] border-l border-[#e6e0d4] pl-2 tabular-nums">
              {health.latency}ms
            </span>
          )}
        </div>

        {/* Team Auth Key Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#fbf9f5] border border-[#e6e0d4] text-[11px] font-mono text-[#78716c] shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-[#c2410c]" />
          <span>TEAM-v1</span>
        </div>

        {/* Global Refresh Button */}
        <button
          onClick={handleManualRefresh}
          className="btn btn-secondary !p-1.5 !rounded-md text-[#78716c] hover:text-[#1c1917]"
          title="Refresh view and telemetry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#c2410c]" : ""}`} />
        </button>

        {/* New Campaign Action Button (if not on new campaign page) */}
        {location.pathname !== "/" && (
          <button
            onClick={() => navigate("/")}
            className="btn btn-primary !py-1.5 !px-3 !text-xs !font-medium flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Brief</span>
          </button>
        )}
      </div>
    </header>
  );
}
