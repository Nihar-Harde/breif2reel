import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  PlusCircle,
  Inbox,
  BookOpen,
  History,
  Users2,
  BarChart3,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Cpu,
} from "lucide-react";

const NAV_ITEMS = [
  {
    to: "/",
    label: "New Campaign",
    icon: PlusCircle,
    end: true,
  },
  {
    to: "/review-queue",
    label: "Review Queue",
    icon: Inbox,
    badgeKey: "queue",
  },
  {
    to: "/brand-assets",
    label: "Brand Assets",
    icon: BookOpen,
  },
  {
    to: "/post-history",
    label: "Post History",
    icon: History,
  },
  {
    to: "/accounts",
    label: "Accounts",
    icon: Users2,
  },
  {
    to: "/analytics",
    label: "Analytics",
    icon: BarChart3,
  },
];

export function Sidebar({ collapsed, onToggleCollapse, queueCount = 0 }) {
  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-50 bg-[#f5f2eb] border-r border-[#e6e0d4] flex flex-col transition-all duration-200 select-none ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 border-b border-[#e6e0d4] flex items-center justify-between px-3.5 bg-[#fbf9f5]">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-7 h-7 rounded-md bg-[#c2410c] flex items-center justify-center flex-shrink-0 shadow-sm text-white font-mono font-bold text-xs tracking-tighter">
            B2R
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold tracking-tight text-[#1c1917] truncate">
                brief2reel
              </span>
              <span className="text-[10px] font-mono text-[#78716c] tracking-wider uppercase">
                Enterprise v1.0
              </span>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-md text-[#78716c] hover:text-[#1c1917] hover:bg-[#ede8dc] transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeft className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-3 px-2 flex flex-col gap-1 overflow-y-auto">
        {!collapsed && (
          <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-[#78716c]">
            Workspace
          </div>
        )}
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[#ffffff] text-[#1c1917] shadow-sm border border-[#e6e0d4] font-semibold"
                    : "text-[#57534e] hover:text-[#1c1917] hover:bg-[#ede8dc] border border-transparent"
                } ${collapsed ? "justify-center !px-0" : ""}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 transition-colors ${
                      isActive
                        ? "text-[#c2410c]"
                        : "text-[#78716c] group-hover:text-[#1c1917]"
                    }`}
                  />
                  {!collapsed && (
                    <span className="truncate flex-1 tracking-tight">
                      {item.label}
                    </span>
                  )}
                  {!collapsed && item.badgeKey === "queue" && queueCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] tabular-nums">
                      {queueCount}
                    </span>
                  )}
                  {collapsed && item.badgeKey === "queue" && queueCount > 0 && (
                    <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#c2410c]" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Footer Info */}
      <div className="p-3 border-t border-[#e6e0d4] bg-[#ede8dc]/50">
        {!collapsed ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-[#57534e]">
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#57534e]">
                <Cpu className="w-3 h-3 text-[#15803d]" />
                Critic Gate: &ge;70%
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#15803d]" />
            </div>
            <div className="text-[10px] font-mono text-[#78716c] leading-tight">
              Warm Editorial · Brand Studio
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title="Critic Threshold: &ge;70%">
            <div className="w-2 h-2 rounded-full bg-[#15803d]" />
          </div>
        )}
      </div>
    </aside>
  );
}
