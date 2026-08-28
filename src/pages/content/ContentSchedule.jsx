// What is going live, and when — the Studio's Schedule screen.
//
// A week at a time, because that is the window an editor plans in and the
// backend already groups by day (empty days come back too, so the grid never
// has to invent its own gaps).
//
// ⚠ Only posts and current affairs can be scheduled. They are the only two
// models carrying `publish_at`; the six StatusedContentModel ones have a
// status but no publish time, so they can be drafts or in review but never
// "going live on Tuesday". The empty state says so rather than implying the
// whole CMS can be scheduled.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { getCalendar } from "../../api/admin_content_studio";
import { errText } from "../../utils/errText";
import "../../css/ContentStudio.css";

// Local calendar date, NOT toISOString().slice(0,10). toISOString converts to
// UTC first, so local midnight in any timezone ahead of UTC lands on the
// previous day — in IST the week rendered as Sun–Sat starting a day early.
const iso = (d) => [
  d.getFullYear(),
  String(d.getMonth() + 1).padStart(2, "0"),
  String(d.getDate()).padStart(2, "0"),
].join("-");

const startOfWeek = (date) => {
  const d = new Date(date);
  // Monday-first, matching the backend's `today - today.weekday()`.
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  d.setHours(0, 0, 0, 0);
  return d;
};

const STATUS_WORD = {
  draft: "Draft",
  review: "In review",
  published: "Live",
  archived: "Hidden",
};

const ContentSchedule = () => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const range = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return { from: iso(weekStart), to: iso(end) };
  }, [weekStart]);

  useEffect(() => {
    let cancelled = false;
    getCalendar(range.from, range.to)
      .then((d) => { if (!cancelled) { setData(d); setError(""); } })
      .catch((e) => { if (!cancelled) setError(errText(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to]);

  const shift = useCallback((weeks) => {
    // Set here rather than in the fetch effect: a synchronous setState in an
    // effect body cascades renders (and lints).
    setLoading(true);
    setWeekStart((cur) => {
      const next = new Date(cur);
      next.setDate(next.getDate() + weeks * 7);
      return next;
    });
  }, []);

  const days = data?.days || [];
  const total = days.reduce((n, d) => n + d.items.length, 0);
  const thisWeek = iso(startOfWeek(new Date())) === range.from;

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Schedule</h1>
      <p className="cs-muted">
        What is going live, and when. Only posts and current affairs can be
        given a date — everything else goes live the moment you publish it.
      </p>

      <div className="cs-toolbar">
        <button type="button" className="cs-btn-ghost" onClick={() => shift(-1)}>
          <ChevronLeft size={14} aria-hidden="true" /> Previous week
        </button>
        <span className="cs-list__title">
          {new Date(`${range.from}T00:00:00`).toLocaleDateString(undefined, {
            day: "numeric", month: "long",
          })}
          {" – "}
          {new Date(`${range.to}T00:00:00`).toLocaleDateString(undefined, {
            day: "numeric", month: "long", year: "numeric",
          })}
        </span>
        <button type="button" className="cs-btn-ghost" onClick={() => shift(1)}>
          Next week <ChevronRight size={14} aria-hidden="true" />
        </button>
        {!thisWeek && (
          <button
            type="button"
            className="cs-btn-ghost"
            onClick={() => { setLoading(true); setWeekStart(startOfWeek(new Date())); }}
          >
            Back to this week
          </button>
        )}
        <span className="cs-card__count">{total}</span>
      </div>

      {loading && <p className="cs-muted">Loading…</p>}
      {error && <p className="cs-error" role="alert">{error}</p>}

      {!loading && !error && (
        <div className="cs-week">
          {days.map((day) => {
            const isToday = day.date === data?.today;
            return (
              <section
                key={day.date}
                className={`cs-card cs-weekday${isToday ? " is-today" : ""}`}
              >
                <p className="cs-day__label">
                  {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: "short", day: "numeric", month: "short",
                  })}
                  {isToday && <span className="cs-chip"> Today</span>}
                </p>

                {day.items.length === 0 ? (
                  <p className="cs-muted cs-muted--inset">Nothing</p>
                ) : (
                  <ul className="cs-list cs-list--tight">
                    {day.items.map((item, i) => (
                      <li key={`${item.url}-${i}`} className="cs-list__row">
                        <span className="cs-list__text">
                          <span className="cs-list__title">{item.title}</span>
                          <span className="cs-list__reason">
                            {new Date(item.at).toLocaleTimeString(undefined, {
                              hour: "numeric", minute: "2-digit",
                            })}
                            {" · "}
                            {STATUS_WORD[item.status] || item.status}
                          </span>
                        </span>
                        <Link to={item.url} className="cs-btn-ghost">Open</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {!loading && !error && total === 0 && (
        <div className="cs-empty">
          <CalendarClock size={20} aria-hidden="true" />
          <p>Nothing is scheduled this week.</p>
        </div>
      )}
    </div>
  );
};

export default ContentSchedule;
