import { useEffect, useState } from "react";

// Warn before losing unsaved edits. `isDirty` should be "current form differs
// from the last-persisted server state", not merely "the user touched a
// field" — a save that round-trips back to the same values should clear it.
//
// IMPORTANT LIMITATION: react-router's `useBlocker` (which would intercept
// in-app <Link>/navigate() calls, including the browser Back button) only
// works under a *data router* (createBrowserRouter + RouterProvider) — it
// calls useDataRouterContext internally and throws if there is no data
// router in the tree. This app's entrypoint (src/main.jsx) renders
// declarative `<BrowserRouter><Routes>`, not a data router, so `useBlocker`
// is unusable here without an app-wide router migration that's out of scope
// for this change. Verified against the installed react-router package
// (v7.13.2) — see node_modules/react-router/dist/development/chunk-*.mjs
// `function useBlocker`, which opens with `useDataRouterContext(...)`.
//
// Given that, this hook only covers:
//   1. Tab close / reload / external navigation, via `beforeunload`.
//   2. In-page Back/Cancel-style buttons that go through `guardedNavigate`
//      instead of calling navigate() directly — it cannot intercept the
//      browser's own Back/Forward buttons or sidebar-link clicks.
export const useUnsavedChangesGuard = (isDirty) => {
  const [pendingNav, setPendingNav] = useState(null); // { to, opts } | null

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Call this from Back/Cancel-style buttons instead of navigate() directly.
  // When dirty, it stashes the destination and asks the caller to render a
  // confirm dialog (ConfirmModal, not window.confirm — see confirmLeave /
  // cancelLeave below) rather than navigating immediately.
  const guardedNavigate = (navigate, to, opts) => {
    if (!isDirty) {
      navigate(to, opts);
      return;
    }
    setPendingNav({ navigate, to, opts });
  };

  const confirmLeave = () => {
    if (!pendingNav) return;
    const { navigate, to, opts } = pendingNav;
    setPendingNav(null);
    navigate(to, opts);
  };

  const cancelLeave = () => setPendingNav(null);

  return { pendingNav, guardedNavigate, confirmLeave, cancelLeave };
};
