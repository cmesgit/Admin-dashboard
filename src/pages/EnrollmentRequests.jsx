import { useEffect, useState } from "react";
import { getEnrollmentRequests, actOnEnrollmentRequest } from "../api/admin";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";
import "../css/EnrollmentRequests.css";

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const formatAmount = (paise) =>
  paise === null || paise === undefined ? "—" : `₹${(paise / 100).toLocaleString("en-IN")}`;

const statusColor = { PENDING: "yellow", APPROVED: "green", REJECTED: "red" };

const EnrollmentRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [previewReceipt, setPreviewReceipt] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const fetchRequests = () => {
    setLoading(true);
    const params = statusFilter ? { status: statusFilter } : {};
    getEnrollmentRequests(params)
      .then((data) => setRequests(data.results || []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  };

  useEffect(fetchRequests, [statusFilter]);

  const handleApprove = (req) => {
    setConfirm({
      title: "Approve enrollment?",
      message: `Approve ${req.user_name}'s enrollment in ${req.course_title} for ${formatAmount(req.amount_paid)}?`,
      onConfirm: async () => {
        try {
          await actOnEnrollmentRequest(req.id, "approve");
          setRequests((prev) => prev.filter((r) => r.id !== req.id));
        } finally {
          setConfirm(null);
        }
      },
    });
  };

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
                <th>UTR</th>
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
