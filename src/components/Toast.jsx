import { AlertTriangle, Check } from "lucide-react";

// Bottom-center dark toast, shown briefly after an action resolves.
// Purely presentational — the owning page keeps the `message` state and
// clears it on a timer (see ModeratorPanel.jsx).
//
// `tone="error"` swaps the check for a warning glyph. Every caller used to
// get the green check, so a rejected save (the card show/hide toggle's 400,
// for one) announced itself with a success tick and the reason scrolled past
// in 2.6 seconds. Defaults to "success" so existing callers are unchanged.
const Toast = ({ message, tone = "success" }) => {
  if (!message) return null;
  const isError = tone === "error";
  const Icon = isError ? AlertTriangle : Check;
  return (
    <div className="mod-toast" role="status" aria-live="polite">
      <Icon
        size={18}
        className={`mod-toast-icon${isError ? " mod-toast-icon--error" : ""}`}
      />
      <span>{message}</span>
    </div>
  );
};

export default Toast;
