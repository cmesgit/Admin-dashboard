import { useEffect, useState } from "react";
import { getGuardianVerifications, actionGuardianVerification } from "../../api/admin_scholarship";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
];

const METHOD_LABEL = {
  digilocker: "DigiLocker",
  aadhaar_otp: "Aadhaar OTP",
  aadhaar_offline: "Aadhaar (Offline e-KYC)",
  manual: "Manual document",
};

const STATUS_BADGE = {
  pending: { bg: "#fff4e0", fg: "#b45309", label: "Pending" },
  verified: { bg: "#dcfce7", fg: "#166534", label: "Verified" },
  rejected: { bg: "#fef2f2", fg: "#991b1b", label: "Rejected" },
};

function Badge({ status }) {
  const meta = STATUS_BADGE[status] || STATUS_BADGE.pending;
  return (
    <span style={{ background: meta.bg, color: meta.fg, padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
      {meta.label}
    </span>
  );
}

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

function ReviewRow({ record, onDecided }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    setBusy(true);
    try { onDecided(await actionGuardianVerification(record.id, "approve")); }
    catch (e) { alert(e.response?.data?.detail || "Failed to approve."); }
    finally { setBusy(false); }
  };
  const submitReject = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try { onDecided(await actionGuardianVerification(record.id, "reject", reason.trim())); }
    catch (e) { alert(e.response?.data?.detail || "Failed to reject."); }
    finally { setBusy(false); }
  };

  return (
    <tr>
      <td className="courses-title">{record.account_email}</td>
      <td>{METHOD_LABEL[record.method] || record.method}</td>
      <td>
        {record.manual_document ? (
          <a href={record.manual_document} target="_blank" rel="noopener noreferrer">View document</a>
        ) : "—"}
      </td>
      <td>{formatDate(record.created_at)}</td>
      <td><Badge status={record.status} /></td>
      <td className="cm-actions" style={{ minWidth: rejecting ? 280 : undefined }}>
        {record.status === "pending" && !rejecting && (
          <>
            <button className="cm-icon-btn" onClick={approve} disabled={busy}>{busy ? "…" : "Approve"}</button>
            <button className="cm-icon-btn cm-icon-btn--danger" onClick={() => setRejecting(true)} disabled={busy}>Reject</button>
          </>
        )}
        {record.status === "pending" && rejecting && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason shown to the parent"
              style={{ padding: 6, fontSize: 12.5, width: 160 }}
            />
            <button className="cm-icon-btn cm-icon-btn--danger" onClick={submitReject} disabled={busy || !reason.trim()}>Send</button>
            <button className="cm-icon-btn" onClick={() => setRejecting(false)} disabled={busy}>Cancel</button>
          </div>
        )}
        {record.status === "rejected" && record.rejection_reason && (
          <span style={{ fontSize: 12, color: "#991b1b" }}>{record.rejection_reason}</span>
        )}
      </td>
    </tr>
  );
}

export default function VerificationsTab() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getGuardianVerifications({ status: status || undefined })
      .then((d) => setRows(Array.isArray(d) ? d : d.results || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {STATUS_TABS.map((t) => (
          <button
            key={t.key || "all"}
            onClick={() => setStatus(t.key)}
            style={{
              padding: "8px 18px", borderRadius: 100, cursor: "pointer", fontWeight: 600, fontSize: 13,
              border: status === t.key ? "2px solid #4f6df5" : "1px solid #d7dbe0",
              background: status === t.key ? "#4f6df515" : "#fff",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="dashboard-card courses-table-card">
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No verifications in this status.</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>Parent/guardian</th><th>Method</th><th>Document</th><th>Submitted</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <ReviewRow
                  key={r.id}
                  record={r}
                  onDecided={(updated) => setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
