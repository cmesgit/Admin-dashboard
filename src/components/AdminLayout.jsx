import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ShieldCheck,
  UserCheck,
  CreditCard,
  FileCheck,
  ClipboardList,
  Settings,
  GraduationCap,
  BookCheck,
  ListChecks,
  Megaphone,
  FileText,
  Users2,
  CalendarClock,
  CalendarCheck2,
  LogOut,
  Flag,
  Send,
  LifeBuoy,
} from "lucide-react";
import "../css/AdminLayout.css";

// The old "Forum" nav entry (a bare thread list + delete) is superseded by
// the Moderator Panel, which folds that same capability into an "All
// Threads" tab alongside reports/auto-rejected/users/analytics.
const fullNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Overview", end: true },
  { to: "/users", icon: Users, label: "Users" },
  { to: "/courses", icon: BookOpen, label: "Courses" },
  { to: "/quizzes", icon: ListChecks, label: "Academy Quizzes" },
  { to: "/moderator", icon: ShieldCheck, label: "Moderator Panel" },
  { to: "/communication/reports", icon: Flag, label: "Chat Reports" },
  { to: "/communication/support", icon: LifeBuoy, label: "Support Tickets" },
  { to: "/communication/broadcast", icon: Send, label: "Broadcast" },
  { to: "/approvals", icon: UserCheck, label: "Approvals" },
  { to: "/enrollment-requests", icon: FileCheck, label: "Enrollments" },
  { to: "/enrollments", icon: ClipboardList, label: "Enrollment Mgmt" },
  { to: "/payments", icon: CreditCard, label: "Payments" },
  { to: "/payment-settings", icon: Settings, label: "Payment Settings" },
  // "Skill Approvals" removed from nav per admin spec (screening handled elsewhere).
  // Counselling has no other queue, so — unlike Skill Approvals — it stays visible.
  { to: "/counselor-approvals", icon: GraduationCap, label: "Counsellor Approvals" },
  { to: "/counseling-sessions", icon: CalendarCheck2, label: "Counselling Sessions" },
  { to: "/skill-experts", icon: Users2, label: "Skill Experts" },
  { to: "/skill-sessions", icon: CalendarClock, label: "Sessions" },
  { to: "/skill-courses", icon: BookCheck, label: "Skill Courses" },
  { to: "/ad-subscriptions", icon: Megaphone, label: "Ad Subscriptions" },
  { to: "/agreement-letter", icon: FileText, label: "Agreement Letter" },
];

// A moderator-only user (no ADMIN role) gets just the Moderator Panel —
// everything else (Users, Payments, Courses, ...) is admin-only territory.
const moderatorOnlyNavItems = [
  { to: "/moderator", icon: ShieldCheck, label: "Moderator Panel", end: true },
];

const AdminLayout = () => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const navItems = hasRole("ADMIN") ? fullNavItems : moderatorOnlyNavItems;

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <h2>ShikshaCom</h2>
          <span>{hasRole("ADMIN") ? "Admin Panel" : "Moderator Panel"}</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `sidebar-link${isActive ? " active" : ""}`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span>{user?.email}</span>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
