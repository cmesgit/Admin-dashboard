// Create/edit a ticker item (design_handoff_live_ticker Phase 2b).
//
// This is the first screen anywhere in the CMS that can set an announcement's
// DISPLAY WINDOW. `starts_at`/`ends_at` have existed on the model all along and
// `utils/datetimeLocal.js` was written to convert them, but the notice modal on
// Questions & notices never sent either field — so until now an admin could not
// schedule a notice at all, and there was nothing on screen to say so.
import { useMemo, useState } from "react";
import ImageUploadField from "../../components/ImageUploadField";
import { isoToLocalInput, localInputToIso } from "../../utils/datetimeLocal";
import { TICKER_SLOTS, unbuiltSlots } from "./tickerSlots";

// Mirrors content.models.TickerKind, and the two rules its clean() enforces.
const KINDS = [
  { id: "new_course", label: "New course", metric: false },
  { id: "enrolment", label: "Enrolment", metric: true },
  { id: "new_mentor", label: "New mentor", metric: false },
  { id: "practice", label: "Practice set", metric: true },
  // Derived from the end time on every read — never stored. See below.
  { id: "deadline", label: "Deadline", metric: false },
  { id: "milestone", label: "Milestone", metric: true },
  { id: "current_affairs", label: "Current affairs", metric: false },
  { id: "mentor_spotlight", label: "Mentor spotlight", metric: true },
];

const blank = {
  message: "", body: "", kind: "", slots: [], level: "info",
  link_label: "", link_url: "", metric_value: "", metric_label: "",
  pinned: false, starts_at: "", ends_at: "", image_url: "",
};

/** Row -> form state. Kept out of the component so the initial state can be
 *  computed lazily, with no effect involved: the parent unmounts this dialog
 *  between opens, so `initial` never changes while it is mounted, and syncing
 *  it in an effect would just be a cascading re-render. */
const fromRow = (row) => {
  if (!row) return blank;
  return {
    ...blank, ...row,
    slots: row.slots?.length ? row.slots : [],
    // ⚠ isoToLocalInput, never `toISOString().slice(0, 10)` — that converts to
    // UTC first, so any IST time before 05:30 shows the previous day.
    starts_at: isoToLocalInput(row.starts_at),
    ends_at: isoToLocalInput(row.ends_at),
  };
};

const TickerItemModal = ({ initial, busy, error, onCancel, onSubmit }) => {
  const [f, setF] = useState(() => fromRow(initial));
  /* The picked File is kept OUT of form state: it cannot be JSON-encoded, and
     the request only becomes multipart when one exists (see buildBody). */
  const [file, setFile] = useState(null);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const kindDef = useMemo(() => KINDS.find((k) => k.id === f.kind), [f.kind]);
  const cardSlots = useMemo(
    () => f.slots.filter((s) => s !== "navbar"), [f.slots],
  );
  const isEdit = Boolean(initial?.id);
  const pending = useMemo(() => unbuiltSlots(f.slots), [f.slots]);

  /* A mentor spotlight reuses the queue's generic fields for a person —
     name/subject/photo/link — rather than needing its own table (README §5).
     The one real cost of that reuse is the labels: "What it says" over a
     field you type a person's name into is confusing. So the labels follow
     the kind. */
  const isMentor = f.kind === "mentor_spotlight";
  const L = isMentor
    ? { message: "Mentor’s name", messageHint: "Shown in bold on the card.",
        messagePlaceholder: "e.g. Esther Lalrinpuii",
        body: "Subject", bodyPlaceholder: "e.g. Chemistry",
        image: "Their photo" }
    : { message: "What it says", messageHint: "",
        messagePlaceholder: "e.g. Class 10 Science · MBSE",
        body: "Second line (optional)", bodyPlaceholder: "e.g. Now enrolling",
        image: "Picture" };

  const toggleSlot = (id) => setF((p) => ({
    ...p,
    slots: p.slots.includes(id) ? p.slots.filter((s) => s !== id) : [...p.slots, id],
  }));

  const onKind = (id) => setF((p) => ({
    ...p, kind: id,
    // Clear a metric the server would reject anyway: it refuses one on a
    // deadline (derived) and on the glyph kinds (nothing renders it). Leaving
    // a stale value here would 400 on a field the admin can no longer see.
    metric_value: KINDS.find((k) => k.id === id)?.metric ? p.metric_value : "",
    metric_label: KINDS.find((k) => k.id === id)?.metric ? p.metric_label : "",
    // A mentor card renders no link — /about has no mentors section, so the
    // design's "Meet the mentors" CTA led nowhere and was dropped. Clear the
    // fields rather than keep a value nothing will ever render, which is the
    // same silently-ignored-data trap the metric pair avoids.
    ...(id === "mentor_spotlight" ? { link_label: "", link_url: "" } : {}),
  }));

  // Mirrors Announcement.clean() so the admin is told before the round trip.
  const localProblem =
    !f.message.trim() ? "An item needs something to say."
      : cardSlots.length && !f.kind
        ? `Pick how it looks as a card — it appears on ${cardSlots.length} place${cardSlots.length === 1 ? "" : "s"} other than the navbar strip.`
        : f.ends_at && f.starts_at && new Date(f.ends_at) <= new Date(f.starts_at)
          ? "The end time must be after the start time."
          : "";

  const submit = () => {
    if (localProblem) return;
    onSubmit({
      message: f.message.trim(),
      body: f.body.trim(),
      kind: f.kind,
      slots: f.slots,
      level: f.level,
      link_label: f.link_label.trim(),
      link_url: f.link_url.trim(),
      metric_value: f.metric_value.trim(),
      metric_label: f.metric_label.trim(),
      pinned: f.pinned,
      starts_at: localInputToIso(f.starts_at) || undefined,
      ends_at: localInputToIso(f.ends_at),   // null clears it
      // ⚠ New items are forced to DRAFT. `StatusedContentModel.status`
      // defaults to PUBLISHED and `starts_at` to now, so without this one
      // Save would put a card on the homepage instantly, with no confirm
      // step anywhere. Editing never sends status — the row's own switch
      // owns that, and silently re-drafting a live item would be worse.
      ...(isEdit ? {} : { status: "draft" }),
      // `image_url` is sent as typed; the File (if any) rides alongside as
      // multipart and the server prefers it. Sending "" clears the URL.
      image_url: f.image_url.trim(),
    }, file);
  };

  return (
    <div
      className="cs-palette-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="cs-confirm" role="dialog" aria-modal="true">
        <h2 className="cs-card__title">
          {isEdit ? "Edit ticker item" : "New ticker item"}
        </h2>
        <p className="cs-field__hint cs-field__hint--tight">
          {isEdit
            ? "Changing the words doesn’t change who can see it."
            : "It saves as a draft — nothing appears until you switch it on."}
        </p>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="t-message">{L.message}</label>
          <input
            id="t-message"
            className="cs-input cs-input--block"
            value={f.message}
            autoFocus
            onChange={(e) => set("message", e.target.value)}
            placeholder={L.messagePlaceholder}
          />
        </div>

        <div className="cs-field">
          <span className="cs-field__label">Where it can show</span>
          <div className="cs-steps">
            {TICKER_SLOTS.map((s) => {
              const on = f.slots.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  /* Deliberately NOT disabled when unbuilt: queueing an item
                     ahead of its surface is a legitimate thing to do, and the
                     server accepts it. It is labelled, not blocked. */
                  title={s.built ? s.where : `${s.where} — not built yet`}
                  className={`cs-chip ${on ? "cs-tone-ok" : "cs-tone-muted"}`}
                  onClick={() => toggleSlot(s.id)}
                >
                  {s.label}{s.built ? "" : " · soon"}
                </button>
              );
            })}
          </div>
          <p className="cs-field__hint">
            {f.slots.length === 0
              ? "Nothing picked — it will show on the navbar strip only."
              : `Appears in ${f.slots.length} place${f.slots.length === 1 ? "" : "s"}.`}
          </p>
          {pending.length > 0 && (
            <p className="cs-field__warn">
              {pending.length === 1 ? "This place isn’t" : "These places aren’t"}
              {" "}built yet, so nothing will appear there for now:{" "}
              {pending.map((id) =>
                TICKER_SLOTS.find((s) => s.id === id)?.label).join(", ")}.
              You can still save it — it will start showing the day that
              screen ships.
            </p>
          )}
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="t-kind">How it looks as a card</label>
          <select
            id="t-kind"
            className="cs-input cs-input--block"
            value={f.kind}
            onChange={(e) => onKind(e.target.value)}
          >
            <option value="">Plain text — navbar strip only</option>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>{k.label}</option>
            ))}
          </select>
          {cardSlots.length > 0 && !f.kind && (
            <p className="cs-field__warn">
              Every place except the navbar strip renders a card, and the card’s
              look comes from this.
            </p>
          )}
        </div>

        {isMentor && (
          <p className="cs-field__hint">
            A mentor card shows a photo, a name and a subject — no link, since
            there is no mentors page to send anyone to yet. Add one item per
            mentor and pick the login and signup places; the card steps
            through them.
          </p>
        )}

        {f.kind && (
          <div className="cs-field">
            <label className="cs-field__label" htmlFor="t-body">{L.body}</label>
            <input
              id="t-body"
              className="cs-input cs-input--block"
              value={f.body}
              onChange={(e) => set("body", e.target.value)}
              placeholder={L.bodyPlaceholder}
            />
            <p className="cs-field__hint">
              {isMentor
                ? "Shown under the name."
                : "The navbar strip ignores this."}
            </p>
          </div>
        )}

        {kindDef?.metric && (
          <div className="cs-field">
            <label className="cs-field__label" htmlFor="t-metric">The big number</label>
            <input
              id="t-metric"
              className="cs-input"
              value={f.metric_value}
              onChange={(e) => set("metric_value", e.target.value)}
              placeholder="2,400"
            />
            <input
              id="t-metric-label"
              className="cs-input"
              value={f.metric_label}
              onChange={(e) => set("metric_label", e.target.value)}
              placeholder="STUDENTS"
              aria-label="Unit for the big number"
            />
            <p className="cs-field__hint">
              Typed as text, so “2,400” keeps its comma.
            </p>
          </div>
        )}

        {f.kind === "deadline" && (
          <p className="cs-field__hint">
            The countdown is worked out from the end time below, every time
            someone loads the page — so it is never out of date.
          </p>
        )}

        <div className="cs-field">
          <span className="cs-field__label">{L.image}</span>
          <div className="cs-picker">
            <ImageUploadField
              value={file}
              onChange={setFile}
              previewUrl={initial?.img || null}
              previewClassName="cs-thumb"
            />
          </div>
          <input
            className="cs-input cs-input--block"
            value={f.image_url}
            onChange={(e) => set("image_url", e.target.value)}
            placeholder="…or paste an image link"
            aria-label="Image link"
          />
          <p className="cs-field__hint">
            {isMentor
              ? "A head-and-shoulders photo works best — it is shown as a rounded square."
              : "Shown full width on the homepage hero and band, and as a thumbnail "
                + "on the courses card. The navbar strip is text-only, so it is ignored there."}
          </p>
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="t-level">How it looks</label>
          <select
            id="t-level"
            className="cs-input cs-input--block"
            value={f.level}
            onChange={(e) => set("level", e.target.value)}
          >
            <option value="info">Ordinary — blue</option>
            <option value="success">Good news — green</option>
            <option value="warning">Needs attention — amber</option>
          </select>
        </div>

        {/* A mentor card renders no link (see AuthTicker.jsx), so the fields
            are hidden rather than offered and silently ignored. */}
        {!isMentor && (
          <>
            <div className="cs-field">
              <label className="cs-field__label" htmlFor="t-label">Button words (optional)</label>
              <input
                id="t-label"
                className="cs-input cs-input--block"
                value={f.link_label}
                onChange={(e) => set("link_label", e.target.value)}
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="t-url">Where it goes (optional)</label>
              <input
                id="t-url"
                className="cs-input cs-input--block"
                value={f.link_url}
                onChange={(e) => set("link_url", e.target.value)}
                placeholder="/courses"
              />
              {f.link_label && !f.link_url && (
                <p className="cs-field__warn">The button has words but nowhere to go.</p>
              )}
            </div>
          </>
        )}

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="t-start">Show from</label>
          <input
            id="t-start"
            type="datetime-local"
            className="cs-input cs-input--block"
            value={f.starts_at}
            onChange={(e) => set("starts_at", e.target.value)}
          />
          <p className="cs-field__hint">
            Leave empty to start as soon as it is switched on. Times are yours,
            not the server’s.
          </p>
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="t-end">Stop showing</label>
          <input
            id="t-end"
            type="datetime-local"
            className="cs-input cs-input--block"
            value={f.ends_at}
            onChange={(e) => set("ends_at", e.target.value)}
          />
          <p className="cs-field__hint">
            Leave empty to run until you switch it off.
          </p>
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="t-pin">
            <input
              id="t-pin"
              type="checkbox"
              checked={f.pinned}
              onChange={(e) => set("pinned", e.target.checked)}
            />{" "}
            Pin it ahead of everything else
          </label>
        </div>

        {(localProblem || error) && (
          <p className="cs-error" role="alert">{error || localProblem}</p>
        )}

        <div className="cs-confirm__actions">
          <button type="button" className="cs-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="cs-btn-primary cs-btn-primary--sm"
            disabled={busy || Boolean(localProblem)}
            onClick={submit}
          >
            {busy ? "Saving…" : (isEdit ? "Save" : "Save as draft")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TickerItemModal;
