import React, { useState } from "react";

/**
 * Metric Sparkline (Inline Trends for KPI Cards)
 * Option C Warm Editorial: high data-to-ink ratio, warm gradient fill, endpoint dot.
 */
export function Sparkline({
  data = [12, 18, 15, 24, 22, 30, 28, 38, 35, 46, 42, 54],
  color = "#c2410c",
  height = 36,
}) {
  if (!data || data.length < 2) return null;
  const width = 120;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * (width - 8) + 4;
    const y = height - 6 - ((val - min) / range) * (height - 12);
    return [x, y];
  });

  const pathD = points.reduce(
    (acc, [x, y], i) => (i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`),
    ""
  );

  const lastPoint = points[points.length - 1];
  const areaD = `${pathD} L ${lastPoint[0]} ${height} L ${points[0][0]} ${height} Z`;
  const gradId = `sparkline-grad-${color.replace("#", "")}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={lastPoint[0]}
        cy={lastPoint[1]}
        r="2.5"
        fill={color}
        stroke="#ffffff"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/**
 * Pipeline Throughput & Latency Time-Series Chart
 * Interactive SVG line/area plot with warm stone grid and hover coordinates tooltip
 */
export function ThroughputChart({
  series = [
    { date: "Oct 28", campaigns: 8, latency: 12.4 },
    { date: "Oct 29", campaigns: 14, latency: 11.2 },
    { date: "Oct 30", campaigns: 19, latency: 9.8 },
    { date: "Oct 31", campaigns: 24, latency: 8.9 },
    { date: "Nov 01", campaigns: 28, latency: 7.6 },
    { date: "Nov 02", campaigns: 36, latency: 6.8 },
    { date: "Nov 03", campaigns: 42, latency: 6.2 },
  ],
}) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const height = 180;
  const width = 560;
  const padding = { top: 20, right: 30, bottom: 30, left: 40 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...series.map((d) => d.campaigns), 10);

  const getX = (i) => padding.left + (i / (series.length - 1)) * chartW;
  const getY = (val) => padding.top + chartH - (val / maxVal) * chartH;

  const lineD = series.reduce(
    (acc, d, i) =>
      i === 0 ? `M ${getX(i)} ${getY(d.campaigns)}` : `${acc} L ${getX(i)} ${getY(d.campaigns)}`,
    ""
  );

  const areaD = `${lineD} L ${getX(series.length - 1)} ${padding.top + chartH} L ${getX(0)} ${
    padding.top + chartH
  } Z`;

  return (
    <div className="relative w-full overflow-hidden select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="throughput-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c2410c" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#c2410c" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Hairline Warm Stone Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + chartH * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e6e0d4"
                strokeDasharray="3 3"
              />
              <text
                x={padding.left - 8}
                y={y + 3}
                fill="#78716c"
                fontSize="10"
                fontFamily="'JetBrains Mono', monospace"
                textAnchor="end"
                className="tabular-nums font-medium"
              >
                {Math.round(maxVal * ratio)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#throughput-grad)" />

        {/* Primary Line */}
        <path
          d={lineD}
          fill="none"
          stroke="#c2410c"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points & Interactive Hover targets */}
        {series.map((d, i) => {
          const x = getX(i);
          const y = getY(d.campaigns);
          const isHovered = hoverIndex === i;

          return (
            <g key={i}>
              {/* Invisible wide capture area */}
              <rect
                x={x - 20}
                y={padding.top}
                width={40}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                className="cursor-crosshair"
              />

              {/* Point Circle */}
              <circle
                cx={x}
                cy={y}
                r={isHovered ? 5 : 3.5}
                fill="#c2410c"
                stroke="#ffffff"
                strokeWidth={isHovered ? 2.5 : 1.5}
                className="transition-all"
              />

              {/* X Axis Date labels */}
              <text
                x={x}
                y={height - 8}
                fill={isHovered ? "#1c1917" : "#78716c"}
                fontSize="10"
                fontFamily="'JetBrains Mono', monospace"
                textAnchor="middle"
                className="tabular-nums font-semibold transition-colors"
              >
                {d.date}
              </text>
            </g>
          );
        })}

        {/* Hover Coordinate Crosshair Rule */}
        {hoverIndex !== null && (
          <line
            x1={getX(hoverIndex)}
            y1={padding.top}
            x2={getX(hoverIndex)}
            y2={padding.top + chartH}
            stroke="#a8a29e"
            strokeDasharray="2 2"
          />
        )}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoverIndex !== null && (
        <div
          className="absolute z-20 pointer-events-none p-2.5 rounded-lg bg-[#ffffff] border border-[#e6e0d4] shadow-xl text-xs font-mono"
          style={{
            left: `${(getX(hoverIndex) / width) * 100}%`,
            top: `${(getY(series[hoverIndex].campaigns) / height) * 100 - 35}%`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="text-[10px] text-[#78716c] font-semibold mb-0.5">
            {series[hoverIndex].date}
          </div>
          <div className="flex items-center gap-2 text-[#1c1917] font-semibold">
            <span>Throughput:</span>
            <span className="text-[#c2410c] font-bold tabular-nums">
              {series[hoverIndex].campaigns} reels
            </span>
          </div>
          <div className="flex items-center gap-2 text-[#57534e] text-[11px]">
            <span>Latency p95:</span>
            <span className="text-[#15803d] font-semibold tabular-nums">
              {series[hoverIndex].latency}s
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Critic Rubric Multi-Bar Graphic with ≥70% Benchmark Threshold Marker
 */
export function CriticDistributionChart({
  rubrics = [
    { label: "Brand Voice Fit", score: 88, threshold: 70 },
    { label: "Claim Accuracy", score: 94, threshold: 70 },
    { label: "Caption Quality", score: 82, threshold: 70 },
    { label: "Engagement Heuristic", score: 79, threshold: 70 },
    { label: "Composite Index", score: 86, threshold: 70 },
  ],
}) {
  return (
    <div className="flex flex-col gap-3 select-none">
      <div className="flex items-center justify-between text-xs text-[#78716c] mb-1">
        <span className="label-micro !mb-0 text-[#78716c]">Dimension Rubric</span>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1.5 text-[#78716c]">
            <span className="w-2 h-0.5 border-t border-dashed border-[#78716c]" />
            70% Gate
          </span>
          <span className="text-[#1c1917] font-semibold">Score / 100</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {rubrics.map((r, i) => {
          const isPassed = r.score >= r.threshold;
          const barColor =
            r.score >= 80 ? "bg-[#15803d]" : r.score >= 70 ? "bg-[#d97706]" : "bg-[#b91c1c]";
          const textColor =
            r.score >= 80 ? "text-[#15803d]" : r.score >= 70 ? "text-[#d97706]" : "text-[#b91c1c]";

          return (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1c1917]">{r.label}</span>
                <span className={`font-mono font-bold tabular-nums ${textColor}`}>
                  {r.score}
                  <span className="text-[10px] text-[#78716c] font-normal">/100</span>
                </span>
              </div>

              {/* Bar Container */}
              <div className="relative h-2 w-full bg-[#ede8dc] rounded-full overflow-hidden">
                {/* Horizontal Fill Bar */}
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${Math.min(100, r.score)}%` }}
                />

                {/* 70% Quality Gate Dashed Line */}
                <div
                  className="absolute top-0 bottom-0 w-[1.5px] bg-[#78716c] z-10 opacity-70"
                  style={{ left: "70%" }}
                  title="70% Quality Gate Threshold"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Multi-Platform Publishing Breakdown Ratios
 */
export function PlatformRatiosChart({
  breakdown = {
    instagram: { total: 42, success: 40, failed: 2 },
    youtube: { total: 38, success: 37, failed: 1 },
    facebook: { total: 12, success: 11, failed: 1 },
  },
}) {
  return (
    <div className="flex flex-col gap-4">
      {Object.entries(breakdown).map(([platform, stats]) => {
        const rate = stats.total > 0 ? (stats.success / stats.total) * 100 : 0;
        return (
          <div key={platform} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold capitalize text-[#1c1917]">{platform}</span>
                <span className="text-[11px] font-mono text-[#78716c]">
                  ({stats.success}/{stats.total} published)
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-[#15803d] tabular-nums">
                {rate.toFixed(0)}% Success
              </span>
            </div>

            {/* Stacked Proportional Bar */}
            <div className="h-2 w-full bg-[#ede8dc] rounded-full overflow-hidden flex">
              <div
                className="bg-[#15803d] h-full transition-all duration-500"
                style={{ width: `${rate}%` }}
                title={`Success: ${stats.success}`}
              />
              <div
                className="bg-[#b91c1c] h-full transition-all duration-500"
                style={{ width: `${100 - rate}%` }}
                title={`Failed: ${stats.failed}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Reach Timeline Chart
 * Multi-series publication-grade SVG line chart plotting Views (primary) and Likes (secondary)
 * over time for Niche-wide aggregates or Post-level viral curves.
 */
export function ReachTimelineChart({
  series = [
    { label: "Day 1", views: 4200, likes: 380, shares: 92 },
    { label: "Day 2", views: 8900, likes: 790, shares: 180 },
    { label: "Day 3", views: 16400, likes: 1420, shares: 360 },
    { label: "Day 4", views: 24800, likes: 2150, shares: 540 },
    { label: "Day 5", views: 33500, likes: 2900, shares: 720 },
    { label: "Day 6", views: 41200, likes: 3540, shares: 890 },
    { label: "Day 7", views: 48200, likes: 3950, shares: 920 },
  ],
  title = "Audience Reach & Interaction Trajectory",
  subtitle = "Views (impressions) and direct likes over time",
}) {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!series || series.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-[#78716c] font-mono">
        No reach timeline data available
      </div>
    );
  }

  const height = 210;
  const width = 620;
  const padding = { top: 25, right: 35, bottom: 35, left: 55 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxViews = Math.max(...series.map((d) => d.views || 0), 100);
  const maxLikes = Math.max(...series.map((d) => d.likes || 0), 10);

  const getX = (i) => padding.left + (i / Math.max(1, series.length - 1)) * chartW;
  const getYViews = (val) => padding.top + chartH - (val / maxViews) * chartH;
  const getYLikes = (val) => padding.top + chartH - (val / (maxLikes || 1)) * chartH;

  const viewsPoints = series.map((d, i) => [getX(i), getYViews(d.views || 0)]);
  const likesPoints = series.map((d, i) => [getX(i), getYLikes(d.likes || 0)]);

  const viewsLineD = viewsPoints.reduce(
    (acc, [x, y], i) => (i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`),
    ""
  );

  const viewsAreaD = `${viewsLineD} L ${getX(series.length - 1)} ${padding.top + chartH} L ${getX(
    0
  )} ${padding.top + chartH} Z`;

  const likesLineD = likesPoints.reduce(
    (acc, [x, y], i) => (i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`),
    ""
  );

  const formatK = (val) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val;
  };

  const hoveredData = hoverIndex !== null ? series[hoverIndex] : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Legend & Summary Bar */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#c2410c]" />
            <span className="font-semibold text-[#1c1917] text-[11px]">Views</span>
            <span className="font-mono text-[#78716c] text-[10px]">
              (Peak {formatK(maxViews)})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#15803d]" />
            <span className="font-semibold text-[#1c1917] text-[11px]">Likes</span>
            <span className="font-mono text-[#78716c] text-[10px]">
              (Peak {formatK(maxLikes)})
            </span>
          </div>
        </div>

        {hoveredData ? (
          <div className="flex items-center gap-3 font-mono text-[11px] bg-[#f5f2eb] px-2.5 py-0.5 rounded border border-[#e6e0d4]">
            <span className="text-[#1c1917] font-semibold">{hoveredData.label || hoveredData.time}:</span>
            <span className="text-[#c2410c] font-bold">{(hoveredData.views || 0).toLocaleString()} views</span>
            <span className="text-[#15803d] font-bold">{(hoveredData.likes || 0).toLocaleString()} likes</span>
          </div>
        ) : (
          <span className="text-[10px] font-mono text-[#78716c]">
            Hover points for live breakdown
          </span>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="viewsAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c2410c" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#c2410c" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines & Ticks */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
            const y = padding.top + chartH * (1 - ratio);
            const val = Math.round(maxViews * ratio);
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#e6e0d4"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-[#78716c] font-mono text-[9px]"
                >
                  {formatK(val)}
                </text>
              </g>
            );
          })}

          {/* X Axis Labels */}
          {series.map((d, i) => {
            const x = getX(i);
            return (
              <text
                key={i}
                x={x}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                className="fill-[#78716c] font-mono text-[9px]"
              >
                {d.label || d.time}
              </text>
            );
          })}

          {/* Views Area Fill */}
          <path d={viewsAreaD} fill="url(#viewsAreaGrad)" />

          {/* Views Line */}
          <path
            d={viewsLineD}
            fill="none"
            stroke="#c2410c"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Likes Line (Dashed Sage Green) */}
          <path
            d={likesLineD}
            fill="none"
            stroke="#15803d"
            strokeWidth="1.8"
            strokeDasharray="4 3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points & Interactive Hover Zones */}
          {series.map((d, i) => {
            const x = getX(i);
            const yV = getYViews(d.views || 0);
            const yL = getYLikes(d.likes || 0);
            const isHovered = hoverIndex === i;

            return (
              <g
                key={i}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                className="cursor-pointer"
              >
                {/* Vertical Crosshair Line when hovered */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={padding.top + chartH}
                    stroke="#c2410c"
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                    opacity="0.8"
                  />
                )}

                {/* Views Point Circle */}
                <circle
                  cx={x}
                  cy={yV}
                  r={isHovered ? 4.5 : 2.5}
                  fill="#c2410c"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="transition-all duration-150"
                />

                {/* Likes Point Circle */}
                <circle
                  cx={x}
                  cy={yL}
                  r={isHovered ? 4 : 2}
                  fill="#15803d"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="transition-all duration-150"
                />

                {/* Wide invisible vertical hit-zone */}
                <rect
                  x={x - chartW / (series.length * 2)}
                  y={padding.top}
                  width={chartW / series.length}
                  height={chartH}
                  fill="transparent"
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
