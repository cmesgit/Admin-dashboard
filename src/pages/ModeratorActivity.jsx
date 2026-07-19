// Moderator Activity — oversight of moderators. KPIs + per-moderator rows +
// action-type breakdown + queue cards. Data: /forum/admin/moderation-overview/
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getModerationOverview } from "../api/admin";
import "../css/NewScreens.css";

const RANGES = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
];

const ModeratorActivity = () => {
  const [data, setData] = useState({ kpis: [], moderators: [], breakdown: [], queues: [] });
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7d");

  useEffect(() => {
    setLoading(true);
    getModerationOverview(range)
      .then(setData)
      .catch(() => setData({ kpis: [], moderators: [], breakdown: [], queues: [] }))
      .finally(() => setLoading(false));
  }, [range]);

  const maxBreak = Math.max(1, ...data.breakdown.map((b) => b.count));

  return (
    <div className="dashboard-wrapper">
      <div className="ns-head-row">
        <h1 className="dashboard-title" style={{ marginBottom: 0 }}>Moderator Activity</h1>
        <div className="ls-chips">
          {RANGES.map((r) => (
            <button key={r.key} className={`ls-chip${range === r.key ? " active" : ""}`} onClick={() => setRange(r.key)}>{r.label}</button>
          ))}
        </div>
      </div>

      <div className="ns-kpi-row">
        {(data.kpis || []).map((k) => (
          <div key={k.key} className="ns-kpi">
            <div className="ns-kpi-val">{k.value}</div>
            <div className="ns-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="dashboard-loading">Loading…</div>
      ) : (
        <>
          {/* Queues — amber when they have items */}
          <div className="ns-queue-row">
            {(data.queues || []).map((qc) => (
              <Link key={qc.key} to={qc.href || "#"} className={`ns-queue-card${qc.count > 0 ? " has-items" : ""}`}>
                <span className="ns-queue-label">{qc.label}</span>
                <span className="ns-queue-count">{qc.count}</span>
              </Link>
            ))}
          </div>

          <div className="ns-two-col">
            <div className="dashboard-card" style={{ textAlign: "left" }}>
              <h3 style={{ marginTop: 0 }}>Per moderator</h3>
              {data.moderators.length === 0 ? (
                <p className="ns-muted">No moderator actions in this period.</p>
              ) : (
                data.moderators.map((m) => (
                  <div key={m.email} className="ns-assign-row">
                    <span>{m.name}</span>
                    <span className="ns-muted">{m.week} actions</span>
                  </div>
                ))
              )}
            </div>

            <div className="dashboard-card" style={{ textAlign: "left" }}>
              <h3 style={{ marginTop: 0 }}>Action types</h3>
              {data.breakdown.length === 0 ? (
                <p className="ns-muted">No actions recorded.</p>
              ) : (
                data.breakdown.map((b) => (
                  <div key={b.type} className="ns-bar-row">
                    <span className="ns-bar-label">{b.type}</span>
                    <div className="ns-bar-track">
                      <div className="ns-bar-fill" style={{ width: `${(b.count / maxBreak) * 100}%` }} />
                    </div>
                    <span className="ns-bar-val">{b.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ModeratorActivity;
