import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Newspaper, HelpCircle, Megaphone, LayoutGrid, Tag, Layers } from "lucide-react";
import BlogPosts from "./BlogPosts";
import CurrentAffairs from "./CurrentAffairs";
import Faqs from "./Faqs";
import Announcements from "./Announcements";
import Showcase from "./Showcase";
import Tags from "./Tags";
import Categories from "./Categories";
import Toast from "../../components/Toast";
import "../../css/Moderator.css";
import "../../css/Courses.css";
import "../../css/Content.css";

const TABS = [
  { id: "blogs", label: "Blog Posts", icon: FileText },
  { id: "affairs", label: "Current Affairs", icon: Newspaper },
  { id: "faqs", label: "FAQs", icon: HelpCircle },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "showcase", label: "Showcase Courses", icon: LayoutGrid },
  { id: "tags", label: "Tags", icon: Tag },
  { id: "categories", label: "Categories", icon: Layers },
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

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Content (CMS)</h1>
      <p className="content-subtitle">
        Manage blog posts, current affairs, FAQs, announcements and homepage showcase cards without touching Django admin.
      </p>

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

      {tab === "blogs" && <BlogPosts onAction={onAction} />}
      {tab === "affairs" && <CurrentAffairs onAction={onAction} />}
      {tab === "faqs" && <Faqs onAction={onAction} />}
      {tab === "announcements" && <Announcements onAction={onAction} />}
      {tab === "showcase" && <Showcase onAction={onAction} />}
      {tab === "tags" && <Tags onAction={onAction} />}
      {tab === "categories" && <Categories onAction={onAction} />}

      <Toast message={toast} />
    </div>
  );
};

export default ContentPanel;
