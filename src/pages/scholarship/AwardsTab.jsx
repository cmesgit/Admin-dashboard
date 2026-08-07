import { useEffect, useState } from "react";
import { getScholarshipAwards, voidScholarshipAward } from "../../api/admin_scholarship";

const STATUS_OPTIONS = ["", "locked", "active", "redeemed", "expired", "voided"];
const STATUS_BADGE = {
  locked: { bg: "#f1f5f9", fg: "#475569", label: "Locked" },
  active: { bg: "#eff6ff", fg: "#1e40af", label: "Active" },
  redeemed: { bg: "#dcfce7", fg: "#166534", label: "Redeemed" },
  expired: { bg: "#fef3c7", fg: "#92400e", label: "Expired" },
  voided: { bg: "#fef2f2", fg: "#991b1b", label: "Voided" },
};
function Badge({ status }) {
  const meta = STATUS_BADGE[status] || STATUS_BADGE.locked;
  return <span style={{ background: meta.bg, color: meta.fg, padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{meta.label}</span>;
}
const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function VoidCell({ row, onVoided }) {
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (row.status === "voided") return <span style={{ fontSize: 12, color: "#991b1b" }}>{row.void_reason}</span>;
  if (row.status === "redeemed") return <span style={{ fontSize: 12, color: "#9ca3af" }}>Already redeemed</span>;
  if (!voiding) return <button className="cm-icon-btn cm-icon-btn--danger" onClick={() => setVoiding(true)}>Void</button>;

  const submit = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try { onVoided(await voidScholarshipAward(row.id, reason.trim())); }
    catch (e) { alert(e.response?.data?.detail || "Failed to void."); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" style={{ padding: 6, fontSize: 12.5, width: 140 }} />
      <button className="cm-icon-btn cm-icon-btn--danger" onClick={submit} disabled={busy || !reason.trim()}>Confirm</button>
      <button className="cm-icon-btn" onClick={() => setVoiding(false)} disabled={busy}>Cancel</button>
    </div>
  );
}

export default function AwardsTab() {
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getScholarshipAwards({ status: status || undefined })
      .then((d) => setRows(Array.isArray(d) ? d : d.results || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: 8 }}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}
        </select>
      </div>

      <div className="dashboard-card courses-table-card">
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No awards match this filter.</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>Student</th><th>Course</th><th>Discount</th><th>Academic year</th><th>Expires</th><th>Status</th><th aria-label="void" /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="courses-title">{r.learner_name}</td>
                  <td>{r.course_title}</td>
                  <td>{r.discount_pct}%</td>
                  <td>{r.academic_year}</td>
                  <td>{formatDate(r.expires_at)}</td>
                  <td><Badge status={r.status} /></td>
                  <td className="cm-actions">
                    <VoidCell row={r} onVoided={(updated) => setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
