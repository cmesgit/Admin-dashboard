import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  MessageSquare,
  UserCheck,
  CreditCard,
  FileCheck,
  LogOut,
} from "lucide-react";
import "../css/AdminLayout.css";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Overview", end: true },
  { to: "/users", icon: Users, label: "Users" },
  { to: "/courses", icon: BookOpen, label: "Courses" },
  { to: "/forum", icon: MessageSquare, label: "Forum" },
  { to: "/approvals", icon: UserCheck, label: "Approvals" },
  { to: "/enrollment-requests", icon: FileCheck, label: "Enrollments" },
  { to: "/payments", icon: CreditCard, label: "Payments" },
];

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <h2>ShikshaCom</h2>
          <span>Admin Panel</span>
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
