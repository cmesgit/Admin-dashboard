// src/pages/EnrollmentManagement.jsx
//
// Central management of academic course enrollments.
//   GET  /enrollments/admin/enrollments/?status=<ACTIVE|REVOKED>&q=<text>  → { results: [...] }
//   POST /enrollments/admin/enrollments/<id>/action/  { action: revoke|reactivate }

import { useEffect, useMemo, useState } from "react";
import { getEnrollments, actOnEnrollment } from "../api/admin";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";

const STATUSES = ["all", "ACTIVE", "REVOKED"];

const fmt = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return iso; }
};
const asList = (r) => (Array.isArray(r) ? r : r?.results || []);
const badgeColor = (s) => (s === "ACTIVE" ? "green" : "red");

const EnrollmentManagement = () => {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState("all");
  const [q, setQ]             = useState("");
  const [busyId, setBusyId]   = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [msg, setMsg]         = useState("");
  const [err, setErr]         = useState("");

  const load = () => {
    setLoading(true);
    getEnrollments(status === "all" ? undefined : { status })
      .then((r) => setRows(asList(r)))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((e) =>
      [e.course_title, e.user_name, e.user_email, e.batch_code]
        .filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [rows, q]);

  const act = (row, action) => {
    const verb = action === "revoke" ? "Revoke" : "Reactivate";
    setConfirm({
      title: `${verb} enrollment?`,
      message: `${verb} ${row.user_name || row.user_email || "this user"}'s enrollment in “${row.course_title || "course"}”?`,
      onConfirm: async () => {
        setBusyId(row.id); setMsg(""); setErr(""); setConfirm(null);
        try {
          await actOnEnrollment(row.id, action);
          setMsg(`Enrollment ${action === "revoke" ? "revoked" : "reactivated"}.`);
          load();
        } catch (e) {
          setErr(e?.response?.data?.detail || "Action failed.");
        } finally { setBusyId(null); }
      },
    });
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Enrollment Management</h1>

      {msg && <div style={{ color: "#16a34a", margin: "0 0 12px" }}>{msg}</div>}
      {err && <div style={{ color: "#dc2626", margin: "0 0 12px" }}>{err}</div>}

      <div className="dashboard-card payments-table-card">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search course, student, batch…"
            style={{ flex: 1, minWidth: 220, padding: "8px 12px", border: "1px solid #d7dbe0", borderRadius: 8 }} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid #d7dbe0", borderRadius: 8 }}>
            {STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>)}
          </select>
          <span className="payments-count">{view.length}</span>
        </div>

        {loading ? (
          <div className="dashboard-loading">Loading...</div>
        ) : view.length === 0 ? (
          <div className="dashboard-loading">No enrollments.</div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th>Student</th><th>Course</th><th>Batch</th>
                <th>Status</th><th>Enrolled</th><th></th>
              </tr>
            </thead>
            <tbody>
              {view.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.user_name || "—"}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{e.user_email || ""}</div>
                  </td>
                  <td>{e.course_title || "—"}</td>
                  <td>{e.batch_code || "—"}</td>
                  <td><StatusBadge color={badgeColor(e.status)}>{e.status}</StatusBadge></td>
                  <td>{fmt(e.enrolled_at)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {e.status === "REVOKED" ? (
                      <button onClick={() => act(e, "reactivate")} disabled={busyId === e.id}
                        style={{ padding: "6px 12px", cursor: "pointer", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600 }}>
                        {busyId === e.id ? "…" : "Reactivate"}
                      </button>
                    ) : (
                      <button onClick={() => act(e, "revoke")} disabled={busyId === e.id}
                        style={{ padding: "6px 12px", cursor: "pointer", background: "#fff", color: "#dc2626", border: "1px solid #dc2626", borderRadius: 6, fontWeight: 600 }}>
                        {busyId === e.id ? "…" : "Revoke"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default EnrollmentManagement;
