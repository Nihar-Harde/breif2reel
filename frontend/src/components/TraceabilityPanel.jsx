import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Search,
  CheckCircle2,
  Sparkles,
  Info,
} from "lucide-react";

const RUBRIC_CONFIG = {
  brand_voice_fit: {
    label: "Brand Voice Fit",
    description: "Alignment with ingested brand guidelines and tonal consistency.",
  },
  claim_accuracy: {
    label: "Claim Accuracy",
    description: "Veracity of product claims and absence of hallucinated facts.",
  },
  caption_quality: {
    label: "Caption Quality",
    description: "Hook strength, call-to-action clarity, and hashtag strategy.",
  },
  engagement_heuristic: {
    label: "Engagement Heuristic",
    description: "Predicted algorithmic retention, shareability, and pacing.",
  },
  overall: {
    label: "Composite Quality Score",
    description: "Weighted evaluation score across all critique vectors.",
  },
};

export function TraceabilityPanel({ traceability }) {
  const [expandedMetric, setExpandedMetric] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  if (!traceability || (!traceability.critic_scores && !traceability.retrieved_chunks)) {
    return (
      <div className="p-8 text-center border border-[#e6e0d4] rounded-lg bg-[#ffffff]">
        <Info className="w-5 h-5 text-[#78716c] mx-auto mb-2" />
        <p className="text-xs text-[#78716c]">
          No automated Critic telemetry or RAG chunks recorded for this campaign run.
        </p>
      </div>
    );
  }

  const scores = traceability.critic_scores || {};
  const justifications = traceability.critic_justifications || {};
  const chunks = traceability.retrieved_chunks || [];
  const repetitionScore = traceability.repetition_score;

  const overallScore = scores.overall ?? 0;
  const isQualityGatePassed = overallScore >= 70;

  const getScoreColor = (score) => {
    if (score >= 80) return "text-[#15803d] bg-[#16a34a]";
    if (score >= 70) return "text-[#d97706] bg-[#d97706]";
    return "text-[#b91c1c] bg-[#dc2626]";
  };

  const filteredChunks = chunks.filter((c) =>
    searchQuery
      ? c.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.source?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Quality Gate Status Banner */}
      <div
        className={`p-3.5 rounded-lg border flex items-center justify-between ${
          isQualityGatePassed
            ? "bg-[#f0fdf4] border-[#bbf7d0] text-[#15803d]"
            : "bg-[#fffbeb] border-[#fde68a] text-[#b45309]"
        }`}
      >
        <div className="flex items-center gap-2.5">
          {isQualityGatePassed ? (
            <ShieldCheck className="w-4 h-4 text-[#15803d]" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-[#d97706]" />
          )}
          <div>
            <div className="text-xs font-semibold tracking-tight text-[#1c1917]">
              {isQualityGatePassed
                ? "Quality Gate Passed (≥ 70% Benchmark)"
                : "Quality Gate Warning (< 70% Benchmark)"}
            </div>
            <div className="text-[11px] opacity-80 text-[#57534e]">
              Evaluated by LLM-as-Judge Critic Agent with automated grounding checks.
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-lg font-mono font-bold tabular-nums text-[#1c1917]">
            {overallScore}
          </span>
          <span className="text-xs opacity-70 font-mono text-[#78716c]"> / 100</span>
        </div>
      </div>

      {/* Critic Rubric Breakdown Bars */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#78716c]">
            Critic Rubric Evaluation
          </span>
          <span className="text-[10px] font-mono text-[#78716c] flex items-center gap-1.5">
            <span className="w-2 h-0.5 border-t border-dashed border-[#78716c]" />
            70% Gate Threshold
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {Object.entries(scores).map(([metricKey, scoreVal]) => {
            const rubric = RUBRIC_CONFIG[metricKey] || {
              label: metricKey.replace(/_/g, " "),
              description: "",
            };
            const isExpanded = expandedMetric === metricKey;
            const justification = justifications[metricKey];
            const colorClass = getScoreColor(scoreVal);

            return (
              <div
                key={metricKey}
                className="p-3 rounded-lg border border-[#e6e0d4] bg-[#ffffff] hover:border-[#d3cbbe] transition-colors shadow-sm"
              >
                {/* Bar Header */}
                <div
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setExpandedMetric(isExpanded ? null : metricKey)}
                >
                  <div className="flex items-center gap-1.5">
                    {justification ? (
                      isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#78716c]" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-[#78716c]" />
                      )
                    ) : (
                      <span className="w-3.5" />
                    )}
                    <span className="text-xs font-medium text-[#1c1917]">
                      {rubric.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono font-semibold tabular-nums ${
                        colorClass.split(" ")[0]
                      }`}
                    >
                      {scoreVal}/100
                    </span>
                  </div>
                </div>

                {/* Rubric Horizontal Bar with 70% Quality Gate Marker */}
                <div className="relative mt-2.5 h-2 w-full bg-[#ede8dc] rounded-full overflow-hidden">
                  {/* Fill Bar */}
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      colorClass.split(" ")[1]
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, scoreVal))}%` }}
                  />

                  {/* 70% Benchmark Threshold Marker (Vertical dashed indicator) */}
                  <div
                    className="absolute top-0 bottom-0 w-[2px] bg-[#78716c] z-10 opacity-70"
                    style={{ left: "70%" }}
                    title="70% Quality Gate Marker"
                  />
                </div>

                {/* Expandable Justification */}
                {isExpanded && justification && (
                  <div className="mt-2.5 pt-2.5 border-t border-[#e6e0d4] text-xs text-[#57534e] bg-[#fbf9f5] p-2.5 rounded">
                    <p className="font-mono text-[11px] text-[#c2410c] mb-1 uppercase tracking-wider font-semibold">
                      Critic Justification:
                    </p>
                    <p className="leading-relaxed italic text-[#1c1917]">
                      "{justification}"
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Anti-Repetition Guard Score */}
      {repetitionScore != null && (
        <div className="p-3.5 rounded-lg border border-[#e6e0d4] bg-[#ffffff] flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs font-medium text-[#1c1917]">
              Anti-Repetition Heuristic
            </div>
            <div className="text-[11px] text-[#78716c]">
              Ensures novel phrasing vs previous campaigns (Benchmark ≤ 85%)
            </div>
          </div>
          <span
            className={`text-xs font-mono font-bold tabular-nums px-2 py-0.5 rounded border ${
              repetitionScore <= 0.85
                ? "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]"
                : "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]"
            }`}
          >
            {(repetitionScore * 100).toFixed(1)}%
          </span>
        </div>
      )}

      {/* RAG Retrieved Guidelines Provenance */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#78716c] flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#c2410c]" />
            RAG Provenance Context ({chunks.length} chunks)
          </span>

          {chunks.length > 2 && (
            <div className="relative w-44">
              <Search className="w-3 h-3 text-[#78716c] absolute left-2 top-2" />
              <input
                type="text"
                placeholder="Search chunks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-base !py-1 !pl-6 !text-[11px] !rounded-md"
              />
            </div>
          )}
        </div>

        {filteredChunks.length === 0 ? (
          <div className="p-4 text-center border border-[#e6e0d4] rounded-lg bg-[#ffffff] text-xs text-[#78716c]">
            No matching context chunks.
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {filteredChunks.map((chunk, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-[#e6e0d4] bg-[#ffffff] text-xs flex flex-col gap-1.5 shadow-sm"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-[#78716c] truncate max-w-[200px]" title={chunk.source}>
                    src: {chunk.source || "brand_guidelines"}
                  </span>
                  {chunk.similarity_score != null && (
                    <span className="font-mono text-[#c2410c] font-semibold">
                      {(chunk.similarity_score * 100).toFixed(1)}% Match
                    </span>
                  )}
                </div>
                <p className="text-[#1c1917] leading-relaxed text-[11px] bg-[#fbf9f5] p-2.5 rounded border border-[#e6e0d4]">
                  "{chunk.text}"
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
