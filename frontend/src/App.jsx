import React, { useState, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { NewCampaignPage } from "./pages/NewCampaignPage";
import { ReviewQueuePage } from "./pages/ReviewQueuePage";
import { BrandAssetsPage } from "./pages/BrandAssetsPage";
import { PostHistoryPage } from "./pages/PostHistoryPage";
import { AccountsPage } from "./pages/AccountsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { listCampaigns } from "./api";

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  const fetchQueueCount = async () => {
    try {
      const data = await listCampaigns({ status: "needs_review" });
      setQueueCount(data.items?.length || 0);
    } catch {
      // Ignore background error
    }
  };

  useEffect(() => {
    fetchQueueCount();
    const interval = setInterval(fetchQueueCount, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#fbf9f5] text-[#1c1917] flex font-sans antialiased">
      {/* Sleek Command Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        queueCount={queueCount}
      />

      {/* Main Viewport Container */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${
          collapsed ? "ml-16" : "ml-60"
        }`}
      >
        {/* Top Header Bar */}
        <Header onRefresh={fetchQueueCount} />

        {/* Routed Content Viewport */}
        <main className="flex-1 pb-16">
          <Routes>
            <Route path="/" element={<NewCampaignPage />} />
            <Route path="/review-queue" element={<ReviewQueuePage />} />
            <Route path="/brand-assets" element={<BrandAssetsPage />} />
            <Route path="/post-history" element={<PostHistoryPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
