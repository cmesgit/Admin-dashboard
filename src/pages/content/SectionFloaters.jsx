// The little badges pinned on top of a section's artwork.
//
// Not a list: each badge sits in a fixed SLOT that maps 1:1 to a pre-tested CSS
// position on the public site, and `section` + `slot` is unique — there is no
// coordinate field for an editor to get wrong. So this renders one row per slot
// the section actually has, each either filled or empty, rather than an
// open-ended "add another".
//
// The slot KEYS come from the server (`floater_slots` on the page-draft
// payload) so they can never drift from the backend's own table. The wording
// below is UI copy and stays here.
//
// "Floater" is deliberately never said out loud. To a writer these are just the
// small badges on the picture.
import { memo, useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createHomeFloater, deleteHomeFloater, getHomeFloaters, updateHomeFloater,
} from "../../api/admin";
import { errText } from "../../utils/errText";

// Where each slot actually appears, in words. Keyed by the same slot strings
// the server sends; a slot with no entry here still works and falls back to
// its key, so adding one backend-side never breaks this screen.
const SLOT_LABEL = {
  cap: "Graduation cap — top-left of the picture",
  book: "Book — bottom-right of the picture",
  play: "Play button — mid-right of the picture",
  b_tl: "Top-left badge",
  b_tr: "Top-right badge",
  b_bl: "Bottom-left badge",
  top: "Top badge",
  bottom: "Bottom badge",
};

// The closed icon set the public site has artwork for. An invented key renders
// nothing, so this is a picker, not a text box.
const ICON_KEYS = [
  "", "cap", "book", "play", "live", "faculty", "board", "flexible", "guest",
  "guidance", "forum", "counselling", "skills", "placement", "library",
  "research", "screen", "chat", "secure", "globe", "check", "folder",
  "calendar", "star",
];

const asList = (r) => (Array.isArray(r) ? r : r?.results || []);

const SectionFloaters = ({ section, slots = [], onNotify }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // ⚠ The cancel flag is created inside each effect run, never as a ref —
  // StrictMode runs the effect twice on mount and a ref would keep the first
  // cleanup's `false` forever, sticking this panel on "Loading…".
  useEffect(() => {
    if (!section || !slots.length) return undefined;
    let cancelled = false;
    setLoading(true);
    getHomeFloaters({ section })
      .then((res) => {
        if (cancelled) return;
        setRows(asList(res));
        // safe() turns a failure into [] — an outage must not read as "this
        // section has no badges".
        setError(res?.__failed
          ? "Couldn’t reach the server, so this may be incomplete." : "");
      })
      .catch((e) => { if (!cancelled) setError(errText(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [section, slots.length, reloadKey]);

  if (!slots.length) return null;

  const bySlot = Object.fromEntries(rows.map((r) => [r.slot, r]));

  const save = async () => {
    const { id, ...payload } = editing;
    if (!payload.label.trim() && !payload.icon) {
      return onNotify("Give it a label or pick an icon first.");
    }
    setBusy("save");
    try {
      if (id) await updateHomeFloater(id, payload);
      else await createHomeFloater({ ...payload, section });
      onNotify(id ? "Saved." : "Badge added.");
      setEditing(null);
      reload();
    } catch (e) {
      onNotify(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (row) => {
    setBusy(`del-${row.id}`);
    try {
      await deleteHomeFloater(row.id);
      onNotify("Badge removed.");
      setRows((xs) => xs.filter((x) => x.id !== row.id));
    } catch (e) {
      onNotify(errText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="cs-subcard cs-items">
      <div className="cs-items__head">
        <p className="cs-subcard__title">Small badges on the picture</p>
      </div>

      {loading && <p className="cs-muted">Loading…</p>}
      {error && <p className="cs-error" role="alert">{error}</p>}

      {!loading && (
        <p className="cs-field__hint">
          Each badge has one fixed position, so there is nothing to drag. Leave
          one empty to hide it.
        </p>
      )}

      {slots.map((slot) => {
        const row = bySlot[slot];
        const where = SLOT_LABEL[slot] || slot;
        return (
          <div key={slot} className="cs-itemrow">
            <span className="cs-itemrow__text">
              <span className="cs-itemrow__title">
                {row?.label || <em className="cs-muted">Empty</em>}
              </span>
              <span className="cs-itemrow__sub">
                {where}
                {row?.sublabel ? ` · ${row.sublabel}` : ""}
              </span>
            </span>
            {row ? (
              <>
                <button
                  type="button"
                  className="cs-btn-ghost"
                  onClick={() => setEditing({ ...row })}
                >
                  <Pencil size={13} aria-hidden="true" /> Edit
                </button>
                <button
                  type="button"
                  className="cs-btn-ghost"
                  disabled={busy === `del-${row.id}`}
                  onClick={() => remove(row)}
                  aria-label={`Remove the ${where} badge`}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="cs-btn-ghost"
                onClick={() => setEditing({
                  id: null, slot, icon: "", label: "", sublabel: "",
                  status: "published",
                })}
              >
                <Plus size={13} aria-hidden="true" /> Add
              </button>
            )}
          </div>
        );
      })}

      {editing && (
        <div
          className="cs-palette-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}
        >
          <div className="cs-confirm" role="dialog" aria-modal="true">
            <h2 className="cs-card__title">
              {editing.id ? "Edit this badge" : "Add a badge"}
            </h2>
            <p className="cs-muted">{SLOT_LABEL[editing.slot] || editing.slot}</p>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="fl-label">Label</label>
              <input
                id="fl-label" className="cs-input cs-input--block"
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                placeholder="e.g. Live now"
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="fl-sub">
                Second line
              </label>
              <input
                id="fl-sub" className="cs-input cs-input--block"
                value={editing.sublabel}
                onChange={(e) => setEditing({ ...editing, sublabel: e.target.value })}
                placeholder="Optional"
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="fl-icon">Icon</label>
              <select
                id="fl-icon" className="cs-input cs-input--block"
                value={editing.icon}
                onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
              >
                {ICON_KEYS.map((k) => (
                  <option key={k} value={k}>{k || "No icon"}</option>
                ))}
              </select>
            </div>

            <div className="cs-confirm__actions">
              <button
                type="button" className="cs-btn-ghost"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="button" className="cs-btn-primary"
                disabled={busy === "save"}
                onClick={save}
              >
                {busy === "save" ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

// memo for the same reason SectionListItems has it: PageEditor re-renders on
// every keystroke, and none of these props change while someone is typing.
export default memo(SectionFloaters);
