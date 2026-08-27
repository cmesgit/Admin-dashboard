// Questions & notices (design_handoff_content_studio Phase 6a).
//
// Merges three separate destinations — FAQs, Announcements and Current
// affairs — into one screen. They were three tabs because they are three
// database tables, which is not a reason a writer should have to care about.
//
// The capability this adds: every one of them can now be a DRAFT. Before
// Phase 1 these rows had only `is_active`, which conflated "not finished" with
// "deliberately taken down", so an answer could not be written without being
// immediately visible to the public.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle, FileText, HelpCircle, Newspaper, Plus, Search,
} from "lucide-react";
import {
  createContentAnnouncement, createContentFaq, deleteContentFaq,
  fetchAllPages, getContentAnnouncements,
  getContentAffairs, getContentFaqs, updateContentAnnouncement,
  updateContentAffair, updateContentFaq,
} from "../../api/admin";
import { errText } from "../../utils/errText";
import Toast from "../../components/Toast";
import "../../css/ContentStudio.css";

const PAGE_LABELS = {
  home: "Homepage", courses: "Courses", counselling: "Counselling",
  skills: "Skill Development", general: "General / FAQ page",
};

// Plain-language status, and what each one means for a visitor. The row shows
// the consequence, not the enum value.
const STATUS = [
  { value: "draft", label: "Draft", tone: "muted", note: "Nobody can see this" },
  { value: "review", label: "In review", tone: "warn", note: "Waiting to be checked" },
  { value: "published", label: "Live", tone: "ok", note: "Visitors can see this" },
  { value: "archived", label: "Hidden", tone: "muted", note: "Taken down on purpose" },
];
const statusOf = (v) => STATUS.find((s) => s.value === v) || STATUS[0];

const TABS = [
  { id: "answers", label: "Answers", icon: HelpCircle },
  { id: "notices", label: "Notices", icon: AlertCircle },
  { id: "affairs", label: "Current affairs", icon: Newspaper },
];

const stripHtml = (html) =>
  (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const asList = (r) => (Array.isArray(r) ? r : r?.results || []);

const QuestionsAndNotices = () => {
  // The tab lives in the URL. ContentPanel redirects ?tab=announcements here as
  // /content/questions?tab=notices and the backend inbox emits the same link,
  // but this screen used to ignore it and always open on Answers — so clicking
  // a notice in "Needs you" landed on a list that didn't contain it.
  const [params, setParams] = useSearchParams();
  const urlTab = params.get("tab");
  const tab = TABS.some((t) => t.id === urlTab) ? urlTab : "answers";
  const setTab = (next) => setParams(
    (prev) => {
      const p = new URLSearchParams(prev);
      p.set("tab", next);
      return p;
    },
    { replace: true },
  );
  const [data, setData] = useState({ answers: [], notices: [], affairs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ question: "", answer: "", page: "general" });
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState(null);
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
      const [f, a, c] = await Promise.all([
        fetchAllPages(getContentFaqs),
        fetchAllPages(getContentAnnouncements),
        fetchAllPages(getContentAffairs),
      ]);
      setData({ answers: asList(f), notices: asList(a), affairs: asList(c) });
      // admin.js's safe() turns a failed request into [] and marks it
      // __failed. Without checking that, a dead API is indistinguishable from
      // "there is nothing here" — which is exactly how an outage gets read as
      // empty content.
      if ([f, a, c].some((r) => r?.__failed)) {
        setError("Couldn’t reach the server, so this may be incomplete. Reload to try again.");
      } else {
        setError("");
      }
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (kind, row, next) => {
    const key = `${kind}-${row.id}`;
    setBusy(key);
    // Optimistic — a status pill that waits on a round trip feels broken.
    const before = data;
    setData((d) => ({
      ...d,
      [kind]: d[kind].map((r) => (r.id === row.id ? { ...r, status: next } : r)),
    }));
    try {
      const fn = kind === "answers" ? updateContentFaq
        : kind === "notices" ? updateContentAnnouncement
          : updateContentAffair;
      await fn(row.id, { status: next });
      say(`Moved to “${statusOf(next).label}”.`);
    } catch (e) {
      setData(before);
      say(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const rows = data[tab] || [];
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      `${r.question || ""} ${r.message || ""} ${r.title || ""}`
        .toLowerCase().includes(term),
    );
  }, [rows, q]);

  // Answers group by the page they appear on; the other two have no page, so
  // they render as one group rather than inventing a grouping that isn't real.
  const groups = useMemo(() => {
    if (tab !== "answers") {
      return [{ key: "all", label: TABS.find((t) => t.id === tab).label, items: filtered }];
    }
    const by = {};
    filtered.forEach((r) => {
      const k = r.page || "general";
      (by[k] = by[k] || []).push(r);
    });
    return Object.keys(by).sort().map((k) => ({
      key: k, label: PAGE_LABELS[k] || k, items: by[k],
    }));
  }, [filtered, tab]);

  const titleOf = (r) => r.question || r.message || r.title || "Untitled";
  const bodyOf = (r) => stripHtml(r.answer_html || r.summary || r.link_label || "");

  const submitNew = async () => {
    if (!form.question.trim()) return say("Give the question some words first.");
    setBusy("new");
    try {
      await createContentFaq({
        question: form.question.trim(),
        answer_html: form.answer.trim() ? `<p>${form.answer.trim()}</p>` : "<p></p>",
        page: form.page,
        // The point of the phase: it starts as a draft nobody can see.
        status: "draft",
      });
      say("Saved as a draft. Nobody can see it yet.");
      setCreating(false);
      setForm({ question: "", answer: "", page: "general" });
      load();
    } catch (e) {
      say(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const saveEdit = async () => {
    const { id, question, answer, page } = editing;
    if (!question.trim()) return say("The question needs some words.");
    setBusy(`edit-${id}`);
    try {
      await updateContentFaq(id, {
        question: question.trim(),
        // The old screen asked for raw HTML. Wrap plain paragraphs so nobody
        // has to know what a <p> is; existing markup is left alone.
        answer_html: /<[a-z][\s\S]*>/i.test(answer) ? answer : `<p>${answer.trim()}</p>`,
        page,
      });
      say("Saved.");
      setEditing(null);
      load();
    } catch (e) {
      say(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const saveNotice = async () => {
    if (!notice.message.trim()) return say("A notice needs something to say.");
    setBusy("notice");
    try {
      const payload = {
        message: notice.message.trim(),
        link_url: notice.link_url.trim(),
        link_label: notice.link_label.trim(),
        level: notice.level,
      };
      if (notice.id) {
        // Editing must not change who can see it — the row's status control
        // owns that, and silently re-drafting someone's live notice would be
        // a nasty surprise.
        await updateContentAnnouncement(notice.id, payload);
        say("Saved.");
      } else {
        await createContentAnnouncement({ ...payload, status: "draft" });
        say("Saved as a draft. Nobody sees it yet.");
      }
      setNotice(null);
      load();
    } catch (e) {
      say(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (row) => {
    setBusy(`del-${row.id}`);
    try {
      await deleteContentFaq(row.id);
      say("Deleted.");
      load();
    } catch (e) {
      say(errText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Questions &amp; notices</h1>
      <p className="cs-home__sub">
        Short pieces of writing that appear across the site — answers to
        questions, notices at the top of a page, and current affairs.
      </p>

      <div className="cs-pilltabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`cs-pill${tab === id ? " is-on" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon size={13} aria-hidden="true" />
            {label}
            <span className="cs-pill__count">{(data[id] || []).length}</span>
          </button>
        ))}

        <div className="cs-pilltabs__spacer" />

        <div className="cs-searchfield">
          <Search size={14} aria-hidden="true" />
          <input
            className="cs-searchfield__input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter…"
            aria-label="Filter"
          />
        </div>

        {tab === "answers" && (
          <button type="button" className="cs-btn-primary cs-btn-primary--sm" onClick={() => setCreating(true)}>
            <Plus size={14} aria-hidden="true" /> New answer
          </button>
        )}
        {tab === "notices" && (
          <button
            type="button"
            className="cs-btn-primary cs-btn-primary--sm"
            onClick={() => setNotice({ message: "", link_url: "", link_label: "", level: "info" })}
          >
            <Plus size={14} aria-hidden="true" /> New notice
          </button>
        )}
      </div>

      {loading && <p className="cs-muted">Loading…</p>}
      {error && <p className="cs-error" role="alert">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="cs-empty">
          <FileText size={20} aria-hidden="true" />
          <p>{q ? `Nothing matches “${q}”.` : "Nothing here yet."}</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="cs-card cs-card--flush">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="cs-grouphead">
                <FileText size={13} aria-hidden="true" />
                <span>{g.label}</span>
                <span className="cs-grouphead__count">
                  {g.items.length} {tab === "answers" ? "answer" : "item"}
                  {g.items.length === 1 ? "" : "s"}
                </span>
              </div>

              {g.items.map((r) => {
                const s = statusOf(r.status);
                const key = `${tab}-${r.id}`;
                return (
                  <div key={r.id} className="cs-qrow">
                    <span className="cs-qrow__text">
                      <span className="cs-qrow__title">{titleOf(r)}</span>
                      {bodyOf(r) && <span className="cs-qrow__body">{bodyOf(r)}</span>}
                    </span>

                    <span className={`cs-chip cs-tone-${s.tone}`} title={s.note}>
                      {s.label}
                    </span>

                    <select
                      className="cs-select cs-select--inline"
                      value={r.status || "draft"}
                      disabled={busy === key}
                      onChange={(e) => setStatus(tab, r, e.target.value)}
                      aria-label={`Visibility of ${titleOf(r)}`}
                    >
                      {STATUS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>

                    {tab === "notices" && (
                      <button
                        type="button"
                        className="cs-btn-ghost"
                        onClick={() => setNotice({
                          id: r.id,
                          message: r.message || "",
                          link_url: r.link_url || "",
                          link_label: r.link_label || "",
                          level: r.level || "info",
                        })}
                      >
                        Edit
                      </button>
                    )}
                    {tab === "answers" && (
                      <>
                        <button
                          type="button"
                          className="cs-btn-ghost"
                          onClick={() => setEditing({
                            id: r.id,
                            question: r.question || "",
                            answer: r.answer_html || "",
                            page: r.page || "general",
                          })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="cs-btn-ghost"
                          disabled={busy === `del-${r.id}`}
                          onClick={() => remove(r)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <p className="cs-note">
        Answers are written like a normal document — no HTML needed.
      </p>

      {creating && (
        <div
          className="cs-palette-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setCreating(false); }}
        >
          <div className="cs-confirm" role="dialog" aria-modal="true">
            <h2 className="cs-card__title">New answer</h2>
            <p className="cs-field__hint cs-field__hint--tight">
              It saves as a draft, so nobody sees it until you say so.
            </p>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="q-question">The question</label>
              <input
                id="q-question"
                className="cs-input cs-input--block"
                value={form.question}
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                placeholder="e.g. How do I enrol?"
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="q-answer">The answer</label>
              <textarea
                id="q-answer"
                className="cs-input cs-input--block cs-textarea"
                rows={4}
                value={form.answer}
                onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="q-page">Where it appears</label>
              <select
                id="q-page"
                className="cs-input cs-input--block"
                value={form.page}
                onChange={(e) => setForm((f) => ({ ...f, page: e.target.value }))}
              >
                {Object.entries(PAGE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div className="cs-confirm__actions">
              <button type="button" className="cs-btn-ghost" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="cs-btn-primary cs-btn-primary--sm"
                disabled={busy === "new"}
                onClick={submitNew}
              >
                {busy === "new" ? "Saving…" : "Save as draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="cs-palette-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setEditing(null);
        }}>
          <div className="cs-confirm" role="dialog" aria-modal="true">
            <h2 className="cs-card__title">Edit answer</h2>
            <p className="cs-field__hint cs-field__hint--tight">
              Changing the words doesn’t change who can see it — the status
              on the row still decides that.
            </p>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="e-question">The question</label>
              <input
                id="e-question"
                className="cs-input cs-input--block"
                value={editing.question}
                onChange={(e) => setEditing((f) => ({ ...f, question: e.target.value }))}
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="e-answer">The answer</label>
              <textarea
                id="e-answer"
                className="cs-input cs-input--block cs-textarea"
                rows={6}
                value={editing.answer}
                onChange={(e) => setEditing((f) => ({ ...f, answer: e.target.value }))}
              />
              <p className="cs-field__hint">
                Write it as normal text. Existing formatting is kept as-is.
              </p>
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="e-page">Where it appears</label>
              <select
                id="e-page"
                className="cs-input cs-input--block"
                value={editing.page}
                onChange={(e) => setEditing((f) => ({ ...f, page: e.target.value }))}
              >
                {Object.entries(PAGE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div className="cs-confirm__actions">
              <button type="button" className="cs-btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="cs-btn-primary cs-btn-primary--sm"
                disabled={busy === `edit-${editing.id}`}
                onClick={saveEdit}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="cs-palette-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setNotice(null);
        }}>
          <div className="cs-confirm" role="dialog" aria-modal="true">
            <h2 className="cs-card__title">
              {notice.id ? "Edit notice" : "New notice"}
            </h2>
            <p className="cs-field__hint cs-field__hint--tight">
              {notice.id
                ? "A strip across the top of the site. Editing the words doesn’t change who can see it."
                : "A strip across the top of the site. It saves as a draft."}
            </p>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="n-message">What it says</label>
              <input
                id="n-message"
                className="cs-input cs-input--block"
                value={notice.message}
                autoFocus
                onChange={(e) => setNotice((n) => ({ ...n, message: e.target.value }))}
                placeholder="e.g. Admissions for 2027 are now open"
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="n-level">How it looks</label>
              <select
                id="n-level"
                className="cs-input cs-input--block"
                value={notice.level}
                onChange={(e) => setNotice((n) => ({ ...n, level: e.target.value }))}
              >
                <option value="info">Ordinary — blue</option>
                <option value="success">Good news — green</option>
                <option value="warning">Needs attention — amber</option>
              </select>
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="n-label">Button words (optional)</label>
              <input
                id="n-label"
                className="cs-input cs-input--block"
                value={notice.link_label}
                onChange={(e) => setNotice((n) => ({ ...n, link_label: e.target.value }))}
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="n-url">Where it goes (optional)</label>
              <input
                id="n-url"
                className="cs-input cs-input--block"
                value={notice.link_url}
                onChange={(e) => setNotice((n) => ({ ...n, link_url: e.target.value }))}
                placeholder="/courses"
              />
              {notice.link_label && !notice.link_url && (
                <p className="cs-field__warn">
                  The button has words but nowhere to go.
                </p>
              )}
            </div>

            <div className="cs-confirm__actions">
              <button type="button" className="cs-btn-ghost" onClick={() => setNotice(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="cs-btn-primary cs-btn-primary--sm"
                disabled={busy === "notice"}
                onClick={saveNotice}
              >
                {busy === "notice" ? "Saving…" : (notice.id ? "Save" : "Save as draft")}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
};

export default QuestionsAndNotices;
