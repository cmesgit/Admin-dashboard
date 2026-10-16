import { useEffect, useId, useRef } from "react";
import "../css/UnsavedChangesDialog.css";

export default function UnsavedChangesDialog({ guard, message = "Save your changes before leaving this editor?", saveLabel = "Save and leave" }) {
  const titleId = useId();
  const messageId = useId();
  const card = useRef(null);
  useEffect(() => {
    if (!guard.pendingNav) return undefined;
    const previous = document.activeElement;
    card.current?.querySelector("button")?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [guard.pendingNav]);
  useEffect(() => {
    if (guard.pendingNav && !guard.working && !card.current?.contains(document.activeElement)) {
      card.current?.querySelector("button")?.focus();
    }
  }, [guard.pendingNav, guard.working]);
  if (!guard.pendingNav) return null;
  const onKeyDown = (event) => {
    if (event.key === "Escape") { event.preventDefault(); guard.cancelLeave(); }
    if (event.key !== "Tab") return;
    const buttons = [...card.current.querySelectorAll("button:not(:disabled)")];
    const first = buttons[0], last = buttons.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <div className="unsaved-overlay" onKeyDown={onKeyDown}>
    <section className="unsaved-card" ref={card} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} aria-busy={guard.working}>
      <h2 id={titleId}>You have unsaved changes</h2>
      <p id={messageId}>{message}</p>
      {guard.navigationError && <p className="unsaved-error" role="alert">{guard.navigationError}</p>}
      <div className="unsaved-actions">
        <button type="button" className="cs-btn-ghost" disabled={guard.working} onClick={guard.cancelLeave}>Keep editing</button>
        <button type="button" className="cs-btn-ghost" disabled={guard.working} onClick={guard.confirmLeave}>Discard and leave</button>
        {guard.saveAndLeave && <button type="button" className="cs-btn-primary" disabled={guard.working} onClick={guard.saveAndLeave}>{guard.working ? "Please wait…" : saveLabel}</button>}
      </div>
    </section>
  </div>;
}
