// Practice sets — what the public Quiz Hub actually puts in front of a
// visitor (design_handoff_public_quiz_hub Phase 5b).
//
// ⚠ A SET DOES NOT CONTAIN QUESTIONS. It stores the criteria that select
// them — a subject, optionally an exam and a difficulty, and a size — and the
// paper is resolved from the bank every time someone opens it. Two things
// follow, and both surprise people:
//
//   · "Ready now" moves on its own. Accept more questions in the Question
//     Bank and every set over that subject grows without being touched.
//   · Two sets over the same subject differ only by their start offset. With
//     a thinly curated subject they will overlap heavily — the fix is more
//     accepted questions, not more sets.
//
// The server refuses to PUBLISH a set that matches nothing, because a card
// that opens onto an empty paper is the exact lie this page exists to avoid.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, LayoutList, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createPracticeSet, deletePracticeSet, getPracticeSets, getQuestionTags,
  updatePracticeSet,
} from "../api/admin_question_bank";
import { errText } from "../utils/errText";
import Toast from "../components/Toast";
import "../css/ContentStudio.css";
import "../css/Moderator.css";

const STATUSES = [
  { value: "", label: "All sets" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

const DIFFICULTIES = [
  { value: "", label: "Any difficulty" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const isFlagOff = (e) => e?.response?.status === 503;

const blank = () => ({
  title: "", description: "", subject_tag: "", exam_tag: "",
  difficulty: "", question_count: 10, minutes: 10, seed: 0,
  status: "draft", display_order: 0,
});

const SetFormModal = ({ initial, tags, busy, error, onSubmit, onCancel }) => {
  const editing = !!initial?.id;
  const [form, setForm] = useState(() => (
    editing
      ? {
        title: initial.title ?? "",
        description: initial.description ?? "",
        subject_tag: initial.subject_tag ?? "",
        exam_tag: initial.exam_tag ?? "",
        difficulty: initial.difficulty ?? "",
        question_count: initial.question_count ?? 10,
        minutes: initial.minutes ?? 10,
        seed: initial.seed ?? 0,
        status: initial.status ?? "draft",
        display_order: initial.display_order ?? 0,
      }
      : blank()
  ));

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const subjects = tags.filter((t) => t.kind === "subject");
  const exams = tags.filter((t) => t.kind === "exam");
  const subject = subjects.find((s) => String(s.id) === String(form.subject_tag));

  const valid = form.title.trim() && form.subject_tag
    && Number(form.question_count) > 0;

  const submit = () => {
    if (!valid || busy) return;
    onSubmit({
      title: form.title.trim(),
      description: form.description.trim(),
      subject_tag: form.subject_tag,
      // "" is not a pk — send null to clear the optional FK.
      exam_tag: form.exam_tag || null,
      difficulty: form.difficulty,
      question_count: Number(form.question_count),
      minutes: Number(form.minutes),
      seed: Number(form.seed),
      status: form.status,
      display_order: Number(form.display_order),
    });
  };

  return (
    <div
      className="cs-palette-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
    >
      <div className="cs-confirm cs-confirm--wide" role="dialog" aria-modal="true">
        <h2 className="cs-card__title">
          {editing ? "Edit this set" : "New practice set"}
        </h2>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="ps-title">Title</label>
          <input
            id="ps-title" className="cs-input cs-input--block" autoFocus
            value={form.title} onChange={set("title")}
            placeholder="e.g. Ancient India — SSC History Quiz 01"
          />
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="ps-desc">
            Description <span className="cs-muted">(shown on the card)</span>
          </label>
          <textarea
            id="ps-desc" className="cs-input cs-input--block" rows={2}
            value={form.description} onChange={set("description")}
            placeholder="Indus Valley, Mauryan and Gupta periods."
          />
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="ps-subject">Subject</label>
          <div className="cs-select-wrap">
            <select
              id="ps-subject" className="cs-select"
              value={form.subject_tag} onChange={set("subject_tag")}
            >
              <option value="">Pick a subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} — {s.question_count} ready
                </option>
              ))}
            </select>
          </div>
          {subject && subject.question_count === 0 && (
            <p className="cs-field__warn">
              Nothing in the bank is ready for {subject.label} yet, so this can
              only be saved as a draft. Accept some questions first.
            </p>
          )}
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="ps-exam">
            Exam <span className="cs-muted">(optional — narrows the questions)</span>
          </label>
          <div className="cs-select-wrap">
            <select
              id="ps-exam" className="cs-select"
              value={form.exam_tag} onChange={set("exam_tag")}
            >
              <option value="">Any exam</option>
              {exams.map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="ps-diff">Difficulty</label>
          <div className="cs-select-wrap">
            <select
              id="ps-diff" className="cs-select"
              value={form.difficulty} onChange={set("difficulty")}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="ps-count">
            How many questions
          </label>
          <input
            id="ps-count" className="cs-input" inputMode="numeric"
            value={form.question_count} onChange={set("question_count")}
          />
          <p className="cs-field__hint">
            A target, not a guarantee — a set serves whatever the bank can
            currently supply, up to this.
          </p>
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="ps-mins">Minutes</label>
          <input
            id="ps-mins" className="cs-input" inputMode="numeric"
            value={form.minutes} onChange={set("minutes")}
          />
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="ps-seed">
            Start offset
          </label>
          <input
            id="ps-seed" className="cs-input" inputMode="numeric"
            value={form.seed} onChange={set("seed")}
          />
          <p className="cs-field__hint">
            Two sets over the same subject differ only by this. Give each a
            different number, or they serve nearly the same paper.
          </p>
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="ps-order">
            Display order
          </label>
          <input
            id="ps-order" className="cs-input" inputMode="numeric"
            value={form.display_order} onChange={set("display_order")}
          />
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="ps-status">
            On the public site?
          </label>
          <div className="cs-select-wrap">
            <select
              id="ps-status" className="cs-select"
              value={form.status} onChange={set("status")}
            >
              <option value="draft">Draft — nobody can see it</option>
              <option value="published">Published — anyone can practise it</option>
            </select>
          </div>
        </div>

        {error && <p className="cs-error" role="alert">{error}</p>}

        <div className="cs-confirm__actions">
          <button type="button" className="cs-btn-ghost"
            disabled={busy} onClick={onCancel}>Cancel</button>
          <button type="button" className="cs-btn-primary"
            disabled={!valid || busy} onClick={submit}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create set"}
          </button>
        </div>
      </div>
    </div>
  );
};

const PracticeSets = () => {
  const [rows, setRows] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flagOff, setFlagOff] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const say = useCallback((m) => {
    clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const load = useCallback(async (state) => {
    setLoading(true);
    try {
      const params = state ? { status: state } : {};
      const data = await getPracticeSets(params);
      setRows(data.results || []);
      setError("");
      setFlagOff(false);
    } catch (e) {
      if (isFlagOff(e)) { setFlagOff(true); setRows([]); }
      else setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(statusFilter); }, [statusFilter, load]);
  useEffect(() => {
    getQuestionTags()
      .then((d) => setTags(Array.isArray(d) ? d : d?.results || []))
      .catch(() => setTags([]));
  }, []);

  const handleSubmit = async (body) => {
    setBusy(true);
    setFormError("");
    try {
      if (modal?.initial?.id) {
        await updatePracticeSet(modal.initial.id, body);
        say("Saved.");
      } else {
        await createPracticeSet(body);
        say("Set created.");
      }
      setModal(null);
      await load(statusFilter);
    } catch (e) {
      // The publish guard answers 400 with a sentence under `status`. Surface
      // that sentence, not a generic "request failed".
      setFormError(e?.response?.data?.status || errText(e));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await deletePracticeSet(confirm.id);
      say("Deleted.");
      setConfirm(null);
      await load(statusFilter);
    } catch (e) {
      if (e?.response?.status === 409) {
        setConfirm(null);
        setBlocked(e.response.data);
      } else {
        setConfirm((c) => ({ ...c, error: errText(e) }));
      }
    } finally {
      setBusy(false);
    }
  };

  const liveCount = useMemo(
    () => rows.filter((r) => r.status === "published").length, [rows]);

  if (flagOff) {
    return (
      <div className="dashboard-wrapper">
        <h1 className="dashboard-title">Practice sets</h1>
        <div className="cs-note cs-note--warn">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>
            The public Quiz Hub is switched off. Turn on{" "}
            <strong>public_quiz_hub_enabled</strong> in admin settings, then
            sign out and back in.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      <div className="cs-home__head">
        <div>
          <h1 className="dashboard-title">Practice sets</h1>
          <p className="cs-home__sub">
            The quizzes visitors see on the public Quiz Hub. A set picks its
            questions from the bank by subject — it doesn’t hold them — so
            “ready now” grows as you accept more.
          </p>
        </div>
      </div>

      <div className="cs-pilltabs">
        <div className="cs-select-wrap">
          <select
            className="cs-select cs-select--inline"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="cs-pilltabs__spacer" />
        <button
          type="button"
          className="cs-btn-primary cs-btn-primary--sm"
          onClick={() => { setFormError(""); setModal({ initial: null }); }}
        >
          <Plus size={14} aria-hidden="true" /> New set
        </button>
        <span className="cs-muted">
          {liveCount} on the site
        </span>
      </div>

      {loading && <p className="cs-muted">Loading…</p>}
      {error && <p className="cs-error" role="alert">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="cs-empty">
          <LayoutList size={20} aria-hidden="true" />
          <p>
            No practice sets yet. Until one is published the public Quiz Hub
            has nothing to show.
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="cs-card cs-card--flush">
          {rows.map((r) => (
            <div className="cs-qrow" key={r.id}>
              <div className="cs-qrow__text">
                <div className="cs-qrow__title">{r.title}</div>
                {r.description && (
                  <div className="cs-qrow__body">{r.description}</div>
                )}
                <div>
                  <span className={r.status === "published"
                    ? "cs-chip cs-tone-ok" : "cs-chip cs-tone-muted"}>
                    {r.status === "published" ? "on the site" : "draft"}
                  </span>
                  <span className="cs-labelpill">{r.subject}</span>
                  {r.exam && <span className="cs-labelpill">{r.exam}</span>}
                  {r.difficulty && (
                    <span className="cs-chip cs-tone-muted">{r.difficulty}</span>
                  )}
                  <span className={r.available_count > 0
                    ? "cs-chip cs-tone-ok" : "cs-chip cs-tone-warn"}>
                    {r.available_count} of {r.question_count} ready
                  </span>
                  <span className="cs-chip cs-tone-muted">
                    {r.minutes} min
                  </span>
                  {r.attempt_count > 0 && (
                    <span className="cs-chip cs-tone-muted">
                      {r.attempt_count} attempt{r.attempt_count === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                {r.status === "published" && r.available_count < r.question_count && (
                  <div className="cs-qrow__body cs-muted">
                    Serving {r.available_count} rather than {r.question_count} —
                    it will fill out as more questions are accepted.
                  </div>
                )}
              </div>

              <span className="cs-qrow__spacer" />

              <button
                type="button" className="cs-btn-ghost"
                onClick={() => { setFormError(""); setModal({ initial: r }); }}
              >
                <Pencil size={13} aria-hidden="true" /> Edit
              </button>
              <button
                type="button" className="cs-btn-ghost cs-btn-ghost--danger"
                onClick={() => setConfirm(r)}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <SetFormModal
          initial={modal.initial}
          tags={tags}
          busy={busy}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={() => { setModal(null); setFormError(""); }}
        />
      )}

      {confirm && (
        <div className="cs-palette-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget && !busy) setConfirm(null);
        }}>
          <div className="cs-confirm" role="dialog" aria-modal="true">
            <h2 className="cs-card__title">Delete this set?</h2>
            <p className="cs-muted">{confirm.title}</p>
            <p className="cs-field__hint">
              The questions themselves are not touched — a set only points at
              them.
            </p>
            {confirm.error && (
              <p className="cs-error" role="alert">{confirm.error}</p>
            )}
            <div className="cs-confirm__actions">
              <button type="button" className="cs-btn-ghost"
                disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="cs-btn-primary"
                disabled={busy} onClick={doDelete}>
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {blocked && (
        <div className="cs-palette-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setBlocked(null);
        }}>
          <div className="cs-confirm" role="dialog" aria-modal="true">
            <h2 className="cs-card__title">People have practised this</h2>
            <p className="cs-muted">{blocked.detail}</p>
            <p className="cs-field__hint">
              {blocked.attempt_count} attempt
              {blocked.attempt_count === 1 ? "" : "s"} would be lost. Edit it
              and set it back to draft instead.
            </p>
            <div className="cs-confirm__actions">
              <button type="button" className="cs-btn-ghost"
                onClick={() => setBlocked(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
};

export default PracticeSets;
