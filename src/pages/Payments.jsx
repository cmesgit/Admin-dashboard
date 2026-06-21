import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPayments, getPaymentConfig } from "../api/admin";
import StatusBadge from "../components/StatusBadge";
import "../css/Payments.css";

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const formatAmount = (paise) =>
  paise === null || paise === undefined ? "—" : `₹${(paise / 100).toLocaleString("en-IN")}`;
const statusColor = { PAID: "green", FAILED: "red", CREATED: "yellow" };

const Payments = () => {
  const [config, setConfig] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => { getPaymentConfig().then(setConfig); }, []);

  // Only fetch gateway orders when a money-collecting gateway is active.
  const gatewayLive = config && config.collects_money && config.provider !== "manual_upi";

  useEffect(() => {
    if (!config) return;
    if (!gatewayLive) { setOrders([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const baseParams = filter ? { status: filter } : {};
      const all = [];
      try {
        let page = 1;
        const pageSize = 100;
        while (true) {
          const data = await getPayments({ ...baseParams, page, page_size: pageSize });
          const results = data.results || [];
          all.push(...results);
          const count = typeof data.count === "number" ? data.count : all.length;
          if (results.length < pageSize || all.length >= count) break;
          page += 1;
        }
        if (!cancelled) setOrders(all);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [config, gatewayLive, filter]);

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Payments</h1>

      {/* Current payment mode */}
      <div className="dashboard-card pay-mode-card">
        <div>
          <p className="pay-mode-label">Active payment mode</p>
          <p className="pay-mode-value">{config ? config.label : "…"}</p>
        </div>
        <StatusBadge color={config?.collects_money ? "green" : "gray"}>
          {config?.collects_money ? "Collecting money" : "No charge"}
        </StatusBadge>
      </div>

      {/* Free mode */}
      {config && config.is_free && (
        <div className="dashboard-card">
          <h3 style={{ marginTop: 0 }}>The platform is free right now</h3>
          <p style={{ color: "#555", lineHeight: 1.6 }}>
            No gateway is collecting money. Enrollments are granted instantly.
            To start charging, set <code>PAYMENT_PROVIDER</code> to{" "}
            <code>manual_upi</code> (UPI + admin approval) or <code>razorpay</code> (gateway).
          </p>
        </div>
      )}

      {/* Manual UPI mode → the "payments" are enrollment requests */}
      {config && config.provider === "manual_upi" && (
        <div className="dashboard-card">
          <h3 style={{ marginTop: 0 }}>Manual UPI</h3>
          <p style={{ color: "#555", lineHeight: 1.6 }}>
            Students pay by UPI and upload a receipt. Verify the UTR and amount, then
            approve from <Link to="/enrollment-requests">Enrollment Requests</Link>.
          </p>
        </div>
      )}

      {/* Gateway mode → real orders */}
      {gatewayLive && (
        <>
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
            {loading ? (
              <div className="dashboard-loading">Loading...</div>
            ) : orders.length === 0 ? (
              <div className="dashboard-loading">No orders found.</div>
            ) : (
              <table className="payments-table">
                <thead>
                  <tr><th>User</th><th>Course</th><th>Amount</th><th>Status</th><th>Date</th></tr>
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
                      <td><StatusBadge color={statusColor[o.status]}>{o.status}</StatusBadge></td>
                      <td>{formatDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Payments;
