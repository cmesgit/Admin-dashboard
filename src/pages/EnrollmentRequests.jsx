import { useEffect, useState } from "react";
import { getEnrollmentRequests, actOnEnrollmentRequest, getPaymentConfig, getCourseBatches } from "../api/admin";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";
import "../css/EnrollmentRequests.css";

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const formatAmount = (paise) =>
  paise === null || paise === undefined ? "—" : `₹${(paise / 100).toLocaleString("en-IN")}`;

const statusColor = { PENDING: "yellow", APPROVED: "green", REJECTED: "red" };

/* ── Approve modal with an optional batch picker ──────────────────────
   Reuses the ConfirmModal overlay classes (.confirm-*), adding a batch
   <select>. Full/closed batches are shown but disabled. Approving with a
   chosen batch fills Enrollment.batch (capacity enforced server-side). */
function ApproveModal({ req, onClose, onApproved }) {
  const [batches, setBatches] = useState([]);
  // Pre-select whatever the student asked for at request time (see
  // EnrollmentRequestCreateSerializer's `batch` field) — approving with this
  // untouched honors their choice, matching what the backend now defaults to
  // anyway (AdminActionSerializer.validate) when `batch` is left unset.
  const [batchId, setBatchId] = useState(req.requested_batch_id || "");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!req.course_id) { setLoading(false); return; }
      const b = await getCourseBatches(req.course_id);
      if (!cancel) { setBatches(Array.isArray(b) ? b : []); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [req.course_id]);

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      await actOnEnrollmentRequest(req.id, "approve", "", batchId || undefined);
      onApproved(req.id);
    } catch (e) {
      const d = e?.response?.data;
      setErr(d?.batch || d?.detail || "Couldn't approve. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onClose}>
      <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
        <h3>Approve enrollment?</h3>
        <p>
          Approve {req.user_name}’s enrollment in {req.course_title} for {formatAmount(req.amount_paid)}?
        </p>

        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#4b5563", marginBottom: 6 }}>
          Place in batch (optional)
        </label>
        {req.requested_batch_name && (
          <p style={{ fontSize: "0.82rem", color: "#374151", marginTop: -2, marginBottom: 8 }}>
            Student requested <strong>{req.requested_batch_name}</strong> — pre-selected below.
          </p>
        )}

        {loading ? (
          <div style={{ fontSize: "0.85rem", color: "#888", marginBottom: 16 }}>Loading batches…</div>
        ) : batches.length === 0 ? (
          <div style={{ fontSize: "0.82rem", color: "#888", marginBottom: 16 }}>
            No batches for this course yet. You can approve without one and assign later.
          </div>
        ) : (
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            disabled={busy}
            style={{ width: "100%", padding: "9px 11px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.9rem", marginBottom: 16, background: "#fff", boxSizing: "border-box" }}
          >
            <option value="">
              {req.requested_batch_name ? "Don't place in a batch" : "No batch (assign later)"}
            </option>
            {batches.map((b) => {
              const seats = `${b.seats_taken}${b.capacity != null ? `/${b.capacity}` : ""}`;
              const flags = `${b.is_full ? " · full" : ""}${!b.is_active ? " · closed" : ""}`;
              return (
                <option key={b.id} value={b.id} disabled={b.is_full || !b.is_active}>
                  {`${b.name} (${b.code}) — ${seats}${flags}`}
                </option>
              );
            })}
          </select>
        )}

        {err && (
          <div style={{ background: "#fdecec", border: "1px solid #f5c2c2", color: "#b91c1c", padding: "9px 12px", borderRadius: 8, fontSize: "0.84rem", marginBottom: 16 }}>
            {err}
          </div>
        )}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="confirm-ok" onClick={submit} disabled={busy}>
            {busy ? "Approving…" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

const EnrollmentRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [previewReceipt, setPreviewReceipt] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [approveReq, setApproveReq] = useState(null);
  const [config, setConfig] = useState(null);

  useEffect(() => { getPaymentConfig().then(setConfig); }, []);

  const fetchRequests = () => {
    setLoading(true);
    const params = statusFilter ? { status: statusFilter } : {};
    getEnrollmentRequests(params)
      .then((data) => setRequests(data.results || []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  };

  useEffect(fetchRequests, [statusFilter]);

  const handleApprove = (req) => setApproveReq(req);

  const handleReject = (req) => {
    let noteRef = { current: "" };
    setConfirm({
      title: "Reject enrollment?",
      message: `Reject ${req.user_name}'s request for ${req.course_title}?`,
      extra: (
        <textarea
          className="er-reject-note"
          placeholder="Reason (shown to student)"
          onChange={(e) => { noteRef.current = e.target.value; }}
        />
      ),
      onConfirm: async () => {
        try {
          await actOnEnrollmentRequest(req.id, "reject", noteRef.current);
          setRequests((prev) => prev.filter((r) => r.id !== req.id));
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Enrollment Requests</h1>

      {config && (
        <div className="er-mode-banner">
          {config.is_free
            ? "Free mode: new enrollments are granted instantly. This list shows any manual requests still on file."
            : config.provider === "manual_upi"
              ? "Manual UPI: check the UTR (the bank's unique reference number for the transfer, printed on the payment receipt) and amount against the receipt before approving."
              : `Payment mode: ${config.label}.`}
        </div>
      )}

      <div className="er-controls">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All</option>
        </select>
      </div>

      <div className="dashboard-card er-table-card">
        <div className="er-count">
          {requests.length} request{requests.length !== 1 ? "s" : ""}
        </div>

        {loading ? (
          <div className="er-empty">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="er-empty">No requests.</div>
        ) : (
          <table className="er-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Amount</th>
                <th title="UTR — the bank's unique reference number for the transfer, printed on the payment receipt">UTR</th>
                <th>Paid On</th>
                <th>Receipt</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const mismatch = r.course_price && r.amount_paid !== r.course_price;
                const isPending = r.status === "PENDING";
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="er-user-name">{r.user_name}</div>
                      <div className="er-user-email">{r.user_email}</div>
                    </td>
                    <td>
                      <div>{r.course_title}</div>
                      {r.course_price ? (
                        <div className="er-user-email">Fee: {formatAmount(r.course_price)}</div>
                      ) : null}
                    </td>
                    <td className={`er-amount${mismatch ? " er-amount-mismatch" : ""}`}>
                      {formatAmount(r.amount_paid)}
                      {mismatch && <div className="er-user-email">⚠ mismatch</div>}
                    </td>
                    <td className="er-utr">{r.utr_number}</td>
                    <td>{formatDate(r.payment_date)}</td>
                    <td>
                      {r.receipt ? (
                        <img
                          src={r.receipt}
                          alt="receipt"
                          className="er-thumb"
                          onClick={() => setPreviewReceipt(r.receipt)}
                        />
                      ) : "—"}
                    </td>
                    <td>
                      <StatusBadge color={statusColor[r.status]}>{r.status}</StatusBadge>
                      {r.admin_note && <div className="er-note">{r.admin_note}</div>}
                    </td>
                    <td>
                      {isPending ? (
                        <div className="er-actions">
                          <button className="approve-btn" onClick={() => handleApprove(r)}>Approve</button>
                          <button className="reject-btn" onClick={() => handleReject(r)}>Reject</button>
                        </div>
                      ) : (
                        <span className="er-user-email">{formatDate(r.reviewed_at)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {previewReceipt && (
        <div className="er-receipt-modal" onClick={() => setPreviewReceipt(null)}>
          <button className="er-receipt-close" onClick={() => setPreviewReceipt(null)}>Close</button>
          <img src={previewReceipt} alt="receipt full" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {approveReq && (
        <ApproveModal
          req={approveReq}
          onClose={() => setApproveReq(null)}
          onApproved={(id) => {
            setRequests((prev) => prev.filter((r) => r.id !== id));
            setApproveReq(null);
          }}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          extra={confirm.extra}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default EnrollmentRequests;
