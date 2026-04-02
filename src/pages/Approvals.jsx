import { useState } from "react";
import { mockApprovals } from "../data/mockData";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";
import "../css/Approvals.css";

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const Approvals = () => {
  const [pending, setPending] = useState([...mockApprovals]);
  const [approved, setApproved] = useState([]);
  const [confirm, setConfirm] = useState(null);

  const handleApprove = (id) => {
    const item = pending.find((a) => a.id === id);
    setConfirm({
      title: "Approve Teacher?",
      message: `Approve ${item.user_name} as a teacher?`,
      onConfirm: () => {
        setPending((prev) => prev.filter((a) => a.id !== id));
        setApproved((prev) => [...prev, { ...item, status: "approved" }]);
        setConfirm(null);
      },
    });
  };

  const handleReject = (id) => {
    const item = pending.find((a) => a.id === id);
    setConfirm({
      title: "Reject Request?",
      message: `Reject teacher request from ${item.user_name}?`,
      onConfirm: () => {
        setPending((prev) => prev.filter((a) => a.id !== id));
        setConfirm(null);
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
        {pending.length === 0 ? (
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
                    <button className="approve-btn" onClick={() => handleApprove(a.id)}>
                      Approve
                    </button>
                    <button className="reject-btn" onClick={() => handleReject(a.id)}>
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {approved.length > 0 && (
        <div className="dashboard-card approvals-table-card" style={{ marginTop: 24 }}>
          <div className="approvals-count">{approved.length} recently approved</div>
          <table className="approvals-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {approved.map((a) => (
                <tr key={a.id}>
                  <td className="approvals-name">{a.user_name}</td>
                  <td>{a.user_email}</td>
                  <td><StatusBadge color="green">Approved</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
