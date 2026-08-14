// Media-library picker for the rich-text editor's inline body images.
//
// This is the *deliberate* path (toolbar "Insert image" button) — a small
// state machine that lets an author upload a fresh image OR reuse one already
// in the library, review/edit its alt text, and optionally crop it, before
// inserting. It is intentionally NOT on the paste/drag-drop path: those keep
// the existing fast no-picker upload-and-insert flow in RichTextEditor.jsx.
//
// State machine:
//   browse ──(upload a file | pick a library image)──▶ review
//   review ──(Crop)──▶ crop ──(Apply crop → new ContentImage row)──▶ review
//   review ──(Insert)──▶ onInsert(image, altText) + close
//   review ──(Back)──▶ browse
//
// Cropping never mutates the source row: it POSTs the canvas output as a
// brand-new ContentImage (other posts may already reference the original's
// exact URL/dimensions), then patches only the new row's alt/focal metadata.
import { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { Loader2, Search, Upload, X, Crop as CropIcon } from "lucide-react";
import {
  uploadContentEditorImage,
  listContentImages,
  updateContentImage,
} from "../api/admin";
// Import the confirm-dialog chrome explicitly so this modal's overlay/card
// shell (.confirm-overlay/.confirm-card) is styled even on a host page that
// doesn't otherwise render a ConfirmModal — MediaLibrary.css only overrides
// the card size, it doesn't redefine the overlay/positioning.
import "../css/ConfirmModal.css";
import "../css/MediaLibrary.css";

// Draw the chosen pixel region of an image onto an offscreen canvas and hand
// back a Blob. `crossOrigin="anonymous"` is set defensively: uploaded images
// are served from the API host (a different origin than this dev/admin app),
// and without the CORS-clean load the canvas would be tainted and toBlob()
// would throw a SecurityError. The backend serves media with permissive CORS,
// so this succeeds; if a given host ever lacked CORS headers the load would
// fail loudly (onerror) rather than silently producing a broken crop.
const cropImageToBlob = (imageUrl, pixelCrop) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = Math.max(1, Math.round(pixelCrop.width));
      const h = Math.max(1, Math.round(pixelCrop.height));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get a 2D canvas context."));
        return;
      }
      ctx.drawImage(
        img,
        pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
        0, 0, w, h
      );
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas produced no image data."))),
        "image/png"
      );
    };
    img.onerror = () => reject(new Error("Could not load the image for cropping."));
    img.src = imageUrl;
  });

// Last path segment of a URL (used to name the cropped-<original> upload).
const basenameFromUrl = (url) => {
  try {
    const path = new URL(url, window.location.origin).pathname;
    return decodeURIComponent(path.split("/").pop() || "image");
  } catch {
    return "image";
  }
};

const PAGE_SIZE = 20; // mirrors the backend's AdminPagination page_size

const MediaLibraryModal = ({ onInsert, onClose }) => {
  // "browse" | "review" | "crop"
  const [step, setStep] = useState("browse");
  // "upload" | "library"
  const [tab, setTab] = useState("upload");

  // The image currently being reviewed/cropped (a ContentImage object).
  const [image, setImage] = useState(null);
  // How the reviewed image entered the flow — a fresh upload prefills nothing
  // (alt text starts empty, title used only as a placeholder); a library pick
  // prefills its stored alt_text and, if the author edits it, persists it back.
  const [imageSource, setImageSource] = useState("upload");
  const [altText, setAltText] = useState("");

  // Busy flag for any in-flight upload/crop/patch, plus an error message
  // surfaced inline (never window.alert).
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // ── browse: library tab ──
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [listData, setListData] = useState({ count: 0, next: null, previous: null, results: [] });
  const [listLoading, setListLoading] = useState(false);

  // ── crop state ──
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  // Focal point as fractions (0-1) of the displayed image; defaults to center.
  const [focal, setFocal] = useState({ x: 0.5, y: 0.5 });
  const cropAreaRef = useRef(null);

  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  // Debounce the search box (~300ms) so typing doesn't fire a request per key.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Reset to page 1 whenever the (debounced) search term changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  // Fetch the library page whenever the library tab is active and its inputs
  // change. Guarded on `tab` so switching to Upload doesn't keep fetching.
  useEffect(() => {
    if (step !== "browse" || tab !== "library") return;
    let cancelled = false;
    setListLoading(true);
    listContentImages({ q: debouncedQuery || undefined, page })
      .then((data) => {
        if (!cancelled) setListData(data);
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, tab, debouncedQuery, page]);

  const goReview = (img, source) => {
    setImage(img);
    setImageSource(source);
    // Library image: prefill its stored alt text. Fresh upload: leave empty
    // (title becomes only a placeholder, per the accessibility-encourage-not-
    // force intent — the field is never force-populated with the title).
    setAltText(source === "library" ? (img.alt_text || "") : "");
    setError("");
    setStep("review");
  };

  const handleUploadFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploadContentEditorImage(file);
      goReview(uploaded, "upload");
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const onFilePick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    handleUploadFile(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    handleUploadFile(file);
  };

  const handleInsert = async () => {
    if (!image) return;
    const trimmed = altText;
    // Persist an edited alt text back to a reused library image so the change
    // sticks in the library, not just this one insertion. A fresh upload's
    // alt text is only carried into the inserted <img> here (the plain-upload
    // create call has no alt to patch against unless the author typed one — in
    // which case we still persist it so the library row is complete).
    try {
      const original = image.alt_text || "";
      if (trimmed !== original) {
        setBusy(true);
        await updateContentImage(image.id, { alt_text: trimmed });
      }
    } catch {
      // A failed metadata save shouldn't block the insertion the author asked
      // for — the <img> still gets the alt text they typed; only the library
      // row's persistence is best-effort here.
    } finally {
      setBusy(false);
    }
    onInsert(image, trimmed);
    onClose();
  };

  const onCropComplete = (_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  };

  // Click inside the crop viewport → set the focal point as fractions of the
  // viewport (which frames the image). Defaults to center if never clicked.
  const onCropAreaClick = (e) => {
    const el = cropAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setFocal({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
  };

  const enterCrop = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setFocal({ x: 0.5, y: 0.5 });
    setError("");
    setStep("crop");
  };

  const applyCrop = async () => {
    if (!image || !croppedAreaPixels) {
      setError("Adjust the crop area first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const blob = await cropImageToBlob(image.file, croppedAreaPixels);
      const newFile = new File([blob], `cropped-${basenameFromUrl(image.file)}`, {
        type: "image/png",
      });
      // New row — the original is never mutated (other posts may reference it).
      const created = await uploadContentEditorImage(newFile);
      // Carry alt text forward and record the focal point on the new row.
      const patched = await updateContentImage(created.id, {
        alt_text: altText || "",
        focal_x: focal.x,
        focal_y: focal.y,
      });
      // Replace the reviewed image with the freshly-cropped one. It's a new
      // library row, so treat it as an "upload" source (its alt_text now equals
      // what we just patched, so handleInsert won't redundantly re-PATCH).
      setImage(patched);
      setImageSource("upload");
      setStep("review");
    } catch (err) {
      setError(err?.message || "Crop failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil((listData.count || 0) / PAGE_SIZE));

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div
        className="confirm-card media-lib-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Insert image"
      >
        <div className="media-lib-header">
          <h3>Insert image</h3>
          <button type="button" className="media-lib-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && <div className="media-lib-error">{error}</div>}

        {/* ── BROWSE ── */}
        {step === "browse" && (
          <>
            <div className="media-lib-tabs">
              <button
                type="button"
                className={`media-lib-tab${tab === "upload" ? " active" : ""}`}
                onClick={() => setTab("upload")}
              >
                Upload new
              </button>
              <button
                type="button"
                className={`media-lib-tab${tab === "library" ? " active" : ""}`}
                onClick={() => setTab("library")}
              >
                Browse library
              </button>
            </div>

            {tab === "upload" && (
              <div
                className={`media-lib-dropzone${dragOver ? " drag-over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => !busy && fileInputRef.current?.click()}
              >
                {busy ? (
                  <span className="media-lib-dz-inner">
                    <Loader2 size={22} className="media-lib-spin" /> Uploading…
                  </span>
                ) : (
                  <span className="media-lib-dz-inner">
                    <Upload size={22} />
                    <span>Click to choose an image, or drag &amp; drop it here</span>
                  </span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={onFilePick}
                />
              </div>
            )}

            {tab === "library" && (
              <div className="media-lib-browse">
                <div className="media-lib-search">
                  <Search size={15} />
                  <input
                    type="text"
                    placeholder="Search by title, alt text, or filename…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                {listLoading ? (
                  <div className="media-lib-grid-empty">
                    <Loader2 size={20} className="media-lib-spin" /> Loading…
                  </div>
                ) : listData.results.length === 0 ? (
                  <div className="media-lib-grid-empty">No images found.</div>
                ) : (
                  <div className="media-lib-grid">
                    {listData.results.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        className="media-lib-thumb"
                        title={img.title || img.alt_text || ""}
                        onClick={() => goReview(img, "library")}
                      >
                        <img src={img.file} alt={img.alt_text || ""} loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="media-lib-pager">
                  <button
                    type="button"
                    disabled={!listData.previous || listLoading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <span>
                    Page {page} of {totalPages} · {listData.count} image
                    {listData.count === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    disabled={!listData.next || listLoading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── REVIEW ── */}
        {step === "review" && image && (
          <div className="media-lib-review">
            <div className="media-lib-preview">
              <img src={image.file} alt={altText || image.alt_text || ""} />
            </div>
            <label className="media-lib-field">
              <span>Alt text</span>
              <input
                type="text"
                value={altText}
                placeholder={image.title || "Describe this image (optional)"}
                onChange={(e) => setAltText(e.target.value)}
              />
            </label>
            <div className="media-lib-actions">
              <button
                type="button"
                className="media-lib-btn-ghost"
                onClick={() => setStep("browse")}
                disabled={busy}
              >
                Back
              </button>
              <div className="media-lib-actions-right">
                <button
                  type="button"
                  className="media-lib-btn-ghost"
                  onClick={enterCrop}
                  disabled={busy}
                >
                  <CropIcon size={14} /> Crop
                </button>
                <button
                  type="button"
                  className="media-lib-btn-primary"
                  onClick={handleInsert}
                  disabled={busy}
                >
                  {busy ? <Loader2 size={14} className="media-lib-spin" /> : null} Insert
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CROP ── */}
        {step === "crop" && image && (
          <div className="media-lib-crop">
            <div
              className="media-lib-cropper"
              ref={cropAreaRef}
              onClick={onCropAreaClick}
            >
              <Cropper
                image={image.file}
                crop={crop}
                zoom={zoom}
                // No fixed `aspect` — body images aren't a fixed ratio.
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                restrictPosition={false}
                crossOrigin="anonymous"
              />
              {/* Focal-point crosshair (display only; the click is handled on
                  the wrapper so it doesn't block cropper dragging). */}
              <span
                className="media-lib-focal"
                style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
              />
            </div>
            <div className="media-lib-crop-hint">
              Drag to reposition, scroll to zoom. Click the image to set the
              focal point (currently {Math.round(focal.x * 100)}% ,{" "}
              {Math.round(focal.y * 100)}%).
            </div>
            <label className="media-lib-zoom">
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
            <div className="media-lib-actions">
              <button
                type="button"
                className="media-lib-btn-ghost"
                onClick={() => setStep("review")}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="media-lib-btn-primary"
                onClick={applyCrop}
                disabled={busy}
              >
                {busy ? <Loader2 size={14} className="media-lib-spin" /> : null} Apply crop
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaLibraryModal;
