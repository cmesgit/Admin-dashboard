import { useEffect, useState } from "react";
import { getModAnalytics } from "../../api/admin";

const ACTION_COLORS = {
  delete: "#c0392b", ban: "#c0392b", warn: "#e07900",
  dismiss: "#4b5563", unban: "#125027", restore: "#125027",
};

const formatAgo = (iso) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const trendClass = (kpi) => {
  if (kpi.trend == null) return "neutral";
  const up = kpi.trend >= 0;
  if (kpi.direction === "bad_if_up") return up ? "bad" : "good";
  if (kpi.direction === "good_if_down") return up ? "bad" : "good";
  return "good"; // good_if_up
};

const Analytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getModAnalytics().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="dashboard-loading">Loading...</div>;
  if (!data) return <div className="mod-empty"><h4>Analytics unavailable</h4></div>;

  const { kpis = [], reports_by_reason = [], recent_actions = [], this_month = {} } = data;

  return (
    <div>
      <div className="mod-month-grid">
        <div className="mod-month-stat"><div className="num">{this_month.reports_resolved ?? 0}</div><div className="lab">Reports resolved</div></div>
        <div className="mod-month-stat"><div className="num">{this_month.posts_approved ?? 0}</div><div className="lab">Posts approved</div></div>
        <div className="mod-month-stat"><div className="num">{this_month.users_warned ?? 0}</div><div className="lab">Users warned</div></div>
        <div className="mod-month-stat"><div className="num">{this_month.users_banned ?? 0}</div><div className="lab">Users banned</div></div>
      </div>

      <div className="mod-kpi-grid">
        {kpis.map((k) => (
          <div key={k.label} className="mod-kpi">
            <div className="label">{k.label}</div>
            <div className="value">{k.value}</div>
            {k.trend != null && (
              <div className={`trend ${trendClass(k)}`}>{k.trend >= 0 ? "↑" : "↓"} {Math.abs(k.trend)}%</div>
            )}
          </div>
        ))}
      </div>

      <div className="dashboard-card" style={{ marginBottom: 20 }}>
        <h3>Reports by Reason (Last 30 days)</h3>
        {reports_by_reason.map((r) => (
          <div key={r.reason} className="mod-bar-row">
            <div className="top"><span>{r.label}</span><span>{r.count}</span></div>
            <div className="mod-bar-track">
              <div className="mod-bar-fill" style={{ width: `${r.pct}%`, background: ACTION_COLORS.ban }} />
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-card">
        <h3>Recent Moderator Actions</h3>
        {recent_actions.length === 0 ? (
          <p style={{ color: "#888" }}>No actions logged yet.</p>
        ) : recent_actions.map((a) => (
          <div key={a.id} className="mod-action-row">
            <span className="mod-action-tile" style={{ background: ACTION_COLORS[a.action] || "#666" }}>
              {a.action.slice(0, 2)}
            </span>
            <div style={{ flex: 1 }}>
              <div>{a.action[0].toUpperCase() + a.action.slice(1)}{a.target_user ? ` — ${a.target_user}` : ""}</div>
              <div style={{ color: "#999", fontSize: "0.78rem" }}>{a.moderator} · {formatAgo(a.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Analytics;
