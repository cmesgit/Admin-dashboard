// Teachers — directory of teaching staff across Academy + Skill tracks.
// Search + track filter → teacher cards; click opens a detail drawer.
// Data: /courses/admin/teacher-directory/ + /courses/admin/teachers/<id>/
import { useEffect, useState } from "react";
import { Search, X, Clock, Star, Radio } from "lucide-react";
import { getTeacherDirectory, getTeacherDetail } from "../api/admin";
import "../css/NewScreens.css";

const TRACKS = [
  { key: "", label: "All tracks" },
  { key: "academy", label: "Academy" },
  { key: "skill", label: "Skill Dev" },
];

const initials = (name = "") =>
  name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase() || "?";

const rupees = (paise) => `₹${((paise || 0) / 100).toLocaleString("en-IN")}`;

const TrackChips = ({ tracks = [] }) => (
  <div className="ns-track-chips">
    {tracks.map((t) => (
      <span key={t} className={`ns-track-chip ${t}`}>{t === "academy" ? "Academy" : "Skill"}</span>
    ))}
  </div>
);

const TeacherDrawer = ({ userId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTeacherDetail(userId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="ns-drawer-overlay" onClick={onClose}>
      <div className="ns-drawer" onClick={(e) => e.stopPropagation()}>
        <button className="ns-drawer-x" onClick={onClose}><X size={18} /></button>
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : !data ? (
          <div className="dashboard-loading">Could not load teacher.</div>
        ) : (
          <>
            <div className="ns-drawer-head">
              <div className="ns-avatar lg">{initials(data.name)}</div>
              <div>
                <h2>{data.name}</h2>
                <div className="ns-muted">{data.email}</div>
                <TrackChips tracks={data.tracks} />
              </div>
            </div>

            <div className="ns-drawer-stats">
              <div><span>Weekly hours</span><b>{data.weekly_hours ?? 0}h</b></div>
              <div><span>Rating</span><b>{data.rating != null ? `★ ${data.rating}` : "—"}</b></div>
              <div><span>Class range</span><b>{data.class_range || "—"}</b></div>
              <div><span>Since</span><b>{data.since ? new Date(data.since).getFullYear() : "—"}</b></div>
            </div>

            {data.skill && (
              <div className="ns-drawer-section">
                <h3>Skill Development</h3>
                <div className="ns-kv"><span>Sessions</span><b>{data.skill.sessions_count}</b></div>
                <div className="ns-kv"><span>Earnings</span><b className="ns-teal">{rupees(data.skill.earnings)}</b></div>
                {data.skill.categories?.length > 0 && (
                  <div className="ns-tag-row">
                    {data.skill.categories.map((c) => <span key={c} className="ns-tag">{c}</span>)}
                  </div>
                )}
              </div>
            )}

            <div className="ns-drawer-section">
              <h3>Assignments ({data.assignments?.length || 0})</h3>
              {data.assignments?.length ? data.assignments.map((a, i) => (
                <div key={i} className="ns-assign-row">
                  <span>{a.subject}</span>
                  <span className="ns-muted">{a.batch_code || a.batch || "—"} · {a.role}</span>
                </div>
              )) : <p className="ns-muted">No active assignments.</p>}
            </div>

            <div className="ns-drawer-section">
              <h3>Recent activity</h3>
              {data.recent_activity?.length ? data.recent_activity.map((r, i) => (
                <div key={i} className="ns-feed-row">
                  <Radio size={14} className="ns-feed-icon live" />
                  <span className="ns-feed-text">{r.text}</span>
                  <span className="ns-muted">{r.when ? new Date(r.when).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}</span>
                </div>
              )) : <p className="ns-muted">No recent activity.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Teachers = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [track, setTrack] = useState("");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      getTeacherDirectory({ ...(q ? { q } : {}), ...(track ? { track } : {}) })
        .then((d) => setRows(d.data || []))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, track]);

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Teachers</h1>

      <div className="ns-controls">
        <div className="rec-search">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teachers…" />
        </div>
        <div className="ls-chips">
          {TRACKS.map((t) => (
            <button key={t.key} className={`ls-chip${track === t.key ? " active" : ""}`} onClick={() => setTrack(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="dashboard-loading">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="dashboard-card" style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>No teachers found.</div>
      ) : (
        <div className="ns-teacher-grid">
          {rows.map((t) => (
            <button key={t.user_id} className="ns-teacher-card" onClick={() => setOpenId(t.user_id)}>
              <div className="ns-teacher-top">
                <div className="ns-avatar">{initials(t.name)}</div>
                <div className="ns-teacher-id">
                  <div className="ns-teacher-name">{t.name}</div>
                  <div className="ns-muted">{t.class_range ? `Class ${t.class_range}` : "—"}</div>
                </div>
              </div>
              <div className="ns-teacher-subjects">{t.subjects?.slice(0, 3).join(", ") || "No subjects"}</div>
              <TrackChips tracks={t.tracks} />
              <div className="ns-teacher-meta">
                <span><Clock size={13} /> {t.weekly_hours ?? 0}h/wk</span>
                <span><Star size={13} /> {t.rating != null ? t.rating : "—"}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {openId && <TeacherDrawer userId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
};

export default Teachers;
