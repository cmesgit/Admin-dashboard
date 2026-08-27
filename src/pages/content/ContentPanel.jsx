import { useCallback, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { FileText } from "lucide-react";
import BlogPosts from "./BlogPosts";
import Toast from "../../components/Toast";
import "../../css/Moderator.css";
import "../../css/Courses.css";
import "../../css/Content.css";

// Blog Posts is all that is left here — every other tab moved into the
// Content Studio, and the last two (Current Affairs, Homepage Content) went
// once the Studio could finally do everything they could.
const TABS = [
  { id: "blogs", label: "Blog Posts", icon: FileText },
];
const TAB_IDS = TABS.map((t) => t.id);
const DEFAULT_TAB = "blogs";

// Same "sidebar entry -> internal tab bar -> tab components" shape as
// ModeratorPanel.jsx, with one shared toast fed by an `onAction` callback
// passed down to every tab. The active tab is synced to `?tab=` so a tab is
// shareable/bookmarkable and survives a reload — falls back to the default
// when the param is missing or unrecognized.
const ContentPanel = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  // Screens that moved into the Content Studio. A bookmark to an old tab
  // should land on its replacement, not silently fall back to Blog Posts.
  const MOVED = {
    faqs: "/content/questions",
    announcements: "/content/questions?tab=notices",
    affairs: "/content/questions?tab=affairs",
    tags: "/content/labels",
    showcase: "/content/cards",
    categories: "/content/labels",
    home: "/content/pages/home",
  };
  const movedTo = MOVED[rawTab];
  const tab = TAB_IDS.includes(rawTab) ? rawTab : DEFAULT_TAB;
  const setTab = (id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", id);
      return next;
    });
  };
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const onAction = useCallback((message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  if (movedTo) return <Navigate to={movedTo} replace />;

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Content (CMS)</h1>
      <p className="content-subtitle">
        Write and manage blog posts. Everything else — pages, answers, notices,
        current affairs, course cards, labels and pictures — now lives in the
        Content Studio in the sidebar.
      </p>

      {/* One tab left, so the bar would just be a label. Kept the map so
          adding a tab back needs no restructuring. */}
      {TABS.length > 1 && (
        <div className="mod-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`mod-tab${tab === id ? " active" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "blogs" && <BlogPosts onAction={onAction} />}

      <Toast message={toast} />
    </div>
  );
};

export default ContentPanel;
