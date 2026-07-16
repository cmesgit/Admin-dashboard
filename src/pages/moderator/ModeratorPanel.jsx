import { useCallback, useEffect, useRef, useState } from "react";
import {
  Flag, ShieldAlert, Users, BarChart3, MessageSquare, History,
  MessagesSquare, TriangleAlert, UserX, ShieldCheck, LayoutGrid,
} from "lucide-react";
import ReportedContent from "./ReportedContent";
import AutoRejected from "./AutoRejected";
import UserManagement from "./UserManagement";
import Analytics from "./Analytics";
import AllThreads from "./AllThreads";
import ActivityLog from "./ActivityLog";
import Categories from "./Categories";
import Toast from "../../components/Toast";
import { getModAnalytics } from "../../api/admin";
import "../../css/Moderator.css";

const TABS = [
  { id: "reports", label: "Reported Content", icon: Flag },
  { id: "auto-rejected", label: "Auto-Rejected", icon: ShieldAlert },
  { id: "users", label: "User Management", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "threads", label: "All Threads", icon: MessageSquare },
  { id: "categories", label: "Categories", icon: LayoutGrid },
  { id: "log", label: "Activity Log", icon: History },
];

const STAT_CARDS = [
  { key: "open_reports", label: "Open reports", icon: MessagesSquare, tone: "blue" },
  { key: "high_priority", label: "High priority", icon: TriangleAlert, tone: "red" },
  { key: "banned_users", label: "Banned users", icon: UserX, tone: "purple" },
  { key: "actions_today", label: "Actions today", icon: ShieldCheck, tone: "green" },
];

const ModeratorPanel = () => {
  const [tab, setTab] = useState("reports");
  const [counts, setCounts] = useState({ reports: 0, "auto-rejected": 0 });
  const [stats, setStats] = useState({ open_reports: 0, high_priority: 0, banned_users: 0, actions_today: 0 });
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const refreshStats = useCallback(() => {
    getModAnalytics().then((d) => {
      if (d && d.header_stats) setStats(d.header_stats);
    });
  }, []);

  useEffect(() => { refreshStats(); }, [refreshStats]);

  // Passed down to every tab that performs a moderation action: shows the
  // bottom-center toast and pulls fresh header-stat counts in one call.
  const onAction = useCallback((message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
    refreshStats();
  }, [refreshStats]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Moderator Panel</h1>

      <div className="mod-stat-grid">
        {STAT_CARDS.map(({ key, label, icon: Icon, tone }) => (
          <div key={key} className="mod-stat-card">
            <div className={`mod-stat-icon tone-${tone}`}><Icon size={24} /></div>
            <div>
              <div className="mod-stat-value">{stats[key] ?? 0}</div>
              <div className="mod-stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

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
        <ReportedContent
          onCount={(n) => setCounts((c) => ({ ...c, reports: n }))}
          onAction={onAction}
        />
      )}
      {tab === "auto-rejected" && (
        <AutoRejected onCount={(n) => setCounts((c) => ({ ...c, "auto-rejected": n }))} />
      )}
      {tab === "users" && <UserManagement onAction={onAction} />}
      {tab === "threads" && <AllThreads onAction={onAction} />}
      {tab === "categories" && <Categories onAction={onAction} />}
      {tab === "analytics" && <Analytics />}
      {tab === "log" && <ActivityLog />}

      <Toast message={toast} />
    </div>
  );
};

export default ModeratorPanel;
