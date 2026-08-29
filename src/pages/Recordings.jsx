// Recordings — library of past session recordings. Data: GET
// /livestream/admin/recordings/.
//
// "View" used to be a toast reading "playback opens the Bunny player in
// production" — there was no production branch anywhere, no player route,
// and the admin endpoint didn't even return bunny_video_id. All three are
// fixed now: the endpoint returns the id, and View opens a player.
//
// That player no longer builds its own Bunny URL. It asks
// GET /courses/recordings/:id/playback/ for a signed, expiring one — see
// getRecordingPlayback in api/livestream.js for why the composed URL had to
// go. Nothing here needs the Player.js listener the student app added: this
// modal is playback-only and records no watch progress.
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Video, PlayCircle, Search, X, Loader2, AlertTriangle, Pencil, Trash2,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";
import {
  getAdminRecordings, getRecordingPlayback, updateAdminRecording,
  deleteAdminRecording, getSubjectBatches, getSubjectChapters,
} from "../api/livestream";
import { errText } from "../utils/errText";
import "../css/LiveStreams.css";
// The edit modal below is built from .cm-form-card / .cm-row / .cm-field,
// which live in Courses.css — and every route in App.jsx is lazy(), so a
// chunk only has the CSS it imports. Same reasoning (and the same one-line
// fix) as pages/content/CardFormModal.jsx: without this the modal renders
// unstyled unless the admin happened to visit Courses first.
import "../css/Courses.css";

const STATUS_BADGE = {
  Finished: "green", Uploaded: "blue", Processing: "yellow",
  Transcoding: "yellow", Created: "gray", Error: "red",
};

const EMPTY_PLAYBACK = { loading: false, embedUrl: null, error: null };

// Sentinel for the "All batches" option. It cannot be "" — an empty <option>
// value and a real batch id have to stay distinguishable, because "" is what
// the chapter select uses for "no chapter" and the two mean different things
// on the wire (batch null = visible course-wide, chapter null = untagged).
const ALL_BATCHES = "__all__";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return iso; }
};
const fmtDur = (secs) => {
  if (!secs) return "—";
  const m = Math.round(secs / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
};

// session_date is a DateField server-side, so it arrives as "YYYY-MM-DD" —
// exactly what <input type="date"> wants. Sliced defensively in case a
// datetime ever shows up there; an unparseable value would silently blank
// the input and then PATCH the blank back as a real change.
const toDateInput = (v) => (v || "").slice(0, 10);

/* ───────────────────────── Edit modal ─────────────────────────
   Defined in-file rather than extracted, matching pages/skillcms/Categories.jsx
   (CategoryFormModal) — it has exactly one call site and shares this file's
   row shape. */
function RecordingFormModal({ recording, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    title: recording.title || "",
    description: recording.description || "",
    session_date: toDateInput(recording.session_date),
    batch_id: recording.batch_id || ALL_BATCHES,
    chapter_id: recording.chapter_id || "",
    is_published: !!recording.is_published,
  });
  // The modal is keyed on the row id, so subjectId is fixed for its whole
  // lifetime. That lets the "no subject at all" case be an INITIAL state
  // rather than a setState fired synchronously inside the effect below —
  // which is a cascading render and an eslint error (react-hooks/
  // set-state-in-effect).
  const subjectId = recording.subject_id;
  const [batches, setBatches] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [optsLoading, setOptsLoading] = useState(!!subjectId);
  // Tracked separately from "the list is empty". A subject with no batches
  // and a subject whose batch list was REFUSED must not render the same.
  //
  // There is deliberately no chaptersBlocked twin any more. It existed because
  // _require_subject_access() had no is_staff branch, so the chapter list 403'd
  // for every pure admin and the field had to be frozen. That gate now
  // short-circuits on is_staff, so chapters are a normal editable select.
  const [batchesBlocked, setBatchesBlocked] = useState(!subjectId);

  useEffect(() => {
    if (!subjectId) return undefined;
    let alive = true;
    Promise.all([getSubjectBatches(subjectId), getSubjectChapters(subjectId)])
      .then(([b, c]) => {
        if (!alive) return;
        // Both are safe()-wrapped, so they resolve to [] on failure and tag it
        // __failed. Reading that flag is the only way to tell a refusal from
        // a genuinely empty list.
        setBatchesBlocked(!!b?.__failed);
        setBatches(Array.isArray(b) ? b : b?.results || []);
        setChapters(Array.isArray(c) ? c : c?.results || []);
      })
      .finally(() => { if (alive) setOptsLoading(false); });
    return () => { alive = false; };
  }, [subjectId]);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  // PARTIAL update: only what actually changed. The endpoint is PATCH-only by
  // design (PUT is a deliberate 405) precisely so a client can't blank a field
  // it never showed the admin.
  //
  // `chapter_tags` is DELIBERATELY never in this payload. The backend leaves
  // existing multi-chapter tags untouched when the key is absent, so this
  // single-select can only ever set the one `chapter` FK — an admin tidying a
  // title can never destroy a teacher's richer multi-chapter placement.
  const payload = useMemo(() => {
    const out = {};
    const title = form.title.trim();
    if (title !== (recording.title || "")) out.title = title;
    if (form.description !== (recording.description || "")) out.description = form.description;

    const date = form.session_date || null;
    if (date !== (toDateInput(recording.session_date) || null)) out.session_date = date;

    if (!batchesBlocked) {
      const batchId = form.batch_id === ALL_BATCHES ? null : form.batch_id;
      if (batchId !== (recording.batch_id || null)) out.batch_id = batchId;
    }
    const chapterId = form.chapter_id || null;
    if (chapterId !== (recording.chapter_id || null)) out.chapter_id = chapterId;

    if (form.is_published !== !!recording.is_published) out.is_published = form.is_published;
    return out;
  }, [form, recording, batchesBlocked]);

  const dirty = Object.keys(payload).length > 0;

  // A <select> whose value matches no <option> silently displays the FIRST
  // option instead. While a list is still loading — or if its request failed —
  // that made a batch-scoped recording read "All batches (course-wide)", which
  // is the opposite of the truth. These placeholders keep both controls honest
  // until the real option arrives, and mean a failed list request can never
  // make the form misreport the row's current placement.
  const batchMissing = form.batch_id !== ALL_BATCHES
    && !batches.some((b) => String(b.id) === String(form.batch_id));
  const chapterMissing = !!form.chapter_id
    && !chapters.some((c) => String(c.id) === String(form.chapter_id));

  const submit = () => {
    const batchId = payload.batch_id !== undefined
      ? payload.batch_id
      : (recording.batch_id || null);
    // The row merge needs a display NAME for the batch cell; the PATCH
    // response only carries ids. Resolve it here, where the options are.
    const batchName = batchId
      ? (batches.find((b) => String(b.id) === String(batchId))?.name || null)
      : null;
    onSubmit(payload, { batchName });
  };

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card" onClick={(e) => e.stopPropagation()}>
        <h3>Edit recording</h3>

        <label className="cm-field">
          <span>Title</span>
          <input value={form.title} onChange={set("title")} autoFocus />
        </label>

        <label className="cm-field">
          <span>Description</span>
          <textarea rows={3} value={form.description} onChange={set("description")}
            placeholder="What was covered in this session (optional)" />
        </label>

        <div className="cm-row">
          <label className="cm-field">
            <span>Session date</span>
            <input type="date" value={form.session_date} onChange={set("session_date")} />
          </label>

          <label className="cm-field">
            <span>Batch</span>
            <select value={form.batch_id} onChange={set("batch_id")}
              disabled={optsLoading || batchesBlocked}>
              <option value={ALL_BATCHES}>All batches (course-wide)</option>
              {batchMissing && (
                <option value={form.batch_id}>
                  {recording.batch_name || "Current batch"}
                  {optsLoading ? " (loading…)" : " (not in the loaded list)"}
                </option>
              )}
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}{b.year ? ` · ${b.year}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="cm-field">
          <span>Chapter</span>
          <select value={form.chapter_id} onChange={set("chapter_id")}
            disabled={optsLoading || !subjectId}>
            <option value="">No chapter</option>
            {chapterMissing && (
              <option value={form.chapter_id}>
                {optsLoading ? "Current chapter (loading…)" : "Current chapter (list unavailable)"}
              </option>
            )}
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </label>

        {batchesBlocked && !optsLoading && (
          <div className="rec-formNote">
            The batch list could not be loaded, so the batch is left unchanged.
          </div>
        )}

        <label className="cm-check">
          <input type="checkbox" checked={form.is_published} onChange={set("is_published")} />
          <span>Published (visible to students who can see this recording)</span>
        </label>

        {error && <div className="cm-form-error">{error}</div>}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="confirm-ok" onClick={submit}
            disabled={busy || !form.title.trim() || !dirty}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* The PATCH response is SessionRecordingSerializer — a DIFFERENT shape from
   the hand-built dict this table renders. Spreading it over the row would
   overwrite `status` (the display string "Finished") with the raw int, so the
   badge would read "4" in grey, and would leave `batch_id`/`batch_name` stale
   because the response calls them `batch` and omits the name entirely. So map
   field by field. `status`/`status_code`/`duration_seconds` are deliberately
   left alone — nothing in this form can change a transcode. */
const mergeUpdatedRow = (row, u, meta) => ({
  ...row,
  title: u.title,
  description: u.description,
  session_date: u.session_date,
  is_published: u.is_published,
  batch_id: u.batch || null,
  batch_name: meta?.batchName ?? null,
  chapter_id: u.chapter || null,
  chapter_note: u.chapter_note,
  no_specific_chapter: u.no_specific_chapter,
  trim_start_seconds: u.trim_start_seconds,
  trim_end_seconds: u.trim_end_seconds,
});

const Recordings = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  // getAdminRecordings is safe()-wrapped, so a dead backend resolves to an
  // empty list instead of throwing. Without reading its __failed flag an
  // outage renders as "No recordings found." — i.e. the library looks empty
  // rather than broken. Same pattern as pages/content/BlogPosts.jsx.
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [playback, setPlayback] = useState(EMPTY_PLAYBACK);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const toastTimer = useRef(null);
  // Bumped on every open and on close, so a slow response for a recording the
  // admin has already closed (or swapped away from) can't land in the modal.
  const playReq = useRef(0);

  const fireToast = useCallback((m) => {
    clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const closePlayer = useCallback(() => {
    playReq.current += 1;
    setPlaying(null);
    setPlayback(EMPTY_PLAYBACK);
  }, []);

  const loadPlayback = useCallback(async (r) => {
    const token = ++playReq.current;
    setPlayback({ loading: true, embedUrl: null, error: null });
    try {
      const data = await getRecordingPlayback(r.id);
      if (token !== playReq.current) return;
      setPlayback({ loading: false, embedUrl: data.embed_url, error: null });
    } catch (err) {
      if (token !== playReq.current) return;
      // Distinct reasons, reported distinctly — conflating them is what made
      // this page's failure mode impossible to diagnose. They now come from
      // the server's status code rather than from a guess made in the bundle.
      const code = err?.response?.status;
      const message =
        code === 403
          ? "Playback was refused for this account. Recordings need a staff session — sign out and back in as an admin."
          : code === 404
            ? "This recording has no video attached yet."
            : code === 503
              ? "Video playback isn't configured on this server (Bunny Stream settings are missing)."
              : errText(err);
      setPlayback({ loading: false, embedUrl: null, error: message });
    }
  }, []);

  // The modal opens straight away and shows its own loading/error state; only
  // the one thing the list already knows — no video at all — is still worth a
  // toast, since it needs no round-trip and can name the transcode status.
  const openPlayer = useCallback((r) => {
    if (!r.bunny_video_id) {
      fireToast(`“${r.title}” has no uploaded video yet (status: ${r.status}).`);
      return;
    }
    setPlaying(r);
    loadPlayback(r);
  }, [fireToast, loadPlayback]);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e) => { if (e.key === "Escape") closePlayer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, closePlayer]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      getAdminRecordings(q ? { q } : undefined)
        .then((d) => {
          setLoadError(!!d?.__failed);
          setRows(d.data || []);
        })
        .catch(() => { setLoadError(true); setRows([]); })
        .finally(() => setLoading(false));
    }, q ? 300 : 0); // debounce search
    return () => clearTimeout(t);
  }, [q, reloadKey]);

  const handleEditSubmit = useCallback(async (payload, meta) => {
    if (!editing) return;
    setBusy(true); setFormError("");
    try {
      const updated = await updateAdminRecording(editing.id, payload);
      setRows((prev) => prev.map((r) =>
        (r.id === editing.id ? mergeUpdatedRow(r, updated, meta) : r)));
      fireToast(`Updated “${updated.title}”`);
      setEditing(null);
    } catch (err) {
      // DRF field dicts (e.g. {"batch_id": ["Pick a batch from this
      // recording's own course."]}) — errText flattens them into a sentence.
      setFormError(errText(err));
    } finally {
      setBusy(false);
    }
  }, [editing, fireToast]);

  const handleDelete = useCallback(async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await deleteAdminRecording(confirm.item.id);
      setRows((prev) => prev.filter((r) => r.id !== confirm.item.id));
      fireToast(`Deleted “${confirm.item.title}”`);
      setConfirm(null);
    } catch (err) {
      // Kept open with the reason attached, rather than closed with a toast —
      // the row is still there, so the admin needs to see why it survived.
      setConfirm((c) => (c ? { ...c, error: errText(err) } : c));
    } finally {
      setBusy(false);
    }
  }, [confirm, fireToast]);

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Recordings</h1>

      <div className="rec-search">
        <Search size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recordings by title…" />
      </div>

      <div className="dashboard-card payments-table-card">
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : loadError ? (
          /* NOT "No recordings found." — that sentence is a claim about the
             library, and this request never got an answer. */
          <div className="dashboard-loading rec-loadError">
            <AlertTriangle size={18} />
            <span>
              The recordings list didn’t load, so this table is empty because the
              request failed — not because there are no recordings.
            </span>
            <button className="rec-playerRetry" onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No recordings found.</div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th>Title</th><th>Course · Subject</th><th>Batch</th>
                <th>Date</th><th>Duration</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="ls-title"><Video size={14} /> {r.title}</span>
                  </td>
                  <td>{r.course_name}{r.subject_name ? ` · ${r.subject_name}` : ""}</td>
                  <td>{r.batch_name || "Course-wide"}</td>
                  <td>{fmtDate(r.session_date || r.created_at)}</td>
                  <td>{fmtDur(r.duration_seconds)}</td>
                  <td><StatusBadge color={STATUS_BADGE[r.status] || "gray"}>{r.status}</StatusBadge></td>
                  <td>
                    <div className="rec-rowActions">
                      <button className="ls-row-monitor" onClick={() => openPlayer(r)}>
                        <PlayCircle size={13} /> View
                      </button>
                      <button
                        className="rec-rowBtn"
                        onClick={() => { setFormError(""); setEditing(r); }}
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        className="rec-rowBtn rec-rowBtn--danger"
                        onClick={() => setConfirm({ item: r })}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {playing && (
        <div className="rec-playerOverlay" onClick={closePlayer}>
          <div className="rec-player" onClick={(e) => e.stopPropagation()}>
            <div className="rec-playerHead">
              <span className="ls-title"><Video size={14} /> {playing.title}</span>
              <button className="rec-playerClose" onClick={closePlayer} aria-label="Close player">
                <X size={16} />
              </button>
            </div>
            <div className="rec-playerFrame">
              {playback.loading ? (
                <div className="rec-playerState">
                  <Loader2 size={20} className="rec-playerSpin" />
                  <span>Preparing playback…</span>
                </div>
              ) : playback.error ? (
                <div className="rec-playerState rec-playerState--error">
                  <AlertTriangle size={20} />
                  <span>{playback.error}</span>
                  <button className="rec-playerRetry" onClick={() => loadPlayback(playing)}>
                    Try again
                  </button>
                </div>
              ) : playback.embedUrl ? (
                <iframe
                  title={playing.title}
                  src={playback.embedUrl}
                  loading="lazy"
                  allow="accelerometer; gyroscope; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : null}
            </div>
            <div className="rec-playerMeta">
              {playing.course_name}
              {playing.subject_name ? ` · ${playing.subject_name}` : ""}
              {playing.batch_name ? ` · ${playing.batch_name}` : " · Course-wide"}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <RecordingFormModal
          /* Keyed so switching rows remounts the modal — its form state is
             seeded from props in useState, which would otherwise keep the
             previous recording's values. */
          key={editing.id}
          recording={editing}
          busy={busy}
          error={formError}
          onSubmit={handleEditSubmit}
          onCancel={() => setEditing(null)}
        />
      )}

      {confirm && (
        <ConfirmModal
          title="Delete recording"
          message={`Delete “${confirm.item.title}”? This removes the recording and its video from Bunny Stream for every student who could see it. This can't be undone.`}
          extra={confirm.error ? <div className="cm-form-error">{confirm.error}</div> : null}
          onConfirm={busy ? () => {} : handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}

      <Toast message={toast} />
    </div>
  );
};

export default Recordings;
