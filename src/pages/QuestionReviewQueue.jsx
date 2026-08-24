// src/pages/QuestionReviewQueue.jsx
// ──────────────────────────────────────────────────────────────────────────
// A1 · Question Bank Review (design_handoff_quiz_system §A1, Phase 7).
//
// The admin half of the curation loop. The framing matters and the copy says
// it outright: these teachers' tests are ALREADY RUNNING. Nothing on this
// screen blocks a classroom — accepting only decides what joins the shared
// library other teachers and student chapter-practice draw on. An admin who
// thinks they are a gate will treat this queue as urgent in the wrong way.
//
// Reuses this app's existing Moderator vocabulary (.mod-stat-card,
// .mod-reports-grid, .mod-report-card, .mod-review-panel, .mod-badge,
// .mod-btn, .mod-chip) rather than inventing a parallel card/badge/button
// system — see the workspace CLAUDE.md, non-negotiable #3.
// ──────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, MessageSquare } from "lucide-react";
import {
  getReviewQueue, reviewQuestion, bulkReviewQuestions,
  getGlobalSettings, setAiDrafting, getSubjectChapters,
} from "../api/admin_question_bank";
import Toast from "../components/Toast";
import "../css/Moderator.css";
import "../css/QuestionReview.css";

const STATE_CHIPS = [
  { id: "suggested", label: "Waiting" },
  { id: "changes_requested", label: "Changes requested" },
  { id: "accepted", label: "In the site bank" },
];

const SUBJ_TONES = ["pal-blue", "pal-purple", "pal-green", "pal-yellow"];
const subjectTone = (name = "") =>
  SUBJ_TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % SUBJ_TONES.length];

const ago = (iso) => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
};

export default function QuestionReviewQueue() {
  // This app's toast is presentational — the page owns the message and
  // clears it on a timer (see ScholarshipPanel.jsx / ModeratorPanel.jsx).
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const say = useCallback((message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const [state, setState] = useState("suggested");
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [contributors, setContributors] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [aiEnabled, setAiEnabled] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [chapters, setChapters] = useState([]);
  const [chapterAction, setChapterAction] = useState("keep");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReviewQueue({ state });
      setRows(data.results || []);
      setCounts(data.counts || {});
      setContributors(data.contributing_teachers || 0);
      setSelectedId((prev) =>
        data.results?.some((r) => r.id === prev) ? prev : data.results?.[0]?.id ?? null);
    } catch {
      say("Couldn't load the review queue.");
    } finally {
      setLoading(false);
    }
  }, [state, say]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getGlobalSettings()
      .then((s) => setAiEnabled(!!s.ai_question_drafting_enabled))
      .catch(() => {});
  }, []);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  // Reset the per-question controls whenever the selection moves, so a note
  // typed for one question can never be sent against another.
  useEffect(() => {
    setFeedback("");
    setChapterAction("keep");
    if (selected?.subject_id) {
      getSubjectChapters(selected.subject_id)
        .then((data) => setChapters(Array.isArray(data) ? data : data?.chapters || []))
        .catch(() => setChapters([]));
    } else {
      setChapters([]);
    }
  }, [selectedId, selected?.subject_id]);

  const sameAuthor = useMemo(
    () => (selected ? rows.filter((r) => r.author_id === selected.author_id) : []),
    [rows, selected]);

  const toggleAi = async () => {
    const next = !aiEnabled;
    setAiEnabled(next);
    try {
      await setAiDrafting(next);
      say(
        next
          ? "AI drafting is on — the Generate button is back in every builder."
          : "AI drafting is off — the Generate button is hidden for every teacher."
      );
    } catch {
      setAiEnabled(!next);
      say("Couldn't change that setting.");
    }
  };

  const decide = async (action) => {
    if (!selected) return;
    if (action === "request_changes" && !feedback.trim()) {
      say("Say what needs changing — the teacher sees this note.");
      return;
    }
    setBusy(true);
    try {
      await reviewQuestion(selected.id, {
        action,
        feedback: feedback.trim(),
        ...(chapterAction === "promote" ? { promote_chapter: true } : {}),
        ...(chapterAction.startsWith("map:")
          ? { map_to_chapter_id: chapterAction.slice(4) } : {}),
      });
      say(
        action === "accept"
          ? "Added to the ShikshaCom bank."
          : "Sent back with your note.");
      load();
    } catch (err) {
      say(
        err?.response?.data?.feedback ||
        err?.response?.data?.map_to_chapter_id ||
        "Couldn't save that decision.");
    } finally {
      setBusy(false);
    }
  };

  const acceptAllFromAuthor = async () => {
    if (sameAuthor.length < 2) return;
    setBusy(true);
    try {
      const res = await bulkReviewQuestions({
        question_ids: sameAuthor.map((r) => r.id),
        action: "accept",
      });
      say(`${res.updated} questions added to the site bank.`);
      load();
    } catch {
      say("Couldn't accept those — nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const stats = [
    { tone: "blue", value: counts.suggested ?? 0, label: "waiting for a look" },
    { tone: "yellow", value: counts.changes_requested ?? 0, label: "sent back for changes" },
    { tone: "green", value: counts.accepted ?? 0, label: "in the ShikshaCom bank" },
    { tone: "purple", value: contributors, label: "teachers contributing" },
  ];

  return (
    <div className="dashboard-wrapper">
      <h1 className="qrv-title">Question Bank Review</h1>
      <p className="qrv-sub">
        {counts.suggested ?? 0} questions teachers suggested for the ShikshaCom
        bank. Their own tests are already running — this only decides what gets
        shared platform-wide.
      </p>

      <div className="mod-stat-grid">
        {stats.map((s) => (
          <div className="mod-stat-card" key={s.label}>
            <span className={`qrv-tile qrv-tile--${s.tone}`} aria-hidden="true" />
            <div>
              <div className="qrv-stat-value">{s.value}</div>
              <div className="qrv-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* The master switch belongs here, not in the builder: it is an admin
          decision about every teacher at once. Non-negotiable #7 — the AI
          path is gated, never deleted. */}
      <div className="qrv-ai">
        <span className="qrv-ai__tile"><Sparkles size={18} /></span>
        <div className="qrv-ai__text">
          <div className="qrv-ai__title">AI question drafting</div>
          <div className="qrv-ai__sub">
            Master switch for every teacher. Currently {aiEnabled ? "on" : "off"} —
            the Generate button is {aiEnabled ? "shown" : "hidden"} in the builder.
          </div>
        </div>
        <span className={`mod-badge ${aiEnabled ? "pal-green" : "pal-gray"}`}>
          {aiEnabled ? "On" : "Off"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={aiEnabled}
          aria-label="AI question drafting"
          className={`qrv-switch${aiEnabled ? " qrv-switch--on" : ""}`}
          onClick={toggleAi}
        >
          <span className="qrv-switch__knob" />
        </button>
      </div>

      <div className="mod-chip-row">
        {STATE_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`mod-chip${state === c.id ? " active" : ""}`}
            onClick={() => setState(c.id)}
          >
            {c.label}
            {counts[c.id] != null && ` (${counts[c.id]})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mod-empty">Loading the queue…</div>
      ) : rows.length === 0 ? (
        <div className="mod-empty">
          Nothing here. No teacher is waiting on you — their tests run either way.
        </div>
      ) : (
        <div className="mod-reports-grid">
          <div className="qrv-queue">
            {rows.map((q) => (
              <button
                type="button"
                key={q.id}
                className={`mod-report-card qrv-card${q.id === selectedId ? " qrv-card--on" : ""}`}
                onClick={() => setSelectedId(q.id)}
              >
                <div className="qrv-card__top">
                  <span className={`mod-badge ${subjectTone(q.subject_name)}`}>
                    {q.subject_name}
                  </span>
                  <span className="qrv-card__who">{q.author_name}</span>
                  <span className="qrv-card__age">{ago(q.created_at)}</span>
                </div>
                <div className="qrv-card__text">{q.text}</div>
                <div className="qrv-card__meta">
                  {q.chapter_label || "No chapter"} · {q.difficulty}
                </div>
                {q.chapter_is_custom && (
                  <span className="mod-badge pal-yellow qrv-flag">teacher-made chapter</span>
                )}
              </button>
            ))}
          </div>

          {selected && (
            <div className="mod-review-panel qrv-panel">
              <div className="qrv-panel__head">
                <span className={`mod-badge ${subjectTone(selected.subject_name)}`}>
                  {selected.subject_name}
                </span>
                <span className="qrv-panel__who">
                  {selected.author_name} · suggested {ago(selected.created_at)}
                </span>
                <span className="qrv-panel__pos">
                  {rows.findIndex((r) => r.id === selected.id) + 1} of {rows.length}
                </span>
              </div>

              <h2 className="qrv-panel__q">{selected.text}</h2>

              <div className="qrv-options">
                {(selected.choices || []).map((c, i) => (
                  <div
                    key={c.id}
                    className={`qrv-option${c.is_correct ? " qrv-option--correct" : ""}`}
                  >
                    <span className="qrv-option__letter">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="qrv-option__text">{c.text}</span>
                    {c.is_correct && <span className="mod-badge pal-green">Correct</span>}
                  </div>
                ))}
              </div>

              {selected.explanation && (
                <div className="qrv-explain">
                  <strong>Teacher&rsquo;s explanation.</strong> {selected.explanation}
                </div>
              )}

              <div className="qrv-meta">
                <div><span>Difficulty</span><strong>{selected.difficulty}</strong></div>
                <div><span>Marks</span><strong>{selected.marks}</strong></div>
                <div><span>From</span><strong>{selected.quiz_title}</strong></div>
                <div>
                  <span>Chapter</span>
                  <strong>{selected.chapter_label || "—"}</strong>
                </div>
              </div>

              {/* Chapter mapping is part of the decision. The commonest reason
                  to bounce a question is that it is filed under a chapter the
                  teacher invented — fixing that here is what stops it
                  recurring. */}
              <div className="qrv-chapter">
                <div className="qrv-chapter__label">
                  Chapter placement
                  {selected.chapter_is_custom && " — this one is the teacher's own"}
                </div>
                <select
                  className="qrv-chapter__select"
                  value={chapterAction}
                  onChange={(e) => setChapterAction(e.target.value)}
                >
                  <option value="keep">Keep as is</option>
                  {selected.chapter_is_custom && (
                    <option value="promote">Add their chapter to the syllabus</option>
                  )}
                  {chapters.map((c) => (
                    <option key={c.id} value={`map:${c.id}`}>
                      Map to {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <label className="qrv-feedback">
                <span>
                  <MessageSquare size={13} /> Note to the teacher
                  <em> — required if you ask for a change</em>
                </span>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What needs changing before this can join the shared bank?"
                />
              </label>

              <div className="mod-action-row qrv-actions">
                <button
                  type="button" className="mod-btn success" disabled={busy}
                  onClick={() => decide("accept")}
                >
                  Add to site bank
                </button>
                <button
                  type="button" className="mod-btn warn" disabled={busy}
                  onClick={() => decide("request_changes")}
                >
                  Ask for a change
                </button>
                {sameAuthor.length > 1 && (
                  <button
                    type="button" className="cm-add-btn qrv-bulk" disabled={busy}
                    onClick={acceptAllFromAuthor}
                  >
                    Accept all {sameAuthor.length} from {selected.author_name}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
}
