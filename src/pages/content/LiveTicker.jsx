// Live ticker queue (design_handoff_live_ticker Phase 2a).
//
// One queue of items, each targeting one or more SLOTS on the public site.
// The left panel is the eight slots with live counts; picking one filters the
// queue to what would appear there.
//
// Phase 2a is read + toggle + filter. The create/edit modal (including the
// display window) is 2b — until then, items are authored on Questions &
// notices, which is where announcements have always lived.
//
// ⚠ Moderator.css is imported ON PURPOSE. `.mod-toast` is defined only there,
// every route is its own lazy chunk, and a screen that renders <Toast> without
// it shows an unstyled toast in normal flow on a hard refresh. Most Studio
// screens have this bug; this one does not.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { getTickerItems, updateTickerItem } from "../../api/admin_content_studio";
import { errText } from "../../utils/errText";
import Toast from "../../components/Toast";
import "../../css/ContentStudio.css";
import "../../css/Moderator.css";

// Mirrors content.models.TickerSlot. Order matches the enum so the panel
// reads the same as the API's error message.
const SLOTS = [
  { id: "navbar", label: "Navbar strip", where: "Every page, under the menu" },
  { id: "hero", label: "Homepage hero", where: "Cards inside the circle" },
  { id: "home_band", label: "Homepage band", where: "Between sections" },
  { id: "courses", label: "Courses rail", where: "Course listing pages" },
  { id: "dashboard", label: "Student dashboard", where: "The right-hand rail" },
  { id: "footer", label: "Footer strip", where: "Bottom of every page" },
  { id: "auth_login", label: "Login screen", where: "Under the sign-in form" },
  { id: "auth_signup", label: "Signup screen", where: "Under the join form" },
];

// Mirrors content.models.TickerKind — the eight the design actually draws.
const KIND_LABEL = {
  new_course: "New course",
  enrolment: "Enrolment",
  new_mentor: "New mentor",
  practice: "Practice set",
  deadline: "Deadline",
  milestone: "Milestone",
  current_affairs: "Current affairs",
  mentor_spotlight: "Mentor spotlight",
};

const asList = (r) => (Array.isArray(r) ? r : r?.results || []);
const isShowing = (it) => it.status === "published";

/** The server treats an empty `slots` as navbar-only (AnnouncementQuerySet
 *  .for_slot). The panel counts have to apply the SAME rule, or an item
 *  created without slots shows on the strip while this screen reports the
 *  navbar as empty — the two disagreeing is worse than either being wrong. */
const slotsOf = (it) => (it.slots?.length ? it.slots : ["navbar"]);

/** Read-only prose for the display window.
 *
 * ⚠ Formatted with toLocaleDateString, never `toISOString().slice(0, 10)`.
 * That truncation converts to UTC first, so any IST time before 05:30 prints
 * as the previous day — the trap recorded on ContentSchedule.jsx.
 */
const windowText = (it) => {
  const fmt = (iso) => new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
  const start = it.starts_at ? fmt(it.starts_at) : null;
  const end = it.ends_at ? fmt(it.ends_at) : null;
  if (start && end) return `${start} → ${end}`;
  if (start) return `From ${start}, no end date`;
  return "No display window";
};

const LiveTicker = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [slot, setSlot] = useState(null);       // null = every slot
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const reqRef = useRef(0);

  // Errors linger: 2.6s is not long enough to read a server message naming a
  // field you didn't touch, which is how a rejected toggle read as a dead
  // switch on the cards screen.
  const say = useCallback((m, tone = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ message: m, tone });
    toastTimer.current = setTimeout(
      () => setToast(null), tone === "error" ? 7000 : 2600,
    );
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Debounced search with an AbortController, per Labels.jsx. The `seq` guard
  // matters as much as the abort: a slow first response can still resolve
  // after a fast second one and overwrite fresher results.
  useEffect(() => {
    const controller = new AbortController();
    const seq = ++reqRef.current;
    const run = async () => {
      setLoading(true);
      try {
        const res = await getTickerItems(
          q.trim() ? { search: q.trim() } : undefined,
          { signal: controller.signal },
        );
        if (seq !== reqRef.current) return;
        setItems(asList(res));
        setError("");
      } catch (e) {
        if (controller.signal.aborted || seq !== reqRef.current) return;
        setError(errText(e));
      } finally {
        if (seq === reqRef.current) setLoading(false);
      }
    };
    const t = setTimeout(run, q ? 250 : 0);
    return () => { clearTimeout(t); controller.abort(); };
  }, [q]);

  const counts = useMemo(() => {
    const out = {};
    for (const s of SLOTS) out[s.id] = 0;
    for (const it of items) {
      if (!isShowing(it)) continue;      // count what a visitor would see
      for (const s of slotsOf(it)) if (s in out) out[s] += 1;
    }
    return out;
  }, [items]);

  const visible = useMemo(
    () => (slot ? items.filter((it) => slotsOf(it).includes(slot)) : items),
    [items, slot],
  );

  const toggle = async (item) => {
    const next = isShowing(item) ? "draft" : "published";
    setBusy(item.id);
    const before = items;
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, status: next } : x)));
    try {
      await updateTickerItem(item.id, { status: next });
      say(next === "published"
        ? "Now showing to visitors."
        : "Hidden from visitors. Nothing is deleted.");
    } catch (e) {
      setItems(before);              // revert — the server said no
      say(errText(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const showingCount = items.filter(isShowing).length;

  return (
    <div className="cs-editor">
      <header className="cs-publishbar">
        <div className="cs-publishbar__id">
          <span className="cs-publishbar__name">Live ticker</span>
          <span className="cs-publishbar__url">
            One queue. Each item picks the places it appears.
          </span>
        </div>
        {/* .cs-publishbar__id carries margin-right:auto, so no spacer here. */}
        <input
          type="search"
          className="cs-input"
          placeholder="Search the queue"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search ticker items"
        />
        <Link to="/content/questions" className="cs-btn-primary cs-btn-primary--sm">
          Add an item
        </Link>
      </header>

      <div className="cs-editor__body">
        <aside className="cs-sectionlist">
          <p className="cs-sectionlist__label">Where it can show</p>

          <button
            type="button"
            className={`cs-sectionrow${slot === null ? " is-selected" : ""}`}
            onClick={() => setSlot(null)}
          >
            <span>Everywhere</span>
            <span className="cs-chip cs-tone-muted">{items.length}</span>
          </button>

          {SLOTS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`cs-sectionrow${slot === s.id ? " is-selected" : ""}`}
              onClick={() => setSlot(slot === s.id ? null : s.id)}
            >
              <span>
                {s.label}
                <small className="cs-muted"> · {s.where}</small>
              </span>
              <span className={`cs-chip ${counts[s.id] ? "cs-tone-ok" : "cs-tone-muted"}`}>
                {counts[s.id]}
              </span>
            </button>
          ))}

          <p className="cs-sectionlist__note">
            Counts are what a visitor would see right now — items that are
            hidden, or outside their display window, are not counted. An item
            with no places chosen shows on the navbar strip.
          </p>
        </aside>

        <main className="cs-fields">
          {loading && <p className="cs-muted">Loading…</p>}
          {error && <p className="cs-error" role="alert">{error}</p>}

          {!loading && !error && (
            <p className="cs-muted">
              {items.length} item{items.length === 1 ? "" : "s"} · {showingCount} showing
              {slot && ` · filtered to ${SLOTS.find((s) => s.id === slot)?.label}`}
            </p>
          )}

          {!loading && !error && visible.length === 0 && (
            <div className="cs-empty">
              <Megaphone size={20} aria-hidden="true" />
              <p>
                {items.length === 0
                  ? "Nothing in the queue yet."
                  : "Nothing appears in this place yet."}
              </p>
            </div>
          )}

          {!loading && !error && visible.length > 0 && (
            <div className="cs-card cs-card--flush">
              {visible.map((it) => {
                const showing = isShowing(it);
                return (
                  <div className="cs-qrow" key={it.id}>
                    <div className="cs-qrow__text">
                      <span className="cs-qrow__title">{it.message}</span>
                      {it.body && <span className="cs-qrow__body">{it.body}</span>}

                      <span className="cs-steps">
                        {it.kind ? (
                          <span className="cs-chip cs-tone-info">
                            {KIND_LABEL[it.kind] || it.kind}
                          </span>
                        ) : (
                          <span className="cs-chip cs-tone-muted">Plain text</span>
                        )}
                        {slotsOf(it).map((s) => (
                          <span key={s} className="cs-chip cs-tone-muted">
                            {SLOTS.find((x) => x.id === s)?.label || s}
                          </span>
                        ))}
                        {it.pinned && (
                          <span className="cs-chip cs-tone-warn">Pinned</span>
                        )}
                      </span>

                      <span className="cs-muted">{windowText(it)}</span>
                    </div>

                    <div className="cs-qrow__spacer" />

                    <button
                      type="button"
                      role="switch"
                      aria-checked={showing}
                      aria-label={`${showing ? "Hide" : "Show"} “${it.message}”`}
                      className={`cs-switch${showing ? " is-on" : ""}`}
                      disabled={busy === it.id}
                      onClick={() => toggle(it)}
                    >
                      <span className="cs-switch__knob" />
                    </button>
                    <span className="cs-qrow__state">
                      {showing ? "Showing" : "Hidden from visitors"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <Toast message={toast?.message} tone={toast?.tone} />
    </div>
  );
};

export default LiveTicker;
