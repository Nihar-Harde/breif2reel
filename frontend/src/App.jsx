import { NavLink, Route, Routes } from "react-router-dom";
import { NewCampaignPage } from "./pages/NewCampaignPage";
import { ReviewQueuePage } from "./pages/ReviewQueuePage";

const navItems = [
  { to: "/", label: "New Campaign" },
  { to: "/review-queue", label: "Review Queue" },
  { to: "/post-history", label: "Post History" },
  { to: "/accounts", label: "Accounts" },
  { to: "/analytics", label: "Analytics" },
];

function Placeholder({ title }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-slate-500">{title} (Coming Soon)</div>;
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-4 p-4 md:grid-cols-[220px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-4">
          <h1 className="mb-4 text-lg font-semibold">breif2reel</h1>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded px-3 py-2 text-sm ${isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="rounded-lg border border-slate-200 bg-white p-4">
          <Routes>
            <Route path="/" element={<NewCampaignPage />} />
            <Route path="/review-queue" element={<ReviewQueuePage />} />
            <Route path="/post-history" element={<Placeholder title="Post History" />} />
            <Route path="/accounts" element={<Placeholder title="Accounts" />} />
            <Route path="/analytics" element={<Placeholder title="Analytics" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

