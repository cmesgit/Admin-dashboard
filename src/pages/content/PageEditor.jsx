import { createSaveQueue, mergeSectionEdits as mergeSections } from "../../utils/draftSaveQueue";
// The site-pages split editor (design_handoff_content_studio Phase 5).
//
// ⚠ Written from scratch. The handoff bundle ships a `PageEditor.jsx` scaffold
// built around an invented `ContentDraft` shape and a flat `sections[].fields{}`
// bag; the real data is a `HomeContentBlock` row per section plus a separate
// `HomeSectionOrder` row for order/visibility, and drafts are per-author on the
// server. The scaffold was discarded rather than adapted.
//
// Phase 5a: publish bar, section list, plain-language fields, autosave, and
// the publish checklist. Phase 5b: live preview column and drag-reorder.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, ChevronDown, CloudCheck, Eye, EyeOff,
  GripVertical, History,
} from "lucide-react";
import {
  discardPageDraft, getLinkTargets, getPageChecklist, getPageDraft, publishPage,
  reorderSections, savePageDraft,
} from "../../api/admin_content_studio";
// Section-order visibility reuses the existing helper rather than growing a
// second copy in admin_content_studio.js.
import { deleteHomeContentBlock, updateHomeSectionOrder } from "../../api/admin";
import SectionPreview from "./SectionPreview";
import DisplayChoice from "./DisplayChoice";
import { HOME_DEFAULTS, homeField, previewContent } from "../../content/homeDisplay";
import UnsavedChangesDialog from "../../components/UnsavedChangesDialog";
import MediaPickerDialog from "./MediaPickerDialog";
import SectionListItems from "./SectionListItems";
import SectionFloaters from "./SectionFloaters";
import { errText } from "../../utils/errText";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import Toast from "../../components/Toast";
import {
  ButtonField, HeadingField, LongTextField, PictureField, TextField,
} from "./ChapterlessFields";
import "../../css/ContentStudio.css";
import "../../css/Moderator.css";

// The page being edited comes from the route (/content/pages/:key). This used
// to be hardcoded to "home", so /content/pages/<anything> silently loaded,
// edited, autosaved and published the HOME page under another page's name —
// harmless only for as long as the backend's PAGES registry has one entry.
const FALLBACK_PAGE_KEY = "home";
const AUTOSAVE_MS = 1500;

// The renaming that makes this screen worth building. Left side: the column
// name nobody outside the codebase should ever see. Right side: what it
// actually is on the page.
const FIELDS = [
  { name: "eyebrow", kind: "text", label: "Small label above the heading",
    hint: "A short word or two that sits above the main heading. Optional.",
    placeholder: "e.g. For Class 8–12" },
  { name: "heading", kind: "heading", label: "Main heading",
    hint: "The biggest line of text in this section." },
  { name: "heading_secondary", kind: "text", label: "Second half of the heading",
    hint: "The tail of the heading, shown in the accent colour. Leave it empty to use the main heading on its own.",
    // Only the sections whose frontend actually renders a second half. The
    // rest draw `heading` alone, so offering the field there would save text
    // that never appears. Editing `heading` on one of these WITHOUT this
    // input is what produced "Explore our <new words> popular courses".
    sections: [
      "hero", "featured_courses", "faq", "courses_hero", "contact_hero",
      "about_hero", "about_vision", "about_mission", "about_values", "about_why",
    ] },
  { name: "subhead", kind: "text", label: "Supporting line",
    hint: "One sentence under the heading, explaining it." },
  { name: "body", kind: "long", label: "Longer text",
    hint: "A paragraph or two. Optional — most sections leave this empty." },
];

const SECTION_PURPOSE = {
  hero: "The first thing anyone sees. It should say what ShikshaCom is and give one clear next step.",
  why_shiksha: "The reasons someone should choose ShikshaCom over anything else.",
  teachers_students: "Who the platform is for, split between teachers and students.",
  browse_categories: "Points visitors at the kinds of courses on offer.",
};

const PageEditor = () => {
  const { key: routeKey } = useParams();
  const pageKey = routeKey || FALLBACK_PAGE_KEY;

  const [page, setPage] = useState(null);
  const [sections, setSections] = useState([]);
  const [draft, setDraft] = useState({});
  const [selected, setSelected] = useState(null);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("idle"); // idle | saving | saved
  const [checklist, setChecklist] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState(null);
  const [device, setDevice] = useState("desktop");
  const [dragKey, setDragKey] = useState(null);
  const [busy, setBusy] = useState(false);

  const toastTimer = useRef(null);
  const saveTimer = useRef(null);
  const pending = useRef({});
  const liveCollectionSettings = useRef({});
  const itemsEditor = useRef(null);
  const floatersEditor = useRef(null);
  const [childDirty, setChildDirty] = useState({ items: false, floaters: false });
  const [childBusy, setChildBusy] = useState({ items: false, floaters: false });
  const itemsDirtyChanged = useCallback((value) => setChildDirty((old) => ({ ...old, items: value })), []);
  const floatersDirtyChanged = useCallback((value) => setChildDirty((old) => ({ ...old, floaters: value })), []);
  const itemsBusyChanged = useCallback((value) => setChildBusy((old) => ({ ...old, items: value })), []);
  const floatersBusyChanged = useCallback((value) => setChildBusy((old) => ({ ...old, floaters: value })), []);
  const [queueSave] = useState(createSaveQueue);

  const say = useCallback((message, tone = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), tone === "error" ? 7000 : 2600);
  }, []);

  const mounted = useRef(true);
  const flushRef = useRef(null);

  useEffect(() => {
    // Set on every mount, not just via useRef's initial value: StrictMode runs
    // this effect's cleanup once before the real mount, and a ref survives that
    // simulated unmount. Relying on useRef(true) alone left `mounted` false for
    // the rest of the session, so every autosave response bailed out of its
    // own `if (!mounted.current) return` and the bar sat on "Saving…" forever.
    mounted.current = true;
    return () => {
      clearTimeout(toastTimer.current);
      clearTimeout(saveTimer.current);
      // Send whatever the debounce was still holding. Clearing the timer alone
      // silently dropped any edit made within 1.5s of clicking a sidebar link.
      if (Object.keys(pending.current).length) flushRef.current?.();
      mounted.current = false;
    };
  }, []);

  const applyServerState = useCallback((data) => {
    setPage(data.page);
    setSections(data.sections.map((section) => ({ ...section, values: { ...section.values, display_settings: { ...(section.values?.display_settings || {}), ...(liveCollectionSettings.current[section.key] || {}) } } })));
    setDraft(data.draft || {});
    setSelected((cur) => cur || data.sections.find((s) => s.has_content)?.key || null);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([getPageDraft(pageKey), getLinkTargets()])
      .then(([d, t]) => {
        if (!alive) return;
        applyServerState(d);
        setTargets(t.groups || []);
      })
      .catch((e) => alive && setError(errText(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [applyServerState, pageKey]);

  const current = sections.find((s) => s.key === selected) || null;

  // The value a field shows: the pending edit if there is one, else what is
  // live. Never read the live row when a draft exists, or typing appears to
  // revert on every re-render.
  const valueOf = useCallback((field) => {
    const edited = draft[selected];
    if (edited && field in edited) return edited[field];
    return current?.values?.[field] ?? "";
  }, [draft, selected, current]);

  const flush = useCallback(() => queueSave(async () => {
    const payload = pending.current;
    pending.current = {};
    if (!Object.keys(payload).length) return true;
    if (mounted.current) setSaving("saving");
    try {
      const data = await savePageDraft(pageKey, payload);
      if (!mounted.current) return false;
      applyServerState(data);
      // Anything typed while the request was in flight is NEWER than the copy
      // the server just echoed back, so it goes back on top. Without this the
      // response overwrites live keystrokes and the input jumps backwards
      // mid-sentence.
      const newer = pending.current;
      const stillPending = Object.keys(newer).length > 0;
      if (stillPending) setDraft((d) => mergeSections(d, newer));
      setSaving(stillPending ? "saving" : "saved");
      // A stale checklist is worse than none — it would green-light an edit
      // that has since broken something.
      setChecklist(null);
      return true;
    } catch (e) {
      // Put the edits back in the queue. They were taken out before the
      // request, so without this the fields still show the new text and the bar
      // still counts them, but nothing will ever send them: Publish then
      // reports "no unpublished edits" and a reload loses the work silently.
      pending.current = mergeSections(payload, pending.current);
      if (!mounted.current) return false;
      setSaving("error");
      say(`Couldn’t save — ${errText(e)}. Your changes are still here; keep
        typing or press Publish to retry.`.replace(/\s+/g, " "), "error");
      return false;
    }
    return true;
  }), [applyServerState, say, pageKey, queueSave]);

  useEffect(() => { flushRef.current = flush; }, [flush]);

  const edit = (field, value) => {
    // Optimistic: the field must not lag 1.5s behind the keystroke.
    setDraft((d) => ({ ...d, [selected]: { ...(d[selected] || {}), [field]: value } }));
    pending.current = {
      ...pending.current,
      [selected]: { ...(pending.current[selected] || {}), [field]: value },
    };
    setSaving("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, AUTOSAVE_MS);
  };

  const changeCount = useMemo(
    () => Object.values(draft).reduce((n, f) => n + Object.keys(f || {}).length, 0),
    [draft],
  );

  // What the preview renders: the live row with this author's pending edits
  // laid over it. Neither half alone is what the page would look like.
  const previewValues = useMemo(() => {
    const d = draft[selected] || {};
    const merged = { ...(current?.values || {}), ...d, display_settings: { ...(current?.values?.display_settings || {}), ...(d.display_settings || {}) } };
    // The preview reads `img`, but the editable fields are `image_url` and the
    // uploaded `image` — so a picture change used to show in neither the
    // thumbnail nor the pane captioned "as it would look".
    if ("image_url" in d || "image" in d) {
      merged.img = d.image_url || (d.image ? merged.img : "");
    }
    return { ...merged, ...previewContent(selected, merged) };
  }, [current, draft, selected]);

  // The cap reads out of the block's `extra` dict, draft-aware like every
  // other field so it doesn't lag 1.5s behind the keystroke.
  const cardCap = (() => {
    const v = (valueOf("extra") || {}).max_cards;
    return v === undefined || v === null ? "" : String(v);
  })();

  const guard = useUnsavedChangesGuard(saving === "saving" || saving === "error" || childDirty.items || childDirty.floaters, {
    busy: publishing || childBusy.items || childBusy.floaters,
    onSave: async () => {
      clearTimeout(saveTimer.current);
      if ((await itemsEditor.current?.save()) === false) return false;
      if ((await floatersEditor.current?.save()) === false) return false;
      if (!(await flush())) return false;
      while (Object.keys(pending.current).length) if (!(await flush())) return false;
      return true;
    },
    onDiscard: async () => {
      if (!(await discard(false))) return false;
      itemsEditor.current?.cancel(); floatersEditor.current?.cancel();
      return true;
    },
  });

  /** Drag-reorder, optimistic with a revert on failure.
   *
   * The server demands the COMPLETE ordered set, so only sections that
   * actually have a place on the page (order !== null) are sent; the rest have
   * no HomeSectionOrder row and would be rejected as "unexpected". */
  const dropOn = async (targetKey) => {
    const from = dragKey;
    setDragKey(null);
    if (!from || from === targetKey) return;

    const placed = sections.filter((s) => s.order !== null);
    const rest = sections.filter((s) => s.order === null);
    const fromIdx = placed.findIndex((s) => s.key === from);
    const toIdx = placed.findIndex((s) => s.key === targetKey);
    if (fromIdx < 0 || toIdx < 0) return;

    const next = [...placed];
    next.splice(toIdx, 0, ...next.splice(fromIdx, 1));

    const before = sections;
    setSections([...next, ...rest]);
    try {
      await reorderSections(next.map((s) => s.key));
      say("Order saved. Visitors see this order now.");
    } catch (e) {
      setSections(before);
      say(`Couldn’t save the new order — ${errText(e)}`, "error");
    }
  };

  /** Show or hide a whole section on the homepage.
   *
   * Distinct from the block's own visibility switch: this drops the section
   * out of the page sequence (HomeSectionOrder.is_visible), while `status` is
   * the content's publish state. The editor could only *display* this before —
   * the eye icon in the list — which is what kept the legacy tab alive.
   *
   * Applies immediately rather than joining the draft: order and visibility
   * are not draft-backed, exactly like drag-reorder above. */
  const toggleVisible = async (s) => {
    if (!s.order_id) return say("This section has no place on the page yet.");
    const next = !s.is_visible;
    const before = sections;
    setSections((xs) => xs.map(
      (x) => (x.key === s.key ? { ...x, is_visible: next } : x),
    ));
    try {
      await updateHomeSectionOrder(s.order_id, { is_visible: next });
      say(next
        ? `“${s.label}” is showing on the home page again.`
        : `“${s.label}” is hidden from the home page.`);
    } catch (e) {
      setSections(before);
      say(`Couldn’t change that — ${errText(e)}`, "error");
    }
  };

  /** Delete this section's copy outright.
   *
   * Not the same as hiding it: this removes the HomeContentBlock row, and the
   * public site falls back to its own default copy for that section. Rare and
   * destructive, hence the typed-out confirmation rather than a bare OK. */
  const deleteBlock = async () => {
    if (!current?.block_id) return;
    if (!window.confirm(
      `Delete all the copy for “${current.label}”?\n\n`
      + "The section stays on the page but falls back to the built-in wording, "
      + "and any pending edits to it are discarded. This can't be undone here.",
    )) return;
    setBusy(true);
    try {
      await deleteHomeContentBlock(current.block_id);
      clearTimeout(saveTimer.current);
      pending.current = {};
      applyServerState(await getPageDraft(pageKey));
      say(`“${current.label}” is back to its built-in wording.`);
    } catch (e) {
      say(`Couldn’t delete that — ${errText(e)}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const openChecklist = async () => {
    clearTimeout(saveTimer.current);
    if (!(await flush())) return;
    try {
      setChecklist(await getPageChecklist(pageKey));
      setChecklistOpen(true);
    } catch (e) {
      say(errText(e), "error");
    }
  };

  /** Throw away this author's pending edits.
   *
   * The endpoint has existed since Phase 1b but nothing reached it, so an
   * editor who changed their mind had no way out: the edits sat in the bar
   * forever and the only escape was publishing them. */
  const discard = async (ask = true) => {
    if (ask && !window.confirm(
      `Throw away ${changeCount} unpublished edit${changeCount === 1 ? "" : "s"}? `
      + "What's live on the site now won't change.",
    )) return false;
    clearTimeout(saveTimer.current);
    try {
      // Wait for an active save before deleting the draft, so it cannot recreate it.
      await queueSave(async () => {});
      pending.current = {};
      await discardPageDraft(pageKey);
      applyServerState(await getPageDraft(pageKey));
      setChecklist(null);
      setSaving("idle");
      say("Unpublished edits discarded.");
      return true;
    } catch (e) {
      say(`Couldn’t discard — ${errText(e)}`, "error");
      return false;
    }
  };

  const doPublish = async () => {
    setPublishing(true);
    try {
      clearTimeout(saveTimer.current);
      if (!(await flush())) return;
      const res = await publishPage(pageKey);
      say(`Published ${res.section_count} section${res.section_count === 1 ? "" : "s"}.`);
      setChecklistOpen(false);
      setChecklist(null);
      applyServerState(await getPageDraft(pageKey));
    } catch (e) {
      say(e?.response?.data?.detail || errText(e), "error");
      // A refusal means the checklist on screen is now wrong — it went on
      // showing everything passing with Publish still armed, so the only way to
      // find the second blocker was to click again and read another one-line
      // toast. Re-read it so the dialog shows all of them at once.
      try {
        setChecklist(await getPageChecklist(pageKey));
        setChecklistOpen(true);
      } catch { /* the toast already said what went wrong */ }
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return <div className="dashboard-wrapper"><p className="cs-muted">Loading…</p></div>;
  if (error) return <div className="dashboard-wrapper"><p className="cs-error">{error}</p></div>;

  const defaults = HOME_DEFAULTS[selected] || {};
  const rawValues = { ...(current?.values || {}), ...(draft[selected] || {}) };
  const display = { ...(current?.values?.display_settings || {}), ...(draft[selected]?.display_settings || {}) };
  const modeFor = (field) => display[field] || (
    field === "image" ? (rawValues.img ? "custom" : "default")
      : field.startsWith("cta_") ? (rawValues[`${field}_label`] ? "custom" : "default")
      : field === "heading_secondary" && selected?.startsWith("about_") ? "custom"
      : rawValues[field] ? "custom" : "default"
  );
  const setMode = (field, mode) => {
    if (mode === "custom") {
      const keys = field.startsWith("cta_") ? [`${field}_label`, `${field}_href`] : [field];
      for (const key of keys) {
        if (field !== "image" && !valueOf(key)) edit(key, homeField(selected, { ...rawValues, display_settings: display }, key));
      }
    }
    const edited = pending.current[selected]?.display_settings || draft[selected]?.display_settings || {};
    edit("display_settings", { ...edited, [field]: mode });
  };
  const editCustom = (field, value) => {
    const key = field.startsWith("cta_primary_") ? "cta_primary" : field.startsWith("cta_secondary_") ? "cta_secondary" : field;
    if (key.startsWith("cta_") && !display[key]) {
      for (const sibling of [`${key}_label`, `${key}_href`]) {
        if (sibling !== field && !valueOf(sibling)) edit(sibling, homeField(selected, rawValues, sibling));
      }
    }
    edit(field, value);
    const edited = pending.current[selected]?.display_settings || draft[selected]?.display_settings || {};
    edit("display_settings", { ...edited, [key]: "custom" });
  };
  const visibleFields = FIELDS.filter((field) => field.name in defaults
    || (field.name === "body" && selected?.startsWith("about_")));
  const liveDisplayChanged = (next) => {
    liveCollectionSettings.current[selected] = { ...(liveCollectionSettings.current[selected] || {}), ...next };
    setSections((xs) => xs.map((section) => section.key === selected
      ? { ...section, values: { ...section.values, display_settings: { ...(section.values?.display_settings || {}), ...next } } } : section));
  };


  return (
    <div className="cs-editor">
      <UnsavedChangesDialog guard={guard} saveLabel="Save draft and leave" message="Save your latest edits as an unpublished draft, or discard this page’s unpublished changes and leave. Published content will stay as it is." />
      <header className="cs-publishbar">
        <div className="cs-publishbar__id">
          <span className="cs-publishbar__name">{page?.label}</span>
          <span className="cs-publishbar__url">{page?.url}</span>
        </div>

        {changeCount > 0 && (
          <span className="cs-chip cs-chip--warn">
            {changeCount} unpublished edit{changeCount === 1 ? "" : "s"}
          </span>
        )}

        <span className="cs-savestate">
          {saving === "saving" && "Saving draft…"}
          {saving === "saved" && (<><CloudCheck size={14} aria-hidden="true" /> Draft saved</>)}
        </span>

        <Link to="/content/history" className="cs-btn-ghost">
          <History size={13} aria-hidden="true" /> Version history
        </Link>
        {changeCount > 0 && (
          <button type="button" className="cs-btn-ghost" onClick={() => discard()}>
            Discard changes
          </button>
        )}
        <button
          type="button"
          className="cs-btn-primary cs-btn-primary--sm"
          onClick={openChecklist}
          disabled={changeCount === 0}
        >
          Publish changes <ChevronDown size={14} aria-hidden="true" />
        </button>
      </header>

      <div className="cs-editor__body">
        <aside className="cs-sectionlist">
          <p className="cs-sectionlist__label">Sections on this page</p>
          {sections.map((s) => {
            const edited = (s.edited_fields || []).length > 0;
            const placed = s.order !== null;
            return (
              <div
                key={s.key}
                className={`cs-sectionrow${s.key === selected ? " is-selected" : ""}`
                  + `${dragKey === s.key ? " is-dragging" : ""}`}
                draggable={placed}
                onDragStart={() => setDragKey(s.key)}
                onDragEnd={() => setDragKey(null)}
                onDragOver={(e) => { if (dragKey && placed) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); dropOn(s.key); }}
              >
                {placed && (
                  <GripVertical
                    size={13}
                    className="cs-sectionrow__grip"
                    aria-hidden="true"
                  />
                )}
                <button
                  type="button"
                  className="cs-sectionrow__btn"
                  onClick={() => guard.requestAction(() => setSelected(s.key))}
                  disabled={!s.has_content}
                >
                  {s.label}
                </button>
                {s.order_id && (
                <button
                  type="button"
                  className="cs-sectionrow__eye"
                  onClick={() => toggleVisible(s)}
                  title={s.is_visible
                    ? "Showing on the home page — click to hide"
                    : "Hidden from the home page — click to show"}
                  aria-label={s.is_visible
                    ? `Hide ${s.label} from the home page`
                    : `Show ${s.label} on the home page`}
                >
                  {s.is_visible
                    ? <Eye size={13} aria-hidden="true" />
                    : <EyeOff size={13} aria-hidden="true" />}
                </button>
                )}
                {edited && <i className="cs-editeddot" title="Edited, not yet published" />}
              </div>
            );
          })}
          <p className="cs-sectionlist__note">
            Drag to reorder. The order here is the order visitors see.
          </p>
        </aside>

        <div className="cs-fields">
          {!current && <p className="cs-muted">Pick a section on the left.</p>}
          {current && (
            <>
              <h2 className="cs-fields__title">{current.label}</h2>
              <p className="cs-fields__purpose">
                {SECTION_PURPOSE[current.key] || "A section of the home page."}
              </p>

              {visibleFields.map((f) => {
                const common = {
                  id: `f-${f.name}`,
                  label: f.label,
                  hint: f.hint,
                  value: modeFor(f.name) === "default" ? (defaults[f.name] || "") : valueOf(f.name),
                  onChange: (v) => editCustom(f.name, v),
                };
                const control = f.kind === "heading" ? <HeadingField {...common} />
                  : f.kind === "long" ? <LongTextField {...common} /> : <TextField {...common} placeholder={f.placeholder} />;
                return <div key={f.name}>
                  <DisplayChoice label={f.label} value={modeFor(f.name)} onChange={(mode) => setMode(f.name, mode)} required={f.name === "heading"} />
                  {modeFor(f.name) !== "hidden" && <fieldset className="cs-mode-fields" disabled={modeFor(f.name) !== "custom"}>{control}</fieldset>}
                </div>;
              })}

              {defaults.cta_primary_label !== undefined && <div>
                <DisplayChoice label="Main button" value={modeFor("cta_primary")} onChange={(mode) => setMode("cta_primary", mode)} />
                {modeFor("cta_primary") !== "hidden" && <fieldset className="cs-mode-fields" disabled={modeFor("cta_primary") !== "custom"}>
              <ButtonField
                idPrefix="cta-main"
                label="Main button"
                hint="The one thing you most want a visitor to do next."
                textValue={modeFor("cta_primary") === "default" ? defaults.cta_primary_label : valueOf("cta_primary_label")}
                hrefValue={modeFor("cta_primary") === "default" ? defaults.cta_primary_href : valueOf("cta_primary_href")}
                onText={(v) => editCustom("cta_primary_label", v)}
                onHref={(v) => editCustom("cta_primary_href", v)}
                targets={targets}
                fixedDestination={selected === "courses_hero"}
              />
                </fieldset>}
              </div>}
              {defaults.cta_secondary_label !== undefined && <div>
                <DisplayChoice label="Second button" value={modeFor("cta_secondary")} onChange={(mode) => setMode("cta_secondary", mode)} />
                {modeFor("cta_secondary") !== "hidden" && <fieldset className="cs-mode-fields" disabled={modeFor("cta_secondary") !== "custom"}>
              <ButtonField
                idPrefix="cta-second"
                label="Second button"
                hint="An alternative for someone not ready for the main one. Optional."
                textValue={modeFor("cta_secondary") === "default" ? defaults.cta_secondary_label : valueOf("cta_secondary_label")}
                hrefValue={modeFor("cta_secondary") === "default" ? defaults.cta_secondary_href : valueOf("cta_secondary_href")}
                onText={(v) => editCustom("cta_secondary_label", v)}
                onHref={(v) => editCustom("cta_secondary_href", v)}
                targets={targets}
                fixedDestination={selected === "courses_hero"}
              />
                </fieldset>}
              </div>}

              {/* Both read the pending edit, not the live row. Reading `current`
                  meant clicking either control changed nothing on screen for
                  1.5s — and Remove appeared to do nothing at all, because
                  clearing `image_url` on a section whose picture is an uploaded
                  `image` is a no-op the server correctly dedupes away. */}
              {"img" in defaults && <div>
                <DisplayChoice label="Picture" value={modeFor("image")} onChange={(mode) => setMode("image", mode)} />
                {modeFor("image") === "custom" && <>
              <PictureField
                label="Picture"
                hint="Shown alongside this section."
                url={previewValues.img || ""}
                name={previewValues.img ? "Current picture" : ""}
                onChoose={() => setPickerOpen(true)}
                onClear={() => {
                  edit("image_url", "");
                  edit("image", "");
                  setMode("image", "hidden");
                }}
              />
                </>}
              </div>}
              <p className="cs-field__hint">Text and picture choices go live when you publish. Use the eye beside a homepage section to hide the whole section.</p>

              {/* The rows listed beneath this section's own copy. Without
                  this the editor showed a section with six live bullet
                  points as though it had none.

                  Only for sections whose public component actually renders
                  them (`supports_list_items`, from the backend). Offering the
                  panel everywhere meant rows saved against Featured Courses,
                  FAQ, Hero, the closing CTA or the courses hero were accepted,
                  reported as saved, and then never displayed anywhere. */}
              {/* Only Featured Courses has this. It lives in the block's
                  `extra` JSON, which the draft round-trips as a dict, so it
                  autosaves and publishes like any other field. Absent from
                  this editor entirely until now — the legacy tab was the only
                  place to change how many cards the homepage renders. */}
              {current.has_card_cap && (
                <div className="cs-field">
                  <div className="cs-field__labelrow">
                    <label className="cs-field__label" htmlFor="f-maxcards">
                      Cards shown on the homepage
                    </label>
                  </div>
                  <input
                    id="f-maxcards"
                    className="cs-input"
                    type="number"
                    min="0"
                    value={cardCap}
                    placeholder="6"
                    onChange={(e) => {
                      const raw = e.target.value;
                      const next = { ...(valueOf("extra") || {}) };
                      if (raw === "") delete next.max_cards;
                      else next.max_cards = Number(raw);
                      edit("extra", next);
                    }}
                  />
                  <p className="cs-field__hint">
                    The grid is three cards wide, so 6 fills two rows. Leave
                    blank for 6. Set 0 to show every card you have published —
                    visitors can always reach the rest through “All courses”.
                  </p>
                </div>
              )}

              {current.supports_list_items ? (
                <SectionListItems
                  key={current.key}
                  editorRef={itemsEditor}
                  onDraftChange={itemsDirtyChanged}
                  onBusyChange={itemsBusyChanged}
                  section={current.key}
                  blockId={current.block_id}
                  displaySettings={current.values?.display_settings || {}}
                  onDisplayUpdated={liveDisplayChanged}
                  sectionLabel={current.label}
                  onNotify={say}
                />
              ) : current.list_source ? (
                <div className="cs-field">
                  <div className="cs-field__labelrow">
                    <span className="cs-field__label">
                      What’s listed in {current.label}
                    </span>
                  </div>
                  <p className="cs-field__hint">{current.list_source.note}</p>
                  <Link to={current.list_source.url} className="cs-btn-ghost">
                    Go to {current.list_source.label}
                  </Link>
                </div>
              ) : null}

              {/* The badges pinned on this section's artwork. Renders nothing
                  for the fourteen sections that have no slots. */}
              <SectionFloaters
                key={current.key}
                editorRef={floatersEditor}
                onDraftChange={floatersDirtyChanged}
                onBusyChange={floatersBusyChanged}
                section={current.key}
                slots={current.floater_slots}
                blockId={current.block_id}
                displaySettings={current.values?.display_settings || {}}
                onDisplayUpdated={liveDisplayChanged}
                onNotify={say}
              />

              {current.block_id && (
                <div className="cs-fields__danger">
                  <button
                    type="button"
                    className="cs-btn-ghost cs-btn-ghost--danger"
                    onClick={deleteBlock}
                    disabled={busy}
                  >
                    {busy ? "Deleting…" : "Delete this section’s copy"}
                  </button>
                  <p className="cs-field__hint">
                    The section stays on the page and falls back to the
                    built-in wording.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <SectionPreview
          device={device}
          onDevice={setDevice}
          values={previewValues}
          sectionLabel={current ? current.label : "this section"}
        />
      </div>

      {checklistOpen && checklist && (
        <div
          className="cs-palette-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setChecklistOpen(false); }}
        >
          <div className="cs-checklist" role="dialog" aria-modal="true">
            <h2 className="cs-card__title">Before this goes live</h2>
            <p className="cs-field__hint cs-field__hint--tight">
              Everything below is checked automatically.
            </p>

            {checklist.sections.map((s) => (
              <div key={s.key} className="cs-checklist__group">
                <p className="cs-day__label">{s.label}</p>
                {s.checks.map((c) => (
                  <div key={c.id} className={`cs-check cs-check--${c.level}`}>
                    {c.level === "ok"
                      ? <CheckCircle2 size={15} aria-hidden="true" />
                      : <AlertTriangle size={15} aria-hidden="true" />}
                    <span>
                      <span className="cs-check__label">{c.label}</span>
                      {c.note && <span className="cs-check__note">{c.note}</span>}
                    </span>
                  </div>
                ))}
              </div>
            ))}

            {checklist.blocking > 0 && (
              <p className="cs-field__warn">
                This can’t go live until the problems above are fixed.
              </p>
            )}

            <div className="cs-confirm__actions">
              <button type="button" className="cs-btn-ghost" onClick={() => setChecklistOpen(false)}>
                Not yet
              </button>
              <button
                type="button"
                className="cs-btn-primary cs-btn-primary--sm"
                disabled={!checklist.can_publish || publishing}
                onClick={doPublish}
              >
                {publishing ? "Publishing…" : "Publish now"}
              </button>
            </div>
            <p className="cs-checklist__later">
              Scheduling a page for later isn’t built yet.
            </p>
          </div>
        </div>
      )}

      {/* Sets `image_url` and clears `image` for the same reason onClear
          clears both: a section whose picture is an uploaded `image` ignores
          `image_url`, so setting one without clearing the other would look
          like the pick silently did nothing. */}
      {pickerOpen && (
        <MediaPickerDialog
          onClose={() => setPickerOpen(false)}
          onPick={(asset) => {
            edit("image_url", asset.url || "");
            edit("image", "");
            say(`Picture set to ${asset.name}.`);
          }}
        />
      )}

      <Toast message={toast?.message} tone={toast?.tone} />
    </div>
  );
};

export default PageEditor;
