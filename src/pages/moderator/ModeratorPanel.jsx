import { useState } from "react";
import { Flag, ShieldAlert, Users, BarChart3, MessageSquare } from "lucide-react";
import ReportedContent from "./ReportedContent";
import AutoRejected from "./AutoRejected";
import UserManagement from "./UserManagement";
import Analytics from "./Analytics";
import AllThreads from "./AllThreads";
import "../../css/Moderator.css";

const TABS = [
  { id: "reports", label: "Reported Content", icon: Flag },
  { id: "auto-rejected", label: "Auto-Rejected", icon: ShieldAlert },
  { id: "users", label: "User Management", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "threads", label: "All Threads", icon: MessageSquare },
];

const ModeratorPanel = () => {
  const [tab, setTab] = useState("reports");
  const [counts, setCounts] = useState({ reports: 0, "auto-rejected": 0 });

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Moderator Panel</h1>

      <div className="mod-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`mod-tab${tab === id ? " active" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon size={16} />
            {label}
            {counts[id] > 0 && <span className="mod-tab-badge">{counts[id]}</span>}
          </button>
        ))}
      </div>

      {tab === "reports" && (
        <ReportedContent onCount={(n) => setCounts((c) => ({ ...c, reports: n }))} />
      )}
      {tab === "auto-rejected" && (
        <AutoRejected onCount={(n) => setCounts((c) => ({ ...c, "auto-rejected": n }))} />
      )}
      {tab === "users" && <UserManagement />}
      {tab === "analytics" && <Analytics />}
      {tab === "threads" && <AllThreads />}
    </div>
  );
};

export default ModeratorPanel;
