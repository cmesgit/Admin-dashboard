// PLACEMENT: Admin-dashboard/src/components/LibraryImageField.jsx
//
// "Upload a picture, or reuse one already in the CMS" — the image field for
// places whose picture is ALSO managed by the Content Studio media library.
//
// Why this exists rather than just `ImageUploadField`:
//
// `Course.thumbnail` is the most load-bearing picture on the public site. The
// /courses catalog reads it directly, and the homepage's featured grid prefers
// it ahead of the showcase card's own image. Until now the only way to set it
// was a raw <input type="file">, so course artwork never entered the media
// library: it had no usage count on the Pictures screen, and the delete guard
// could not protect it.
//
// Picking from the library POINTS AT the picture the CMS already holds — the
// backend sets the file path rather than copying the bytes — so one picture
// stays one file and one library row, and the course shows up in that
// picture's "used in" list.
//
// Deliberately does NOT offer an upload inside the picker dialog: uploads
// belong on the Pictures screen, where usage counts and the delete-guard live.
// A second upload entry point is how a CMS ends up with two libraries. (Same
// reasoning as MediaPickerDialog's own header.)
//
// State stays with the caller, like ImageUploadField. The caller gets back
// EITHER a File (fresh upload) OR an asset id (library pick) — never both, so
// the two can't race and the submit path stays a simple either/or.

import { useState } from "react";
import { ImageIcon, Upload, X } from "lucide-react";

import MediaPickerDialog from "../pages/content/MediaPickerDialog";

/**
 * @param {File|null}    file        — a freshly chosen upload, or null
 * @param {function}     onFile      — receives a File (clears any library pick)
 * @param {number|string|null|undefined} assetId
 *        undefined = untouched (the server leaves the picture alone);
 *        null      = explicitly cleared; a number = a library pick.
 * @param {function}     onAsset     — receives (assetId, previewUrl)
 * @param {string=}      previewUrl  — the picture already saved on the record
 * @param {boolean=}     disabled
 */
export default function LibraryImageField({
  file,
  onFile,
  assetId,
  onAsset,
  previewUrl,
  disabled = false,
}) {
  const [picking, setPicking] = useState(false);
  const [pickedUrl, setPickedUrl] = useState("");

  // What to show: a fresh upload wins, then a library pick, then whatever is
  // already saved. `assetId === null` means the editor cleared it, so nothing
  // should be shown even though `previewUrl` still holds the old picture.
  const cleared = assetId === null && !file;
  const shownUrl = pickedUrl || (cleared ? "" : previewUrl);

  const clear = () => {
    onFile(null);
    setPickedUrl("");
    onAsset(null, "");
  };

  return (
    <>
      <div className="cm-imgfield">
        <input
          type="file"
          accept="image/*"
          disabled={disabled}
          onChange={(e) => {
            const picked = e.target.files?.[0] || null;
            onFile(picked);
            // A file upload and a library pick are mutually exclusive; leaving
            // a stale asset id set would send both and let the server decide,
            // which is exactly the ambiguity this field exists to remove.
            if (picked) {
              setPickedUrl("");
              onAsset(undefined, "");
            }
          }}
        />
        <button
          type="button"
          className="cm-libpick"
          disabled={disabled}
          onClick={() => setPicking(true)}
        >
          <ImageIcon size={14} aria-hidden="true" />
          Choose from library
        </button>
      </div>

      {file ? (
        <small className="cm-file-name">
          <Upload size={12} aria-hidden="true" /> {file.name}
        </small>
      ) : null}

      {!file && shownUrl ? (
        <span className="cm-imgfield-preview">
          <img src={shownUrl} alt="" className="cm-thumb" />
          <button
            type="button"
            className="cm-imgfield-clear"
            disabled={disabled}
            onClick={clear}
            title="Remove this picture"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </span>
      ) : null}

      {!file && cleared ? (
        <small className="cm-imgfield-note">
          Removed — the card will show its placeholder until you save a new one.
        </small>
      ) : null}

      {picking && (
        <MediaPickerDialog
          onClose={() => setPicking(false)}
          onPick={(asset) => {
            onFile(null);
            setPickedUrl(asset.url || "");
            onAsset(asset.id, asset.url || "");
          }}
        />
      )}
    </>
  );
}
