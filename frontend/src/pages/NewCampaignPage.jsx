import React, { useEffect, useRef, useState } from "react";
import {
  createCampaign,
  fetchNiches,
  generateCampaign,
  getCampaign,
  listBrandAssets,
} from "../api";
import { InspectionSheet } from "../components/InspectionSheet";
import { StatusBadge } from "../components/StatusBadge";
import {
  Sparkles,
  PenTool,
  ShieldCheck,
  Music,
  Film,
  CheckCircle2,
  UploadCloud,
  FileText,
  X,
  Play,
  ArrowRight,
  Sliders,
  Layers,
  Clock,
  ExternalLink,
} from "lucide-react";

const INITIAL_FORM = {
  niche_id: "",
  product_name: "",
  target_audience: "",
  campaign_goal: "awareness",
  tone: "playful",
  brand_guideline_text: "",
};

const GOALS = [
  { value: "awareness", label: "Awareness" },
  { value: "launch", label: "Launch" },
  { value: "promotion", label: "Promotion" },
  { value: "engagement", label: "Engagement" },
];

const TONES = [
  { value: "playful", label: "Playful" },
  { value: "formal", label: "Formal" },
  { value: "bold", label: "Bold" },
  { value: "minimal", label: "Minimal" },
];

const PIPELINE_AGENTS = [
  {
    key: "copywriter",
    name: "Copywriter Agent",
    role: "Drafts hook captions & 15s voiceover script grounded in RAG brand voice",
    icon: PenTool,
  },
  {
    key: "critic",
    name: "Critic Agent (LLM-as-Judge)",
    role: "Runs 5-rubric quality checks, verifies claims, checks repetition",
    icon: ShieldCheck,
  },
  {
    key: "audio",
    name: "Audio Agent",
    role: "Synthesizes voiceover cadence & matches audio pacing",
    icon: Music,
  },
  {
    key: "video",
    name: "Video Agent",
    role: "Composes 9:16 vertical motion canvas with kinetic typography",
    icon: Film,
  },
];

export function NewCampaignPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [niches, setNiches] = useState([]);
  const [nicheAssetCount, setNicheAssetCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [guidelineFile, setGuidelineFile] = useState(null);
  const [createdCampaign, setCreatedCampaign] = useState(null);
  const [inspectCampaignId, setInspectCampaignId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchNiches()
      .then((data) => {
        const items = data.items || [];
        setNiches(items);
        if (items.length > 0 && !form.niche_id) {
          setForm((prev) => ({ ...prev, niche_id: items[0].id }));
        }
      })
      .catch((err) => setErrorMsg(err.message));
  }, []);

  // When selected niche changes, check how many brand guideline assets it has
  useEffect(() => {
    if (form.niche_id) {
      listBrandAssets(form.niche_id)
        .then((data) => setNicheAssetCount(data.total_chunks || 0))
        .catch(() => setNicheAssetCount(0));
    }
  }, [form.niche_id]);

  // Elapsed timer during generation
  useEffect(() => {
    if (polling) {
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [polling]);

  const pollCampaignProgress = async (campaignId) => {
    setPolling(true);
    setActiveStep(0);

    try {
      for (let attempt = 0; attempt < 35; attempt++) {
        const details = await getCampaign(campaignId);
        setCreatedCampaign(details);

        // Advance agent step based on elapsed polling attempts
        if (attempt < 4) setActiveStep(0);
        else if (attempt < 9) setActiveStep(1);
        else if (attempt < 14) setActiveStep(2);
        else if (attempt < 20) setActiveStep(3);
        else setActiveStep(4);

        if (details.status !== "generating") {
          setActiveStep(PIPELINE_AGENTS.length);
          return details;
        }
        await new Promise((res) => setTimeout(res, 1500));
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setPolling(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "txt", "md", "doc", "docx"].includes(ext)) {
      setErrorMsg("Supported file formats: .pdf, .txt, .md, .doc");
      return;
    }
    setGuidelineFile(file);

    if (["txt", "md"].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setForm((prev) => ({ ...prev, brand_guideline_text: e.target.result }));
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    setCreatedCampaign(null);
    setActiveStep(-1);

    try {
      const created = await createCampaign({
        ...form,
        brand_guideline_text: form.brand_guideline_text || null,
      });

      const started = await generateCampaign(created.campaign_id);
      setCreatedCampaign({ id: started.campaign_id, status: "generating" });

      await pollCampaignProgress(started.campaign_id);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e6e0d4]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#1c1917] flex items-center gap-2">
            <span>Campaign Creation Studio</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa]">
              Multi-Agent Orchestrator
            </span>
          </h1>
          <p className="text-xs text-[#57534e] mt-1 max-w-2xl leading-relaxed">
            Configure brief parameters to dispatch the autonomous Copywriter, Critic, Audio, and Video agents.
          </p>
        </div>

        {createdCampaign && createdCampaign.status !== "generating" && (
          <button
            onClick={() => setInspectCampaignId(createdCampaign.id)}
            className="btn btn-primary flex items-center gap-2 shadow-md"
          >
            <span>Inspect Generated Reel</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] text-xs flex items-center justify-between shadow-sm">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="hover:text-black">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pro Split-Pane Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane: Configuration Controls (7 Cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-5">
          {/* Card 1: Core Parameters */}
          <div className="surface-panel p-5 space-y-4 bg-[#ffffff]">
            <div className="flex items-center justify-between pb-3 border-b border-[#e6e0d4]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#1c1917] flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-[#c2410c]" />
                Brief Configuration
              </span>
              {nicheAssetCount > 0 && (
                <span className="text-[11px] font-mono text-[#15803d] bg-[#f0fdf4] px-2 py-0.5 rounded border border-[#bbf7d0] flex items-center gap-1.5 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#15803d]" />
                  {nicheAssetCount} RAG chunks active
                </span>
              )}
            </div>

            {/* Niche & Product Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-micro text-[#78716c]">Target Niche</label>
                <select
                  name="niche_id"
                  value={form.niche_id}
                  onChange={handleInputChange}
                  required
                  className="select-base"
                >
                  <option value="">Select a brand niche...</option>
                  {niches.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-micro text-[#78716c]">Product / Campaign Name</label>
                <input
                  name="product_name"
                  value={form.product_name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. AeroFit Pulse Wireless Earbuds"
                  className="input-base font-medium"
                />
              </div>
            </div>

            {/* Target Audience */}
            <div>
              <label className="label-micro text-[#78716c]">Target Audience Demographics</label>
              <input
                name="target_audience"
                value={form.target_audience}
                onChange={handleInputChange}
                required
                placeholder="e.g. Tech-forward fitness enthusiasts, aged 20-35"
                className="input-base"
              />
            </div>

            {/* Segmented Controls: Goal & Tone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Campaign Goal Segmented Control */}
              <div>
                <label className="label-micro text-[#78716c]">Campaign Objective</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-md bg-[#f5f2eb] border border-[#e6e0d4]">
                  {GOALS.map((g) => (
                    <button
                      type="button"
                      key={g.value}
                      onClick={() => setForm((prev) => ({ ...prev, campaign_goal: g.value }))}
                      className={`py-1.5 px-2 rounded text-xs font-medium transition-all ${
                        form.campaign_goal === g.value
                          ? "bg-[#ffffff] text-[#1c1917] shadow-sm font-semibold border border-[#e6e0d4]"
                          : "text-[#57534e] hover:text-[#1c1917]"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone Segmented Control */}
              <div>
                <label className="label-micro text-[#78716c]">Brand Tone</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-md bg-[#f5f2eb] border border-[#e6e0d4]">
                  {TONES.map((t) => (
                    <button
                      type="button"
                      key={t.value}
                      onClick={() => setForm((prev) => ({ ...prev, tone: t.value }))}
                      className={`py-1.5 px-2 rounded text-xs font-medium transition-all ${
                        form.tone === t.value
                          ? "bg-[#ffffff] text-[#1c1917] shadow-sm font-semibold border border-[#e6e0d4]"
                          : "text-[#57534e] hover:text-[#1c1917]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Brand Voice & Guideline Attachments */}
          <div className="surface-panel p-5 space-y-3 bg-[#ffffff]">
            <div className="flex items-center justify-between pb-2 border-b border-[#e6e0d4]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#1c1917] flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[#c2410c]" />
                Brand Voice Guidelines (Optional)
              </span>
              <span className="text-[11px] font-mono text-[#78716c]">
                Grounds Copywriter Agent
              </span>
            </div>

            <textarea
              name="brand_guideline_text"
              value={form.brand_guideline_text}
              onChange={handleInputChange}
              rows={3}
              placeholder="Paste specific dos/don'ts, tonal guardrails, forbidden phrases, or required hashtags..."
              className="textarea-base"
            />

            {/* Document Upload Zone */}
            <div className="pt-1">
              {guidelineFile ? (
                <div className="flex items-center justify-between p-2.5 rounded-md bg-[#f5f2eb] border border-[#e6e0d4]">
                  <div className="flex items-center gap-2 text-xs">
                    <FileText className="w-4 h-4 text-[#c2410c]" />
                    <span className="font-semibold text-[#1c1917]">{guidelineFile.name}</span>
                    <span className="text-[10px] font-mono text-[#78716c]">
                      ({(guidelineFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGuidelineFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="p-1 text-[#78716c] hover:text-[#b91c1c]"
                    title="Remove file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 border border-dashed border-[#d6d0c4] rounded-lg hover:border-[#c2410c] hover:bg-[#fff7ed]/40 cursor-pointer transition-all flex items-center justify-center gap-2 text-xs text-[#57534e] bg-[#fbf9f5]"
                >
                  <UploadCloud className="w-4 h-4 text-[#78716c]" />
                  <span>Attach brand guidelines document (.pdf, .txt, .md)</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.doc,.docx"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || polling || !form.product_name || !form.niche_id}
              className="btn btn-primary !py-2.5 !px-5 !text-xs !font-semibold flex items-center gap-2 shadow-md"
            >
              {loading || polling ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Synthesizing Reel Pipeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#ea580c]" />
                  <span>Dispatch Generation Pipeline</span>
                </>
              )}
            </button>

            {polling && (
              <span className="text-xs font-mono text-[#57534e] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#c2410c]" />
                <span>Elapsed: {elapsedTime}s</span>
              </span>
            )}
          </div>
        </form>

        {/* Right Pane: Live Multi-Agent Execution Stream (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="surface-panel p-5 space-y-4 bg-[#ffffff]">
            <div className="flex items-center justify-between pb-3 border-b border-[#e6e0d4]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#1c1917] flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-[#c2410c]" />
                Autonomous Agent Stream
              </span>
              <span className="text-[11px] font-mono text-[#78716c]">
                {polling ? "Status: Live" : createdCampaign ? "Status: Completed" : "Status: Ready"}
              </span>
            </div>

            {/* Agent Pipeline Steps */}
            <div className="space-y-2.5">
              {PIPELINE_AGENTS.map((agent, i) => {
                const Icon = agent.icon;
                const isCurrent = polling && activeStep === i;
                const isFinished = (polling && activeStep > i) || (createdCampaign && !polling && createdCampaign.status !== "generating");

                return (
                  <div
                    key={agent.key}
                    className={`p-3 rounded-lg border transition-all ${
                      isCurrent
                        ? "bg-[#fff7ed] border-[#fed7aa] text-[#1c1917] shadow-sm"
                        : isFinished
                        ? "bg-[#f5f2eb] border-[#e6e0d4] text-[#1c1917]"
                        : "bg-[#fbf9f5] border-[#e6e0d4] text-[#78716c]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                            isCurrent
                              ? "bg-[#ffedd5] text-[#c2410c]"
                              : isFinished
                              ? "bg-[#f0fdf4] text-[#15803d]"
                              : "bg-[#ede8dc] text-[#78716c]"
                          }`}
                        >
                          {isFinished ? (
                            <CheckCircle2 className="w-4 h-4 text-[#15803d]" />
                          ) : (
                            <Icon className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold tracking-tight">
                              {agent.name}
                            </span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] animate-pulse">
                                Executing...
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#57534e] leading-snug mt-0.5">
                            {agent.role}
                          </p>
                        </div>
                      </div>

                      {isCurrent && (
                        <span className="w-3.5 h-3.5 border-2 border-[#c2410c] border-t-transparent rounded-full animate-spin flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Generation Progress Bar */}
            {polling && (
              <div className="pt-2">
                <div className="h-1.5 w-full bg-[#ede8dc] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#c2410c] transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(10, ((activeStep + 1) / PIPELINE_AGENTS.length) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Generation Summary Card when finished */}
            {createdCampaign && createdCampaign.status !== "generating" && (
              <div className="mt-4 p-4 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#15803d]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Reel Generation Succeeded</span>
                  </div>
                  <StatusBadge status={createdCampaign.status} />
                </div>

                {createdCampaign.generated_caption && (
                  <div className="text-xs text-[#1c1917] line-clamp-3 bg-[#ffffff] p-2.5 rounded-md border border-[#bbf7d0]">
                    "{createdCampaign.generated_caption}"
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  {createdCampaign.traceability?.critic_scores?.overall && (
                    <span className="text-[11px] font-mono text-[#57534e]">
                      Critic Score:{" "}
                      <strong className="text-[#15803d] font-bold">
                        {createdCampaign.traceability.critic_scores.overall}/100
                      </strong>
                    </span>
                  )}

                  <button
                    onClick={() => setInspectCampaignId(createdCampaign.id)}
                    className="btn btn-secondary !py-1 !px-2.5 !text-[11px] flex items-center gap-1.5"
                  >
                    <span>Inspect Reel</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide-over Inspection Sheet */}
      {inspectCampaignId && (
        <InspectionSheet
          campaignId={inspectCampaignId}
          onClose={() => setInspectCampaignId(null)}
        />
      )}
    </div>
  );
}
