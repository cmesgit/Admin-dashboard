// PLACEMENT: Admin-dashboard/src/pages/content/MediaPickerDialog.jsx
//
// "Choose from library" for the page editor's PictureField.
//
// The button existed since Phase 5a but did nothing except toast "Choosing
// from the library lands in a later phase" (PageEditor.jsx), so the only way
// to give a section a picture was to paste a URL by hand. The library itself
// has existed since Phase 4 — this reads the same GET /media/ endpoint
// Pictures.jsx does, so there is still exactly one media library and one
// upload path.
//
// Deliberately picks an EXISTING asset rather than offering an upload here:
// uploads belong on the Pictures screen, where usage counts and the
// delete-guard live. A second upload entry point is how a CMS ends up with
// two libraries.

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, Search, X } from "lucide-react";

import { getMedia } from "../../api/admin_content_studio";

const errText = (e) =>
  e?.response?.data?.detail || e?.message || "Something went wrong.";

export default function MediaPickerDialog({ onPick, onClose }) {
  const [term, setTerm] = useState("");
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  // Escape closes, matching every other dialog in the Studio.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const load = useCallback(async (q, signal) => {
    setLoading(true);
    try {
      const data = await getMedia(q, { signal });
      setAssets(data.results || []);
      setError("");
    } catch (e) {
      // An abort fires on every keystroke — that is the debounce working, not
      // a failure worth showing.
      if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED"
          || e?.name === "AbortError") return;
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => load(term.trim(), ctrl.signal), 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [term, load]);

  return (
    <div className="cs-palette-overlay" onMouseDown={onClose}>
      <div
        className="cs-confirm cs-confirm--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Choose a picture from the library"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="cs-field__labelrow">
          <h2 className="cs-card__title">Choose a picture</h2>
          <button
            type="button"
            className="cs-btn-ghost"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="cs-field">
          <div className="cs-input cs-input--block" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={14} aria-hidden="true" />
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search pictures by name…"
              aria-label="Search pictures"
              style={{ border: "none", outline: "none", background: "none", flex: 1, font: "inherit", color: "inherit" }}
            />
          </div>
          <span className="cs-field__hint cs-field__hint--tight">
            Pictures are uploaded on the Pictures screen.
          </span>
        </div>

        {error && <p className="cs-error">{error}</p>}

        {loading && <p className="cs-field__hint">Loading pictures…</p>}

        {!loading && !error && assets.length === 0 && (
          <p className="cs-field__hint">
            {term.trim()
              ? `No pictures match “${term.trim()}”.`
              : "There are no pictures in the library yet. Add some on the Pictures screen."}
          </p>
        )}

        {!loading && assets.length > 0 && (
          <div className="cs-picture-grid">
            {assets.map((a) => (
              <button
                key={a.id}
                type="button"
                className="cs-picture cs-picture--pick"
                onClick={() => { onPick(a); onClose(); }}
                title={`Use ${a.name}`}
              >
                <div className="cs-picture__thumb">
                  {a.url
                    ? <img src={a.url} alt={a.alt_text || ""} loading="lazy" />
                    : <ImageIcon size={18} aria-hidden="true" />}
                </div>
                <span className="cs-picture__body">
                  <span className="cs-picture__name" title={a.name}>{a.name}</span>
                  <span className="cs-picture__meta">
                    {a.width && a.height ? `${a.width} × ${a.height}` : "Size unknown"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="cs-confirm__actions">
          <button type="button" className="cs-btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
