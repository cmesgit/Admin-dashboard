import { Check } from "lucide-react";

// Bottom-center dark toast, shown briefly after a moderation action succeeds.
// Purely presentational — the owning page keeps the `message` state and
// clears it on a timer (see ModeratorPanel.jsx).
const Toast = ({ message }) => {
  if (!message) return null;
  return (
    <div className="mod-toast">
      <Check size={18} className="mod-toast-icon" />
      <span>{message}</span>
    </div>
  );
};

export default Toast;
