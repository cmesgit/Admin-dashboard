import { useState, useCallback, useRef } from "react";
import { ShieldCheck, KeyRound, UserCog, History } from "lucide-react";
import Toast from "../../components/Toast";
import RolesTab from "./RolesTab";
import AssignmentsTab from "./AssignmentsTab";
import PermissionsTab from "./PermissionsTab";
import ActionHistoryTab from "./ActionHistoryTab";
import "../../css/Moderator.css";
import "../../css/Roles.css";

const TABS = [
  { key: "roles", label: "Roles", icon: ShieldCheck },
  { key: "assignments", label: "Assignments", icon: UserCog },
  { key: "permissions", label: "Permissions", icon: KeyRound },
  { key: "history", label: "Action History", icon: History },
];

const RolesPage = () => {
  const [tab, setTab] = useState("roles");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const notify = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title" style={{ marginBottom: 4 }}>Roles &amp; Permissions</h1>
      <p className="rbac-sub">
        Govern staff access, assign roles, and review moderator activity.
        Moderators do their work in the public forum's Moderator Panel.
      </p>

      <div className="mod-tabs">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`mod-tab${tab === key ? " active" : ""}`}
            onClick={() => setTab(key)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === "roles" && <RolesTab notify={notify} />}
      {tab === "assignments" && <AssignmentsTab notify={notify} />}
      {tab === "permissions" && <PermissionsTab />}
      {tab === "history" && <ActionHistoryTab />}

      <Toast message={toast} />
    </div>
  );
};

export default RolesPage;
