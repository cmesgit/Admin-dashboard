/**
 * design_handoff_admin_counsellor — the Admin v2 information architecture.
 *
 * Ten top-level AREAS replacing today's nine-group sidebar, transcribed from
 * `Admin Prototype v2.dc.html`'s own `nav()` function. The artboard annotated
 * every entry with the screen it replaces; that annotation is kept here as
 * `was`, and rendered under the active item, because an admin who has used
 * this console for a year navigates by the OLD names.
 *
 * ⚠ THIS FILE CHANGES NAVIGATION ONLY. Every `to` below is an existing route
 * that already works at that exact path today. Nothing here merges, moves or
 * replaces a screen — later phases do that one at a time, and keeping the URLs
 * alive is what lets them, without breaking a bookmark or a notification link
 * mid-rebuild. See `design_handoff_admin_counsellor/README.md`.
 *
 * ⚠ WHERE THE DESIGN AND THE CODEBASE DISAGREE, THE CODEBASE WINS — a nav row
 * that leads nowhere is worse than a missing row. Specifically:
 *
 *   • The design merges several screens into one item (its "Teachers" covers
 *     Teachers + Teacher Approvals + Teacher Activity; its "Students" covers
 *     Users + Students; its "Admissions" covers both enrollment screens).
 *     Those merges are SCREEN work, not nav work. Each real screen keeps its
 *     own row here, grouped under the design's area.
 *   • ONE design entry still has no screen behind it and is omitted rather
 *     than rendered as a dead link: "Checks" (the design calls it
 *     Corrections — no such screen exists anywhere in the app).
 *     "SEO and redirects", "Forms" and "Reusable blocks" were all in that
 *     list and are now built (Phase 5).
 *   • `LivestreamMonitor` has no nav entry anywhere today — it is reachable
 *     only by typing the URL. The design has no slot for it either. It gets
 *     one here, under Live classes, since that is plainly where it belongs.
 *
 * Flags: `needs: "studio"` hides a row unless content_studio_enabled, and
 * `needs: "quizHub"` unless public_quiz_hub_enabled — matching the existing
 * sidebar's gating exactly. Those endpoints 503 while their flag is off, so an
 * always-on row would just be a dead link.
 */
import {
  Activity,
  Award,
  BarChart3,
  Blocks,
  BookCheck,
  BookOpen,
  CalendarCheck2,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileCheck,
  FileText,
  Flag,
  Gavel,
  GraduationCap,
  HelpCircle,
  History,
  ImageIcon,
  Layout,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Megaphone,
  Menu,
  Newspaper,
  Paperclip,
  Radio,
  School,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Shuffle,
  Tag,
  UserCheck,
  UserRound,
  Users,
  Users2,
  Video,
} from "lucide-react";

export const ADMIN_V2_AREAS = [
  {
    id: "home",
    label: "Home",
    badgeKey: "todo",
    items: [
      { to: "/", end: true, icon: LayoutDashboard, label: "To do", was: "Overview" },
    ],
  },
  {
    id: "people",
    label: "People",
    badgeKey: "people",
    items: [
      { to: "/students", icon: GraduationCap, label: "Students", was: "Students" },
      { to: "/users", icon: Users, label: "All users", was: "Users" },
      { to: "/teachers", icon: School, label: "Teachers", was: "Teachers" },
      { to: "/approvals", icon: UserCheck, label: "Teacher applications", was: "Teacher Approvals" },
      { to: "/teacher-activity", icon: Activity, label: "Teacher activity", was: "Teacher Activity" },
      { to: "/counselor-approvals", icon: UserRound, label: "Counsellors", was: "Counsellor Approvals" },
      { to: "/skill-experts", icon: Users2, label: "Experts", was: "Skill Experts" },
      { to: "/moderator-activity", icon: Gavel, label: "Staff activity", was: "Moderator Activity" },
    ],
  },
  {
    id: "courses",
    label: "Courses",
    badgeKey: "courses",
    items: [
      { to: "/courses", icon: BookOpen, label: "All courses", was: "Courses" },
      { to: "/enrollment-requests", icon: FileCheck, label: "Admissions", was: "Enrollments", badgeKey: "admission" },
      { to: "/enrollments", icon: ListChecks, label: "Admission management", was: "Enrollment Mgmt" },
      { to: "/academy-content", icon: Paperclip, label: "Study material", was: "Content & Materials" },
      { to: "/quizzes", icon: BookCheck, label: "Quizzes", was: "Academy Quizzes" },
      { to: "/skill-courses", icon: ClipboardList, label: "Skill course review", was: "Skill Courses" },
      { to: "/analytics", icon: BarChart3, label: "Reports", was: "Analytics" },
    ],
  },
  {
    id: "live",
    label: "Live classes",
    badgeKey: "live",
    items: [
      { to: "/live-streams", icon: Radio, label: "Live and scheduled", was: "Live Streams" },
      { to: "/live-streams/monitor", icon: Search, label: "Monitor", was: "(no nav entry before)" },
      { to: "/recordings", icon: Video, label: "Recordings", was: "Recordings" },
      { to: "/group-session-attendance", icon: CalendarCheck2, label: "Attendance", was: "Group Session Attendance" },
      { to: "/skill-sessions", icon: CalendarClock, label: "Skill sessions", was: "Sessions" },
      { to: "/counseling-sessions", icon: UserRound, label: "Counselling sessions", was: "Counselling Sessions" },
    ],
  },
  {
    id: "questions",
    label: "Questions",
    badgeKey: "questions",
    items: [
      { to: "/question-bank/review", icon: FileCheck, label: "To review", was: "Question Review", badgeKey: "question" },
      { to: "/question-bank/bank", icon: BookCheck, label: "All questions", was: "Question Bank", needs: "quizHub" },
      { to: "/question-bank/labels", icon: Tag, label: "Taxonomy", was: "Question Labels", needs: "quizHub" },
      { to: "/question-bank/sets", icon: ClipboardList, label: "Practice sets", was: "Practice Sets", needs: "quizHub" },
    ],
  },
  {
    id: "scholarship",
    label: "Scholarship",
    badgeKey: "scholarship",
    // One route, eight ?tab= panels (ScholarshipPanel.jsx). The ids are the
    // panel's own TAB_IDS — an unrecognised one silently falls back to stats.
    items: [
      { to: "/scholarship?tab=stats", icon: BarChart3, label: "Overview", was: "Overview tab" },
      { to: "/scholarship?tab=verifications", icon: ShieldCheck, label: "Checks to do", was: "Verifications", badgeKey: "scholarship" },
      { to: "/scholarship?tab=sessions", icon: ClipboardList, label: "Tests taken", was: "Sessions" },
      { to: "/scholarship?tab=eligibility", icon: UserCheck, label: "Who qualifies", was: "Eligibility" },
      { to: "/scholarship?tab=awards", icon: Award, label: "Awards", was: "Awards" },
      { to: "/scholarship?tab=bands", icon: ListChecks, label: "Score bands", was: "Bands" },
      { to: "/scholarship?tab=questions", icon: BookCheck, label: "Test questions", was: "Question Bank tab" },
      { to: "/scholarship?tab=settings", icon: Settings, label: "Setup", was: "Settings tab" },
    ],
  },
  {
    id: "website",
    label: "Website",
    badgeKey: "website",
    items: [
      { to: "/content/home", end: true, icon: LayoutDashboard, label: "Overview", was: "Content home", needs: "studio" },
      { group: "Content" },
      { to: "/content/pages/home", icon: Layout, label: "Pages", was: "Site pages", needs: "studio" },
      { to: "/content?tab=blogs", icon: FileText, label: "Posts and articles", was: "Content (CMS)" },
      { to: "/content/questions?tab=affairs", icon: Newspaper, label: "Current affairs", was: "Current affairs", needs: "studio" },
      { to: "/content/exams", icon: GraduationCap, label: "Exams", was: "Exams", needs: "studio" },
      { to: "/content/questions", icon: HelpCircle, label: "Questions and notices", was: "Questions & notices", needs: "studio" },
      { group: "Library" },
      { to: "/content/pictures", icon: ImageIcon, label: "Media library", was: "Pictures", needs: "studio" },
      { to: "/content/blocks", icon: Blocks, label: "Blocks", was: "(new)" },
      { to: "/content/labels", icon: Tag, label: "Labels", was: "Labels", needs: "studio" },
      { group: "Structure" },
      { to: "/content/menu", icon: Menu, label: "Menus", was: "Courses menu", needs: "studio" },
      // Built in Phase 5. NOT flagged `needs: "studio"` — a dead link is a
      // dead link whether or not the CMS rebuild is switched on, and the
      // redirect API has no Studio gate.
      { to: "/content/redirects", icon: Shuffle, label: "SEO and redirects", was: "(new)" },
      // Built in Phase 5. Neither is Studio-gated: contact enquiries arrive
      // whatever the CMS rebuild flag says, and the block catalogue is read
      // from the editor's own schema.
      { to: "/content/forms", icon: ClipboardList, label: "Forms", was: "(new)" },
      { group: "Planning" },
      { to: "/content/schedule", icon: CalendarClock, label: "Schedule", was: "Schedule", needs: "studio" },
      { to: "/content/history", icon: History, label: "History", was: "History", needs: "studio" },
      { group: "Advertising" },
      { to: "/content/ticker", icon: Megaphone, label: "Ads", was: "Advertisements", needs: "studio" },
      { to: "/ad-subscriptions", icon: CreditCard, label: "Ad payments", was: "Ad Subscriptions" },
      { to: "/content/cards", icon: LayoutDashboard, label: "Course cards", was: "Course cards", needs: "studio" },
      { group: "Other" },
      { to: "/skill-cms", icon: Flag, label: "Skill page", was: "Skill CMS" },
      { to: "/research", icon: FileText, label: "Research", was: "Research Hub" },
    ],
  },
  {
    id: "money",
    label: "Money",
    items: [
      { to: "/payments", icon: CreditCard, label: "Payments", was: "Payments" },
    ],
  },
  {
    id: "help",
    label: "Help desk",
    badgeKey: "help",
    items: [
      { to: "/communication/support", icon: LifeBuoy, label: "Help requests", was: "Support Tickets", badgeKey: "help_request" },
      { to: "/communication/reports", icon: Flag, label: "Reported chats", was: "Chat Reports" },
      { to: "/communication/messages", icon: Search, label: "Find a message", was: "Message Search" },
      { to: "/communication/broadcast", icon: Send, label: "Announcements", was: "Broadcast" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      { to: "/payment-settings", icon: CreditCard, label: "Payment setup", was: "Payment Settings" },
      { to: "/live-session-rules", icon: Radio, label: "Class rules", was: "Live Session Rules" },
      { to: "/roles", icon: ShieldCheck, label: "Staff access", was: "Roles & Permissions" },
      { to: "/public-site", icon: Settings, label: "Website switches", was: "Public Site" },
      { to: "/agreement-letter", icon: FileText, label: "Agreement letter", was: "Agreement Letter" },
    ],
  },
];

/** Drop rows whose feature flag is off. Group headers survive only if at
 *  least one row under them did — otherwise the Website area renders a
 *  "Structure" heading with nothing beneath it when the Studio is off. */
export const visibleItems = (area, { studioOn, quizHubOn }) => {
  const allowed = (it) =>
    !it.needs || (it.needs === "studio" ? studioOn : quizHubOn);
  const kept = area.items.filter((it) => it.group || allowed(it));
  // A header earns its place only if a real row follows it before the next
  // header. With the Studio off, Website loses most of its rows and would
  // otherwise render "Structure" and "Planning" over empty space.
  return kept.filter((it, i) => {
    if (!it.group) return true;
    const next = kept[i + 1];
    return !!next && !next.group;
  });
};

/** Which area owns the current URL?
 *
 *  Longest-prefix wins, so `/content/pictures` resolves to Website rather than
 *  matching some shorter path first. Returns the area id, or "home" — an
 *  unrecognised URL must still render a usable top bar rather than no nav.
 */
export const areaForPath = (pathname) => {
  let best = null;
  for (const area of ADMIN_V2_AREAS) {
    for (const it of area.items) {
      if (!it.to) continue;
      const path = it.to.split("?")[0];
      if (path === "/") {
        if (pathname === "/" && !best) best = { id: area.id, len: 1 };
        continue;
      }
      const hit = pathname === path || pathname.startsWith(`${path}/`);
      if (hit && (!best || path.length > best.len)) best = { id: area.id, len: path.length };
    }
  }
  return best?.id || "home";
};

/** Is this nav row the one currently open?
 *
 *  Rows in Website and Scholarship live at ONE pathname and differ only by
 *  `?tab=`, so a pathname-only compare lights several at once — the same trap
 *  `isStudioLinkActive` already documents for the Studio sidebar. This handles
 *  both families plus ordinary prefix routes.
 */
export const isRowActive = (to, location) => {
  const [path, query] = to.split("?");
  const wantTab = new URLSearchParams(query || "").get("tab");

  if (wantTab !== null) {
    if (location.pathname !== path) return false;
    const haveTab = new URLSearchParams(location.search).get("tab");
    // /scholarship with no ?tab= is the Overview panel (TAB_IDS falls back to
    // "stats"), and /content with no ?tab= is Blog Posts ("blogs").
    const fallback = path === "/scholarship" ? "stats" : "blogs";
    return (haveTab || fallback) === wantTab;
  }

  // Two Website rows share /content/questions: Current affairs owns
  // ?tab=affairs, Questions and notices owns every other pill. Without this
  // the Notices pill leaves no row lit.
  if (path === "/content/questions") {
    return location.pathname === path
      && new URLSearchParams(location.search).get("tab") !== "affairs";
  }
  if (path === "/content") {
    return location.pathname === path
      && (new URLSearchParams(location.search).get("tab") || "blogs") === "blogs";
  }
  if (path === "/") return location.pathname === "/";
  return location.pathname === path || location.pathname.startsWith(`${path}/`);
};

/** Which single row in `rows` is the open one?
 *
 *  `isRowActive` matches by prefix so a detail URL keeps its list row lit —
 *  but that makes a NESTED row ambiguous: /live-streams/monitor satisfies
 *  both "Monitor" and "Live and scheduled" (/live-streams), and both light up.
 *  Longest pathname wins, so the more specific row takes it.
 *
 *  Returns the winning `to`, or null when the URL belongs to no row at all
 *  (a detail screen with no nav home) — in which case nothing is lit, which
 *  is honest, rather than lighting the wrong thing.
 */
export const activeRowTo = (rows, location) => {
  const hits = rows.filter((it) => it.to && isRowActive(it.to, location));
  if (hits.length < 2) return hits[0]?.to ?? null;
  return hits.reduce((best, it) =>
    it.to.split("?")[0].length > best.to.split("?")[0].length ? it : best
  ).to;
};
