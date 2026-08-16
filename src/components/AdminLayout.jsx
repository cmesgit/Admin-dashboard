import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
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
  School,
  BookCheck,
  ListChecks,
  Megaphone,
  FileText,
  Newspaper,
  Users2,
  CalendarClock,
  CalendarCheck2,
  LogOut,
  Flag,
  Send,
  LifeBuoy,
  UserRound,
  Activity,
  Radio,
  Video,
  BarChart3,
  Gavel,
  Search,
  Plus,
  ImageIcon,
  Award,
  Menu,
  X,
} from "lucide-react";
import { getEnrollmentRequests } from "../api/admin";
import { getAdminSupportTickets } from "../api/admin_communication";
import { getScholarshipStats } from "../api/admin_scholarship";
import NewCourseWizard from "./NewCourseWizard";
import "../css/AdminLayout.css";

// 7-group nav mirroring the LMS Admin Console handoff. `isNew` renders the
// blue "NEW" tag; `badgeKey` binds a live count pill (resolved below).
// Forum moderation lives in the public frontend; the admin app governs it via
// Roles & Permissions + Moderator Activity oversight.
const navGroups = [
  {
    header: null,
    items: [{ to: "/", icon: LayoutDashboard, label: "Overview", end: true }],
  },
  {
    header: "People",
    items: [
      { to: "/users", icon: Users, label: "Users" },
      { to: "/approvals", icon: UserCheck, label: "Teacher Approvals" },
      { to: "/roles", icon: ShieldCheck, label: "Roles & Permissions" },
      { to: "/moderator-activity", icon: Gavel, label: "Moderator Activity", isNew: true },
    ],
  },
  {
    header: "Academy",
    items: [
      { to: "/courses", icon: BookOpen, label: "Courses" },
      { to: "/teachers", icon: UserRound, label: "Teachers", isNew: true },
      { to: "/students", icon: School, label: "Students", isNew: true },
      { to: "/teacher-activity", icon: Activity, label: "Teacher Activity", isNew: true },
      { to: "/live-streams", icon: Radio, label: "Live Streams", isNew: true },
      { to: "/live-session-rules", icon: Settings, label: "Live Session Rules", isNew: true },
      { to: "/recordings", icon: Video, label: "Recordings", isNew: true },
      { to: "/group-session-attendance", icon: Users, label: "Group Session Attendance", isNew: true },
      { to: "/enrollment-requests", icon: FileCheck, label: "Enrollments", badgeKey: "enroll" },
      { to: "/enrollments", icon: ClipboardList, label: "Enrollment Mgmt" },
      { to: "/quizzes", icon: ListChecks, label: "Academy Quizzes" },
      { to: "/analytics", icon: BarChart3, label: "Analytics", isNew: true },
    ],
  },
  {
    header: "Skill Dev",
    items: [
      { to: "/skill-experts", icon: Users2, label: "Skill Experts" },
      { to: "/skill-sessions", icon: CalendarClock, label: "Sessions" },
      { to: "/skill-courses", icon: BookCheck, label: "Skill Courses" },
      { to: "/skill-cms", icon: ImageIcon, label: "Skill CMS" },
    ],
  },
  {
    header: "Instant Scholarship",
    items: [{ to: "/scholarship", icon: Award, label: "Instant Scholarship", badgeKey: "scholarship" }],
  },
  {
    header: "Counselling",
    items: [
      { to: "/counselor-approvals", icon: GraduationCap, label: "Counsellor Approvals" },
      { to: "/counseling-sessions", icon: CalendarCheck2, label: "Counselling Sessions" },
    ],
  },
  {
    header: "Payments",
    items: [
      { to: "/payments", icon: CreditCard, label: "Payments" },
      { to: "/payment-settings", icon: Settings, label: "Payment Settings" },
      { to: "/ad-subscriptions", icon: Megaphone, label: "Ad Subscriptions" },
    ],
  },
  {
    header: "Content & Comms",
    items: [
      { to: "/content", icon: Newspaper, label: "Content (CMS)" },
      { to: "/communication/reports", icon: Flag, label: "Chat Reports" },
      { to: "/communication/messages", icon: Search, label: "Message Search" },
      { to: "/communication/support", icon: LifeBuoy, label: "Support Tickets", badgeKey: "support" },
      { to: "/communication/broadcast", icon: Send, label: "Broadcast" },
      { to: "/agreement-letter", icon: FileText, label: "Agreement Letter" },
    ],
  },
];

const len = (r) => (Array.isArray(r) ? r.length : r?.results?.length ?? r?.count ?? 0);

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [badges, setBadges] = useState({ enroll: 0, support: 0, scholarship: 0 });
  // Below the tablet breakpoint (see AdminLayout.css) the sidebar becomes a
  // slide-in overlay instead of a permanent 238px column — this just tracks
  // whether it's open. Irrelevant above that breakpoint (CSS keeps the
  // sidebar always visible there regardless of this state).
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close the mobile overlay on every navigation, so picking a nav link
  // doesn't leave the sidebar covering the page it just opened.
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Live nav count pills: pending enrollment requests + open support tickets
  // + scholarship items needing attention (flagged sessions + pending
  // verifications). Guarded so a missing/optional endpoint never blanks
  // the sidebar.
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      getEnrollmentRequests(),
      getAdminSupportTickets("open"),
      getScholarshipStats(),
    ]).then(([enr, sup, sch]) => {
      if (!alive) return;
      const schVal = sch.status === "fulfilled" ? sch.value : null;
      setBadges({
        enroll: enr.status === "fulfilled" ? len(enr.value) : 0,
        support: sup.status === "fulfilled" ? len(sup.value) : 0,
        scholarship: schVal ? (schVal.flagged_for_review_open || 0) + (schVal.pending_verifications || 0) : 0,
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const avatarInitials = (user?.email || "AD").slice(0, 2).toUpperCase();

  return (
    <div className="admin-layout">
      {sidebarOpen && (
        <div className="admin-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`admin-sidebar${sidebarOpen ? " mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">S</div>
          <div className="sidebar-brand-text">
            <h2>ShikshaCom</h2>
            <span>Admin Console</span>
          </div>
          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group, gi) => (
            <div key={group.header || `g${gi}`}>
              {group.header && <div className="sidebar-group-header">{group.header}</div>}
              {group.items.map(({ to, icon: Icon, label, end, isNew, badgeKey }) => {
                const badge = badgeKey ? badges[badgeKey] : 0;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
                  >
                    <Icon size={17} />
                    <span className="sidebar-link-label">{label}</span>
                    {isNew && <span className="sidebar-new-tag">NEW</span>}
                    {badge > 0 && <span className="sidebar-badge">{badge}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span>{user?.email}</span>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          {/* CSS-only visible below the tablet breakpoint — see .admin-menu-toggle
              in AdminLayout.css. */}
          <button
            className="admin-menu-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="admin-header-spacer" />
          {/* Only relevant on the pages courses actually live on — showing a
              course-creation shortcut on e.g. Roles or Analytics read as a
              stray, unexplained button. */}
          {(location.pathname === "/" || location.pathname.startsWith("/courses")) && (
            <button className="admin-new-btn" onClick={() => setWizardOpen(true)}>
              <Plus size={16} />
              New course
            </button>
          )}
          <div className="admin-avatar" title={user?.email}>
            {avatarInitials}
          </div>
        </header>

        <main className="admin-content page-fade" key={location.pathname}>
          <Outlet />
        </main>
      </div>

      {wizardOpen && (
        <NewCourseWizard
          onClose={() => setWizardOpen(false)}
          onCreated={(course) => {
            setWizardOpen(false);
            if (course?.id) navigate("/courses");
          }}
        />
      )}
    </div>
  );
};

export default AdminLayout;
