// The CMS landing screen (design_handoff_content_studio Phase 3).
//
// Opens with what is waiting rather than with a list of rows. Three panels
// load INDEPENDENTLY — inbox, calendar and activity each have their own
// loading and error state — so one slow query cannot blank the screen.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle, CalendarClock, Clock, FileText, HelpCircle, Image as ImageIcon,
  Layout, PenLine, Undo2, Megaphone,
} from "lucide-react";
import {
  getActivity, getCalendar, getInbox, restoreRevision,
} from "../../api/admin_content_studio";
import { errText } from "../../utils/errText";
import Toast from "../../components/Toast";
import { describeChange } from "./activityWords";
import "../../css/ContentStudio.css";
import "../../css/Moderator.css";

const KIND_ICON = {
  post: FileText, affair: FileText, answer: HelpCircle, notice: AlertCircle,
  card: Layout, page: Layout, picture: ImageIcon,
};

const START_ACTIONS = [
  { to: "/content/ticker/new", icon: Megaphone, title: "Create an advertisement", sub: "Choose a picture, placement and display dates." },
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
  const sequence = useRef(0);
  const mounted = useRef(false);
  const run = useCallback(() => {
    const request = ++sequence.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    Promise.resolve().then(fn)
      .then((data) => {
        if (mounted.current && request === sequence.current) setState({ data, loading: false, error: "" });
      })
      .catch((e) => {
        if (mounted.current && request === sequence.current) setState({ data: null, loading: false, error: errText(e) });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    mounted.current = true;
    run();
    return () => { mounted.current = false; sequence.current += 1; };
  }, [run]);
  return [state, run];
};

const Panel = ({ title, icon: Icon, count, children, state, empty, onRetry }) => (
  <section className="cs-card">
    <header className="cs-card__head">
      {Icon && <Icon size={15} aria-hidden="true" />}
      <h2 className="cs-card__title">{title}</h2>
      {count > 0 && <span className="cs-card__count">{count}</span>}
    </header>
    {state.loading && <p className="cs-muted">Loading…</p>}
    {!state.loading && state.error && (
      <div><p className="cs-error" role="alert">{state.error}</p>
        {onRetry && <button type="button" className="cs-btn-ghost" onClick={onRetry}>Try again</button>}
      </div>
    )}
    {!state.loading && !state.error && (count === 0 ? <p className="cs-muted">{empty}</p> : children)}
  </section>
);

const ContentStudioHome = () => {
  const navigate = useNavigate();
  const [inbox, reloadInbox] = useAsync(getInbox, []);
  const [calendar, reloadCalendar] = useAsync(() => getCalendar(), []);
  const [activity, reloadActivity] = useAsync(() => getActivity(8), []);
  const [undoing, setUndoing] = useState(null);
  // Admin-dashboard has no toast library — the convention here is a local
  // message cleared on a timer, rendered by the shared <Toast> (see
  // ContentPanel.jsx / ModeratorPanel.jsx).
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const say = useCallback((message, tone = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), tone === "error" ? 7000 : 2500);
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
      say(errText(e), "error");
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
            Manage website pages, advertisements, articles and featured course cards.
          </p>
        </div>
        <Link to="/content/blogs/new" className="cs-btn-primary">
          <PenLine size={15} aria-hidden="true" />
          Write a post
        </Link>
      </header>

      <section className="cs-card" aria-labelledby="content-start-guide">
        <h2 className="cs-card__title" id="content-start-guide">How changes reach your website</h2>
        <ul className="cs-publish-guide">
          <li><strong>Website pages:</strong> Text and picture edits save as drafts. Select Publish changes when you are ready for visitors to see them.</li>
          <li><strong>Advertisements:</strong> Save a draft, then turn on its switch in Advertisements. Check the display dates. Saving an already published advertisement updates it within those dates.</li>
          <li><strong>Course cards:</strong> Choose the visibility in the form. Saving a card marked Showing on the homepage makes it live immediately.</li>
        </ul>
      </section>

      <Panel
        title="Needs attention"
        count={inboxItems.length}
        state={inbox}
        onRetry={reloadInbox}
        empty="No items need attention right now."
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
          <h2 className="cs-card__title">Choose what to update</h2>
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
          onRetry={reloadCalendar}
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
          onRetry={reloadActivity}
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
                        {item.actor || "Someone"} {describeChange(item)}
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

      <Toast message={toast?.message} tone={toast?.tone} />
    </div>
  );
};

export default ContentStudioHome;
