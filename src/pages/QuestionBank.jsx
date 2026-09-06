// Question Bank — the standalone bank (design_handoff_public_quiz_hub Phase 2a).
//
// WHY THIS SCREEN EXISTS AT ALL, stated plainly because it is not obvious:
// the PYQ importer creates thousands of rows with `quiz=None`, and the older
// admin review queue deliberately filters those out (`quiz__isnull=False`) so
// an import cannot bury the teachers' queue. So imported questions appear in
// NO existing screen. Meanwhile Question.objects.publishable() requires
// `bank_state="accepted"`. Those two facts together mean this screen is the
// only path from "3,793 rows imported" to "a learner can practise anything",
// and until somebody works through it the public Quiz Hub has zero content.
//
// That is why the headline number here is `publishable`, not `total`. A bank
// full of `suggested` rows looks like progress and serves nobody.
//
// Curation is page-at-a-time on purpose. Accepting thousands of questions in
// one click would lean entirely on the importer's gates, and the one failure
// this project cannot ship is a confident wrong answer in front of an exam
// aspirant. So the options and the marked answer are rendered inline, on
// every row — if you cannot see the answer you should not be accepting it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Check, FileQuestion, Pencil, Plus, Search, Trash2, X,
} from "lucide-react";
import {
  bulkReviewQuestions, createBankQuestion, deleteBankQuestion,
  getBankQuestions, getBankSummary, getQuestionTags, updateBankQuestion,
} from "../api/admin_question_bank";
import { errText } from "../utils/errText";
import QuestionFormModal from "./QuestionFormModal";
import Toast from "../components/Toast";
import "../css/ContentStudio.css";
import "../css/Moderator.css";

const PAGE_SIZE = 50;
const KEYS = ["A", "B", "C", "D", "E", "F"];

const DIFFICULTIES = [
  { value: "", label: "Any difficulty" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const STATES = [
  { value: "", label: "Any state" },
  { value: "suggested", label: "Suggested — waiting on you" },
  { value: "accepted", label: "Accepted" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "private", label: "Private" },
];

const EMPTY_FILTERS = {
  search: "", subject: "", exam: "", difficulty: "", year: "",
  state: "suggested", untagged: "", flagged: "",
};

// { practice_sessions: 1 } → "1 practice session". Raw column names must not
// reach the screen, and "1 practice sessions" reads as a bug even though the
// number is right — the same thing Labels.jsx keeps a `singular()` for.
//
// ⚠ Do NOT name this `useLabel`: the `use` prefix makes eslint's
// rules-of-hooks treat it as a Hook and fail the build inside a .map().
const USAGE_LABELS = {
  student_answers: ["answer inside a teacher's quiz",
                    "answers inside a teacher's quiz"],
  practice_answers: ["practice answer", "practice answers"],
  practice_sessions: ["practice session", "practice sessions"],
  public_attempt_answers: ["answer from a Quiz Hub visitor",
                           "answers from Quiz Hub visitors"],
};
const describeUsage = (key, n) => {
  const pair = USAGE_LABELS[key];
  if (!pair) return key;
  return n === 1 ? pair[0] : pair[1];
};

// The server answers 503 (not 403) when public_quiz_hub_enabled is off. That
// is a different sentence from "you may not" and the screen says so, rather
// than rendering a bare error and letting an admin think the bank is broken.
const isFlagOff = (e) => e?.response?.status === 503;

const QuestionBank = () => {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState(null);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flagOff, setFlagOff] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  // `modal` is null | {initial}. `confirm` is the row awaiting a delete
  // decision; `blocked` is the server's 409 when that delete is refused.
  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState("");
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

  const subjectTags = useMemo(
    () => tags.filter((t) => t.kind === "subject"), [tags],
  );
  const examTags = useMemo(
    () => tags.filter((t) => t.kind === "exam"), [tags],
  );

  // Counts ride a separate call from the list, deliberately — see the view's
  // docstring. Refreshed after every write so `publishable` stays honest.
  const loadSummary = useCallback(async () => {
    try {
      setSummary(await getBankSummary());
    } catch {
      // A failed summary must not blank the screen; the list is the job.
      setSummary(null);
    }
  }, []);

  const load = useCallback(async (p, f, { signal } = {}) => {
    setLoading(true);
    try {
      const params = { page: p, page_size: PAGE_SIZE };
      Object.entries(f).forEach(([k, v]) => { if (v !== "") params[k] = v; });
      const data = await getBankQuestions(params, { signal });
      setRows(data.results || []);
      setCount(data.count || 0);
      setError("");
      setFlagOff(false);
    } catch (e) {
      if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED"
          || e?.name === "AbortError") return;
      if (isFlagOff(e)) { setFlagOff(true); setRows([]); setCount(0); }
      else setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(
      () => load(page, filters, { signal: controller.signal }),
      filters.search ? 250 : 0,
    );
    return () => { clearTimeout(t); controller.abort(); };
  }, [page, filters, load]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  useEffect(() => {
    getQuestionTags().then((d) => setTags(Array.isArray(d) ? d : d?.results || []))
      .catch(() => setTags([]));   // the rails degrade to text inputs, not a crash
  }, []);

  // A selection is only meaningful for the page it was made on: paging away
  // and accepting would act on rows that are no longer in front of anyone.
  const setFilter = (k, v) => {
    setSelected(new Set());
    setPage(1);
    setFilters((f) => ({ ...f, [k]: v }));
  };

  const goToPage = (p) => { setSelected(new Set()); setPage(p); };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  // Flagged rows are excluded from select-all on purpose. The importer marks a
  // row flagged when its own explanation names a different option than the one
  // keyed correct — ~35% of those are genuinely wrong against a ~5% base rate.
  // They are exactly the rows that deserve a human, so a bulk gesture must not
  // sweep them along. They stay individually selectable.
  const selectableOnPage = useMemo(
    () => rows.filter((r) => !r.bank_feedback && r.bank_state !== "accepted"),
    [rows],
  );
  const allSelected = selectableOnPage.length > 0
    && selectableOnPage.every((r) => selected.has(r.id));

  const toggleAll = () => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (allSelected) selectableOnPage.forEach((r) => next.delete(r.id));
      else selectableOnPage.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const toggleOne = (id) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const acceptSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    try {
      const res = await bulkReviewQuestions({
        question_ids: ids, action: "accept",
      });
      say(`Accepted ${res.updated} question${res.updated === 1 ? "" : "s"}.`);
      setSelected(new Set());
      await Promise.all([load(page, filters), loadSummary()]);
    } catch (e) {
      say(isFlagOff(e) ? "The Quiz Hub is switched off." : errText(e));
    } finally {
      setBusy(false);
    }
  };

  const correctIndex = (choices = []) => choices.findIndex((c) => c.is_correct);

  const handleSubmit = async (body) => {
    setBusy(true);
    setFormError("");
    try {
      if (modal?.initial?.id) {
        const saved = await updateBankQuestion(modal.initial.id, body);
        // Splice the server's own row back in rather than refetching: the
        // list is filtered and paged, and a refetch here would jump the
        // admin somewhere else mid-edit.
        setRows((cur) => cur.map((r) => (r.id === saved.id ? saved : r)));
        say("Saved.");
      } else {
        await createBankQuestion(body);
        // A new row is created `accepted`, so it does not belong in the
        // default `suggested` view — reload rather than prepend, or it would
        // appear in a list it does not match.
        say("Question created. It is accepted and ready for learners.");
        await load(page, filters);
      }
      setModal(null);
      await loadSummary();
    } catch (e) {
      setFormError(isFlagOff(e) ? "The Quiz Hub is switched off." : errText(e));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    const row = confirm;
    setBusy(true);
    try {
      await deleteBankQuestion(row.id);
      setRows((cur) => cur.filter((r) => r.id !== row.id));
      setCount((c) => Math.max(0, c - 1));
      setConfirm(null);
      say("Deleted.");
      await loadSummary();
    } catch (e) {
      // A 409 is the design working, not a failure: someone has already
      // answered this question, and deleting it would cascade their answers
      // and silently rewrite a past score. Name what is holding it.
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


  if (flagOff) {
    return (
      <div className="dashboard-wrapper">
        <h1 className="dashboard-title">Question Bank</h1>
        <div className="cs-note cs-note--warn">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>
            The public Quiz Hub is switched off, so this screen has nothing to
            manage. Turn on <strong>public_quiz_hub_enabled</strong> in admin
            settings, then sign out and back in.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      <div className="cs-home__head">
        <div>
          <h1 className="dashboard-title">Question Bank</h1>
          <p className="cs-home__sub">
            Questions that belong to no quiz — imported past papers and
            anything written here. Teachers’ suggestions live in Question
            Review; these are separate and only appear on this screen.
          </p>
        </div>
      </div>

      {summary && (
        <div className="cs-card">
          <div className="cs-card__head">
            <h2 className="cs-card__title">
              Ready for learners: {summary.publishable.toLocaleString()}
            </h2>
            <span className="cs-card__count">
              of {summary.total.toLocaleString()}
            </span>
          </div>
          <div className="cs-qrow">
            <span className="cs-chip cs-tone-muted">
              {(summary.by_state?.suggested ?? 0).toLocaleString()} waiting
            </span>
            <span className="cs-chip cs-tone-ok">
              {(summary.by_state?.accepted ?? 0).toLocaleString()} accepted
            </span>
            {summary.flagged > 0 && (
              <span className="cs-chip cs-tone-warn">
                <AlertTriangle size={11} aria-hidden="true" />
                {summary.flagged.toLocaleString()} need a closer look
              </span>
            )}
            {summary.untagged > 0 && (
              <span className="cs-chip cs-tone-muted">
                {summary.untagged.toLocaleString()} untagged
              </span>
            )}
          </div>
          {summary.publishable === 0 && summary.total > 0 && (
            <div className="cs-note cs-note--warn">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>
                Nothing here reaches learners yet. A question needs to be
                accepted, and to have an explanation, before it can be
                practised — accepting them is what this screen is for.
              </span>
            </div>
          )}
        </div>
      )}

      <div className="cs-pilltabs">
        <div className="cs-searchfield">
          <Search size={14} aria-hidden="true" />
          <input
            className="cs-searchfield__input"
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            placeholder="Search questions…"
            aria-label="Search questions"
          />
        </div>

        <div className="cs-select-wrap">
          <select
            className="cs-select cs-select--inline"
            value={filters.state}
            onChange={(e) => setFilter("state", e.target.value)}
            aria-label="Filter by state"
          >
            {STATES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {subjectTags.length > 0 && (
          <div className="cs-select-wrap">
            <select
              className="cs-select cs-select--inline"
              value={filters.subject}
              onChange={(e) => setFilter("subject", e.target.value)}
              aria-label="Filter by subject"
            >
              <option value="">Any subject</option>
              {subjectTags.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        )}

        {examTags.length > 0 && (
          <div className="cs-select-wrap">
            <select
              className="cs-select cs-select--inline"
              value={filters.exam}
              onChange={(e) => setFilter("exam", e.target.value)}
              aria-label="Filter by exam"
            >
              <option value="">Any exam</option>
              {examTags.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="cs-select-wrap">
          <select
            className="cs-select cs-select--inline"
            value={filters.difficulty}
            onChange={(e) => setFilter("difficulty", e.target.value)}
            aria-label="Filter by difficulty"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className={filters.flagged === "1" ? "cs-btn-primary cs-btn-primary--sm" : "cs-btn-ghost"}
          onClick={() => setFilter("flagged", filters.flagged === "1" ? "" : "1")}
        >
          <AlertTriangle size={13} aria-hidden="true" /> Needs a closer look
        </button>

        <div className="cs-pilltabs__spacer" />
        <button
          type="button"
          className="cs-btn-primary cs-btn-primary--sm"
          onClick={() => { setFormError(""); setModal({ initial: null }); }}
        >
          <Plus size={14} aria-hidden="true" /> New question
        </button>
        <span className="cs-muted">
          {count.toLocaleString()} question{count === 1 ? "" : "s"}
        </span>
      </div>

      {selected.size > 0 && (
        <div className="cs-toolbar">
          <span className="cs-muted">
            {selected.size} selected on this page
          </span>
          <div className="cs-pilltabs__spacer" />
          <button
            type="button"
            className="cs-btn-ghost"
            onClick={() => setSelected(new Set())}
          >
            <X size={13} aria-hidden="true" /> Clear
          </button>
          <button
            type="button"
            className="cs-btn-primary cs-btn-primary--sm"
            disabled={busy}
            onClick={acceptSelected}
          >
            <Check size={13} aria-hidden="true" />
            {busy ? "Accepting…" : `Accept ${selected.size}`}
          </button>
        </div>
      )}

      {loading && <p className="cs-muted">Loading…</p>}
      {error && <p className="cs-error" role="alert">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="cs-empty">
          <FileQuestion size={20} aria-hidden="true" />
          <p>
            {filters.search
              ? `Nothing matches “${filters.search}”.`
              : "No questions match these filters."}
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {selectableOnPage.length > 0 && (
            <label className="cs-check">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
              />
              <span className="cs-check__label">
                Select all {selectableOnPage.length} acceptable on this page
                {rows.length !== selectableOnPage.length && (
                  <span className="cs-check__note">
                    {" "}— the flagged and already-accepted ones are left out;
                    pick those individually.
                  </span>
                )}
              </span>
            </label>
          )}

          <div className="cs-card cs-card--flush">
            {rows.map((r) => {
              const ci = correctIndex(r.choices);
              return (
                <div key={r.id} className="cs-qrow">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleOne(r.id)}
                    aria-label={`Select question: ${r.text.slice(0, 60)}`}
                  />
                  <div className="cs-qrow__text">
                    <div className="cs-qrow__title">{r.text}</div>

                    <div className="cs-qrow__body">
                      {(r.choices || []).map((c, i) => (
                        <div key={c.id ?? i}>
                          <span className={c.is_correct ? "cs-chip cs-tone-ok" : "cs-chip cs-tone-muted"}>
                            {KEYS[i] ?? i + 1}
                          </span>{" "}
                          {c.text}
                        </div>
                      ))}
                      {ci === -1 && (
                        <div className="cs-error">
                          No option is marked correct — this cannot be
                          practised until one is.
                        </div>
                      )}
                    </div>

                    {r.explanation
                      ? <div className="cs-qrow__body">{r.explanation}</div>
                      : (
                        <div className="cs-qrow__body cs-muted">
                          No explanation. Accepting it will not make it
                          practisable — the Quiz Hub requires one.
                        </div>
                      )}

                    {r.bank_feedback && (
                      <div className="cs-note cs-note--warn">
                        <AlertTriangle size={15} aria-hidden="true" />
                        <span>{r.bank_feedback}</span>
                      </div>
                    )}

                    <div>
                      <span className="cs-chip cs-tone-muted">{r.difficulty}</span>
                      {r.year && <span className="cs-chip cs-tone-muted">{r.year}</span>}
                      <span className={r.bank_state === "accepted"
                        ? "cs-chip cs-tone-ok" : "cs-chip cs-tone-muted"}>
                        {r.bank_state === "accepted" ? "accepted" : r.bank_state}
                      </span>
                      {(r.tags || []).map((t) => (
                        <span key={t.id} className="cs-labelpill">{t.label}</span>
                      ))}
                      {(r.tags || []).length === 0 && (
                        <span className="cs-chip cs-tone-muted">untagged</span>
                      )}
                    </div>
                  </div>

                  <span className="cs-qrow__spacer" />

                  <button
                    type="button"
                    className="cs-btn-ghost"
                    onClick={() => { setFormError(""); setModal({ initial: r }); }}
                  >
                    <Pencil size={13} aria-hidden="true" /> Edit
                  </button>
                  <button
                    type="button"
                    className="cs-btn-ghost cs-btn-ghost--danger"
                    onClick={() => setConfirm(r)}
                  >
                    <Trash2 size={13} aria-hidden="true" /> Delete
                  </button>
                </div>
              );
            })}
          </div>

          <div className="cs-toolbar">
            <span className="cs-muted">
              Page {page} of {totalPages.toLocaleString()}
            </span>
            <div className="cs-pilltabs__spacer" />
            <button
              type="button"
              className="cs-btn-ghost"
              disabled={page <= 1 || loading}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="cs-btn-ghost"
              disabled={page >= totalPages || loading}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      {modal && (
        <QuestionFormModal
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
            <h2 className="cs-card__title">Delete this question?</h2>
            <p className="cs-muted">{confirm.text}</p>
            <p className="cs-field__hint">
              This cannot be undone. If anyone has already answered it, the
              server will refuse rather than rewrite their score.
            </p>
            {confirm.error && (
              <p className="cs-error" role="alert">{confirm.error}</p>
            )}
            <div className="cs-confirm__actions">
              <button
                type="button" className="cs-btn-ghost"
                disabled={busy} onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button" className="cs-btn-primary"
                disabled={busy} onClick={doDelete}
              >
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
            <h2 className="cs-card__title">Someone has already answered this</h2>
            <p className="cs-muted">{blocked.detail}</p>
            <ul className="cs-list">
              {Object.entries(blocked.used_by || {}).map(([key, n]) => (
                <li key={key} className="cs-list__row">
                  <span className="cs-list__text">
                    <span className="cs-list__title">{n}</span>
                    <span className="cs-list__reason">
                      {describeUsage(key, n)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="cs-field__hint">
              Edit it instead, or set it aside with “Changes requested” — both
              leave those answers intact.
            </p>
            <div className="cs-confirm__actions">
              <button
                type="button" className="cs-btn-ghost"
                onClick={() => setBlocked(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
};

export default QuestionBank;
