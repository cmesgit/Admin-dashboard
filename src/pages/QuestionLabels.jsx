// Question labels — the rails the public Quiz Hub is filtered by
// (design_handoff_public_quiz_hub Phase 3).
//
// THE POINT OF THIS SCREEN, because it is not the obvious one: the importer
// already tagged every question (0 untagged across 3,793 rows), so this is
// not where classification happens. What it controls is whether a subject
// APPEARS on the public page at all.
//
// Every tag is created `soon` — the model default — so a fully curated bank
// still renders eight greyed-out "Soon" chips and nothing clickable. Flipping
// a subject to `live` is what puts it on the page, and doing that from here
// rather than in code is the whole reason the state is data: Reasoning,
// Mathematics and English have no questions yet, and turning one on when
// content lands must not need a deploy.
//
// ⚠ `live` is a FLOOR, NOT AN OVERRIDE. The server degrades a `live` tag with
// no publishable questions back to `soon` and reports the disagreement as
// `status_downgraded`. An admin cannot make an empty chip clickable — that
// would open an empty grid, which is exactly the lie this page exists to
// avoid. This screen SHOWS that disagreement instead of hiding it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Merge, Plus, Tag, Trash2,
} from "lucide-react";
import {
  createQuestionTag, deleteQuestionTag, getQuestionTags, mergeQuestionTags,
  updateQuestionTag,
} from "../api/admin_question_bank";
import { errText } from "../utils/errText";
import Toast from "../components/Toast";
import "../css/ContentStudio.css";
import "../css/Moderator.css";

const KINDS = [
  { value: "subject", label: "Subjects",
    hint: "The big tiles and the subject filter on the public page." },
  { value: "exam", label: "Exams",
    hint: "SSC, Banking, Railways — the exam filter." },
  { value: "topic", label: "Topics",
    hint: "Finer-grained than a subject. Optional." },
  { value: "custom", label: "Other", hint: "Anything else." },
];

const STATUSES = [
  { value: "live", label: "Live" },
  { value: "soon", label: "Soon" },
  { value: "hidden", label: "Hidden" },
];

const STATUS_HELP = {
  live: "Clickable, with its question count.",
  soon: "Greyed out, labelled “Soon”. Not clickable.",
  hidden: "Not shown on the public page at all.",
};

const isFlagOff = (e) => e?.response?.status === 503;

const QuestionLabels = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flagOff, setFlagOff] = useState(false);
  const [busy, setBusy] = useState(null);
  const [creating, setCreating] = useState(null);
  const [merging, setMerging] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const say = useCallback((m) => {
    clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getQuestionTags();
      // ⚠ This endpoint is UNPAGINATED and returns a bare array — the bank
      // list next door returns an envelope. Normalise for both anyway.
      setRows(Array.isArray(data) ? data : data?.results || []);
      setError("");
      setFlagOff(false);
    } catch (e) {
      if (isFlagOff(e)) { setFlagOff(true); setRows([]); }
      else setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const byKind = useMemo(() => {
    const groups = new Map(KINDS.map((k) => [k.value, []]));
    for (const r of rows) {
      if (!groups.has(r.kind)) groups.set(r.kind, []);
      groups.get(r.kind).push(r);
    }
    return groups;
  }, [rows]);

  const patch = async (row, body, note) => {
    setBusy(row.id);
    try {
      const saved = await updateQuestionTag(row.id, body);
      setRows((cur) => cur.map((r) => (r.id === saved.id ? saved : r)));
      if (note) say(note);
    } catch (e) {
      say(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const setStatus = (row) => (e) => {
    const status = e.target.value;
    patch(row, { status },
      status === "live" && row.question_count === 0
        // Say it before the server does, so the admin is not left thinking
        // the save failed when the chip comes back "Soon".
        ? `“${row.label}” has no ready questions yet, so it stays “Soon”.`
        : `“${row.label}” is now ${status}.`);
  };

  const rename = (row) => (e) => {
    const label = e.target.value.trim();
    if (!label || label === row.label) return;
    patch(row, { label }, "Renamed everywhere it’s used.");
  };

  const reorder = (row) => (e) => {
    const n = e.target.value.trim();
    if (n === "" || String(row.display_order) === n) return;
    patch(row, { display_order: Number(n) });
  };

  const doCreate = async () => {
    const { kind, label } = creating;
    if (!label.trim()) return say("Give the label a name.");
    setBusy("new");
    try {
      await createQuestionTag({ kind, label: label.trim() });
      say(`Created “${label.trim()}”. It starts as “Soon”.`);
      setCreating(null);
      await load();
    } catch (e) {
      // A duplicate within a kind is a designed 400 naming the existing tag.
      say(e?.response?.data?.label || errText(e));
    } finally {
      setBusy(null);
    }
  };

  const doMerge = async () => {
    const { source, targetId } = merging;
    if (!targetId) return say("Pick a label to merge into.");
    setBusy(source.id);
    try {
      const res = await mergeQuestionTags([source.id], targetId);
      say(`Moved ${res.moved_question_refs} question${
        res.moved_question_refs === 1 ? "" : "s"} across.`);
      setMerging(null);
      await load();
    } catch (e) {
      say(e?.response?.data?.detail
        || e?.response?.data?.source_ids || errText(e));
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async (row) => {
    setBusy(row.id);
    try {
      await deleteQuestionTag(row.id);
      setRows((cur) => cur.filter((r) => r.id !== row.id));
      say(`Deleted “${row.label}”.`);
    } catch (e) {
      // 409 is the design working: the tag is still on questions, and
      // deleting would strip their classification silently.
      if (e?.response?.status === 409) {
        setBlocked({ row, ...e.response.data });
      } else {
        say(errText(e));
      }
    } finally {
      setBusy(null);
    }
  };

  const mergeTargets = (row) => rows.filter(
    (r) => r.kind === row.kind && r.id !== row.id);

  if (flagOff) {
    return (
      <div className="dashboard-wrapper">
        <h1 className="dashboard-title">Question labels</h1>
        <div className="cs-note cs-note--warn">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>
            The public Quiz Hub is switched off, so these labels control
            nothing yet. Turn on <strong>public_quiz_hub_enabled</strong> in
            admin settings, then sign out and back in.
          </span>
        </div>
      </div>
    );
  }

  const liveSubjects = (byKind.get("subject") || [])
    .filter((r) => r.effective_status === "live").length;

  return (
    <div className="dashboard-wrapper">
      <div className="cs-home__head">
        <div>
          <h1 className="dashboard-title">Question labels</h1>
          <p className="cs-home__sub">
            The subject tiles and exam filters visitors browse the Quiz Hub
            by. Questions are already labelled — what you set here is whether
            each label is <em>shown</em>.
          </p>
        </div>
      </div>

      {!loading && !error && liveSubjects === 0 && rows.length > 0 && (
        <div className="cs-note cs-note--warn">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>
            No subject is live, so the public page shows every tile as
            “Soon” and nothing can be opened. Set a subject to <strong>Live</strong>
            {" "}once it has accepted questions.
          </span>
        </div>
      )}

      {loading && <p className="cs-muted">Loading…</p>}
      {error && <p className="cs-error" role="alert">{error}</p>}

      {!loading && !error && KINDS.map((kind) => {
        const list = byKind.get(kind.value) || [];
        return (
          <div className="cs-card" key={kind.value}>
            <div className="cs-card__head">
              <h2 className="cs-card__title">{kind.label}</h2>
              <span className="cs-card__count">{list.length}</span>
              <div className="cs-pilltabs__spacer" />
              <button
                type="button"
                className="cs-btn-ghost"
                onClick={() => setCreating({ kind: kind.value, label: "" })}
              >
                <Plus size={13} aria-hidden="true" /> Add
              </button>
            </div>
            <p className="cs-field__hint cs-field__hint--tight">{kind.hint}</p>

            {list.length === 0 && (
              <div className="cs-empty">
                <Tag size={20} aria-hidden="true" />
                <p>Nothing here yet.</p>
              </div>
            )}

            {list.map((r) => (
              <div className="cs-qrow" key={r.id}>
                <input
                  className="cs-input"
                  defaultValue={r.label}
                  onBlur={rename(r)}
                  aria-label={`Rename ${r.label}`}
                />

                <span className={r.question_count > 0
                  ? "cs-chip cs-tone-ok" : "cs-chip cs-tone-muted"}>
                  {r.question_count} ready
                </span>

                <div className="cs-select-wrap">
                  <select
                    className="cs-select cs-select--inline"
                    value={r.status}
                    onChange={setStatus(r)}
                    disabled={busy === r.id}
                    aria-label={`Visibility of ${r.label}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* The server's verdict, shown whenever it differs from what
                    the admin asked for. Never resolved silently. */}
                {r.status_downgraded ? (
                  <span className="cs-chip cs-tone-warn">
                    <AlertTriangle size={11} aria-hidden="true" />
                    set to Live, but showing as Soon — no ready questions
                  </span>
                ) : (
                  <span className="cs-muted">{STATUS_HELP[r.status]}</span>
                )}

                <span className="cs-qrow__spacer" />

                <input
                  className="cs-input"
                  style={{ width: 64 }}
                  defaultValue={r.display_order}
                  onBlur={reorder(r)}
                  inputMode="numeric"
                  aria-label={`Display order of ${r.label}`}
                />

                <button
                  type="button"
                  className="cs-btn-ghost"
                  disabled={mergeTargets(r).length === 0 || busy === r.id}
                  onClick={() => setMerging({ source: r, targetId: "" })}
                >
                  <Merge size={13} aria-hidden="true" /> Merge
                </button>
                <button
                  type="button"
                  className="cs-btn-ghost cs-btn-ghost--danger"
                  disabled={busy === r.id}
                  onClick={() => doDelete(r)}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        );
      })}

      {creating && (
        <div className="cs-palette-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setCreating(null);
        }}>
          <div className="cs-confirm" role="dialog" aria-modal="true">
            <h2 className="cs-card__title">
              New {KINDS.find((k) => k.value === creating.kind)?.label.toLowerCase()
                    .replace(/s$/, "")} label
            </h2>
            <div className="cs-field">
              <label className="cs-field__label" htmlFor="ql-new">Name</label>
              <input
                id="ql-new" className="cs-input cs-input--block" autoFocus
                value={creating.label}
                onChange={(e) => setCreating((c) => ({ ...c, label: e.target.value }))}
                placeholder="e.g. Reasoning"
              />
              <p className="cs-field__hint">
                It starts as “Soon”. Set it Live once it has questions.
              </p>
            </div>
            <div className="cs-confirm__actions">
              <button type="button" className="cs-btn-ghost"
                onClick={() => setCreating(null)}>Cancel</button>
              <button type="button" className="cs-btn-primary"
                disabled={busy === "new"} onClick={doCreate}>
                {busy === "new" ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {merging && (
        <div className="cs-palette-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setMerging(null);
        }}>
          <div className="cs-confirm" role="dialog" aria-modal="true">
            <h2 className="cs-card__title">Merge “{merging.source.label}”</h2>
            <p className="cs-muted">
              Every question on it moves to the label you pick, and
              “{merging.source.label}” is deleted. Only labels of the same
              kind are offered.
            </p>
            <div className="cs-field">
              <label className="cs-field__label" htmlFor="ql-target">
                Merge into
              </label>
              <div className="cs-select-wrap">
                <select
                  id="ql-target" className="cs-select"
                  value={merging.targetId}
                  onChange={(e) => setMerging((m) => ({ ...m, targetId: e.target.value }))}
                >
                  <option value="">Pick a label…</option>
                  {mergeTargets(merging.source).map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="cs-confirm__actions">
              <button type="button" className="cs-btn-ghost"
                onClick={() => setMerging(null)}>Cancel</button>
              <button type="button" className="cs-btn-primary"
                disabled={busy === merging.source.id} onClick={doMerge}>
                Merge
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
            <h2 className="cs-card__title">Still in use</h2>
            <p className="cs-muted">{blocked.detail}</p>
            <p className="cs-field__hint">
              Merge it into another label instead — that moves the questions
              rather than stripping their classification.
            </p>
            <div className="cs-confirm__actions">
              <button type="button" className="cs-btn-ghost"
                onClick={() => setBlocked(null)}>Close</button>
              <button
                type="button" className="cs-btn-primary"
                onClick={() => {
                  setMerging({ source: blocked.row, targetId: "" });
                  setBlocked(null);
                }}
              >
                Merge instead
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
};

export default QuestionLabels;
