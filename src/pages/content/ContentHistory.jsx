// Everything anyone has changed, newest first — the Studio's History screen.
//
// The home screen shows the last handful in a side panel; this is the full
// feed with filters, and it is where Undo actually belongs (a panel you glance
// at is the wrong place to revert someone else's work).
//
// It was a "Soon" nav row for a long time for a good reason: until revision
// recording covered every write path, this screen would have shown nothing but
// homepage publishes and looked broken. See content/admin_views.py's
// RecordsRevisions.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { getActivity, restoreRevision } from "../../api/admin_content_studio";
import { describeChange, KIND_WORD } from "./activityWords";
import { errText } from "../../utils/errText";
import Toast from "../../components/Toast";
import "../../css/ContentStudio.css";

const dayLabel = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long",
  });

const timeLabel = (at) =>
  new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const ContentHistory = () => {
  const [days, setDays] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const [kind, setKind] = useState("all");
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const toastTimer = useRef(null);

  const say = useCallback((m) => {
    clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // The cancel flag is created inside the effect, never a ref — StrictMode
  // runs this twice on mount and a ref would keep the first cleanup's `false`.
  useEffect(() => {
    let cancelled = false;
    getActivity(200)
      .then((data) => {
        if (cancelled) return;
        setDays(data.days || []);
        setCount(data.count || 0);
        setError("");
      })
      .catch((e) => { if (!cancelled) setError(errText(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  // Which kinds actually appear, so the filter never offers an empty option.
  const kinds = useMemo(() => {
    const seen = new Map();
    for (const day of days) {
      for (const item of day.items) {
        if (!seen.has(item.kind)) {
          seen.set(item.kind, KIND_WORD[item.kind] || item.kind_label || item.kind);
        }
      }
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [days]);

  const shown = useMemo(() => {
    if (kind === "all") return days;
    return days
      .map((d) => ({ ...d, items: d.items.filter((i) => i.kind === kind) }))
      .filter((d) => d.items.length);
  }, [days, kind]);

  const undo = async (item) => {
    setBusy(item.id);
    try {
      await restoreRevision(item.id);
      setLoading(true);   // set here, not in the effect: a synchronous setState
                          // in an effect body cascades renders (and lints).
      // Restoring records a FURTHER revision rather than deleting one, so the
      // feed grows by a row — refetch instead of patching it in.
      setReloadKey((k) => k + 1);
      say("Put back. The change before this one is what's live now.");
    } catch (e) {
      say(`Couldn’t undo that — ${errText(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">History</h1>
      <p className="cs-muted">
        Everything anyone has changed, newest first. Undo puts a single change
        back without touching anything else.
      </p>

      <div className="cs-toolbar">
        <label className="cs-field__label" htmlFor="hist-kind">Show</label>
        <select
          id="hist-kind" className="cs-input"
          value={kind} onChange={(e) => setKind(e.target.value)}
        >
          <option value="all">Everything</option>
          {kinds.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <span className="cs-card__count">{count}</span>
      </div>

      {loading && <p className="cs-muted">Loading…</p>}
      {error && <p className="cs-error" role="alert">{error}</p>}

      {!loading && !error && !shown.length && (
        <div className="cs-empty">
          <Clock size={20} aria-hidden="true" />
          <p>
            {kind === "all"
              ? "Nothing has been changed yet."
              : "Nothing of that kind has been changed yet."}
          </p>
        </div>
      )}

      {shown.map((day) => (
        <section key={day.date} className="cs-card cs-day">
          <p className="cs-day__label">{dayLabel(day.date)}</p>
          <ul className="cs-list cs-list--tight">
            {day.items.map((item) => (
              <li key={item.id} className="cs-list__row">
                <span className="cs-avatar" aria-hidden="true">
                  {(item.actor || "?").slice(0, 2).toUpperCase()}
                </span>
                <span className="cs-list__text">
                  <span className="cs-list__title">
                    {item.actor || "Someone"} {describeChange(item)}
                  </span>
                  <span className="cs-list__reason">
                    {timeLabel(item.at)}
                    {item.note ? ` · ${item.note}` : ""}
                  </span>
                </span>
                {item.can_restore ? (
                  <button
                    type="button"
                    className="cs-btn-ghost"
                    disabled={busy === item.id}
                    onClick={() => undo(item)}
                  >
                    <RotateCcw size={13} aria-hidden="true" />
                    {busy === item.id ? " Undoing…" : " Undo"}
                  </button>
                ) : (
                  // Deleted rows keep their snapshot for the record, but
                  // re-creating one would resurrect it under a new id and
                  // break anything that pointed at the old one.
                  <span className="cs-muted">Can’t be undone</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Toast message={toast} />
    </div>
  );
};

export default ContentHistory;
