import { useEffect, useState } from "react";
import { getExamSessions, getExamSessionDetail, actionExamSession } from "../../api/admin_scholarship";

const STATUS_OPTIONS = ["", "in_progress", "submitted", "expired", "voided"];

const STATUS_BADGE = {
  in_progress: { bg: "#eff6ff", fg: "#1e40af", label: "In progress" },
  submitted: { bg: "#dcfce7", fg: "#166534", label: "Submitted" },
  expired: { bg: "#f1f5f9", fg: "#475569", label: "Expired" },
  voided: { bg: "#fef2f2", fg: "#991b1b", label: "Voided" },
};
function Badge({ status }) {
  const meta = STATUS_BADGE[status] || STATUS_BADGE.in_progress;
  return <span style={{ background: meta.bg, color: meta.fg, padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{meta.label}</span>;
}

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }) : "—";

function SessionDetailModal({ sessionId, onClose, onActed }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getExamSessionDetail(sessionId).then((d) => { if (alive) setDetail(d); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sessionId]);

  const act = async (action) => {
    setBusy(true);
    try {
      const updated = await actionExamSession(sessionId, action, notes.trim());
      onActed(updated);
      onClose();
    } catch (e) {
      alert(e.response?.data?.detail || "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ap-modal-overlay" onClick={onClose}>
      <div className="ap-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        {loading || !detail ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading…</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>{detail.learner_name}</h2>
                <div style={{ color: "#6b7280", marginTop: 4, fontSize: 13 }}>{detail.course_title}</div>
              </div>
              <div style={{ marginLeft: "auto" }}><Badge status={detail.status} /></div>
            </div>

            <div className="ap-detail-grid" style={{ marginTop: 16 }}>
              <div><span>Score</span><b>{detail.score ?? "—"}</b></div>
              <div><span>Awarded</span><b>{detail.awarded_discount_pct != null ? `${detail.awarded_discount_pct}%` : "—"}</b></div>
              <div><span>Tab switches</span><b>{detail.tab_switch_count}</b></div>
              <div><span>Deadline</span><b>{formatDate(detail.deadline)}</b></div>
            </div>

            <h4 style={{ margin: "20px 0 10px" }}>
              {detail.cheat_signals?.length || 0} cheat signal{detail.cheat_signals?.length !== 1 ? "s" : ""}
            </h4>
            {!detail.cheat_signals?.length ? (
              <p style={{ color: "#9ca3af", fontSize: 13 }}>No signals recorded for this session.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                {detail.cheat_signals.map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, border: "1px solid #eef0f3", borderRadius: 8, padding: "8px 12px" }}>
                    <span style={{ textTransform: "capitalize" }}>{s.event_type.replace(/_/g, " ")}</span>
                    <span style={{ color: "#9ca3af" }}>{formatDate(s.created_at)}</span>
                  </div>
                ))}
              </div>
            )}

            {detail.review_notes && (
              <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px", marginTop: 14, fontSize: 13 }}>
                <strong>Previous review note:</strong> {detail.review_notes}
              </div>
            )}

            {!detail.review_status && (
              <div style={{ marginTop: 20 }}>
                <textarea
                  value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder="Review notes (optional for clear, shown internally for void)…"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d7dbe0", borderRadius: 8, fontFamily: "inherit", resize: "vertical", marginBottom: 12 }}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="approve-btn" onClick={() => act("clear")} disabled={busy}>{busy ? "…" : "Clear flag"}</button>
                  {!voiding ? (
                    <button className="reject-btn" onClick={() => setVoiding(true)} disabled={busy}>Void session & award</button>
                  ) : (
                    <button className="reject-btn" onClick={() => act("void")} disabled={busy || !notes.trim()}>
                      {busy ? "…" : "Confirm void"}
                    </button>
                  )}
                  <button onClick={onClose} style={{ marginLeft: "auto", padding: "8px 16px", cursor: "pointer" }}>Close</button>
                </div>
                {voiding && <p style={{ fontSize: 12, color: "#991b1b", marginTop: 8 }}>Voiding requires a note — it also voids any award this session produced.</p>}
              </div>
            )}
            {detail.review_status && (
              <div style={{ display: "flex", marginTop: 22 }}>
                <button onClick={onClose} style={{ marginLeft: "auto", padding: "8px 16px", cursor: "pointer" }}>Close</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SessionsTab() {
  const [flaggedOnly, setFlaggedOnly] = useState(true);
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);

  const load = () => {
    setLoading(true);
    getExamSessions({ flagged: flaggedOnly ? "true" : undefined, status: status || undefined })
      .then((d) => setRows(Array.isArray(d) ? d : d.results || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [flaggedOnly, status]);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600, fontSize: 13.5 }}>
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
          Flagged for review only
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: 8 }}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s ? s.replace("_", " ") : "All statuses"}</option>)}
        </select>
      </div>

      <div className="dashboard-card courses-table-card">
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">{flaggedOnly ? "No flagged sessions." : "No sessions match these filters."}</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>Student</th><th>Course</th><th>Score</th><th>Tab switches</th><th>Status</th><th aria-label="actions" /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="courses-title">{r.learner_name}</td>
                  <td>{r.course_title}</td>
                  <td>{r.score ?? "—"}</td>
                  <td>{r.tab_switch_count > 0 ? <span style={{ color: "#b45309", fontWeight: 700 }}>{r.tab_switch_count}</span> : 0}</td>
                  <td><Badge status={r.status} /></td>
                  <td className="cm-actions">
                    <button className="cm-icon-btn" onClick={() => setDetailId(r.id)}>Review</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detailId && (
        <SessionDetailModal
          sessionId={detailId}
          onClose={() => setDetailId(null)}
          onActed={(updated) => setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))}
        />
      )}
    </div>
  );
}
