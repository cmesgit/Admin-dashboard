// src/pages/SkillSessionsAdmin.jsx  (NEW)
//
// Platform-wide 1-on-1 session monitor — a friendly replacement for the raw
// Django-admin SkillSession list.
//   GET /skill/admin/sessions/?status=<status>  → { sessions:[...], counts:{...} }
//
// Read-only: every booking with learner, expert, status, schedule, and whether
// the class was started. Filter by status; status counts shown as chips.

import { useEffect, useState } from "react";
import { getSkillSessions } from "../api/admin";

const STATUSES = [
  { key: "",          label: "All" },
  { key: "requested", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_COLOR = {
  requested: "#b46a00",
  confirmed: "#0a808a",
  completed: "#16a34a",
  cancelled: "#dc2626",
};

const fmt = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
};

const SkillSessionsAdmin = () => {
  const [data, setData]       = useState({ sessions: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState("");

  const load = (st) => {
    setLoading(true);
    getSkillSessions(st ? { status: st } : undefined)
      .then(setData)
      .catch(() => setData({ sessions: [], counts: {} }))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(status); }, [status]);

  const { sessions, counts } = data;

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Sessions</h1>

      {/* Status count chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {STATUSES.map((s) => {
          const n = s.key ? (counts[s.key] || 0)
                          : Object.values(counts).reduce((a, b) => a + b, 0);
          const active = status === s.key;
          return (
            <button key={s.key || "all"} onClick={() => setStatus(s.key)}
              style={{
                padding: "7px 14px", borderRadius: 100, cursor: "pointer",
                border: active ? "2px solid #4f6df5" : "1px solid #d7dbe0",
                background: active ? "#4f6df515" : "#fff",
                fontWeight: 600, fontSize: 13,
              }}>
              {s.label} <span style={{ color: "#6b7280" }}>· {n}</span>
            </button>
          );
        })}
      </div>

      <div className="dashboard-card payments-table-card">
        {loading ? (
          <div className="dashboard-loading">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="dashboard-loading">No sessions{status ? ` with status “${status}”` : ""}.</div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th>Learner</th><th>Expert</th><th>Status</th>
                <th>Scheduled</th><th>Started</th><th>Duration</th><th>Booked</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.learner}</td>
                  <td>{s.expert}</td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 100,
                      textTransform: "capitalize",
                      background: `${STATUS_COLOR[s.status] || "#9ca3af"}22`,
                      color: STATUS_COLOR[s.status] || "#6b7280",
                    }}>
                      {s.status === "requested" ? "pending" : s.status}
                    </span>
                  </td>
                  <td>{fmt(s.scheduled_for)}</td>
                  <td>{s.started_at ? fmt(s.started_at) : "—"}</td>
                  <td>{s.duration_mins} min</td>
                  <td>{fmt(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SkillSessionsAdmin;
