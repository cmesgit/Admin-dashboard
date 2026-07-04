// PLACEMENT: src/pages/CounselingSessions.jsx   (NEW FILE — admin app)
//
// Appointments oversight — read-only visibility for support/ops.
//   GET /counseling/admin/appointments/?status=&search=
//     → { results: [...], count, stats: {upcoming, completed, counselors} }

import { useEffect, useState } from "react";
import { getCounselingAppointments } from "../api/admin_counseling";

const STATUS_OPTIONS = [
  ["", "All statuses"], ["confirmed", "Confirmed"], ["completed", "Completed"],
  ["cancelled", "Cancelled"], ["no_show", "No-show"],
];

const STATUS_STYLE = {
  confirmed: { color: "#047857", background: "#d1fae5" },
  completed: { color: "#475569", background: "#f1f5f9" },
  cancelled: { color: "#b91c1c", background: "#fee2e2" },
  no_show:   { color: "#b91c1c", background: "#fee2e2" },
};

const fmtWhen = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });

const CounselingSessions = ({ embedded = false }) => {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ upcoming: 0, completed: 0, counselors: 0 });
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [detail, setDetail] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await getCounselingAppointments({ status: status || undefined, search: search || undefined });
      setRows(d.results || []);
      setStats(d.stats || { upcoming: 0, completed: 0, counselors: 0 });
    } catch { setErr("Failed to load sessions."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [status]);

  const onSearchKey = (e) => { if (e.key === "Enter") load(); };

  return (
    <div className={embedded ? "" : "dashboard-wrapper"}>
      {!embedded && <h1 className="dashboard-title">Counselling Sessions</h1>}

      <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
        <StatCard label="Upcoming" value={stats.upcoming} color="#4f6df5" />
        <StatCard label="Completed" value={stats.completed} color="#047857" />
        <StatCard label="Active counsellors" value={stats.counselors} color="#425f7f" />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: 8 }}>
          {STATUS_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <input
          placeholder="Search counsellor, student, or booker email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onSearchKey}
          style={{ padding: 8, minWidth: 260, flex: 1 }}
        />
        <button onClick={load} style={{ padding: "8px 16px", cursor: "pointer" }}>Search</button>
      </div>

      {err && <div style={{ color: "#dc2626", marginBottom: 10, fontWeight: 600 }}>{err}</div>}

      <div className={embedded ? "" : "dashboard-card payments-table-card"}>
        <div className="payments-count">{rows.length} session{rows.length !== 1 ? "s" : ""} shown{rows.length === 200 ? " (capped at 200 — narrow your filters)" : ""}</div>
        {loading ? (
          <div className="dashboard-loading">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No sessions match.</div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th>When</th><th>Student</th><th>Counsellor</th>
                <th>Booked by</th><th>Status</th><th>Report</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{fmtWhen(a.scheduled_at)}</td>
                  <td>{a.learner?.display_name}</td>
                  <td>{a.counselor?.display_name}</td>
                  <td>{a.booked_by_email}</td>
                  <td>
                    <span style={{
                      ...STATUS_STYLE[a.status], padding: "3px 10px", borderRadius: 100,
                      fontSize: 11.5, fontWeight: 700, textTransform: "capitalize",
                    }}>
                      {a.status === "no_show" ? "No-show" : a.status}
                    </span>
                  </td>
                  <td>{a.has_report ? "Published" : "—"}</td>
                  <td>
                    <button onClick={() => setDetail(a)} style={{ padding: "6px 12px", cursor: "pointer" }}>
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Read-only detail modal — oversight, not moderation; no destructive actions here */}
      {detail && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
        }} onClick={() => setDetail(null)}>
          <div className="dashboard-card" style={{ width: 460, padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{detail.learner?.display_name} × {detail.counselor?.display_name}</h2>
            <p style={{ color: "#666", marginTop: -8 }}>{fmtWhen(detail.scheduled_at)} · {detail.duration_minutes} min</p>
            <Row label="Status" value={detail.status} />
            <Row label="Booked by" value={detail.booked_by_email} />
            {detail.student_note && <Row label="Booking note" value={detail.student_note} />}
            {detail.cancel_reason && <Row label="Cancel reason" value={detail.cancel_reason} />}
            <Row label="Assessment" value={detail.has_assessment ? (detail.assessment_submitted ? "Submitted" : "Draft") : "Not started"} />
            <Row label="Report" value={detail.has_report ? "Published" : "None"} />
            <div style={{ marginTop: 16 }}>
              <button onClick={() => setDetail(null)} style={{ padding: "10px 18px", cursor: "pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Row = ({ label, value }) => (
  <div style={{ display: "flex", gap: 10, fontSize: 13, margin: "6px 0" }}>
    <b style={{ minWidth: 110, color: "#64748b" }}>{label}</b>
    <span style={{ color: "#0f172a", textTransform: label === "Status" ? "capitalize" : "none" }}>{value}</span>
  </div>
);

const StatCard = ({ label, value, color }) => (
  <div className="dashboard-card" style={{ flex: 1, padding: "14px 18px" }}>
    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{label}</div>
  </div>
);

export default CounselingSessions;
