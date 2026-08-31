// PLACEMENT: Admin-dashboard/src/pages/content/ShowcaseCategoryManager.jsx
//
// Manages the filter tabs above the homepage's "Featured courses" grid
// (content.ShowcaseCategory, Phase 2a).
//
// Lives on the Course Cards screen rather than behind its own route for two
// reasons: on the public site these tabs sit directly above that grid, so this
// is where an editor looks for them; and ContentPanel only knows eight `?tab=`
// ids, so a new nav entry would need plumbing that buys nothing here.
//
// Until Phase 2 this list was hardcoded in three repos at once — the model, the
// public site's homeData.js, and CardFormModal's own array — kept in sync by
// comment. Adding a tab was a three-repo coordinated deploy.

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";

import {
  createShowcaseCategory, deleteShowcaseCategory, getShowcaseCategories,
  updateShowcaseCategory,
} from "../../api/admin_content_studio";
import { errText } from "../../utils/errText";

/** Mirrors the server's own rule (ShowcaseCategory.clean) so the reason is
 *  given before a round trip, not after a 400. */
const RESERVED = "all";

const slugify = (s) =>
  (s || "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function ShowcaseCategoryManager({ say }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getShowcaseCategories());
      setError("");
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const newSlug = slugify(newLabel);
  const slugTaken = rows.some((r) => r.slug === newSlug);
  const slugReserved = newSlug === RESERVED;
  const canAdd = newLabel.trim() && newSlug && !slugTaken && !slugReserved;

  const add = async () => {
    if (!canAdd) return;
    setBusy("new");
    try {
      await createShowcaseCategory({
        label: newLabel.trim(),
        slug: newSlug,
        // Appended, not inserted: `order` is a PositiveSmallIntegerField, so a
        // new tab cannot sort ahead of the existing ones by going negative.
        order: rows.length ? Math.max(...rows.map((r) => r.order)) + 1 : 0,
      });
      setNewLabel("");
      setAdding(false);
      await load();
      say?.("Tab added. It appears on the homepage immediately.");
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async (row) => {
    setBusy(row.id);
    try {
      await updateShowcaseCategory(row.id, { is_active: !row.is_active });
      await load();
      say?.(row.is_active ? "Tab hidden from the homepage." : "Tab is showing again.");
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (row) => {
    setBusy(row.id);
    try {
      await deleteShowcaseCategory(row.id);
      await load();
      say?.("Tab deleted.");
    } catch (e) {
      // The endpoint refuses while cards still carry the slug — there is no FK,
      // so a delete cannot cascade and would orphan the slug in every tagged
      // card. Surface its message, which names the count and points at hiding.
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="cs-card cs-tabsmanager">
      <div className="cs-field__labelrow">
        <div>
          <h2 className="cs-card__title">Filter tabs</h2>
          <p className="cs-field__hint cs-field__hint--tight">
            The row of buttons above the Featured courses grid on the homepage.
            Visitors always get an “All” tab as well — that one is automatic.
          </p>
        </div>
        {!adding && (
          <button type="button" className="cs-btn-ghost" onClick={() => setAdding(true)}>
            <Plus size={14} aria-hidden="true" /> Add a tab
          </button>
        )}
      </div>

      {error && <p className="cs-error">{error}</p>}
      {loading && <p className="cs-field__hint">Loading tabs…</p>}

      {adding && (
        <div className="cs-tabsmanager__add">
          <label className="cs-field">
            <span className="cs-field__label">Tab name</span>
            <input
              className="cs-input cs-input--block"
              value={newLabel}
              autoFocus
              placeholder="e.g. Skills"
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canAdd) add(); }}
            />
            <span className="cs-field__hint cs-field__hint--tight">
              {newSlug
                ? <>Saved on cards as <code>{newSlug}</code>.</>
                : "Type a name to see how it will be stored."}
            </span>
          </label>
          {slugReserved && (
            <p className="cs-field__warn">
              “All” is reserved — the homepage always shows an All tab of its own.
            </p>
          )}
          {slugTaken && (
            <p className="cs-field__warn">
              A tab is already stored as <code>{newSlug}</code>. Pick a different name.
            </p>
          )}
          <div className="cs-confirm__actions">
            <button
              type="button"
              className="cs-btn-ghost"
              onClick={() => { setAdding(false); setNewLabel(""); }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="cs-btn-primary"
              disabled={!canAdd || busy === "new"}
              onClick={add}
            >
              {busy === "new" ? "Adding…" : "Add tab"}
            </button>
          </div>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <ul className="cs-tabsmanager__list">
          {rows.map((r) => (
            <li key={r.id} className={`cs-tabrow${r.is_active ? "" : " is-hidden"}`}>
              <span className="cs-tabrow__label">{r.label}</span>
              <code className="cs-tabrow__slug">{r.slug}</code>
              <span className="cs-tabrow__meta">
                {r.card_count === 0
                  ? "no cards"
                  : `${r.card_count} card${r.card_count === 1 ? "" : "s"}`}
                {!r.is_active && " · hidden from visitors"}
              </span>
              <button
                type="button"
                className="cs-btn-ghost"
                disabled={busy === r.id}
                onClick={() => toggleActive(r)}
                title={
                  r.is_active
                    ? "Hide this tab from the homepage. Cards keep their tag."
                    : "Show this tab on the homepage again."
                }
              >
                {r.is_active
                  ? <><EyeOff size={13} aria-hidden="true" /> Hide</>
                  : <><Eye size={13} aria-hidden="true" /> Show</>}
              </button>
              <button
                type="button"
                className="cs-btn-ghost"
                disabled={busy === r.id}
                onClick={() => remove(r)}
                title={
                  r.card_count
                    ? "Cards still use this tab — hide it instead, or untag them first"
                    : "Delete this tab"
                }
                aria-label={`Delete ${r.label}`}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
