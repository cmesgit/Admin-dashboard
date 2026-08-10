import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BarChart3, Settings, TrendingUp, HelpCircle, ShieldCheck, ClipboardList, Award, Users,
} from "lucide-react";
import StatsTab from "./StatsTab";
import SettingsTab from "./SettingsTab";
import BandsTab from "./BandsTab";
import QuestionBankTab from "./QuestionBankTab";
import VerificationsTab from "./VerificationsTab";
import SessionsTab from "./SessionsTab";
import EligibilityTab from "./EligibilityTab";
import AwardsTab from "./AwardsTab";
import Toast from "../../components/Toast";
import "../../css/Moderator.css";
import "../../css/Courses.css";
import "../../css/Content.css";
import "../../css/Approvals.css";

const TABS = [
  { id: "stats", label: "Overview", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "bands", label: "Bands", icon: TrendingUp },
  { id: "questions", label: "Question Bank", icon: HelpCircle },
  { id: "verifications", label: "Verifications", icon: ShieldCheck },
  { id: "sessions", label: "Sessions", icon: ClipboardList },
  { id: "eligibility", label: "Eligibility", icon: Users },
  { id: "awards", label: "Awards", icon: Award },
];
const TAB_IDS = TABS.map((t) => t.id);
const DEFAULT_TAB = "stats";

// Same "sidebar entry -> internal tab bar -> tab components" shape as
// SkillCMSPanel.jsx — one nav item, everything else lives behind tabs synced
// to ?tab= so a reload (or a deep link from a "needs attention" card) lands
// on the right screen.
export default function ScholarshipPanel() {
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
      <h1 className="dashboard-title">Instant Scholarship</h1>
      <p className="content-subtitle">
        Configure the pre-enrollment scholarship exam, review identity verifications and flagged
        sessions, and manage the award ledger.
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

      {tab === "stats" && <StatsTab onAction={onAction} goToTab={setTab} />}
      {tab === "settings" && <SettingsTab onAction={onAction} />}
      {tab === "bands" && <BandsTab onAction={onAction} />}
      {tab === "questions" && <QuestionBankTab onAction={onAction} />}
      {tab === "verifications" && <VerificationsTab onAction={onAction} />}
      {tab === "sessions" && <SessionsTab onAction={onAction} />}
      {tab === "eligibility" && <EligibilityTab onAction={onAction} />}
      {tab === "awards" && <AwardsTab onAction={onAction} />}

      <Toast message={toast} />
    </div>
  );
}
