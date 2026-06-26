import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  BookOpen,
  GraduationCap,
  MessageSquare,
  IndianRupee,
  UserCheck,
} from "lucide-react";
import {
  getStats,
  getApprovals,
  getSkillApplications,
  getAdSubscriptions,
  getEnrollmentRequests,
  getSkillSessions,
} from "../api/admin";
import "../css/Overview.css";

const cardDefs = [
  { key: "total_users", label: "Total Users", icon: Users, color: "#4f6df5" },
  { key: "active_courses", label: "Active Courses", icon: BookOpen, color: "#2f9d42" },
  { key: "active_enrollments", label: "Enrollments", icon: GraduationCap, color: "#e67e22" },
  { key: "forum_posts", label: "Forum Posts", icon: MessageSquare, color: "#9b59b6" },
  { key: "total_revenue", label: "Revenue", icon: IndianRupee, color: "#1abc9c", format: "currency" },
  { key: "pending_approvals", label: "Pending Approvals", icon: UserCheck, color: "#e74c3c" },
];

const formatValue = (val, format) => {
  if (val === null || val === undefined) return "—";
  if (format === "currency") return `₹${(val / 100).toLocaleString("en-IN")}`;
  return val.toLocaleString("en-IN");
};

const len = (r) => (Array.isArray(r) ? r.length : (r?.results?.length ?? r?.sessions?.length ?? 0));

const fmt = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }
  catch { return iso; }
};

const Overview = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState(null);   // needs-attention counts
  const [recent, setRecent] = useState([]);   // recent sessions

  useEffect(() => {
    getStats().then(setStats).catch(() => setStats(null)).finally(() => setLoading(false));

    // "What needs action" + recent activity — composed from existing endpoints,
    // each guarded so one failure never blanks the dashboard.
    Promise.allSettled([
      getApprovals(),
      getSkillApplications(),
      getAdSubscriptions(),
      getEnrollmentRequests(),
      getSkillSessions(),
    ]).then(([appr, skApps, adSubs, enr, sess]) => {
      const v = (r) => (r.status === "fulfilled" ? r.value : []);
      setQueue({
        approvals:    len(v(appr)),
        skillApps:    len(v(skApps)),
        adSubs:       len(v(adSubs)),
        enrollments:  len(v(enr)),
      });
      const s = v(sess);
      setRecent((s.sessions || []).slice(0, 6));
    });
  }, []);

  const attention = queue ? [
    { label: "Teacher approvals",   n: queue.approvals,   to: "/approvals" },
    { label: "Skill applications",  n: queue.skillApps,   to: "/skill-approvals" },
    { label: "Ad subscriptions",    n: queue.adSubs,      to: "/ad-subscriptions" },
    { label: "Enrollment requests", n: queue.enrollments, to: "/enrollment-requests" },
  ] : [];

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Dashboard Overview</h1>

      {loading ? (
        <div className="dashboard-loading">Loading stats...</div>
      ) : (
        <div className="dashboard-cards">
          {cardDefs.map(({ key, label, icon: Icon, color, format }) => (
            <div key={key} className="dashboard-card">
              <div className="stat-icon" style={{ backgroundColor: `${color}15` }}>
                <Icon size={28} color={color} />
              </div>
              <p className="stat-value">{stats ? formatValue(stats[key], format) : "—"}</p>
              <p className="stat-label">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-cards" style={{ marginTop: 32, gridTemplateColumns: "1fr 1fr" }}>
        {/* Needs attention queue */}
        <div className="dashboard-card empty" style={{ alignItems: "stretch", textAlign: "left" }}>
          <h3 style={{ marginTop: 0 }}>Needs attention</h3>
          {!queue ? (
            <p>Loading…</p>
          ) : attention.every((a) => a.n === 0) ? (
            <p>All clear — nothing waiting for review.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {attention.map((a) => (
                <Link key={a.to} to={a.to}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                           padding: "9px 12px", borderRadius: 8, textDecoration: "none",
                           background: a.n > 0 ? "#fff7ed" : "#f8fafc",
                           border: `1px solid ${a.n > 0 ? "#fed7aa" : "#eef0f3"}`, color: "#1f2937" }}>
                  <span>{a.label}</span>
                  <span style={{ fontWeight: 800, color: a.n > 0 ? "#b45309" : "#9ca3af" }}>{a.n}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Payment mode */}
        <div className="dashboard-card empty" style={{ alignItems: "stretch", textAlign: "left" }}>
          <h3 style={{ marginTop: 0 }}>Payment mode</h3>
          <p>
            {stats
              ? ({
                  free: "Free — no payment is collected. Enrollments are instant.",
                  manual_upi: "Manual UPI — students upload a receipt; approve under Enrollments.",
                  razorpay: "Razorpay gateway is active.",
                }[stats.payment_provider] || stats.payment_provider || "Free")
              : "—"}
          </p>
          <Link to="/payment-settings" style={{ marginTop: 8, color: "#4f6df5", fontWeight: 600, textDecoration: "none" }}>
            Manage payment settings →
          </Link>
        </div>
      </div>

      {/* Recent sessions history */}
      <div className="dashboard-card payments-table-card" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Recent sessions</h3>
          <Link to="/skill-sessions" style={{ color: "#4f6df5", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="ud-empty" style={{ color: "#6b7280" }}>No sessions yet.</p>
        ) : (
          <table className="payments-table">
            <thead>
              <tr><th>Learner</th><th>Expert</th><th>Status</th><th>Booked</th></tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id}>
                  <td>{s.learner}</td>
                  <td>{s.expert}</td>
                  <td style={{ textTransform: "capitalize" }}>
                    {s.status === "requested" ? "pending" : s.status}
                  </td>
                  <td>{fmt(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Overview;
