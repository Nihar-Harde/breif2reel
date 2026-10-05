import React, { useEffect, useState } from "react";
import { getCampaign, updateCampaignStatus } from "../api";
import { VideoPlayer916 } from "./VideoPlayer916";
import { TraceabilityPanel } from "./TraceabilityPanel";
import { StatusBadge } from "./StatusBadge";
import {
  X,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Film,
  FileSearch,
  Code2,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";

export function InspectionSheet({ campaignId, onClose, onAction }) {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  useEffect(() => {
    if (!campaignId) return;
    setLoading(true);
    getCampaign(campaignId)
      .then((data) => setCampaign(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaignId]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!campaignId) return null;

  const handleCopyCaption = () => {
    if (!campaign?.generated_caption) return;
    navigator.clipboard.writeText(campaign.generated_caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStatusAction = async (status) => {
    setActionInProgress(true);
    try {
      if (onAction) {
        await onAction(campaignId, status);
      } else {
        await updateCampaignStatus(campaignId, status);
        const updated = await getCampaign(campaignId);
        setCampaign(updated);
      }
    } catch {
      // Fallback
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="sheet-backdrop" onClick={onClose} />

      {/* Slide-over Drawer */}
      <div className="sheet-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header Bar */}
        <div className="p-4 border-b border-[#e6e0d4] flex items-center justify-between bg-[#fbf9f5]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md bg-[#fff7ed] border border-[#fed7aa] flex items-center justify-center text-[#c2410c] flex-shrink-0">
              <Film className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#1c1917] tracking-tight truncate">
                  {campaign?.product_name || "Campaign Inspection"}
                </h3>
                {campaign && <StatusBadge status={campaign.status} />}
              </div>
              <div className="text-[11px] font-mono text-[#78716c] flex items-center gap-2 mt-0.5">
                <span>ID: {campaignId.slice(0, 8)}...</span>
                <span>•</span>
                <span className="capitalize">{campaign?.tone || "Standard"} tone</span>
                <span>•</span>
                <span className="capitalize">{campaign?.campaign_goal || "Awareness"}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#78716c] hover:text-[#1c1917] hover:bg-[#ede8dc] transition-colors"
            title="Close inspection sheet (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[#e6e0d4] bg-[#f5f2eb]">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "overview"
                ? "bg-[#ffffff] text-[#1c1917] border border-[#e6e0d4] shadow-sm font-semibold"
                : "text-[#57534e] hover:text-[#1c1917] border border-transparent"
            }`}
          >
            <Film className="w-3.5 h-3.5 text-[#c2410c]" />
            <span>Reel Preview & Copy</span>
          </button>

          <button
            onClick={() => setActiveTab("traceability")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "traceability"
                ? "bg-[#ffffff] text-[#1c1917] border border-[#e6e0d4] shadow-sm font-semibold"
                : "text-[#57534e] hover:text-[#1c1917] border border-transparent"
            }`}
          >
            <FileSearch className="w-3.5 h-3.5 text-[#c2410c]" />
            <span>Critic & Provenance</span>
            {campaign?.traceability?.critic_scores?.overall && (
              <span className="text-[10px] font-mono px-1 rounded bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] font-semibold">
                {campaign.traceability.critic_scores.overall}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("raw")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "raw"
                ? "bg-[#ffffff] text-[#1c1917] border border-[#e6e0d4] shadow-sm font-semibold"
                : "text-[#57534e] hover:text-[#1c1917] border border-transparent"
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-[#78716c]" />
            <span>JSON Spec</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fbf9f5]">
          {loading ? (
            <div className="space-y-4">
              <div className="h-64 skeleton-shimmer" />
              <div className="h-32 skeleton-shimmer" />
            </div>
          ) : campaign ? (
            <>
              {activeTab === "overview" && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  {/* Left Column: 9:16 Vertical Reel Player with Audio & Subtitles */}
                  <div className="md:col-span-5 flex justify-center">
                    {(() => {
                      const backendBase = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/api\/v1\/?$/, "");
                      const audioSrc = campaign.audio_url
                        ? (campaign.audio_url.startsWith("http") ? campaign.audio_url : `${backendBase}${campaign.audio_url}`)
                        : (campaign.id ? `${backendBase}/api/v1/campaigns/${campaign.id}/audio` : null);
                      const videoSrc = campaign.video_url
                        ? (campaign.video_url.startsWith("http") ? campaign.video_url : `${backendBase}${campaign.video_url}`)
                        : (campaign.cloudinary_url || null);
                      return (
                        <VideoPlayer916
                          videoUrl={videoSrc}
                          audioUrl={audioSrc}
                          caption={campaign.generated_caption}
                          script={campaign.generated_script}
                          productName={campaign.product_name}
                        />
                      );
                    })()}
                  </div>

                  {/* Right Column: Copy & Voiceover Text */}
                  <div className="md:col-span-7 flex flex-col gap-4">
                    {/* Caption Card */}
                    <div className="surface-panel p-4 bg-[#ffffff]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="label-micro !mb-0 text-[#78716c]">
                          Hook & Social Caption
                        </span>
                        <button
                          onClick={handleCopyCaption}
                          className="flex items-center gap-1 text-[11px] font-mono text-[#78716c] hover:text-[#1c1917] transition-colors"
                        >
                          {copied ? (
                            <>
                              <Check className="w-3 h-3 text-[#15803d]" />
                              <span className="text-[#15803d]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="text-xs text-[#1c1917] leading-relaxed font-sans whitespace-pre-wrap bg-[#fbf9f5] p-3 rounded-md border border-[#e6e0d4]">
                        {campaign.generated_caption || "No caption generated yet."}
                      </div>

                      {campaign.generated_caption && (
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#78716c] mt-2">
                          <span>
                            Length: {campaign.generated_caption.length} characters
                          </span>
                          <span>Auto-optimized for Instagram & Shorts</span>
                        </div>
                      )}
                    </div>

                    {/* Voiceover Script Card */}
                    <div className="surface-panel p-4 bg-[#ffffff]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="label-micro !mb-0 text-[#78716c]">
                          Voiceover Script (Audio Track)
                        </span>
                        <span className="text-[10px] font-mono text-[#78716c]">
                          ~15s duration
                        </span>
                      </div>

                      <div className="text-xs text-[#57534e] italic leading-relaxed bg-[#fbf9f5] p-3 rounded-md border border-[#e6e0d4]">
                        "{campaign.generated_script || "No voiceover script provided."}"
                      </div>
                    </div>

                    {/* Campaign Context Metadata */}
                    <div className="surface-panel p-4 bg-[#ffffff] grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="label-micro text-[#78716c]">Target Audience</span>
                        <p className="text-[#1c1917] font-medium text-xs mt-0.5">
                          {campaign.target_audience || "General Audience"}
                        </p>
                      </div>
                      <div>
                        <span className="label-micro text-[#78716c]">Created Date</span>
                        <p className="text-[#1c1917] font-mono text-xs mt-0.5">
                          {new Date(campaign.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "traceability" && (
                <TraceabilityPanel traceability={campaign.traceability} />
              )}

              {activeTab === "raw" && (
                <div className="surface-panel p-4 bg-[#ffffff]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="label-micro !mb-0 text-[#78716c]">Raw Campaign Spec</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(campaign, null, 2));
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-1 text-[11px] font-mono text-[#78716c] hover:text-[#1c1917]"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copied ? "Copied" : "Copy JSON"}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-md bg-[#1c1917] text-[11px] font-mono text-[#f5f2eb] overflow-x-auto max-h-[500px] border border-[#e6e0d4]">
                    {JSON.stringify(campaign, null, 2)}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-[#78716c]">Campaign not found.</div>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 border-t border-[#e6e0d4] bg-[#f5f2eb] flex items-center justify-between">
          <div className="text-xs text-[#57534e]">
            {campaign?.status === "needs_review" ? (
              <span className="text-[#c2410c] font-semibold">
                Pending human sign-off before dispatching to publisher
              </span>
            ) : (
              <span>Campaign Status: <strong className="capitalize text-[#1c1917]">{campaign?.status}</strong></span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn btn-secondary">
              Close
            </button>

            {campaign?.status === "needs_review" && (
              <>
                <button
                  onClick={() => handleStatusAction("rejected")}
                  disabled={actionInProgress}
                  className="btn btn-destructive flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>

                <button
                  onClick={() => handleStatusAction("approved")}
                  disabled={actionInProgress}
                  className="btn btn-success flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve & Schedule</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
