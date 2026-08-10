// Teacher Activity — unified academy-teaching + skill-session feed.
// KPIs + typed activity feed. Data: /activity/admin/teacher-activity/?range=
import { useEffect, useState } from "react";
import { Radio, BookCheck, Upload, ListChecks, CalendarClock } from "lucide-react";
import { getTeacherActivity } from "../api/admin";
import "../css/NewScreens.css";

const RANGES = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
];

const rupees = (paise) => `₹${((paise || 0) / 100).toLocaleString("en-IN")}`;

const TYPE_META = {
  live: { icon: Radio, color: "#4f6df5", label: "Live class" },
  coverage: { icon: BookCheck, color: "#2f9d42", label: "Coverage" },
  upload: { icon: Upload, color: "#9b59b6", label: "Upload" },
  quiz: { icon: ListChecks, color: "#e67e22", label: "Quiz" },
  skill: { icon: CalendarClock, color: "#0f766e", label: "Skill session" },
};

const fmt = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }
  catch { return iso; }
};

const TeacherActivity = () => {
  const [data, setData] = useState({ kpis: {}, feed: [] });
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7d");

  useEffect(() => {
    setLoading(true);
    getTeacherActivity(range)
      .then(setData)
      .catch(() => setData({ kpis: {}, feed: [] }))
      .finally(() => setLoading(false));
  }, [range]);

  const k = data.kpis || {};
  const kpiCards = [
    { label: "Live classes", value: k.live_classes ?? 0, color: "#4f6df5" },
    { label: "Chapters covered", value: k.chapters_covered ?? 0, color: "#2f9d42" },
    { label: "Skill sessions", value: k.skill_sessions ?? 0, sub: rupees(k.skill_amount), subColor: "#0f766e", color: "#1abc9c" },
    { label: "Content uploads", value: k.uploads ?? 0, color: "#9b59b6" },
    { label: "Quizzes created", value: k.quizzes ?? 0, color: "#e67e22" },
  ];

  return (
    <div className="dashboard-wrapper">
      <div className="ns-head-row">
        <h1 className="dashboard-title" style={{ marginBottom: 0 }}>Teacher Activity</h1>
        <div className="ls-chips">
          {RANGES.map((r) => (
            <button key={r.key} className={`ls-chip${range === r.key ? " active" : ""}`} onClick={() => setRange(r.key)}>{r.label}</button>
          ))}
        </div>
      </div>

      <div className="ns-kpi-row">
        {kpiCards.map((c) => (
          <div key={c.label} className="ns-kpi">
            <div className="ns-kpi-val" style={{ color: c.color }}>{c.value}</div>
            <div className="ns-kpi-label">{c.label}</div>
            {c.sub && <div className="ns-kpi-sub" style={{ color: c.subColor }}>{c.sub} commission</div>}
          </div>
        ))}
      </div>

      <div className="dashboard-card" style={{ textAlign: "left", marginTop: 8 }}>
        <h3 style={{ marginTop: 0 }}>Activity feed</h3>
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : data.feed.length === 0 ? (
          <p className="ns-muted">No activity in this period.</p>
        ) : (
          <div className="ns-feed">
            {data.feed.map((f, i) => {
              const m = TYPE_META[f.type] || TYPE_META.live;
              const Icon = m.icon;
              return (
                <div key={i} className="ns-feed-row">
                  <span className="ns-feed-icon" style={{ background: `${m.color}18`, color: m.color }}><Icon size={14} /></span>
                  <span className="ns-feed-text">
                    <b>{f.teacher}</b> — {f.text}
                  </span>
                  <span className="ns-muted">{fmt(f.when)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherActivity;
