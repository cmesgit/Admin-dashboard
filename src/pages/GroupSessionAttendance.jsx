// src/pages/GroupSessionAttendance.jsx  (NEW)
//
// Group Session attendance monitor — the data (GroupSessionAttendance /
// GroupSessionAttendanceInterval, populated by the same LiveKit webhook
// livestream already uses) has existed since group sessions shipped; this
// is the first admin UI to actually surface it.
//   GET /sessions/admin/group-sessions/  → { sessions: [...] }

import { useEffect, useState } from "react";
import { getGroupSessionAttendance } from "../api/admin";

const fmt = (val) => {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleString("en-IN", {
      day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    });
  } catch { return val; }
};

const fmtMins = (secs) => {
  const m = Math.round((secs || 0) / 60);
  return m > 0 ? `${m}m` : "<1m";
};

const STATUS_COLOR = {
  live: "#16a34a",
  scheduled: "#0a808a",
  completed: "#6b7280",
  cancelled: "#dc2626",
};

const GroupSessionAttendance = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    getGroupSessionAttendance()
      .then((d) => setSessions(d.sessions || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Group Session Attendance</h1>
      <p className="content-subtitle">
        Real per-participant join/leave/watch-time, captured from LiveKit — expand a session
        to see who actually attended and for how long.
      </p>

      <div className="dashboard-card payments-table-card">
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="dashboard-loading">No group sessions yet.</div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th>Topic</th><th>Host</th><th>Type</th><th>Status</th>
                <th>Scheduled</th><th>Attendees</th><th aria-label="expand" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <>
                  <tr key={s.id}>
                    <td>{s.topic}</td>
                    <td>{s.host || "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{s.session_type}</td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 100,
                        textTransform: "capitalize",
                        background: `${STATUS_COLOR[s.status] || "#9ca3af"}22`,
                        color: STATUS_COLOR[s.status] || "#6b7280",
                      }}>
                        {s.status}
                      </span>
                    </td>
                    <td>{s.scheduled_date ? `${s.scheduled_date} ${s.scheduled_time || ""}` : "—"}</td>
                    <td>{s.attendance.length}</td>
                    <td>
                      {s.attendance.length > 0 && (
                        <button
                          className="cm-icon-btn"
                          onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                        >
                          {expanded === s.id ? "Hide" : "View"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === s.id && (
                    <tr key={`${s.id}-detail`}>
                      <td colSpan={7} style={{ background: "#fafafa", padding: "10px 16px" }}>
                        <table style={{ width: "100%" }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: "left", fontSize: 11, color: "#6b7280" }}>Participant</th>
                              <th style={{ textAlign: "left", fontSize: 11, color: "#6b7280" }}>Joined</th>
                              <th style={{ textAlign: "left", fontSize: 11, color: "#6b7280" }}>Left</th>
                              <th style={{ textAlign: "left", fontSize: 11, color: "#6b7280" }}>Watch time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.attendance.map((a) => (
                              <tr key={a.user_id}>
                                <td>{a.name}</td>
                                <td>{fmt(a.joined_at)}</td>
                                <td>{a.left_at ? fmt(a.left_at) : "still in room"}</td>
                                <td>{fmtMins(a.total_seconds)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default GroupSessionAttendance;
