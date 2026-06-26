// src/pages/AdSubscriptions.jsx  (NEW)
//
// Admin page for the Skill-Dev expert advertising subscriptions (manual UPI).
//   GET  /skill/admin/ad-subscriptions/                  → submitted/pending queue
//   POST /skill/admin/ad-subscriptions/<id>/approve/     → activate the ad period
//   POST /skill/admin/ad-subscriptions/<id>/reject/      → send back to pending
//
// A teacher submits a UPI payment under "Promote my profile"; the receipt +
// reference show here so an admin can verify and approve (which advertises the
// expert across the marketplace) or reject with a reason.
//
// Matches the existing admin style (dashboard-wrapper / dashboard-card / tables).

import { useEffect, useState } from "react";
import {
  getAdSubscriptions,
  approveAdSubscription,
  rejectAdSubscription,
} from "../api/admin";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return iso; }
};

const AdSubscriptions = () => {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState(null);
  const [reject, setReject]   = useState(null);   // row pending rejection
  const [reason, setReason]   = useState("");
  const [err, setErr]         = useState("");
  const [msg, setMsg]         = useState("");

  const load = async () => {
    setLoading(true); setErr("");
    try { setRows(await getAdSubscriptions()); }
    catch { setErr("Failed to load subscriptions."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const approve = async (row) => {
    setBusyId(row.id); setErr(""); setMsg("");
    try {
      await approveAdSubscription(row.id);
      setMsg(`Approved — ${row.expert_name} is now advertised.`);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not approve.");
    } finally { setBusyId(null); }
  };

  const doReject = async () => {
    if (!reject) return;
    setBusyId(reject.id); setErr(""); setMsg("");
    try {
      await rejectAdSubscription(reject.id, reason);
      setMsg(`Sent back to pending — ${reject.expert_name}.`);
      setReject(null); setReason("");
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not reject.");
    } finally { setBusyId(null); }
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Ad Subscriptions</h1>

      {msg && <div style={{ color: "#16a34a", margin: "0 0 12px" }}>{msg}</div>}
      {err && <div style={{ color: "#dc2626", margin: "0 0 12px" }}>{err}</div>}

      <div className="dashboard-card payments-table-card">
        <div className="payments-count">
          {rows.length} awaiting review
        </div>
        {loading ? (
          <div className="dashboard-loading">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No subscriptions awaiting review.</div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th>Expert</th><th>Amount</th><th>UPI ref</th>
                <th>Payer VPA</th><th>Receipt</th><th>Status</th>
                <th>Submitted</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.expert_name}</td>
                  <td>₹{r.amount_rupees?.toLocaleString("en-IN")}</td>
                  <td>{r.upi_reference || "—"}</td>
                  <td>{r.payer_vpa || "—"}</td>
                  <td>
                    {r.receipt
                      ? <a href={r.receipt} target="_blank" rel="noreferrer">View</a>
                      : "—"}
                  </td>
                  <td style={{ textTransform: "capitalize" }}>{r.status}</td>
                  <td>{fmtDate(r.created_at)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => approve(r)} disabled={busyId === r.id}
                      style={{ padding: "6px 12px", cursor: "pointer", marginRight: 6,
                               background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600 }}>
                      {busyId === r.id ? "…" : "Approve"}
                    </button>
                    <button onClick={() => { setReject(r); setReason(""); setErr(""); setMsg(""); }}
                      disabled={busyId === r.id}
                      style={{ padding: "6px 12px", cursor: "pointer",
                               background: "#fff", color: "#dc2626", border: "1px solid #dc2626", borderRadius: 6, fontWeight: 600 }}>
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject modal */}
      {reject && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
        }} onClick={() => setReject(null)}>
          <div className="dashboard-card" style={{ width: 440, padding: 24 }}
               onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Reject — {reject.expert_name}</h2>
            <p style={{ color: "#666", marginTop: -6 }}>
              This sends the subscription back to pending so the expert can re-submit. Add a reason (optional).
            </p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)}
              rows={3} placeholder="e.g. Receipt unreadable / reference not found"
              style={{ width: "100%", padding: 8 }} />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={doReject} disabled={busyId === reject.id}
                style={{ padding: "10px 18px", fontWeight: 600, cursor: "pointer",
                         background: "#dc2626", color: "#fff", border: "none", borderRadius: 6 }}>
                {busyId === reject.id ? "Rejecting..." : "Confirm reject"}
              </button>
              <button onClick={() => setReject(null)}
                style={{ padding: "10px 18px", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdSubscriptions;
