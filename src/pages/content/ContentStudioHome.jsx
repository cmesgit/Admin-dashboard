// The CMS landing screen (design_handoff_content_studio Phase 3).
//
// Opens with what is waiting rather than with a list of rows. Three panels
// load INDEPENDENTLY — inbox, calendar and activity each have their own
// loading and error state — so one slow query cannot blank the screen.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle, CalendarClock, Clock, FileText, HelpCircle, Image as ImageIcon,
  Layout, PenLine, Undo2,
} from "lucide-react";
import {
  getActivity, getCalendar, getInbox, restoreRevision,
} from "../../api/admin_content_studio";
import { errText } from "../../utils/errText";
import Toast from "../../components/Toast";
import "../../css/ContentStudio.css";

const KIND_ICON = {
  post: FileText, affair: FileText, answer: HelpCircle, notice: AlertCircle,
  card: Layout, page: Layout, picture: ImageIcon,
};

const START_ACTIONS = [
  { to: "/content/blogs/new", icon: PenLine, title: "Write a post", sub: "A blog article or a chapter." },
  // Straight to the Studio screens. Routing through /content?tab= meant
  // downloading and evaluating the 42KB ContentPanel chunk just to render a
  // <Navigate> — and ?tab=home opened the LEGACY homepage tab rather than the
  // split editor with preview, checklist and autosave that this screen fronts.
  { to: "/content/questions", icon: HelpCircle, title: "Answer a question", sub: "Adds to the questions on any page." },
  { to: "/content/pages/home", icon: Layout, title: "Edit the home page", sub: "Change what visitors see first." },
  { to: "/content/cards", icon: ImageIcon, title: "Add a course card", sub: "Feature a course on the homepage." },
];

/** One independently-loading panel's state. */
const useAsync = (fn, deps = []) => {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const run = useCallback(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fn()
      .then((data) => { if (alive) setState({ data, loading: false, error: "" }); })
      .catch((e) => { if (alive) setState({ data: null, loading: false, error: errText(e) }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => run(), [run]);
  return [state, run];
};

const Panel = ({ title, icon: Icon, count, children, state, empty }) => (
  <section className="cs-card">
    <header className="cs-card__head">
      {Icon && <Icon size={15} aria-hidden="true" />}
      <h2 className="cs-card__title">{title}</h2>
      {count > 0 && <span className="cs-card__count">{count}</span>}
    </header>
    {state.loading && <p className="cs-muted">Loading…</p>}
    {!state.loading && state.error && (
      <p className="cs-error" role="alert">{state.error}</p>
    )}
    {!state.loading && !state.error && (count === 0 ? <p className="cs-muted">{empty}</p> : children)}
  </section>
);

const ContentStudioHome = () => {
  const navigate = useNavigate();
  const [inbox, reloadInbox] = useAsync(getInbox, []);
  const [calendar] = useAsync(() => getCalendar(), []);
  const [activity, reloadActivity] = useAsync(() => getActivity(8), []);
  const [undoing, setUndoing] = useState(null);
  // Admin-dashboard has no toast library — the convention here is a local
  // message cleared on a timer, rendered by the shared <Toast> (see
  // ContentPanel.jsx / ModeratorPanel.jsx).
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const say = useCallback((message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const undo = async (id) => {
    setUndoing(id);
    try {
      await restoreRevision(id);
      say("Change reverted.");
      reloadActivity();
      reloadInbox();
    } catch (e) {
      say(errText(e));
    } finally {
      setUndoing(null);
    }
  };

  const inboxItems = (inbox.data?.groups || []).flatMap((g) =>
    g.items.map((i) => ({ ...i, group: g.label })),
  );
  const activityDays = activity.data?.days || [];
  const activityCount = activityDays.reduce((n, d) => n + d.items.length, 0);

  return (
    <div className="cs-home">
      <header className="cs-home__head">
        <div>
          <h1 className="cs-home__greeting">Content</h1>
          <p className="cs-home__sub">
            Everything on the website that isn’t a course — and what’s waiting on you.
          </p>
        </div>
        <Link to="/content/blogs/new" className="cs-btn-primary">
          <PenLine size={15} aria-hidden="true" />
          Write something
        </Link>
      </header>

      <Panel
        title="Needs you"
        count={inboxItems.length}
        state={inbox}
        empty="Nothing is waiting. Everything is published or deliberately hidden."
      >
        <ul className="cs-list">
          {inboxItems.map((item, i) => {
            const Icon = KIND_ICON[item.kind] || FileText;
            return (
              <li key={`${item.kind}-${item.url}-${i}`} className="cs-list__row">
                <span className={`cs-tile cs-state-${item.state}`}>
                  <Icon size={15} aria-hidden="true" />
                </span>
                <span className="cs-list__text">
                  <span className="cs-list__title">{item.title}</span>
                  <span className="cs-list__reason">{item.reason}</span>
                </span>
                <span className={`cs-chip cs-state-${item.state}`}>{item.group}</span>
                <button
                  type="button"
                  className="cs-btn-ghost"
                  onClick={() => navigate(item.url)}
                >
                  Open
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>

      <section className="cs-card">
        <header className="cs-card__head">
          <h2 className="cs-card__title">Start something</h2>
        </header>
        <div className="cs-start-grid">
          {START_ACTIONS.map(({ to, icon: Icon, title, sub }) => (
            <Link key={to} to={to} className="cs-start-card">
              <span className="cs-tile"><Icon size={15} aria-hidden="true" /></span>
              <span className="cs-start-card__title">{title}</span>
              <span className="cs-start-card__sub">{sub}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="cs-home__split">
        <Panel
          title="This week"
          icon={CalendarClock}
          count={calendar.data?.days?.length || 0}
          state={calendar}
          empty="Nothing is scheduled."
        >
          <div className="cs-week">
            {(calendar.data?.days || []).map((d) => {
              const isToday = d.date === calendar.data?.today;
              const day = new Date(`${d.date}T00:00:00`);
              return (
                <div key={d.date} className={`cs-week__cell${isToday ? " is-today" : ""}`}>
                  <span className="cs-week__dow">
                    {day.toLocaleDateString(undefined, { weekday: "narrow" })}
                  </span>
                  <span className="cs-week__num">{day.getDate()}</span>
                  <span className="cs-week__dots">
                    {d.items.slice(0, 3).map((_, i) => (
                      <i key={i} className="cs-week__dot" />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          <ul className="cs-list cs-list--tight">
            {(calendar.data?.days || [])
              .flatMap((d) => d.items.map((i) => ({ ...i, date: d.date })))
              .map((item, i) => (
                <li key={`${item.url}-${i}`} className="cs-list__row">
                  <span className="cs-list__text">
                    <span className="cs-list__title">{item.title}</span>
                    <span className="cs-list__reason">
                      {new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: "long", day: "numeric", month: "short",
                      })}
                    </span>
                  </span>
                  <Link to={item.url} className="cs-btn-ghost">Open</Link>
                </li>
              ))}
            {(calendar.data?.days || []).every((d) => !d.items.length) && (
              <li className="cs-muted cs-muted--inset">
                Nothing is scheduled this week.
              </li>
            )}
          </ul>
        </Panel>

        <Panel
          title="Recent changes"
          icon={Clock}
          count={activityCount}
          state={activity}
          empty="No changes recorded yet."
        >
          {activityDays.map((day) => (
            <div key={day.date} className="cs-day">
              <p className="cs-day__label">
                {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "long", day: "numeric", month: "short",
                })}
              </p>
              <ul className="cs-list cs-list--tight">
                {day.items.map((item) => (
                  <li key={item.id} className="cs-list__row">
                    <span className="cs-avatar" aria-hidden="true">
                      {(item.actor || "?").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="cs-list__text">
                      <span className="cs-list__title">
                        {item.actor || "Someone"} {item.action} a {item.kind_label.toLowerCase()}
                      </span>
                      <span className="cs-list__reason">
                        {item.note || new Date(item.at).toLocaleTimeString(undefined, {
                          hour: "numeric", minute: "2-digit",
                        })}
                      </span>
                    </span>
                    {item.can_restore && (
                      <button
                        type="button"
                        className="cs-btn-ghost"
                        disabled={undoing === item.id}
                        onClick={() => undo(item.id)}
                      >
                        <Undo2 size={13} aria-hidden="true" />
                        {undoing === item.id ? "Undoing…" : "Undo"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Panel>
      </div>

      <Toast message={toast} />
    </div>
  );
};

export default ContentStudioHome;
