// Competitive exams (design_handoff_content_studio Phase 8).
//
// The one screen in the Studio whose job is to tell you something
// uncomfortable: the exams are already in the navbar and on /courses, and
// there is nothing behind them. Every number here is a real count, so when it
// says zero subjects, there are zero subjects.
//
// ⚠ An exam is a COURSE, not a board. `Add content` deep-links into the
// existing course editor rather than rebuilding subject and chapter editing
// inside the CMS.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BookOpen, Check, CircleAlert, EyeOff, GraduationCap, Layers,
  Lock, Plus,
} from "lucide-react";
import { getExamReadiness } from "../../api/admin_content_studio";
import { errText } from "../../utils/errText";
import Toast from "../../components/Toast";
import NewExamDialog from "./NewExamDialog";
import "../../css/ContentStudio.css";

const SETUP_STEPS = [
  { n: 1, title: "Name the subjects", why: "An exam with no subjects has nothing to open." },
  { n: 2, title: "List one subject's chapters", why: "Enough to see the shape of it." },
  { n: 3, title: "Add one piece of material", why: "This is what makes it stop saying “Coming soon”." },
  {
    n: 4, title: "Schedule one test", why: "Quiz scheduling doesn’t exist yet.",
    blocked: true,
  },
];

const ExamReadiness = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const say = useCallback((m) => {
    clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // `quiet` skips the loading state. It has to exist: the whole screen
  // early-returns "Loading…" while `loading` is true, which unmounts the
  // create dialog along with it — so a refresh triggered from inside that
  // dialog destroyed it and remounted a blank one at step 1, throwing away
  // the confirmation screen the user had just earned.
  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      setData(await getExamReadiness());
      setError("");
    } catch (e) {
      setError(errText(e));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The dialog stays open on its own confirmation screen, so the list is
  // refreshed underneath it rather than on close — by the time it is
  // dismissed the new exam is already in the table behind it.
  const handleCreated = useCallback((created) => {
    say(`${created.course.title} created.`);
    load({ quiet: true });
  }, [load, say]);

  if (loading) {
    return <div className="dashboard-wrapper"><p className="cs-muted">Loading…</p></div>;
  }
  if (error) {
    return <div className="dashboard-wrapper"><p className="cs-error">{error}</p></div>;
  }

  const { exams = [], summary = {}, pipeline = [], suggested_id: suggested } = data || {};
  const focus = exams.find((e) => e.id === suggested);

  const tiles = [
    { icon: GraduationCap, value: summary.in_navbar ?? summary.total, label: "live in the navbar" },
    {
      icon: Layers, value: summary.with_subjects,
      // "1 have any subjects" reads as a bug even though the number is right.
      label: summary.with_subjects === 1 ? "has any subjects" : "have any subjects",
    },
    { icon: CircleAlert, value: summary.coming_soon, label: "showing “Coming soon”" },
    { icon: BookOpen, value: focus ? 1 : 0, label: "worth finishing first" },
    ...(summary.not_published
      ? [{
          icon: EyeOff, value: summary.not_published,
          label: summary.not_published === 1
            ? "exists but isn’t published" : "exist but aren’t published",
        }]
      : []),
  ];

  return (
    <div className="dashboard-wrapper">
      <div className="cs-grouphead">
        <h1 className="dashboard-title">Competitive exams</h1>
        <button
          type="button"
          className="cs-btn-primary cs-btn-primary--sm"
          onClick={() => setCreating(true)}
        >
          <Plus size={13} aria-hidden="true" /> New exam
        </button>
      </div>
      <p className="cs-home__sub">
        {summary.total === 0
          ? "No competitive exams exist yet."
          : `${summary.in_navbar ?? summary.total} exam${(summary.in_navbar ?? summary.total) === 1 ? " is" : "s are"} already in the navbar and on the courses page.` +
            (summary.coming_soon
              ? ` ${summary.coming_soon === summary.total ? "None of them has" : "Some have"} any content yet, so ${summary.coming_soon === 1 ? "it says" : "they say"} “Coming soon” to visitors.`
              : "")}
      </p>

      <div className="cs-tilerow">
        {tiles.map(({ icon: Icon, value, label }) => (
          <div key={label} className="cs-tile-card">
            <span className="cs-tile"><Icon size={16} aria-hidden="true" /></span>
            <span className="cs-tile-card__value">{value ?? 0}</span>
            <span className="cs-tile-card__label">{label}</span>
          </div>
        ))}
      </div>

      <div className="cs-exams">
        <section className="cs-card cs-card--flush">
          <div className="cs-grouphead">
            <span>How far each one has got</span>
            <span className="cs-grouphead__count">{pipeline.join(" → ")}</span>
          </div>

          {exams.length === 0 && (
            <div className="cs-empty">
              <GraduationCap size={20} aria-hidden="true" />
              <p>No competitive exams are set up.</p>
              <button
                type="button"
                className="cs-btn-primary cs-btn-primary--sm"
                onClick={() => setCreating(true)}
              >
                <Plus size={13} aria-hidden="true" /> Add the first one
              </button>
            </div>
          )}

          {exams.map((e) => (
            <div
              key={e.id}
              className={`cs-examrow${e.id === suggested ? " is-focus" : ""}`}
            >
              <div className="cs-examrow__head">
                <span className="cs-examrow__name">{e.name}</span>
                <span className={`cs-chip ${e.state === "live" ? "cs-tone-ok" : "cs-tone-warn"}`}>
                  {e.state === "live" ? "Live" : "Coming soon"}
                </span>
                {e.in_navbar === false && (
                  <span
                    className="cs-chip cs-tone-muted"
                    title={`Course status: ${e.course_status}. Visitors can’t reach it.`}
                  >
                    <EyeOff size={11} aria-hidden="true" />
                    not published
                  </span>
                )}
              </div>
              {e.blurb && <p className="cs-examrow__blurb">{e.blurb}</p>}

              <div className="cs-steps">
                {e.steps.map((s) => (
                  <span
                    key={s.key}
                    className={`cs-step${s.done ? " is-done" : ""}`}
                    title={s.done ? `${s.count} ${s.label.toLowerCase()}` : `No ${s.label.toLowerCase()} yet`}
                  >
                    {s.done && <Check size={11} aria-hidden="true" />}
                    {s.label}
                  </span>
                ))}
                <Link to={e.edit_url} className="cs-btn-ghost cs-steps__action">
                  Add content <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </div>
            </div>
          ))}
        </section>

        <aside className="cs-examrail">
          <div className="cs-card">
            <h2 className="cs-card__title">Finish one, not seven</h2>
            <p className="cs-field__hint">
              {focus
                ? `Doing ${focus.name} properly will show you what the others need.`
                : "Every exam is either done or not started."}
            </p>

            <ol className="cs-setup">
              {SETUP_STEPS.map((s) => (
                <li key={s.n} className={`cs-setup__item${s.blocked ? " is-blocked" : ""}`}>
                  <span className="cs-setup__n">
                    {s.blocked ? <Lock size={11} aria-hidden="true" /> : s.n}
                  </span>
                  <span>
                    <span className="cs-setup__title">{s.title}</span>
                    <span className="cs-setup__why">{s.why}</span>
                  </span>
                </li>
              ))}
            </ol>

            {focus && (
              <Link to={focus.edit_url} className="cs-btn-primary cs-btn-primary--sm">
                Set up {focus.name} <ArrowRight size={13} aria-hidden="true" />
              </Link>
            )}
          </div>

          <p className="cs-note cs-note--warn">
            An exam is a <strong>course</strong> here, not a board. It has no
            board, which is why it never showed up under a board filter.
          </p>
        </aside>
      </div>

      {creating && (
        <NewExamDialog
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      )}
      <Toast message={toast} />
    </div>
  );
};

export default ExamReadiness;
