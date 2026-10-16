// Live ticker queue (design_handoff_live_ticker Phase 2a).
//
// One queue of items, each targeting one or more SLOTS on the public site.
// The left panel is the eight slots with live counts; picking one filters the
// queue to what would appear there.
//
// Create and Edit are regular links to dedicated editor routes, so they also
// support opening in another tab. Search and placement filters live in the URL.
//
// ⚠ Moderator.css is imported ON PURPOSE. `.mod-toast` is defined only there,
// every route is its own lazy chunk, and a screen that renders <Toast> without
// it shows an unstyled toast in normal flow on a hard refresh. Most Studio
// screens have this bug; this one does not.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  getTickerItems, updateTickerItem,
} from "../../api/admin_content_studio";
import { TICKER_SLOTS as SLOTS, slotsOf } from "./tickerSlots";
import { errText } from "../../utils/errText";
import Toast from "../../components/Toast";
import "../../css/ContentStudio.css";
import "../../css/Moderator.css";

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
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const slot = SLOTS.some((s) => s.id === params.get("slot")) ? params.get("slot") : null;
  const q = params.get("q") || "";
  const setFilter = (key, value) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    if (value) next.set(key, value);
    else next.delete(key);
    return next;
  }, { replace: true });
  const [refreshVersion, setRefreshVersion] = useState(0);
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

  useEffect(() => {
    if (!location.state?.tickerNotice) return;
    say(location.state.tickerNotice);
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location, navigate, say]);

  // Reflect saves from another browser tab when the admin returns to the queue.
  useEffect(() => {
    const refresh = () => setRefreshVersion((version) => version + 1);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

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
  }, [q, refreshVersion]);

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
          onChange={(e) => setFilter("q", e.target.value)}
          aria-label="Search ticker items"
        />
        <Link
          className="cs-btn-primary cs-btn-primary--sm"
          to={`/content/ticker/new${location.search}`}
        >
          Add an item
        </Link>
      </header>

      <div className="cs-editor__body">
        <aside className="cs-sectionlist">
          <p className="cs-sectionlist__label">Where it can show</p>

          <button
            type="button"
            className={`cs-sectionrow${slot === null ? " is-selected" : ""}`}
            onClick={() => setFilter("slot", null)}
          >
            <span>Everywhere</span>
            <span className="cs-chip cs-tone-muted">{items.length}</span>
          </button>

          {SLOTS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`cs-sectionrow${slot === s.id ? " is-selected" : ""}`}
              onClick={() => setFilter("slot", slot === s.id ? null : s.id)}
            >
              <span>
                {s.label}
                <small className="cs-muted"> · {s.where}</small>
              </span>
              {/* An unbuilt surface reports "soon", not "0". A zero here
                  reads as "nothing is scheduled", when the truth is that
                  nothing CAN appear yet however much is scheduled. */}
              <span className={`cs-chip ${
                !s.built ? "cs-tone-warn" : counts[s.id] ? "cs-tone-ok" : "cs-tone-muted"
              }`}>
                {s.built ? counts[s.id] : "soon"}
              </span>
            </button>
          ))}

          <p className="cs-sectionlist__note">
            Counts are what a visitor would see right now — items that are
            hidden, or outside their display window, are not counted. An item
            with no places chosen shows on the navbar strip. Places marked
            “soon” aren’t built yet: you can queue items for them now and they
            will start showing the day that screen ships.
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
                    <Link
                      className="cs-btn-ghost"
                      to={`/content/ticker/${it.id}/edit${location.search}`}
                      aria-label={`Edit “${it.message}”`}
                    >
                      Edit
                    </Link>
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
