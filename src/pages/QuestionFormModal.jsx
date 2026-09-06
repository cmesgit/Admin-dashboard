// Author or edit a standalone bank question (public Quiz Hub Phase 2b).
//
// Until this existed the admin console could not write a question at all —
// the older review queue is accept / request-changes / remap-chapter only. So
// this is net-new authoring, not an extension of an existing form.
//
// Two server contracts drive the shape here and are easy to get wrong:
//
//   * `choices` is REPLACED WHOLESALE, never merged. Sending a partial list
//     silently drops the options left out, so the form always submits the
//     complete set.
//   * exactly one option must be correct, and there must be at least two.
//     The submit button stays disabled until both hold, so the server's 400
//     is a backstop rather than the way a user finds out.
//
// `explanation` is deliberately optional server-side — but a question without
// one can never reach a learner, because publishable() requires it. That is a
// trap worth naming at the point of decision rather than letting someone
// write fifty questions that quietly go nowhere, so the field says so.
import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

const MAX_CHOICES = 6;
const MIN_CHOICES = 2;
const KEYS = ["A", "B", "C", "D", "E", "F"];

const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const KIND_LABELS = {
  subject: "Subject",
  exam: "Exam",
  topic: "Topic",
  custom: "Other",
};

const blankChoices = () => ([
  { text: "", is_correct: true },
  { text: "", is_correct: false },
  { text: "", is_correct: false },
  { text: "", is_correct: false },
]);

const QuestionFormModal = ({ initial, tags, busy, error, onSubmit, onCancel }) => {
  const editing = !!initial?.id;

  const [form, setForm] = useState(() => ({
    text: initial?.text ?? "",
    explanation: initial?.explanation ?? "",
    difficulty: initial?.difficulty ?? "medium",
    year: initial?.year ? String(initial.year) : "",
    topic: initial?.topic ?? "",
    // An existing question always has its choices; a new one starts with the
    // four the corpus uses, with A provisionally correct so the radio group
    // is never in an unset state.
    choices: initial?.choices?.length
      ? initial.choices.map((c) => ({ text: c.text, is_correct: !!c.is_correct }))
      : blankChoices(),
    tag_ids: (initial?.tags ?? []).map((t) => String(t.id)),
  }));

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const setChoiceText = (i) => (e) => setForm((f) => ({
    ...f,
    choices: f.choices.map((c, n) => (n === i ? { ...c, text: e.target.value } : c)),
  }));

  const markCorrect = (i) => () => setForm((f) => ({
    ...f,
    choices: f.choices.map((c, n) => ({ ...c, is_correct: n === i })),
  }));

  const addChoice = () => setForm((f) => (
    f.choices.length >= MAX_CHOICES
      ? f
      : { ...f, choices: [...f.choices, { text: "", is_correct: false }] }
  ));

  const removeChoice = (i) => () => setForm((f) => {
    if (f.choices.length <= MIN_CHOICES) return f;
    const choices = f.choices.filter((_, n) => n !== i);
    // Removing the correct option would leave the question with no answer;
    // fall back to the first rather than submitting an unanswerable row.
    if (!choices.some((c) => c.is_correct)) choices[0].is_correct = true;
    return { ...f, choices };
  });

  const toggleTag = (id) => () => setForm((f) => ({
    ...f,
    tag_ids: f.tag_ids.includes(id)
      ? f.tag_ids.filter((t) => t !== id)
      : [...f.tag_ids, id],
  }));

  const tagsByKind = useMemo(() => {
    const groups = new Map();
    for (const t of tags) {
      if (!groups.has(t.kind)) groups.set(t.kind, []);
      groups.get(t.kind).push(t);
    }
    return [...groups.entries()];
  }, [tags]);

  const filled = form.choices.filter((c) => c.text.trim());
  const correctCount = form.choices.filter(
    (c) => c.is_correct && c.text.trim()).length;
  const yearOk = !form.year
    || (/^\d{4}$/.test(form.year) && +form.year >= 1900 && +form.year <= 2100);
  const valid = form.text.trim()
    && filled.length >= MIN_CHOICES
    && correctCount === 1
    && yearOk;

  const submit = () => {
    if (!valid || busy) return;
    onSubmit({
      text: form.text.trim(),
      explanation: form.explanation.trim(),
      difficulty: form.difficulty,
      // "" is not "leave it alone" for a nullable integer — send null.
      year: form.year ? Number(form.year) : null,
      topic: form.topic.trim(),
      tag_ids: form.tag_ids,
      // Always the COMPLETE set — the server replaces rather than merges.
      choices: form.choices
        .filter((c) => c.text.trim())
        .map((c) => ({ text: c.text.trim(), is_correct: c.is_correct })),
    });
  };

  return (
    <div
      className="cs-palette-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
    >
      <div className="cs-confirm cs-confirm--wide" role="dialog" aria-modal="true">
        <h2 className="cs-card__title">
          {editing ? "Edit this question" : "Write a question"}
        </h2>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="qb-text">Question</label>
          <textarea
            id="qb-text" className="cs-input cs-input--block" rows={3} autoFocus
            value={form.text} onChange={set("text")}
            placeholder="e.g. Which Harappan site is best known for its dockyard?"
          />
        </div>

        <div className="cs-field">
          <span className="cs-field__label">
            Options — pick the one that is correct
          </span>
          {form.choices.map((c, i) => (
            <div key={i} className="cs-check">
              <input
                type="radio" name="qb-correct"
                checked={c.is_correct} onChange={markCorrect(i)}
                aria-label={`Mark option ${KEYS[i]} correct`}
              />
              <input
                className="cs-input cs-input--block"
                value={c.text} onChange={setChoiceText(i)}
                placeholder={`Option ${KEYS[i]}`}
              />
              {form.choices.length > MIN_CHOICES && (
                <button
                  type="button" className="cs-btn-ghost"
                  onClick={removeChoice(i)}
                  aria-label={`Remove option ${KEYS[i]}`}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
          {form.choices.length < MAX_CHOICES && (
            <button type="button" className="cs-btn-ghost" onClick={addChoice}>
              <Plus size={13} aria-hidden="true" /> Add an option
            </button>
          )}
          {filled.length < MIN_CHOICES && (
            <p className="cs-field__hint">
              Give at least two options with text in them.
            </p>
          )}
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="qb-expl">
            Explanation
          </label>
          <textarea
            id="qb-expl" className="cs-input cs-input--block" rows={4}
            value={form.explanation} onChange={set("explanation")}
            placeholder="Why that answer is right. Learners see this after they answer."
          />
          {!form.explanation.trim() && (
            <p className="cs-field__warn">
              Without an explanation this question can be accepted but will
              never be shown to a learner — the Quiz Hub only serves questions
              that can explain themselves.
            </p>
          )}
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="qb-diff">Difficulty</label>
          <div className="cs-select-wrap">
            <select
              id="qb-diff" className="cs-select"
              value={form.difficulty} onChange={set("difficulty")}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="qb-year">
            Year it was asked <span className="cs-muted">(optional)</span>
          </label>
          <input
            id="qb-year" className="cs-input" inputMode="numeric"
            value={form.year} onChange={set("year")} placeholder="e.g. 2019"
          />
          {!yearOk && (
            <p className="cs-field__warn">
              Give a four-digit year between 1900 and 2100, or leave it empty.
            </p>
          )}
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="qb-topic">
            Topic <span className="cs-muted">(optional)</span>
          </label>
          <input
            id="qb-topic" className="cs-input cs-input--block"
            value={form.topic} onChange={set("topic")}
            placeholder="e.g. Indus Valley"
          />
        </div>

        {tagsByKind.length > 0 && (
          <div className="cs-field">
            <span className="cs-field__label">Labels</span>
            <p className="cs-field__hint cs-field__hint--tight">
              Subject and exam labels are what the filters on the public page
              are built from. An untagged question is practisable but hard to
              find.
            </p>
            {tagsByKind.map(([kind, list]) => (
              <div key={kind}>
                <p className="cs-field__hint">{KIND_LABELS[kind] ?? kind}</p>
                {list.map((t) => (
                  <label key={t.id} className="cs-check">
                    <input
                      type="checkbox"
                      checked={form.tag_ids.includes(String(t.id))}
                      onChange={toggleTag(String(t.id))}
                    />
                    <span className="cs-check__label">{t.label}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}

        {error && <p className="cs-error" role="alert">{error}</p>}

        <div className="cs-confirm__actions">
          <button
            type="button" className="cs-btn-ghost"
            disabled={busy} onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button" className="cs-btn-primary"
            disabled={!valid || busy} onClick={submit}
          >
            {busy
              ? "Saving…"
              : editing ? "Save changes" : "Create question"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionFormModal;
