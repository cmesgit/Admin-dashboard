import { useEffect, useState } from "react";
import { getApprovals, actOnApproval } from "../api/admin";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";
import "../css/Approvals.css";

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const Approvals = () => {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);

  const fetchPending = () => {
    setLoading(true);
    getApprovals()
      .then((data) => setPending(Array.isArray(data) ? data : []))
      .catch(() => setPending([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleAction = (item, action) => {
    const verb = action === "approve" ? "Approve" : "Reject";
    setConfirm({
      title: `${verb} ${action === "approve" ? "Teacher" : "Request"}?`,
      message: `${verb} teacher request from ${item.user_name}?`,
      onConfirm: async () => {
        try {
          await actOnApproval(item.id, action);
          setPending((prev) => prev.filter((a) => a.id !== item.id));
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Teacher Approvals</h1>

      <div className="dashboard-card approvals-table-card">
        <div className="approvals-count">
          {pending.length} pending request{pending.length !== 1 ? "s" : ""}
        </div>
        {loading ? (
          <div className="approvals-empty">Loading...</div>
        ) : pending.length === 0 ? (
          <div className="approvals-empty">No pending approvals.</div>
        ) : (
          <table className="approvals-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Requested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((a) => (
                <tr key={a.id}>
                  <td className="approvals-name">{a.user_name}</td>
                  <td>{a.user_email}</td>
                  <td>{formatDate(a.requested_at)}</td>
                  <td className="approvals-actions">
                    <button className="approve-btn" onClick={() => handleAction(a, "approve")}>
                      Approve
                    </button>
                    <button className="reject-btn" onClick={() => handleAction(a, "reject")}>
                      Reject
                    </button>
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

export default Approvals;
