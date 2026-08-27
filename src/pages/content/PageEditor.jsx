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
  AlertTriangle, CheckCircle2, ChevronDown, CloudCheck, EyeOff, GripVertical,
  History,
} from "lucide-react";
import {
  discardPageDraft, getLinkTargets, getPageChecklist, getPageDraft, publishPage,
  reorderSections, savePageDraft,
} from "../../api/admin_content_studio";
import SectionPreview from "./SectionPreview";
import SectionListItems from "./SectionListItems";
import { errText } from "../../utils/errText";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import Toast from "../../components/Toast";
import {
  ButtonField, HeadingField, LongTextField, PictureField, TextField,
  VisibilitySwitch,
} from "./ChapterlessFields";
import "../../css/ContentStudio.css";

// The page being edited comes from the route (/content/pages/:key). This used
// to be hardcoded to "home", so /content/pages/<anything> silently loaded,
// edited, autosaved and published the HOME page under another page's name —
// harmless only for as long as the backend's PAGES registry has one entry.
const FALLBACK_PAGE_KEY = "home";
const AUTOSAVE_MS = 1500;

/** Merge two `{section: {field: value}}` maps, the right-hand side winning.
 *
 * Both the autosave queue and the draft use this nested shape, and a plain
 * spread at the top level would drop every other field in a section. */
const mergeSections = (base, extra) => {
  const out = { ...base };
  for (const [section, fields] of Object.entries(extra || {})) {
    out[section] = { ...(out[section] || {}), ...fields };
  }
  return out;
};

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
    hint: "Only the top section uses this — it continues the heading on a new line.",
    sections: ["hero"] },
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
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState(null);
  const [device, setDevice] = useState("desktop");
  const [dragKey, setDragKey] = useState(null);

  const toastTimer = useRef(null);
  const saveTimer = useRef(null);
  const pending = useRef({});

  const say = useCallback((m) => {
    clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const mounted = useRef(true);
  const flushRef = useRef(null);

  useEffect(() => () => {
    clearTimeout(toastTimer.current);
    clearTimeout(saveTimer.current);
    // Send whatever the debounce was still holding. Clearing the timer alone
    // silently dropped any edit made within 1.5s of clicking a sidebar link.
    if (Object.keys(pending.current).length) flushRef.current?.();
    mounted.current = false;
  }, []);

  const applyServerState = useCallback((data) => {
    setPage(data.page);
    setSections(data.sections);
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

  const flush = useCallback(async () => {
    const payload = pending.current;
    pending.current = {};
    if (!Object.keys(payload).length) return;
    if (mounted.current) setSaving("saving");
    try {
      const data = await savePageDraft(pageKey, payload);
      if (!mounted.current) return;
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
    } catch (e) {
      // Put the edits back in the queue. They were taken out before the
      // request, so without this the fields still show the new text and the bar
      // still counts them, but nothing will ever send them: Publish then
      // reports "no unpublished edits" and a reload loses the work silently.
      pending.current = mergeSections(pending.current, payload);
      if (!mounted.current) return;
      setSaving("idle");
      say(`Couldn’t save — ${errText(e)}. Your changes are still here; keep
        typing or press Publish to retry.`.replace(/\s+/g, " "));
    }
  }, [applyServerState, say, pageKey]);

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
    const merged = { ...(current?.values || {}), ...d };
    // The preview reads `img`, but the editable fields are `image_url` and the
    // uploaded `image` — so a picture change used to show in neither the
    // thumbnail nor the pane captioned "as it would look".
    if ("image_url" in d || "image" in d) {
      merged.img = d.image_url || (d.image ? merged.img : "");
    }
    return merged;
  }, [current, draft, selected]);

  // Covers tab close / reload. It cannot intercept a sidebar-link click — see
  // the hook's own note on useBlocker — which is why unmount flushes instead.
  useUnsavedChangesGuard(saving !== "saved" && changeCount > 0);

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
      say(`Couldn’t save the new order — ${errText(e)}`);
    }
  };

  const openChecklist = async () => {
    clearTimeout(saveTimer.current);
    await flush();
    try {
      setChecklist(await getPageChecklist(pageKey));
      setChecklistOpen(true);
    } catch (e) {
      say(errText(e));
    }
  };

  /** Throw away this author's pending edits.
   *
   * The endpoint has existed since Phase 1b but nothing reached it, so an
   * editor who changed their mind had no way out: the edits sat in the bar
   * forever and the only escape was publishing them. */
  const discard = async () => {
    if (!window.confirm(
      `Throw away ${changeCount} unpublished edit${changeCount === 1 ? "" : "s"}? `
      + "What's live on the site now won't change.",
    )) return;
    clearTimeout(saveTimer.current);
    pending.current = {};
    try {
      await discardPageDraft(pageKey);
      applyServerState(await getPageDraft(pageKey));
      setChecklist(null);
      setSaving("idle");
      say("Unpublished edits discarded.");
    } catch (e) {
      say(`Couldn’t discard — ${errText(e)}`);
    }
  };

  const doPublish = async () => {
    setPublishing(true);
    try {
      const res = await publishPage(pageKey);
      say(`Published ${res.section_count} section${res.section_count === 1 ? "" : "s"}.`);
      setChecklistOpen(false);
      setChecklist(null);
      applyServerState(await getPageDraft(pageKey));
    } catch (e) {
      say(e?.response?.data?.detail || errText(e));
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

  const visibleFields = FIELDS.filter(
    (f) => !f.sections || f.sections.includes(selected),
  );

  return (
    <div className="cs-editor">
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
          {saving === "saving" && "Saving…"}
          {saving === "saved" && (<><CloudCheck size={14} aria-hidden="true" /> Saved just now</>)}
        </span>

        <Link to="/content/home" className="cs-btn-ghost">
          <History size={13} aria-hidden="true" /> Version history
        </Link>
        {changeCount > 0 && (
          <button type="button" className="cs-btn-ghost" onClick={discard}>
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
                  onClick={() => setSelected(s.key)}
                  disabled={!s.has_content}
                >
                  {s.label}
                </button>
                {!s.is_visible && <EyeOff size={13} aria-hidden="true" />}
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
                  value: valueOf(f.name),
                  onChange: (v) => edit(f.name, v),
                };
                if (f.kind === "heading") return <HeadingField key={f.name} {...common} />;
                if (f.kind === "long") return <LongTextField key={f.name} {...common} />;
                return <TextField key={f.name} {...common} placeholder={f.placeholder} />;
              })}

              <ButtonField
                idPrefix="cta-main"
                label="Main button"
                hint="The one thing you most want a visitor to do next."
                textValue={valueOf("cta_primary_label")}
                hrefValue={valueOf("cta_primary_href")}
                onText={(v) => edit("cta_primary_label", v)}
                onHref={(v) => edit("cta_primary_href", v)}
                targets={targets}
              />
              <ButtonField
                idPrefix="cta-second"
                label="Second button"
                hint="An alternative for someone not ready for the main one. Optional."
                textValue={valueOf("cta_secondary_label")}
                hrefValue={valueOf("cta_secondary_href")}
                onText={(v) => edit("cta_secondary_label", v)}
                onHref={(v) => edit("cta_secondary_href", v)}
                targets={targets}
              />

              {/* Both read the pending edit, not the live row. Reading `current`
                  meant clicking either control changed nothing on screen for
                  1.5s — and Remove appeared to do nothing at all, because
                  clearing `image_url` on a section whose picture is an uploaded
                  `image` is a no-op the server correctly dedupes away. */}
              <PictureField
                label="Picture"
                hint="Shown alongside this section."
                url={previewValues.img || ""}
                name={previewValues.img ? "Current picture" : ""}
                onChoose={() => say("Choosing from the library lands in a later phase.")}
                onClear={() => {
                  edit("image_url", "");
                  edit("image", "");
                }}
              />

              <VisibilitySwitch
                status={draft[selected]?.status || current.status}
                onChange={(next) => edit("status", next)}
              />

              {/* The rows listed beneath this section's own copy. Without
                  this the editor showed a section with six live bullet
                  points as though it had none. */}
              <SectionListItems
                section={current.key}
                sectionLabel={current.label}
                onNotify={say}
              />
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

      <Toast message={toast} />
    </div>
  );
};

export default PageEditor;
