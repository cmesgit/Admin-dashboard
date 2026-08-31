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
import { GripVertical, LayoutGrid, Link2, Plus, Trash2 } from "lucide-react";
import {
  createContentShowcase, deleteContentShowcase, fetchAllPages, getContentShowcase,
  updateContentShowcase,
} from "../../api/admin";
import { reorderShowcaseCards } from "../../api/admin_content_studio";
import { buildBody } from "../../utils/buildBody";
import CardFormModal from "./CardFormModal";
import ShowcaseCategoryManager from "./ShowcaseCategoryManager";
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
  const [modal, setModal] = useState(null);   // { mode, initial }
  const [formError, setFormError] = useState("");
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
      const res = await fetchAllPages(getContentShowcase);
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

  const submit = async (payload, file) => {
    setBusy("form");
    setFormError("");
    try {
      const { data, isMultipart } = buildBody(payload, file, "image");
      if (modal.mode === "edit") {
        await updateContentShowcase(modal.initial.id, data, isMultipart);
      } else {
        await createContentShowcase(data, isMultipart);
      }
      say(modal.mode === "edit" ? "Saved." : "Card added.");
      setModal(null);
      // Refetch rather than patching the response in: a card linked to a
      // course derives its title, price and thumbnail server-side on every
      // read, so the row this screen should show is the one the server
      // computes, not the one we sent.
      load();
    } catch (e) {
      // Keep the modal open with the reason — a card form holds a lot of
      // typing and closing it on failure loses all of it.
      setFormError(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (card) => {
    setBusy(card.id);
    try {
      await deleteContentShowcase(card.id);
      say(`Deleted “${card.title}”.`);
      setCards((cs) => cs.filter((c) => c.id !== card.id));
    } catch (e) {
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

  // ── Drag to reorder ────────────────────────────────────────────────
  //
  // Only on the unfiltered view. The endpoint demands EVERY card id in one
  // ordered list (and 400s otherwise, deliberately, so a stale tab cannot
  // reshuffle the homepage) — but `visible` is a subset under any other
  // filter, and "move this card up" has no single meaning when the cards
  // between it and its neighbour are hidden from you. The grip says so rather
  // than failing on drop.
  //
  // Until now `order` could only be changed by typing an integer into each
  // card's edit form, one card at a time, while this grid rendered a grip with
  // `cursor: grab` and no handlers at all.
  const canReorder = filter === "all";
  const [dragId, setDragId] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const onDropOn = async (targetId) => {
    const sourceId = dragId;
    setDragId(null);
    if (!sourceId || sourceId === targetId || !canReorder) return;

    const from = cards.findIndex((c) => c.id === sourceId);
    const to = cards.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;

    const next = cards.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    const previous = cards;
    setCards(next);           // optimistic
    setSavingOrder(true);
    try {
      await reorderShowcaseCards(next.map((c) => c.id));
      say("Order saved.");
    } catch (e) {
      setCards(previous);     // revert — same pattern as PageEditor's reorder
      setError(errText(e));
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <div className="cs-home__head">
        <div>
          <h1 className="dashboard-title">Course cards</h1>
          <p className="cs-home__sub">
            The cards in the “Featured courses” grid on the homepage.
          </p>
        </div>
        <button
          type="button"
          className="cs-btn-primary"
          onClick={() => setModal({ mode: "create", initial: null })}
        >
          <Plus size={15} aria-hidden="true" /> Add a card
        </button>
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

      {/* The tabs that filter the grid below, on the same screen as the
          grid they filter — which is how they appear on the public site. */}
      <ShowcaseCategoryManager say={say} />

      <div className="cs-cardgrid">
        {visible.map((c) => {
          const showing = isShowing(c);
          return (
            <article
              key={c.id}
              className={`cs-coursecard${showing ? "" : " is-hidden"}`
                + (dragId === c.id ? " is-dragging" : "")}
              draggable={canReorder && !savingOrder}
              onDragStart={() => setDragId(c.id)}
              onDragEnd={() => setDragId(null)}
              // Without preventDefault the drop event never fires — the
              // browser's default is to reject the drag.
              onDragOver={(e) => { if (canReorder) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); onDropOn(c.id); }}
            >
              <div
                className="cs-coursecard__banner"
                // `gradient_css` stores the STOPS only ("rgba(...),rgba(...)"),
                // not a complete CSS value — the public card supplies the
                // `linear-gradient(135deg, …)` wrapper. Assigning the stops
                // straight to backgroundImage is not a valid declaration, so
                // this banner silently rendered no gradient at all and an
                // admin could never see what the card would actually look
                // like. Same wrapper and angle as the homepage.
                style={
                  c.gradient_css
                    ? { backgroundImage: `linear-gradient(135deg,${c.gradient_css})` }
                    : undefined
                }
              >
                {/* Was aria-hidden with cursor:grab and no handlers — a
                    control that looked draggable and was not. It now either
                    drags or explains why it cannot. */}
                <span
                  className={`cs-coursecard__grip${canReorder ? "" : " is-disabled"}`}
                  title={
                    canReorder
                      ? "Drag to reorder the homepage grid"
                      : "Switch to the All filter to reorder — the homepage order "
                        + "covers every card, including the ones this filter hides"
                  }
                >
                  <GripVertical size={13} aria-hidden="true" />
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
                <button
                  type="button"
                  className="cs-btn-ghost"
                  onClick={() => setModal({ mode: "edit", initial: c })}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="cs-btn-ghost"
                  disabled={busy === c.id}
                  onClick={() => remove(c)}
                  aria-label={`Delete ${c.title}`}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {modal && (
        <CardFormModal
          mode={modal.mode}
          initial={modal.initial}
          busy={busy === "form"}
          error={formError}
          onSubmit={submit}
          onCancel={() => { setModal(null); setFormError(""); }}
        />
      )}

      <Toast message={toast} />
    </div>
  );
};

export default CourseCards;
