// The "New exam" flow for the Competitive exams screen.
//
// Before this, /content/exams was a report with no way to add anything: its
// empty state said "No competitive exams are set up" and offered nothing, and
// the four objects an exam actually needs lived on four screens across two
// sections of the dashboard, in no stated order.
//
// ⚠ Three things make an exam that looks created but is invisible to every
// visitor, and all three are silent. This form names each one where the
// decision is made rather than after the fact:
//
//   1. The navbar and the catalog's competitive axis both key on the CATEGORY
//      link, not on the course being "coaching". No category, no listing.
//   2. Status defaults to Draft, which is invisible. The older New course
//      wizard never sent a status at all, so every exam it made was hidden
//      until someone separately found it in Courses and flipped it.
//   3. The URL is derived from the name on first save and never re-derived on
//      rename, so a typo in the name is permanent in the public link.
//
// Everything is one request. The backend does it in a transaction, so a card
// that fails to validate rolls the whole exam back rather than leaving a
// course with a silently missing card.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, CircleAlert, ExternalLink, Eye, EyeOff,
} from "lucide-react";
import { createExam, getExamOptions } from "../../api/admin_content_studio";
import { errText } from "../../utils/errText";

const STEPS = ["Basics", "Details", "Card"];

const EMPTY = {
  name: "",
  description: "",
  categoryId: "",
  newCategoryName: "",
  status: "COMING_SOON",
  detail: {
    level: "", duration_weeks: "", language: "English",
    syllabus: "", requirements: "", highlights: "", includes: "",
  },
  card: {
    create: true, level_label: "", fact_line: "", price_label: "",
    ribbon: "", icon: "book",
  },
};

/** Mirrors Course.save()'s slugify so the form can show the real public URL
 *  before it commits. Only an approximation of Django's slugify — it is a
 *  preview, and the response carries the authoritative slug. */
const previewSlug = (name) =>
  name.trim().toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");

const NewExamDialog = ({ onClose, onCreated }) => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [options, setOptions] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [result, setResult] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getExamOptions();
        if (!alive) return;
        setOptions(data);
        // Preselect the first competitive category that has no course yet —
        // an unused category is the most common half-built state on this
        // data, and it is exactly what someone is here to finish.
        const free = (data.categories || []).find((c) => !c.has_course);
        if (free) setForm((f) => ({ ...f, categoryId: String(free.id) }));
      } catch (e) {
        if (alive) setError(errText(e));
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { nameRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setDetail = (patch) =>
    setForm((f) => ({ ...f, detail: { ...f.detail, ...patch } }));
  const setCard = (patch) =>
    setForm((f) => ({ ...f, card: { ...f.card, ...patch } }));

  const makingNewCategory = form.categoryId === "__new__";
  const chosenStatus = useMemo(
    () => (options?.statuses || []).find((s) => s.value === form.status),
    [options, form.status],
  );

  const basicsReady =
    form.name.trim() &&
    (makingNewCategory ? form.newCategoryName.trim() : form.categoryId);

  const submit = async () => {
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        status: form.status,
        category: makingNewCategory
          ? { name: form.newCategoryName.trim() }
          : { id: Number(form.categoryId) },
        detail: {
          ...form.detail,
          duration_weeks: Number(form.detail.duration_weeks) || 0,
        },
        card: form.card.create ? form.card : { create: false },
      };
      const data = await createExam(payload);
      setResult(data);
      onCreated?.(data);
    } catch (e) {
      // The backend returns per-field messages for the three refusals that
      // matter (duplicate name, duplicate category slug, wrong group). Show
      // them against the field rather than as one opaque banner.
      const body = e?.response?.data;
      if (body && typeof body === "object" && !Array.isArray(body)) {
        setFieldErrors(body);
        if (body.name || body.category) setStep(0);
      }
      setError(errText(e));
    } finally {
      setSaving(false);
    }
  };

  // ── created ────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="cs-palette-overlay">
        <div className="cs-confirm cs-confirm--wide" role="dialog" aria-modal="true">
          <h2 className="cs-card__title">
            <Check size={16} aria-hidden="true" /> {result.course.title} created
          </h2>

          <p className="cs-field__hint">
            {result.in_navbar ? (
              <><Eye size={12} aria-hidden="true" /> It is listed in the navbar
                and on the courses page now.</>
            ) : (
              <><EyeOff size={12} aria-hidden="true" /> It is saved as a draft,
                so no visitor can see it yet.</>
            )}
          </p>

          <div className="cs-field">
            <span className="cs-field__label">Its public address</span>
            <p className="cs-field__hint cs-field__hint--tight">
              <code>{result.course.public_url}</code>{" "}
              <ExternalLink size={11} aria-hidden="true" />
            </p>
            <p className="cs-field__hint">
              This comes from the name and does not change if you rename the
              exam later.
            </p>
          </div>

          {result.category?.created && (
            <p className="cs-field__hint">
              A new category “{result.category.name}” was created and linked.
            </p>
          )}

          {!!result.next_steps?.length && (
            <div className="cs-field">
              <span className="cs-field__label">What it still needs</span>
              <ol className="cs-setup">
                {result.next_steps.map((s, i) => (
                  <li key={s} className="cs-setup__item">
                    <span className="cs-setup__n">{i + 1}</span>
                    <span><span className="cs-setup__why">{s}</span></span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="cs-confirm__actions">
            <button type="button" className="cs-btn-ghost" onClick={onClose}>
              Done
            </button>
            <a
              className="cs-btn-primary"
              href={`/courses?course=${result.course.id}`}
            >
              Add subjects <ArrowRight size={13} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── form ───────────────────────────────────────────────────────────
  return (
    <div
      className="cs-palette-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="cs-confirm cs-confirm--wide" role="dialog" aria-modal="true">
        <h2 className="cs-card__title">New competitive exam</h2>

        <div className="cs-steps">
          {STEPS.map((label, i) => (
            <span key={label} className={`cs-step${i <= step ? " is-done" : ""}`}>
              {i < step && <Check size={11} aria-hidden="true" />}
              {label}
            </span>
          ))}
        </div>

        {error && <p className="cs-error">{error}</p>}

        {step === 0 && (
          <>
            <div className="cs-field">
              <label className="cs-field__label" htmlFor="exam-name">
                What is it called
              </label>
              <input
                id="exam-name"
                ref={nameRef}
                className="cs-input cs-input--block"
                value={form.name}
                placeholder="NEET Preparation"
                onChange={(e) => set({ name: e.target.value })}
              />
              {fieldErrors.name && (
                <p className="cs-field__warn">{fieldErrors.name}</p>
              )}
              {form.name.trim() && !fieldErrors.name && (
                <p className="cs-field__hint">
                  Its address will be <code>/courses/{previewSlug(form.name)}</code>.
                  That is fixed once you save, even if you rename it.
                </p>
              )}
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="exam-category">
                Which category it belongs to
              </label>
              <select
                id="exam-category"
                className="cs-input cs-input--block"
                value={form.categoryId}
                onChange={(e) => set({ categoryId: e.target.value })}
              >
                <option value="">Choose one…</option>
                {(options?.categories || []).map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}{c.has_course ? "" : " — no course yet"}
                  </option>
                ))}
                <option value="__new__">＋ Create a new category…</option>
              </select>
              <p className="cs-field__hint">
                This is what puts the exam in the navbar and on the competitive
                tab of the courses page. Without it the exam exists but is
                listed nowhere.
              </p>
              {fieldErrors.category && (
                <p className="cs-field__warn">{fieldErrors.category}</p>
              )}
            </div>

            {makingNewCategory && (
              <div className="cs-field">
                <label className="cs-field__label" htmlFor="exam-newcat">
                  New category name
                </label>
                <input
                  id="exam-newcat"
                  className="cs-input cs-input--block"
                  value={form.newCategoryName}
                  placeholder="CLAT"
                  onChange={(e) => set({ newCategoryName: e.target.value })}
                />
                <p className="cs-field__hint">
                  Keep it short — this is the label visitors browse by.
                </p>
              </div>
            )}

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="exam-status">
                Should visitors see it
              </label>
              <select
                id="exam-status"
                className="cs-input cs-input--block"
                value={form.status}
                onChange={(e) => set({ status: e.target.value })}
              >
                {(options?.statuses || []).map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {chosenStatus && (
                <p
                  className={
                    form.status === "DRAFT" ? "cs-field__warn" : "cs-field__hint"
                  }
                >
                  {form.status === "DRAFT" && (
                    <CircleAlert size={12} aria-hidden="true" />
                  )}
                  {chosenStatus.consequence}
                </p>
              )}
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="exam-desc">
                One line about it
              </label>
              <textarea
                id="exam-desc"
                className="cs-textarea"
                rows={2}
                value={form.description}
                placeholder="Full-length NEET coaching with weekly mock tests."
                onChange={(e) => set({ description: e.target.value })}
              />
              <p className="cs-field__hint">
                Shown on the courses page and on this screen.
              </p>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="cs-field__hint">
              All optional — this fills the exam’s own page. You can add it
              later from the course editor.
            </p>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="exam-level">Level</label>
              <input
                id="exam-level"
                className="cs-input cs-input--block"
                value={form.detail.level}
                placeholder="Advanced"
                onChange={(e) => setDetail({ level: e.target.value })}
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="exam-weeks">
                How many weeks it runs
              </label>
              <input
                id="exam-weeks"
                type="number"
                min="0"
                className="cs-input cs-input--block"
                value={form.detail.duration_weeks}
                placeholder="52"
                onChange={(e) => setDetail({ duration_weeks: e.target.value })}
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="exam-lang">Language</label>
              <input
                id="exam-lang"
                className="cs-input cs-input--block"
                value={form.detail.language}
                onChange={(e) => setDetail({ language: e.target.value })}
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="exam-syllabus">
                What it covers
              </label>
              <textarea
                id="exam-syllabus"
                className="cs-textarea"
                rows={3}
                value={form.detail.syllabus}
                placeholder="Physics, Chemistry, Biology — full NCERT plus practice."
                onChange={(e) => setDetail({ syllabus: e.target.value })}
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="exam-highlights">
                What a student gets
              </label>
              <textarea
                id="exam-highlights"
                className="cs-textarea"
                rows={2}
                value={form.detail.highlights}
                placeholder="Daily practice sets · Weekly mock tests"
                onChange={(e) => setDetail({ highlights: e.target.value })}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="cs-field">
              <label className="cs-field__labelrow">
                <input
                  type="checkbox"
                  checked={form.card.create}
                  onChange={(e) => setCard({ create: e.target.checked })}
                />
                <span className="cs-field__label">
                  Put a card on the homepage
                </span>
              </label>
              <p className="cs-field__hint">
                Without a card the exam is still in the navbar and the courses
                page, just not in the Featured courses grid on the homepage.
              </p>
            </div>

            {form.card.create && (
              <>
                <div className="cs-field">
                  <label className="cs-field__label" htmlFor="card-level">
                    Chip on the card
                  </label>
                  <input
                    id="card-level"
                    className="cs-input cs-input--block"
                    value={form.card.level_label}
                    placeholder="Competitive exam"
                    onChange={(e) => setCard({ level_label: e.target.value })}
                  />
                </div>

                <div className="cs-field">
                  <label className="cs-field__label" htmlFor="card-fact">
                    The line under the title
                  </label>
                  <input
                    id="card-fact"
                    className="cs-input cs-input--block"
                    value={form.card.fact_line}
                    placeholder="1 Year · Online · Full access"
                    onChange={(e) => setCard({ fact_line: e.target.value })}
                  />
                </div>

                <div className="cs-field">
                  <label className="cs-field__label" htmlFor="card-icon">Icon</label>
                  <select
                    id="card-icon"
                    className="cs-input cs-input--block"
                    value={form.card.icon}
                    onChange={(e) => setCard({ icon: e.target.value })}
                  >
                    {(options?.icons || []).map((i) => (
                      <option key={i.value} value={i.value}>{i.label}</option>
                    ))}
                  </select>
                </div>

                <div className="cs-field">
                  <label className="cs-field__label" htmlFor="card-ribbon">
                    Corner ribbon
                  </label>
                  <input
                    id="card-ribbon"
                    className="cs-input cs-input--block"
                    value={form.card.ribbon}
                    placeholder="Optional — e.g. Popular"
                    onChange={(e) => setCard({ ribbon: e.target.value })}
                  />
                </div>
              </>
            )}
          </>
        )}

        <div className="cs-confirm__actions">
          {step > 0 && (
            <button
              type="button"
              className="cs-btn-ghost"
              disabled={saving}
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft size={13} aria-hidden="true" /> Back
            </button>
          )}
          <button
            type="button"
            className="cs-btn-ghost"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="cs-btn-primary"
              disabled={!basicsReady || !options}
              onClick={() => setStep((s) => s + 1)}
            >
              Next <ArrowRight size={13} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="cs-btn-primary"
              disabled={saving || !basicsReady}
              onClick={submit}
            >
              {saving ? "Creating…" : "Create exam"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewExamDialog;
