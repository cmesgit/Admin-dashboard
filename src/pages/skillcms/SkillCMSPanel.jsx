import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layers, Megaphone, ImageIcon } from "lucide-react";
import Categories from "./Categories";
import Marketing from "./Marketing";
import MediaModeration from "./MediaModeration";
import Toast from "../../components/Toast";
import "../../css/Moderator.css";
import "../../css/Courses.css";
import "../../css/Content.css";

const TABS = [
  { id: "categories", label: "Categories", icon: Layers },
  { id: "marketing", label: "Marketing", icon: Megaphone },
  { id: "media", label: "Media Moderation", icon: ImageIcon },
];
const TAB_IDS = TABS.map((t) => t.id);
const DEFAULT_TAB = "categories";

// Same "sidebar entry -> internal tab bar -> tab components" shape as
// ContentPanel.jsx, one shared toast fed by an `onAction` callback passed
// down to every tab. Active tab synced to `?tab=` so it survives a reload.
const SkillCMSPanel = () => {
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
      <h1 className="dashboard-title">Skill CMS</h1>
      <p className="content-subtitle">
        Manage the SkillDev marketplace's categories, hero/banner copy, and expert/course media —
        without touching Django admin.
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

      {tab === "categories" && <Categories onAction={onAction} />}
      {tab === "marketing" && <Marketing onAction={onAction} />}
      {tab === "media" && <MediaModeration onAction={onAction} />}

      <Toast message={toast} />
    </div>
  );
};

export default SkillCMSPanel;
