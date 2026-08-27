// The Pictures library (design_handoff_content_studio Phase 4).
//
// The grid's second line — "1440 × 980 · used on 2 pages" — is the reason this
// screen exists. Before it, a picture lived on whichever row owned it and
// nobody could tell where it was used, or whether deleting it would blank a
// live page.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ImageOff, Trash2, UploadCloud } from "lucide-react";
import { deleteMedia, getMedia, uploadMedia } from "../../api/admin_content_studio";
import { errText } from "../../utils/errText";
import Toast from "../../components/Toast";
import "../../css/ContentStudio.css";

const Pictures = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [blocked, setBlocked] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const fileInput = useRef(null);

  const say = useCallback((m) => {
    clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // The real table total, so the header can't present a truncated library as
  // complete the way `assets.length` did at exactly 200.
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async (term, { signal, append = false, page: p = 1 } = {}) => {
    setLoading(true);
    try {
      const data = await getMedia(term, { page: p, signal });
      const rows = data.results || [];
      setAssets((cur) => (append ? [...cur, ...rows] : rows));
      setTotal(typeof data.count === "number" ? data.count : rows.length);
      setHasMore(Boolean(data.has_more));
      setPage(p);
      setError("");
    } catch (e) {
      // An abort is expected on every keystroke — not a failure to report.
      if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED"
          || e?.name === "AbortError") return;
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Cancelling only the debounce timer left in-flight requests racing: a slow
    // early response could overwrite a newer one.
    const controller = new AbortController();
    const t = setTimeout(
      () => load(q.trim(), { signal: controller.signal }), q ? 250 : 0,
    );
    return () => { clearTimeout(t); controller.abort(); };
  }, [q, load]);

  const send = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setUploading(list.map((f) => f.name));
    try {
      // Sequential, not parallel: a dropped folder of 30 images would
      // otherwise open 30 sockets and the last few would time out.
      for (const file of list) {
        await uploadMedia(file);
      }
      say(list.length === 1 ? "Picture added." : `${list.length} pictures added.`);
      await load(q.trim());
    } catch (e) {
      say(errText(e));
    } finally {
      setUploading([]);
    }
  };

  const remove = async (asset) => {
    try {
      await deleteMedia(asset.id);
      say("Picture deleted.");
      setAssets((a) => a.filter((x) => x.id !== asset.id));
    } catch (e) {
      // 409 is the designed answer, not a failure: the server refuses and
      // names what would break.
      const used = e?.response?.data?.used_in;
      if (e?.response?.status === 409 && used?.length) {
        setBlocked({ asset, used, detail: e.response.data.detail });
      } else {
        say(errText(e));
      }
    }
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Pictures</h1>
      <p className="cs-home__sub">
        Upload a picture once and use it in as many places as you like.
      </p>

      <div
        className={`cs-dropzone${dragging ? " is-dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          send(e.dataTransfer.files);
        }}
      >
        <UploadCloud size={22} aria-hidden="true" />
        <p className="cs-dropzone__title">Drag pictures here</p>
        <p className="cs-dropzone__sub">
          or{" "}
          <button
            type="button"
            className="cs-linklike"
            onClick={() => fileInput.current?.click()}
          >
            choose from your computer
          </button>
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { send(e.target.files); e.target.value = ""; }}
        />
        {uploading.length > 0 && (
          <p className="cs-dropzone__sub">Uploading {uploading.join(", ")}…</p>
        )}
      </div>

      <div className="cs-pictures__bar">
        <input
          className="cs-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search pictures by name…"
          aria-label="Search pictures"
        />
        <span className="cs-muted">
          {loading ? "Loading…" : total > assets.length
            ? `${assets.length} of ${total} pictures`
            : `${total} picture${total === 1 ? "" : "s"}`}
        </span>
      </div>

      {error && <p className="cs-error" role="alert">{error}</p>}

      {!loading && !error && assets.length === 0 && (
        <div className="cs-empty">
          <ImageOff size={20} aria-hidden="true" />
          <p>{q ? `No pictures match “${q}”.` : "No pictures yet. Drop one above."}</p>
        </div>
      )}

      <div className="cs-picture-grid">
        {assets.map((a) => (
          <figure key={a.id} className="cs-picture">
            <div className="cs-picture__thumb">
              {a.url ? <img src={a.url} alt={a.alt_text || ""} loading="lazy" /> : null}
            </div>
            <figcaption className="cs-picture__body">
              <span className="cs-picture__name" title={a.name}>{a.name}</span>
              <span className="cs-picture__meta">
                {a.width && a.height ? `${a.width} × ${a.height}` : "Size unknown"}
                {" · "}
                {a.usage_count === 0
                  ? "not used yet"
                  : `used on ${a.usage_count} page${a.usage_count === 1 ? "" : "s"}`}
              </span>
            </figcaption>
            <button
              type="button"
              className="cs-picture__delete"
              onClick={() => remove(a)}
              aria-label={`Delete ${a.name}`}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </figure>
        ))}
      </div>

      {/* Everything past the first page used to be unreachable — and
          undeletable — through this screen. */}
      {hasMore && !loading && (
        <div className="cs-picture-more">
          <button
            type="button"
            className="cs-btn-ghost"
            onClick={() => load(q.trim(), { append: true, page: page + 1 })}
          >
            Show more pictures
          </button>
        </div>
      )}

      {blocked && (
        <div className="cs-palette-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setBlocked(null);
        }}>
          <div className="cs-confirm" role="dialog" aria-modal="true">
            <h2 className="cs-card__title">Still in use</h2>
            <p className="cs-muted">{blocked.detail}</p>
            <ul className="cs-list">
              {/* One link per place it's used. A single shared button had to
                  guess a destination, and guessed the homepage tab for
                  everything — including blog covers, which aren't on it.
                  `field` is a raw column name, so it stays out of the copy. */}
              {blocked.used.map((u, i) => (
                <li key={i} className="cs-list__row">
                  <span className="cs-list__text">
                    <span className="cs-list__title">{u.title}</span>
                    <span className="cs-list__reason">{u.kind_label}</span>
                  </span>
                  {u.url && (
                    <Link to={u.url} className="cs-btn-ghost">
                      Open
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <div className="cs-confirm__actions">
              <button type="button" className="cs-btn-ghost" onClick={() => setBlocked(null)}>
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

export default Pictures;
