import { useEffect, useRef, useState } from "react";
import { useBlocker, useLocation } from "react-router-dom";

// One router blocker per full-page editor. Covers sidebar links, navigate(),
// and browser Back/Forward. beforeunload covers reload and external exits.
export const useUnsavedChangesGuard = (isDirty, { onSave, onDiscard, busy = false } = {}) => {
  const location = useLocation();
  const permitted = useRef(false);
  const actionInFlight = useRef(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const blocker = useBlocker(() => !permitted.current && (isDirty || busy));

  useEffect(() => { permitted.current = false; }, [location.key]);
  useEffect(() => {
    if (!isDirty && !busy) return undefined;
    const handler = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, busy]);

  const finish = async (action, requireSaved = false) => {
    if (busy || actionInFlight.current || (!pendingAction && blocker.state !== "blocked")) return;
    actionInFlight.current = true;
    setWorking(true);
    setError("");
    try {
      const result = action ? await action() : true;
      if (result === false || (requireSaved && result !== true)) {
        setError("Your changes could not be saved. Keep editing or try again.");
        return;
      }
      if (pendingAction) {
        const next = pendingAction;
        setPendingAction(null);
        next();
      } else {
        permitted.current = true;
        blocker.proceed();
      }
    } catch {
      setError("Couldn’t finish that action. Your editor is still open; please try again.");
    } finally {
      actionInFlight.current = false;
      setWorking(false);
    }
  };

  return {
    pendingNav: Boolean(pendingAction) || blocker.state === "blocked",
    requestAction: (action) => {
      if (isDirty || busy) setPendingAction(() => action);
      else action();
    },
    guardedNavigate: (navigate, to, opts) => navigate(to, opts),
    navigateAfterSave: (navigate, to, opts) => {
      permitted.current = true;
      navigate(to, opts);
    },
    confirmLeave: () => finish(onDiscard),
    saveAndLeave: onSave ? () => finish(onSave, true) : null,
    cancelLeave: () => {
      if (working || busy) return;
      setError("");
      setPendingAction(null);
      if (blocker.state === "blocked") blocker.reset();
    },
    working: working || busy,
    navigationError: error,
  };
};
