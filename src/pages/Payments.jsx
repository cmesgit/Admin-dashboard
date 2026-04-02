import { useState } from "react";
import { mockOrders } from "../data/mockData";
import StatusBadge from "../components/StatusBadge";
import "../css/Payments.css";

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const formatAmount = (paise) => `₹${(paise / 100).toLocaleString("en-IN")}`;

const statusColor = { PAID: "green", FAILED: "red", CREATED: "yellow" };

const Payments = () => {
  const [filter, setFilter] = useState("");

  const orders = filter
    ? mockOrders.filter((o) => o.status === filter)
    : mockOrders;

  const totalPaid = mockOrders
    .filter((o) => o.status === "PAID")
    .reduce((sum, o) => sum + o.amount, 0);

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Payments</h1>

      <div className="dashboard-cards" style={{ marginBottom: 24 }}>
        <div className="dashboard-card">
          <p className="stat-value">{formatAmount(totalPaid)}</p>
          <p className="stat-label">Total Revenue</p>
        </div>
        <div className="dashboard-card">
          <p className="stat-value">{mockOrders.filter((o) => o.status === "PAID").length}</p>
          <p className="stat-label">Paid Orders</p>
        </div>
        <div className="dashboard-card">
          <p className="stat-value">{mockOrders.filter((o) => o.status === "CREATED").length}</p>
          <p className="stat-label">Pending Orders</p>
        </div>
      </div>

      <div className="payments-controls">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="PAID">Paid</option>
          <option value="CREATED">Pending</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      <div className="dashboard-card payments-table-card">
        <div className="payments-count">{orders.length} order{orders.length !== 1 ? "s" : ""}</div>
        <table className="payments-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Course</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <div className="payments-user">{o.user_name}</div>
                  <div className="payments-email">{o.user_email}</div>
                </td>
                <td>{o.course_title}</td>
                <td className="payments-amount">{formatAmount(o.amount)}</td>
                <td>
                  <StatusBadge color={statusColor[o.status]}>{o.status}</StatusBadge>
                </td>
                <td>{formatDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Payments;
