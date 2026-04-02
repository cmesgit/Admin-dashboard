import { useEffect, useState } from "react";
import {
  Users,
  BookOpen,
  GraduationCap,
  MessageSquare,
  IndianRupee,
  UserCheck,
} from "lucide-react";
import { getStats } from "../api/admin";
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

const Overview = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

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
              <p className="stat-value">
                {stats ? formatValue(stats[key], format) : "—"}
              </p>
              <p className="stat-label">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-cards" style={{ marginTop: 32 }}>
        <div className="dashboard-card empty">
          <h3>Recent Activity</h3>
          <p>Activity feed will appear here in a future update.</p>
        </div>
        <div className="dashboard-card empty">
          <h3>Quick Actions</h3>
          <p>Manage users, approve teachers, and moderate content from the sidebar.</p>
        </div>
      </div>
    </div>
  );
};

export default Overview;
