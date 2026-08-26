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
  HelpCircle,
  History,
  Layout,
  Tag,
} from "lucide-react";
import { getEnrollmentRequests } from "../api/admin";
import CommandPalette from "./CommandPalette";
import "../css/ContentStudio.css";
import { getAdminSupportTickets } from "../api/admin_communication";
import { getReviewQueue } from "../api/admin_question_bank";
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
    header: "Question Bank",
    items: [
      { to: "/question-bank/review", icon: ListChecks, label: "Question Review", badgeKey: "questionBank", isNew: true },
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

// design_handoff_content_studio Phase 2 — the CMS nav, grouped by the job
// someone is doing rather than by which table the rows live in. Replaces the
// single "Content (CMS)" entry above, and ONLY when
// GlobalSettings.content_studio_enabled is on; with the flag off the eight-tab
// panel at /content is what renders, exactly as today.
//
// ⚠ Every destination below is deliberately an existing route for now. Later
// phases replace the screens behind them one at a time; keeping the old URLs
// alive is what lets that happen without breaking bookmarks mid-rebuild.
// ⚠ `soon: true` marks a destination whose screen is not built yet. Those
// render as a dimmed row with a "Soon" tag and do NOT navigate. Pointing them
// at /content?tab=<something ContentPanel doesn't know> would silently fall
// back to the Blog Posts tab — the nav would look complete while four of ten
// entries quietly went to the wrong screen. Each is un-marked by its phase:
// History/Schedule get dedicated screens later; Exams is Phase 8.
// Pictures was un-marked in Phase 4.
const studioNavGroups = [
  {
    header: "Content",
    items: [
      { to: "/content/home", icon: LayoutDashboard, label: "Home", end: true },
    ],
  },
  {
    header: "Write",
    items: [
      { to: "/content?tab=blogs", icon: FileText, label: "Posts & articles" },
      { to: "/content?tab=affairs", icon: Newspaper, label: "Current affairs" },
      { to: "/content/questions", icon: HelpCircle, label: "Questions & notices" },
    ],
  },
  {
    header: "The website",
    items: [
      { to: "/content/pages/home", icon: Layout, label: "Site pages" },
      { to: "/content/cards", icon: LayoutDashboard, label: "Course cards" },
      { to: "/content?tab=exams", icon: GraduationCap, label: "Exams", soon: true },
    ],
  },
  {
    header: "Reusable",
    items: [
      { to: "/content/labels", icon: Tag, label: "Labels" },
      { to: "/content/pictures", icon: ImageIcon, label: "Pictures" },
    ],
  },
  {
    header: "Keeping track",
    items: [
      { to: "/content?tab=history", icon: History, label: "History", soon: true },
      { to: "/content?tab=schedule", icon: CalendarClock, label: "Schedule", soon: true },
    ],
  },
];

// ContentPanel's default tab when ?tab= is absent or unrecognised.
const DEFAULT_CONTENT_TAB = "blogs";

/** Is this Studio nav entry the one currently open?
 *
 * NavLink's own `isActive` compares pathname only and matches by prefix, so
 * every "/content?tab=…" entry lights up together — and all of them stay lit on
 * /content/blogs/:id. Studio entries are distinguished purely by their query
 * string, so the comparison has to include it.
 */
const isStudioLinkActive = (to, location) => {
  const [path, query] = to.split("?");
  if (location.pathname !== path) return false;
  const want = new URLSearchParams(query || "").get("tab") || DEFAULT_CONTENT_TAB;
  const have = new URLSearchParams(location.search).get("tab") || DEFAULT_CONTENT_TAB;
  return want === have;
};

/** Swap the single Content entry for the four Studio groups when the flag is on. */
const buildNav = (studioOn) => {
  if (!studioOn) return navGroups;
  return navGroups.flatMap((group) => {
    if (group.header !== "Content & Comms") return [group];
    return [
      ...studioNavGroups,
      {
        header: "Comms",
        items: group.items.filter((i) => i.to !== "/content"),
      },
    ];
  });
};

const len = (r) => (Array.isArray(r) ? r.length : r?.results?.length ?? r?.count ?? 0);

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [badges, setBadges] = useState({ enroll: 0, support: 0, scholarship: 0, questionBank: 0 });
  // Below the tablet breakpoint (see AdminLayout.css) the sidebar becomes a
  // slide-in overlay instead of a permanent 238px column — this just tracks
  // whether it's open. Irrelevant above that breakpoint (CSS keeps the
  // sidebar always visible there regardless of this state).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // design_handoff_content_studio Phase 2. /accounts/me/ already carries
  // feature_flags, so nothing needs adding to AuthContext — which matters,
  // because that file is generated from shared/src and editing it here would
  // be reverted by the next sync.
  const studioOn = !!user?.feature_flags?.content_studio_enabled;
  const groups = buildNav(studioOn);

  // Close the mobile overlay on every navigation, so picking a nav link
  // doesn't leave the sidebar covering the page it just opened.
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // ⌘K / Ctrl-K opens the palette from anywhere in the console. Bound only
  // while the Studio is on, so the shortcut doesn't swallow the browser's own
  // behaviour for admins who don't have the feature.
  useEffect(() => {
    if (!studioOn) return undefined;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studioOn]);

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
      getReviewQueue({ state: "suggested" }),
    ]).then(([enr, sup, sch, qbk]) => {
      if (!alive) return;
      const schVal = sch.status === "fulfilled" ? sch.value : null;
      const qbkVal = qbk.status === "fulfilled" ? qbk.value : null;
      setBadges({
        enroll: enr.status === "fulfilled" ? len(enr.value) : 0,
        support: sup.status === "fulfilled" ? len(sup.value) : 0,
        scholarship: schVal ? (schVal.flagged_for_review_open || 0) + (schVal.pending_verifications || 0) : 0,
        // What is actually waiting on an admin — not the whole bank.
        questionBank: qbkVal ? (qbkVal.counts?.suggested || 0) : 0,
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

        {studioOn && (
          <button
            type="button"
            className="cs-search-trigger"
            onClick={() => setPaletteOpen(true)}
          >
            <Search size={14} aria-hidden="true" />
            <span className="cs-search-trigger__label">Search everything</span>
            <span className="cs-search-trigger__key">⌘K</span>
          </button>
        )}

        <nav className="sidebar-nav">
          {groups.map((group, gi) => (
            <div key={group.header || `g${gi}`}>
              {group.header && <div className="sidebar-group-header">{group.header}</div>}
              {group.items.map(({ to, icon: Icon, label, end, isNew, badgeKey, soon }) => {
                const badge = badgeKey ? badges[badgeKey] : 0;
                if (soon) {
                  return (
                    <span key={to} className="sidebar-link cs-link-soon" aria-disabled="true">
                      <Icon size={17} />
                      <span className="sidebar-link-label">{label}</span>
                      <span className="cs-soon-tag">Soon</span>
                    </span>
                  );
                }
                // Studio entries live at one pathname and differ only by
                // ?tab=, so they need the query-aware comparison above.
                const isStudioEntry = studioOn && to.startsWith("/content");
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) => {
                      const on = isStudioEntry
                        ? isStudioLinkActive(to, location)
                        : isActive;
                      return `sidebar-link${on ? " active" : ""}`;
                    }}
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

      {studioOn && (
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      )}

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
              stray, unexplained button.

              Also hidden on the Courses page's Skill Dev tab. This wizard is
              Academy-only: it asks board-linked vs competitive and always
              writes an Academy course. Skill Dev courses are submitted by
              teachers and only reviewed here (/skill/admin/courses/<id>/review/),
              so there is no admin create path at all — leaving the button up
              made it look like a Skill Dev flow that inexplicably wanted a
              board. The tab is read from the URL, which is why Courses.jsx
              keeps it in a search param. */}
          {(location.pathname === "/"
            || (location.pathname.startsWith("/courses")
                && new URLSearchParams(location.search).get("tab") !== "skill")) && (
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
