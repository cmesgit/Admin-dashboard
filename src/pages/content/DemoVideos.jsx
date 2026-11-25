/**
 * /content/demo-videos — the clips behind the public homepage's floating
 * "Watch a demo" button.
 *
 * WHY A VIDEO CAN BE "SAVED BUT NOT ON THE SITE". A row only reaches visitors
 * when it is Published AND Bunny has finished encoding its clip. Right after an
 * upload Bunny is still working, so the row says what it is waiting for instead
 * of looking broken, and this page re-checks Bunny until it finishes.
 *
 * Uploads go browser → Bunny directly (the API only mints a signed ticket), so
 * a big file never passes through our server. Hiding a clip is a status
 * change; Delete removes the row but leaves the file in Bunny.
 *
 * ⚠ `react-hot-toast` does not exist in this app. The convention is local
 * state cleared on a timer, rendered by components/Toast.jsx.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Pencil, Trash2, Upload } from "lucide-react";
import {
  createDemoVideo, createUploadSlot, deleteDemoVideo, getDemoVideos,
  syncDemoVideo, updateDemoVideo, uploadToBunny,
} from "../../api/admin_demo_videos";
import Toast from "../../components/Toast";
import { errText } from "../../utils/errText";
import "../../css/DemoVideos.css";

const POLL_MS = 6000;
const POLL_LIMIT_MS = 15 * 60 * 1000; // Bunny can take a while on a long clip.

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);

const runtime = (sec) =>
  sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "—";

const isEncoding = (v) => !!v.bunny_video_id && v.bunny_status !== 4 && v.bunny_status !== 5 && v.bunny_status !== 6;

// errText() only understands API errors. A failed Bunny upload (no response)
// needs its own wording, so fall back to the caller's sentence.
const msg = (err, fallback) => (err?.response ? errText(err) : fallback);

const BLANK = { title: "", blurb: "", key: "" };

/** Upload `file` and return the new Bunny guid. `onProgress(0..100)`. */
async function sendToBunny(file, onProgress) {
  const ticket = await createUploadSlot(file);
  await uploadToBunny(file, ticket, onProgress);
  return ticket.video_id;
}

export default function DemoVideos() {
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [toast, setToast] = useState({ msg: "", tone: "success" });
  const [form, setForm] = useState(BLANK);
  const [keyTouched, setKeyTouched] = useState(false);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [adding, setAdding] = useState(false);
  const [progress, setProgress] = useState({}); // key | "__new" → 0..100
  const [editing, setEditing] = useState(null); // row being edited
  const fileRef = useRef(null);
  const pollStart = useRef(Date.now());

  const say = (msg, tone = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast({ msg: "", tone: "success" }), 3000);
  };

  const load = useCallback(() =>
    getDemoVideos()
      .then((d) => { setRows(d); setFailed(false); })
      // ⚠ Never render "no demo videos" for a failed request — an outage would
      // read as "nothing is configured".
      .catch(() => { setFailed(true); setRows((r) => r ?? []); }), []);

  useEffect(() => { load(); }, [load]);

  // While any clip is still encoding, ask Bunny again. Stops after a while so
  // a stuck upload doesn't poll forever; reloading the page restarts it.
  const encodingKeys = (rows || []).filter(isEncoding).map((v) => v.key).join(",");
  useEffect(() => {
    if (!encodingKeys) { pollStart.current = Date.now(); return undefined; }
    const t = setInterval(async () => {
      if (Date.now() - pollStart.current > POLL_LIMIT_MS) { clearInterval(t); return; }
      const updated = await Promise.all(
        encodingKeys.split(",").map((k) => syncDemoVideo(k).catch(() => null)),
      );
      setRows((cur) => (cur || []).map((r) => updated.find((u) => u?.key === r.key) || r));
    }, POLL_MS);
    return () => clearInterval(t);
  }, [encodingKeys]);

  const setTitle = (title) =>
    setForm((f) => ({ ...f, title, key: keyTouched ? f.key : slugify(title) }));

  const add = async () => {
    setErrors({});
    if (!file) { setErrors({ file: "Choose a video file." }); return; }
    setAdding(true);
    try {
      const guid = await sendToBunny(file, (p) => setProgress((s) => ({ ...s, __new: p })));
      await createDemoVideo({
        key: form.key,
        title: form.title.trim(),
        blurb: form.blurb.trim(),
        order: (rows || []).reduce((m, r) => Math.max(m, r.order), -1) + 1,
        status: "published",
        bunny_video_id: guid,
      });
      setForm(BLANK); setKeyTouched(false); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      say("Uploaded. It goes live once Bunny finishes processing it.");
      load();
    } catch (err) {
      const d = err?.response?.data;
      if (d && typeof d === "object") setErrors(d);
      else say(msg(err, "Upload failed. Nothing was added — try again."), "error");
    } finally {
      setAdding(false);
      setProgress((s) => { const { __new, ...rest } = s; return rest; });
    }
  };

  const replace = async (row, f) => {
    if (!f) return;
    if (!window.confirm(
      `Replace the video for "${row.title}" with ${f.name}?\n\n` +
      `The new clip stays hidden until Bunny finishes processing it. ` +
      `The old file is kept in Bunny.`)) return;
    try {
      const guid = await sendToBunny(f, (p) => setProgress((s) => ({ ...s, [row.key]: p })));
      const updated = await updateDemoVideo(row.key, { bunny_video_id: guid });
      setRows((cur) => cur.map((r) => (r.key === row.key ? updated : r)));
      say("New video uploaded. It goes live once Bunny finishes processing it.");
    } catch (err) {
      say(msg(err, "Upload failed. The existing video was not changed."), "error");
    } finally {
      setProgress((s) => { const { [row.key]: _, ...rest } = s; return rest; });
    }
  };

  const toggle = async (row) => {
    const next = row.status === "published" ? "archived" : "published";
    try {
      const updated = await updateDemoVideo(row.key, { status: next });
      setRows((cur) => cur.map((r) => (r.key === row.key ? updated : r)));
      say(next === "published" ? "Published." : "Hidden from the site.");
    } catch (err) { say(msg(err, "Couldn't change that."), "error"); }
  };

  const saveEdit = async () => {
    try {
      const updated = await updateDemoVideo(editing.key, {
        title: editing.title.trim(),
        blurb: editing.blurb.trim(),
        order: Number(editing.order) || 0,
      });
      setRows((cur) => cur.map((r) => (r.key === editing.key ? updated : r))
        .sort((a, b) => a.order - b.order || a.id - b.id));
      setEditing(null);
      say("Saved.");
    } catch (err) { say(msg(err, "Couldn't save that."), "error"); }
  };

  const remove = async (row) => {
    if (!window.confirm(
      `Delete "${row.title}"?\n\n` +
      `This removes it from the list and the homepage. The video file stays in ` +
      `Bunny. To just hide it, use Hide instead.`)) return;
    try {
      await deleteDemoVideo(row.key);
      setRows((cur) => cur.filter((r) => r.key !== row.key));
      say("Deleted.");
    } catch (err) { say(msg(err, "Couldn't delete that."), "error"); }
  };

  const liveCount = (rows || []).filter((r) => r.is_live).length;

  return (
    <div className="dvp">
      <header>
        <h1 className="dvp__h1">Demo videos</h1>
        <p className="dvp__sub">
          The walkthroughs behind the homepage's “Watch a demo” button.
          Upload a video and it appears there once Bunny has finished
          processing it, usually within a few minutes.
        </p>
      </header>

      <section className="dvp__add" aria-label="Add a demo video">
        <div className="dvp__field">
          <label className="dvp__label" htmlFor="dvp-title">Title</label>
          <input id="dvp-title" className={`dvp__input${errors.title ? " dvp__input--bad" : ""}`}
            maxLength={80} placeholder="How to enroll in a course"
            value={form.title} onChange={(e) => setTitle(e.target.value)} />
          {errors.title && <span className="dvp__err">{String(errors.title)}</span>}
        </div>
        <div className="dvp__field">
          <label className="dvp__label" htmlFor="dvp-blurb">Short description</label>
          <input id="dvp-blurb" className="dvp__input" maxLength={120}
            placeholder="Find and join a course"
            value={form.blurb} onChange={(e) => setForm({ ...form, blurb: e.target.value })} />
        </div>
        <div className="dvp__field dvp__field--narrow">
          <label className="dvp__label" htmlFor="dvp-key">Short name</label>
          <input id="dvp-key" className={`dvp__input${errors.key ? " dvp__input--bad" : ""}`}
            placeholder="enroll" value={form.key}
            onChange={(e) => { setKeyTouched(true); setForm({ ...form, key: slugify(e.target.value) }); }} />
          {errors.key && <span className="dvp__err">{String(errors.key)}</span>}
        </div>
        <div className="dvp__field">
          <label className="dvp__label" htmlFor="dvp-file">Video file</label>
          <input id="dvp-file" ref={fileRef} type="file" accept="video/*" className="dvp__input"
            onChange={(e) => setFile(e.target.files?.[0] || null)} />
          {errors.file && <span className="dvp__err">{String(errors.file)}</span>}
        </div>
        <button className="dvp__btn" onClick={add}
          disabled={adding || !form.title.trim() || !form.key || !file}>
          <Upload size={15} aria-hidden="true" />
          {adding ? `Uploading… ${progress.__new ?? 0}%` : "Upload and add"}
        </button>
      </section>

      {failed && (
        <div className="dvp__failed" role="status">
          Couldn't load the demo videos — this list may be incomplete.
        </div>
      )}

      {rows === null ? (
        <p className="dvp__sub">Loading…</p>
      ) : rows.length === 0 && !failed ? (
        <div className="dvp__empty">
          <strong>No demo videos yet.</strong>
          <p>Until one is live, the “Watch a demo” button doesn't appear on the homepage.</p>
        </div>
      ) : (
        <div className="adm-table-card">
          <div className="adm-count">
            {rows.length} video{rows.length !== 1 ? "s" : ""} · {liveCount} live on the site
          </div>
          <table className="adm-table adm-table--wide">
            <thead>
              <tr><th>Video</th><th>Length</th><th>On the site</th><th>Order</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    <div className="dvp__cell">
                      {r.thumbnail_url
                        ? <img className="dvp__thumb" src={r.thumbnail_url} alt="" loading="lazy" />
                        : <span className="dvp__thumb dvp__thumb--none" aria-hidden="true" />}
                      <div>
                        <div className="dvp__title">{r.title}</div>
                        <div className="dvp__meta">{r.blurb || <em>No description</em>} · <code>{r.key}</code></div>
                      </div>
                    </div>
                  </td>
                  <td>{runtime(r.duration_seconds)}</td>
                  <td>
                    {progress[r.key] != null ? (
                      <span className="dvp__pill dvp__pill--wait">Uploading {progress[r.key]}%</span>
                    ) : (
                      <span className={`dvp__pill${r.is_live ? " dvp__pill--on" : ""}`}
                        title={r.status_label}>
                        {r.is_live ? "Live" : r.on_the_site.replace(/^No — /, "Not live: ")}
                      </span>
                    )}
                  </td>
                  <td>{r.order}</td>
                  <td>
                    <div className="dvp__actions">
                      <label className="dvp__icon" title="Replace the video file">
                        <Upload size={15} aria-label={`Replace video for ${r.title}`} />
                        <input type="file" accept="video/*" hidden
                          onChange={(e) => { replace(r, e.target.files?.[0]); e.target.value = ""; }} />
                      </label>
                      <button className="dvp__icon" onClick={() => setEditing({ ...r })}
                        title="Edit title, description and order" aria-label={`Edit ${r.title}`}>
                        <Pencil size={15} />
                      </button>
                      <button className="dvp__icon" onClick={() => toggle(r)}
                        title={r.status === "published" ? "Hide from the site" : "Publish"}
                        aria-label={r.status === "published" ? `Hide ${r.title}` : `Publish ${r.title}`}>
                        {r.status === "published" ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button className="dvp__icon dvp__icon--danger" onClick={() => remove(r)}
                        title="Delete" aria-label={`Delete ${r.title}`}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="dvp__modal" role="dialog" aria-modal="true" aria-label="Edit demo video"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="dvp__card">
            <h2 className="dvp__h2">Edit “{editing.key}”</h2>
            <label className="dvp__label" htmlFor="dvp-e-title">Title</label>
            <input id="dvp-e-title" className="dvp__input" maxLength={80} value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <label className="dvp__label" htmlFor="dvp-e-blurb">Short description</label>
            <input id="dvp-e-blurb" className="dvp__input" maxLength={120} value={editing.blurb}
              onChange={(e) => setEditing({ ...editing, blurb: e.target.value })} />
            <label className="dvp__label" htmlFor="dvp-e-order">Order (lowest first)</label>
            <input id="dvp-e-order" className="dvp__input" type="number" min="0" value={editing.order}
              onChange={(e) => setEditing({ ...editing, order: e.target.value })} />
            <div className="dvp__row-end">
              <button className="dvp__btn dvp__btn--ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="dvp__btn" onClick={saveEdit} disabled={!editing.title.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast.msg} tone={toast.tone} />
    </div>
  );
}
