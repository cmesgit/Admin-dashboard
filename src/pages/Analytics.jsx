// Analytics — insights across enrollments, revenue, engagement.
// KPI cards + a simple daily bar chart + top breakdowns. Data:
// /dashboard/admin/analytics/?range=&metric=
import { useEffect, useState } from "react";
import { getAnalytics } from "../api/admin";
import "../css/NewScreens.css";

const RANGES = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
];
const METRICS = [
  { key: "enrollments", label: "Enrollments" },
  { key: "revenue", label: "Revenue" },
  { key: "engagement", label: "Engagement" },
];

const SERIES_COLORS = ["#4f6df5", "#1abc9c", "#e67e22"];

const fmtKpi = (k) =>
  k.format === "currency" ? `₹${((k.value || 0) / 100).toLocaleString("en-IN")}` : (k.value ?? 0).toLocaleString("en-IN");

const fmtDay = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
  catch { return iso; }
};

const MiniBars = ({ points = [], color }) => {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="ns-chart">
      {points.length === 0 ? (
        <p className="ns-muted">No data for this period.</p>
      ) : (
        <div className="ns-bars">
          {points.map((p, i) => (
            <div key={i} className="ns-bar-col" title={`${fmtDay(p.date)}: ${p.value}`}>
              <div className="ns-bar-vert" style={{ height: `${(p.value / max) * 100}%`, background: color }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Analytics = () => {
  const [data, setData] = useState({ kpis: [], series: [], breakdowns: [] });
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30d");
  const [metric, setMetric] = useState("enrollments");

  useEffect(() => {
    setLoading(true);
    getAnalytics({ range, metric })
      .then(setData)
      .catch(() => setData({ kpis: [], series: [], breakdowns: [] }))
      .finally(() => setLoading(false));
  }, [range, metric]);

  const isRevenue = metric === "revenue";

  return (
    <div className="dashboard-wrapper">
      <div className="ns-head-row">
        <h1 className="dashboard-title" style={{ marginBottom: 0 }}>Analytics</h1>
        <div className="ls-chips">
          {RANGES.map((r) => (
            <button key={r.key} className={`ls-chip${range === r.key ? " active" : ""}`} onClick={() => setRange(r.key)}>{r.label}</button>
          ))}
        </div>
      </div>

      <div className="ns-kpi-row">
        {(data.kpis || []).map((k) => (
          <div key={k.key} className="ns-kpi">
            <div className="ns-kpi-val">{fmtKpi(k)}</div>
            <div className="ns-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="ls-chips" style={{ marginBottom: 16 }}>
        {METRICS.map((m) => (
          <button key={m.key} className={`ls-chip${metric === m.key ? " active" : ""}`} onClick={() => setMetric(m.key)}>{m.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="dashboard-loading">Loading…</div>
      ) : (
        <div className="ns-two-col">
          <div className="dashboard-card" style={{ textAlign: "left" }}>
            <h3 style={{ marginTop: 0, textTransform: "capitalize" }}>{metric} · last {range}</h3>
            {(data.series || []).map((s, i) => (
              <div key={s.label} style={{ marginBottom: 14 }}>
                <div className="ns-series-label">{s.label}</div>
                <MiniBars points={s.points} color={SERIES_COLORS[i % SERIES_COLORS.length]} />
              </div>
            ))}
            {(data.series || []).length === 0 && <p className="ns-muted">No series data.</p>}
          </div>

          <div className="dashboard-card" style={{ textAlign: "left" }}>
            <h3 style={{ marginTop: 0 }}>Top {isRevenue ? "courses by revenue" : "courses"}</h3>
            {(data.breakdowns || []).length === 0 ? (
              <p className="ns-muted">No breakdown available.</p>
            ) : (
              data.breakdowns.map((b) => (
                <div key={b.label} className="ns-assign-row">
                  <span>{b.label}</span>
                  <b>{isRevenue ? `₹${((b.value || 0) / 100).toLocaleString("en-IN")}` : b.value}</b>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
