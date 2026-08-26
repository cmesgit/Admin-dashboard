// Course cards (design_handoff_content_studio Phase 6b).
//
// The homepage "Featured courses" grid, shown as the grid it actually is
// rather than as a table of rows. Two things this adds over the old tab:
//
//  1. The show/hide control is labelled with its CONSEQUENCE — "Showing" /
//     "Hidden from visitors" — not with a bare toggle whose meaning you have
//     to infer.
//  2. A "Linked to a real course" chip. A card can point at nothing in
//     particular, and until now there was no way to see which ones do.
//
// Heavy editing (image upload, gradient, course linking) stays in the existing
// Showcase editor — this screen deliberately does not reimplement 497 lines of
// form, it links to it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GripVertical, LayoutGrid, Link2, Plus } from "lucide-react";
import { getContentShowcase, updateContentShowcase } from "../../api/admin";
import { errText } from "../../utils/errText";
import Toast from "../../components/Toast";
import "../../css/ContentStudio.css";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "showing", label: "Showing" },
  { id: "hidden", label: "Hidden" },
  { id: "linked", label: "Linked to a course" },
];

const asList = (r) => (Array.isArray(r) ? r : r?.results || []);
const isShowing = (c) => c.status === "published";

const CourseCards = () => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const say = useCallback((m) => {
    clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getContentShowcase();
      setCards(asList(res));
      // safe() swallows a failure into [] — say so rather than showing an
      // empty grid that looks like "no cards".
      setError(res?.__failed
        ? "Couldn’t reach the server. This list may be incomplete — reload to try again."
        : "");
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (card) => {
    const next = isShowing(card) ? "draft" : "published";
    setBusy(card.id);
    const before = cards;
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, status: next } : c)));
    try {
      await updateContentShowcase(card.id, { status: next });
      say(next === "published"
        ? "Now showing on the homepage."
        : "Hidden from visitors. Nothing is deleted.");
    } catch (e) {
      setCards(before);
      say(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const visible = useMemo(() => {
    if (filter === "showing") return cards.filter(isShowing);
    if (filter === "hidden") return cards.filter((c) => !isShowing(c));
    if (filter === "linked") return cards.filter((c) => c.course);
    return cards;
  }, [cards, filter]);

  const showingCount = cards.filter(isShowing).length;

  return (
    <div className="dashboard-wrapper">
      <div className="cs-home__head">
        <div>
          <h1 className="dashboard-title">Course cards</h1>
          <p className="cs-home__sub">
            The cards in the “Featured courses” grid on the homepage.
          </p>
        </div>
        <Link to="/content?tab=showcase" className="cs-btn-primary">
          <Plus size={15} aria-hidden="true" /> Add a card
        </Link>
      </div>

      <div className="cs-pilltabs">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`cs-pill${filter === id ? " is-on" : ""}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
        <div className="cs-pilltabs__spacer" />
        <span className="cs-muted">
          {cards.length} card{cards.length === 1 ? "" : "s"} · {showingCount} showing
        </span>
      </div>

      {loading && <p className="cs-muted">Loading…</p>}
      {error && <p className="cs-error" role="alert">{error}</p>}

      {!loading && !error && visible.length === 0 && (
        <div className="cs-empty">
          <LayoutGrid size={20} aria-hidden="true" />
          <p>
            {cards.length === 0
              ? "No cards yet."
              : "No cards match that filter."}
          </p>
        </div>
      )}

      <div className="cs-cardgrid">
        {visible.map((c) => {
          const showing = isShowing(c);
          return (
            <article
              key={c.id}
              className={`cs-coursecard${showing ? "" : " is-hidden"}`}
            >
              <div
                className="cs-coursecard__banner"
                style={c.gradient_css ? { backgroundImage: c.gradient_css } : undefined}
              >
                <span className="cs-coursecard__grip" aria-hidden="true">
                  <GripVertical size={13} />
                </span>
                {c.ribbon && <span className="cs-coursecard__ribbon">{c.ribbon}</span>}
                {c.img && <img src={c.img} alt="" />}
              </div>

              <div className="cs-coursecard__body">
                <span className="cs-coursecard__title">{c.title}</span>
                <span className="cs-coursecard__meta">
                  {c.level_label || "No level set"}
                  {c.price_label ? ` · ₹${c.price_label}` : " · No price"}
                </span>

                {c.course ? (
                  <span className="cs-chip cs-tone-ok cs-coursecard__link">
                    <Link2 size={12} aria-hidden="true" />
                    Linked to {c.course_title || "a real course"}
                  </span>
                ) : (
                  <span className="cs-chip cs-tone-muted cs-coursecard__link">
                    Not linked to a course
                  </span>
                )}
              </div>

              <div className="cs-coursecard__foot">
                <button
                  type="button"
                  role="switch"
                  aria-checked={showing}
                  className={`cs-switch${showing ? " is-on" : ""}`}
                  disabled={busy === c.id}
                  onClick={() => toggle(c)}
                >
                  <span className="cs-switch__knob" />
                </button>
                <span className="cs-coursecard__state">
                  {showing ? "Showing" : "Hidden from visitors"}
                </span>
                <Link to="/content?tab=showcase" className="cs-btn-ghost">Edit</Link>
              </div>
            </article>
          );
        })}
      </div>

      <Toast message={toast} />
    </div>
  );
};

export default CourseCards;
