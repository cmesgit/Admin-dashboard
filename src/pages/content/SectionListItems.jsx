// The repeatable rows inside a homepage section.
//
// A section is two different things: its own copy (heading, buttons — the
// HomeContentBlock the fields column edits) and a list of items beneath it.
// The editor showed only the first, so a section with six live bullet points
// looked like it had none, and the only way to see them was the old Homepage
// Content tab.
//
// "List item" is deliberately never said out loud here. To a writer these are
// just the points, cards or stats in this section.
import { memo, useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  createHomeListItem, deleteHomeListItem, getHomeListItems, updateHomeListItem,
} from "../../api/admin";
import { errText } from "../../utils/errText";

// What the row is called on the page, per variant. The enum value means
// nothing to the person editing it.
const VARIANT_LABEL = {
  default: "Card",
  bullet: "Bullet point",
  pillar: "Pillar",
  sticker: "Sticker",
  numbered: "Numbered step",
  stat_chip: "Statistic",
  marquee_chip: "Scrolling chip",
  contact_card: "Contact card",
};

const asList = (r) => (Array.isArray(r) ? r : r?.results || []);

const SectionListItems = ({ section, sectionLabel, onNotify }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  // ⚠ No module-lifetime `alive` ref here. StrictMode runs an effect twice on
  // mount and the first cleanup would set it false forever, so every guard
  // after that fails and the panel sticks on "Loading…". The cancel flag has
  // to be created fresh inside each effect run.
  useEffect(() => {
    if (!section) return undefined;
    let cancelled = false;
    setLoading(true);
    getHomeListItems({ section })
      .then((res) => {
        if (cancelled) return;
        setItems(asList(res).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
        // safe() swallows a failure into [] — an outage must not read as
        // "this section has no items".
        setError(res?.__failed
          ? "Couldn’t reach the server, so this list may be incomplete." : "");
      })
      .catch((e) => { if (!cancelled) setError(errText(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [section, reloadKey]);

  const save = async () => {
    const { id, ...payload } = editing;
    if (!payload.title.trim() && !payload.body.trim()) {
      return onNotify("Give it a title or some words first.");
    }
    setBusy("save");
    try {
      if (id) await updateHomeListItem(id, payload);
      else await createHomeListItem({ ...payload, section, order: items.length });
      onNotify(id ? "Saved." : "Added.");
      setEditing(null);
      // Refetch rather than splice the response in: `order` is assigned
      // server-side (a create sends items.length as a hint, not a decision),
      // so an in-place insert can show a position the server didn't agree to.
      // One request on an infrequent action is the cheaper mistake.
      load();
    } catch (e) {
      onNotify(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (item) => {
    setBusy(`del-${item.id}`);
    try {
      await deleteHomeListItem(item.id);
      onNotify("Removed.");
      setItems((xs) => xs.filter((x) => x.id !== item.id));
    } catch (e) {
      onNotify(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const blank = {
    id: null, title: "", subtitle: "", body: "",
    variant: items[0]?.variant || "default",
    cta_label: "", cta_href: "", stat_text: "",
    status: "published",
  };

  return (
    <section className="cs-subcard cs-items">
      <div className="cs-items__head">
        <p className="cs-subcard__title">
          What’s listed in {sectionLabel || "this section"}
        </p>
        <button
          type="button"
          className="cs-btn-ghost"
          onClick={() => setEditing(blank)}
        >
          <Plus size={13} aria-hidden="true" /> Add one
        </button>
      </div>

      {loading && <p className="cs-muted">Loading…</p>}
      {error && <p className="cs-error" role="alert">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="cs-field__hint">
          Nothing is listed here. Some sections — the top banner, the closing
          call to action — are just a heading and a button, and that’s normal.
        </p>
      )}

      {items.map((it) => (
        <div key={it.id} className="cs-itemrow">
          <span className="cs-itemrow__text">
            <span className="cs-itemrow__title">
              {it.title || it.stat_text || "(no title)"}
            </span>
            <span className="cs-itemrow__sub">
              {VARIANT_LABEL[it.variant] || it.variant}
              {it.subtitle ? ` · ${it.subtitle}` : ""}
              {it.status !== "published" ? " · hidden" : ""}
            </span>
          </span>
          <button
            type="button"
            className="cs-btn-ghost"
            onClick={() => setEditing({
              id: it.id,
              title: it.title || "", subtitle: it.subtitle || "",
              body: it.body || "", variant: it.variant || "default",
              cta_label: it.cta_label || "", cta_href: it.cta_href || "",
              stat_text: it.stat_text || "", status: it.status || "published",
            })}
          >
            Edit
          </button>
          <button
            type="button"
            className="cs-btn-ghost"
            disabled={busy === `del-${it.id}`}
            onClick={() => remove(it)}
            aria-label={`Remove ${it.title || "item"}`}
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      ))}

      {editing && (
        <div
          className="cs-palette-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}
        >
          <div className="cs-confirm" role="dialog" aria-modal="true">
            <h2 className="cs-card__title">
              {editing.id ? "Edit this one" : `Add to ${sectionLabel}`}
            </h2>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="li-title">Title</label>
              <input
                id="li-title" className="cs-input cs-input--block"
                value={editing.title} autoFocus
                onChange={(e) => setEditing((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="li-sub">Supporting line</label>
              <input
                id="li-sub" className="cs-input cs-input--block"
                value={editing.subtitle}
                onChange={(e) => setEditing((f) => ({ ...f, subtitle: e.target.value }))}
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="li-body">Longer text</label>
              <textarea
                id="li-body" className="cs-input cs-input--block cs-textarea" rows={3}
                value={editing.body}
                onChange={(e) => setEditing((f) => ({ ...f, body: e.target.value }))}
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="li-variant">How it looks</label>
              <select
                id="li-variant" className="cs-input cs-input--block"
                value={editing.variant}
                onChange={(e) => setEditing((f) => ({ ...f, variant: e.target.value }))}
              >
                {Object.entries(VARIANT_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <p className="cs-field__hint">
                Keep this the same as the others in this section unless you
                mean to change the whole row’s shape.
              </p>
            </div>

            <div className="cs-confirm__actions">
              <button type="button" className="cs-btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="cs-btn-primary cs-btn-primary--sm"
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

// memo: all three props are stable while the editor types, but PageEditor
// re-renders on every keystroke, which re-rendered this whole item list (and
// any open modal) for nothing.
export default memo(SectionListItems);
