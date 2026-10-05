import React from "react";

const STATUS_CONFIGS = {
  needs_review: {
    label: "Needs Review",
    dotClass: "bg-[#ea580c]",
    badgeClass: "bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]",
  },
  generating: {
    label: "Generating",
    dotClass: "bg-[#d97706] animate-pulse",
    badgeClass: "bg-[#fffbeb] text-[#b45309] border-[#fde68a]",
  },
  approved: {
    label: "Approved",
    dotClass: "bg-[#16a34a]",
    badgeClass: "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]",
  },
  published: {
    label: "Published",
    dotClass: "bg-[#15803d]",
    badgeClass: "bg-[#f0fdf4] text-[#15803d] border-[#86efac]",
  },
  scheduled: {
    label: "Scheduled",
    dotClass: "bg-[#7c3aed]",
    badgeClass: "bg-[#f5f3ff] text-[#6d28d9] border-[#ddd6fe]",
  },
  draft: {
    label: "Draft",
    dotClass: "bg-[#78716c]",
    badgeClass: "bg-[#f5f5f4] text-[#57534e] border-[#d6d3d1]",
  },
  failed: {
    label: "Failed",
    dotClass: "bg-[#dc2626]",
    badgeClass: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
  },
  rejected: {
    label: "Rejected",
    dotClass: "bg-[#dc2626]",
    badgeClass: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
  },
  active: {
    label: "Active",
    dotClass: "bg-[#16a34a]",
    badgeClass: "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]",
  },
  success: {
    label: "Success",
    dotClass: "bg-[#15803d]",
    badgeClass: "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]",
  },
};

export function StatusBadge({ status, className = "" }) {
  const norm = (status || "draft").toLowerCase().replace(" ", "_");
  const config = STATUS_CONFIGS[norm] || {
    label: status,
    dotClass: "bg-[#78716c]",
    badgeClass: "bg-[#f5f5f4] text-[#57534e] border-[#d6d3d1]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono tracking-tight border font-semibold ${config.badgeClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dotClass}`} />
      <span>{config.label}</span>
    </span>
  );
}
