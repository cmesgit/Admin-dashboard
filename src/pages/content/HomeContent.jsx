import { useEffect, useMemo, useState } from "react";
import {
  getHomeContentBlocks, createHomeContentBlock, updateHomeContentBlock,
  getHomeListItems, createHomeListItem, updateHomeListItem, deleteHomeListItem,
  getHomeFloaters, createHomeFloater, updateHomeFloater,
  getHomeSectionOrder, updateHomeSectionOrder, reorderHomeSections,
} from "../../api/admin";
import ConfirmModal from "../../components/ConfirmModal";
import ImageUploadField from "../../components/ImageUploadField";
import TagChipInput from "../../components/TagChipInput";
import RichTextEditor from "../../components/RichTextEditor";
import { errText } from "../../utils/errText";
import { buildBody } from "../../utils/buildBody";

// Every homepage section this screen can edit. Mirrors backend
// content.models.HomeSection exactly. This list is content-block editing
// only — actual page DISPLAY ORDER is separate and admin-configurable, see
// SectionOrderPanel below; don't assume this array's order reflects the
// live site (it doesn't move when an editor reorders sections).
const HOME_SECTIONS = [
  ["hero", "Hero"],
  ["why_shiksha", "Why Shiksha"],
  ["teachers_students", "Teachers & Students"],
  ["browse_categories", "Browse Categories"],
  // featured_courses/faq get their LIST content from ShowcaseCourse and
  // FAQItem (edit those on the Showcase / FAQs tabs). Their section heading
  // is a normal content block though, so both belong here — until the
  // frontend was wired up those headings were hardcoded and uneditable.
  ["featured_courses", "Featured Courses (heading only)"],
  ["faq", "FAQ (heading only)"],
  ["why_choose", "Why Choose ShikshaCom"],
  ["resources", "Resources & Support"],
  ["collaborate", "Collaborate"],
  ["cta", "Closing CTA"],
  // Not a homepage section — the /courses page's own hero, reusing this
  // same screen/model since it's the identical heading/copy/CTA/image shape.
  ["courses_hero", "Courses Hero"],
];

// Human labels for SectionOrderPanel, covering the 2 sections above that
// have no content-block chip (featured_courses/faq) plus everything else.
const SECTION_ORDER_LABELS = {
  hero: "Hero", why_shiksha: "Why Shiksha",
  teachers_students: "Teachers & Students", browse_categories: "Browse Categories",
  featured_courses: "Featured Courses", why_choose: "Why Choose ShikshaCom",
  resources: "Resources & Support", collaborate: "Collaborate",
  faq: "FAQ", cta: "Closing CTA",
};

// Closed per-section slot list — mirrors backend
// content.models.HomeFloater.SLOT_CHOICES_BY_SECTION exactly. A slot maps
// 1:1 to a pre-tested CSS position on the public site, so this screen never
// lets an editor type a slot — only pick one of these, or leave it unset.
const FLOATER_SLOTS_BY_SECTION = {
  hero: [["cap", "Graduation cap (top-left of art)"], ["book", "Book (bottom-right of art)"], ["play", "Play button (mid-right of art)"]],
  why_choose: [["b_tl", "Top-left badge"], ["b_tr", "Top-right badge"], ["b_bl", "Bottom-left badge"]],
  collaborate: [["top", "Top badge"], ["bottom", "Bottom badge"]],
};

const ICON_KEYS = [
  "", "cap", "book", "play", "live", "faculty", "board", "flexible", "guest", "guidance",
  "forum", "counselling", "skills", "placement", "library", "research",
  "screen", "chat", "secure", "globe", "check", "folder", "calendar", "star",
];

const TINT_KEYS = ["", "violet", "green", "blue", "red", "gold", "pink", "teal"];

const VARIANT_CHOICES = [
  ["default", "Default card"],
  ["marquee_chip", "Marquee chip (Collaborate)"],
  ["stat_chip", "Stat chip (Collaborate)"],
];
const VARIANT_LABEL = Object.fromEntries(VARIANT_CHOICES);

const sectionLabel = (v) => (HOME_SECTIONS.find((s) => s[0] === v) || [v, v])[1];

/* ═══════════════════════ Content block (singleton per section) ═══════════════════════ */

function ContentBlockForm({ section, row, busy, error, onSubmit }) {
  const [form, setForm] = useState({
    eyebrow: row?.eyebrow || "",
    heading: row?.heading || "",
    heading_secondary: row?.heading_secondary || "",
    subhead: row?.subhead || "",
    body: row?.body || "",
    cta_primary_label: row?.cta_primary_label || "",
    cta_primary_href: row?.cta_primary_href || "",
    cta_secondary_label: row?.cta_secondary_label || "",
    cta_secondary_href: row?.cta_secondary_href || "",
    image_url: row?.image_url || "",
    is_active: row?.is_active ?? true,
  });
  const [file, setFile] = useState(null);

  // Reset the form whenever the selected section's row changes underneath it.
  useEffect(() => {
    setForm({
      eyebrow: row?.eyebrow || "",
      heading: row?.heading || "",
      heading_secondary: row?.heading_secondary || "",
      subhead: row?.subhead || "",
      body: row?.body || "",
      cta_primary_label: row?.cta_primary_label || "",
      cta_primary_href: row?.cta_primary_href || "",
      cta_secondary_label: row?.cta_secondary_label || "",
      cta_secondary_href: row?.cta_secondary_href || "",
      image_url: row?.image_url || "",
      is_active: row?.is_active ?? true,
    });
    setFile(null);
  }, [row, section]);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = () => {
    const payload = { ...form, section };
    onSubmit(payload, file);
  };

  return (
    <div className="dashboard-card">
      <div className="cm-row">
        <label className="cm-field">
          <span>Eyebrow</span>
          <input value={form.eyebrow} onChange={set("eyebrow")} placeholder="e.g. Empowerment Through Education" />
        </label>
        <label className="cm-check" style={{ marginTop: 26 }}>
          <input type="checkbox" checked={form.is_active} onChange={set("is_active")} />
          <span>Active</span>
        </label>
      </div>

      <div className="cm-row">
        <label className="cm-field">
          <span>Heading</span>
          <input value={form.heading} onChange={set("heading")} placeholder="e.g. Empowering Students Through" />
        </label>
        <label className="cm-field">
          <span>Heading — 2nd half (Hero only)</span>
          <input value={form.heading_secondary} onChange={set("heading_secondary")} placeholder="e.g. Better Learning." />
        </label>
      </div>

      <label className="cm-field">
        <span>Subhead</span>
        <input value={form.subhead} onChange={set("subhead")} placeholder="Short one-line subhead" />
      </label>

      <label className="cm-field">
        <span>Body</span>
        <RichTextEditor
          mode="restricted"
          value={form.body}
          onChange={(html) => setForm((f) => ({ ...f, body: html }))}
          placeholder="Longer paragraph, if this section has one"
        />
      </label>

      <div className="cm-row">
        <label className="cm-field">
          <span>Primary CTA label</span>
          <input value={form.cta_primary_label} onChange={set("cta_primary_label")} placeholder="e.g. Explore Courses" />
        </label>
        <label className="cm-field">
          <span>Primary CTA link</span>
          <input value={form.cta_primary_href} onChange={set("cta_primary_href")} placeholder="/courses" />
        </label>
      </div>

      <div className="cm-row">
        <label className="cm-field">
          <span>Secondary CTA label</span>
          <input value={form.cta_secondary_label} onChange={set("cta_secondary_label")} placeholder="e.g. Book a Tutor" />
        </label>
        <label className="cm-field">
          <span>Secondary CTA link</span>
          <input value={form.cta_secondary_href} onChange={set("cta_secondary_href")} placeholder="/counselling" />
        </label>
      </div>

      <div className="cm-row">
        <label className="cm-field">
          <span>Image (optional upload — overrides the section's default illustration)</span>
          <ImageUploadField value={file} onChange={setFile} previewUrl={row?.img} previewClassName="cms-image-preview" />
        </label>
        <label className="cm-field">
          <span>Image URL (fallback if no upload)</span>
          <input value={form.image_url} onChange={set("image_url")} placeholder="https://…" />
        </label>
      </div>

      {error && <div className="cm-form-error">{error}</div>}

      <div className="confirm-actions" style={{ justifyContent: "flex-end" }}>
        <button className="confirm-ok" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : row ? "Save" : "Create"}
        </button>
      </div>
    </div>
  );
}

function ContentBlockPanel({ section, notify }) {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getHomeContentBlocks({ section }).then((rows) => {
      if (!alive) return;
      const list = Array.isArray(rows) ? rows : rows.results || [];
      setRow(list[0] || null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [section]);

  const handleSubmit = async (payload, file) => {
    setBusy(true); setError("");
    try {
      const { data, isMultipart } = buildBody(payload, file);
      const saved = row
        ? await updateHomeContentBlock(row.id, data, isMultipart)
        : await createHomeContentBlock(data, isMultipart);
      setRow(saved);
      notify(`${sectionLabel(section)} content block ${row ? "updated" : "created"}`);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="dashboard-loading">Loading…</div>;
  return <ContentBlockForm section={section} row={row} busy={busy} error={error} onSubmit={handleSubmit} />;
}

/* ═══════════════════════ List items (repeatable cards/chips) ═══════════════════════ */

function ListItemFormModal({ section, showVariant, initial, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    variant: initial?.variant || "default",
    icon: initial?.icon || "",
    title: initial?.title || "",
    subtitle: initial?.subtitle || "",
    body: initial?.body || "",
    pills: initial?.pills || [],
    stat_text: initial?.stat_text || "",
    cta_label: initial?.cta_label || "",
    cta_href: initial?.cta_href || "",
    tint: initial?.tint || "",
    order: initial?.order ?? 0,
    is_active: initial?.is_active ?? true,
  });

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card" onClick={(e) => e.stopPropagation()}>
        <h3>{initial ? "Edit item" : "New item"} — {sectionLabel(section)}</h3>

        {showVariant && (
          <label className="cm-field">
            <span>Type</span>
            <select value={form.variant} onChange={set("variant")}>
              {VARIANT_CHOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}

        <div className="cm-row">
          <label className="cm-field">
            <span>Icon</span>
            <select value={form.icon} onChange={set("icon")}>
              {ICON_KEYS.map((k) => <option key={k} value={k}>{k || "— none —"}</option>)}
            </select>
          </label>
          <label className="cm-field">
            <span>Tint</span>
            <select value={form.tint} onChange={set("tint")}>
              {TINT_KEYS.map((k) => <option key={k} value={k}>{k || "— default —"}</option>)}
            </select>
          </label>
        </div>

        <label className="cm-field">
          <span>Title</span>
          <input value={form.title} onChange={set("title")} autoFocus placeholder="e.g. Live & recorded classes" />
        </label>
        <label className="cm-field">
          <span>Subtitle</span>
          <input value={form.subtitle} onChange={set("subtitle")} placeholder="e.g. Classes 8–12 · CBSE, NCERT & MBSE" />
        </label>
        <label className="cm-field">
          <span>Body</span>
          <RichTextEditor
            mode="restricted"
            value={form.body}
            onChange={(html) => setForm((f) => ({ ...f, body: html }))}
          />
        </label>

        {section === "browse_categories" && (
          <label className="cm-field">
            <span>Pills</span>
            <TagChipInput value={form.pills} onChange={(v) => setForm((f) => ({ ...f, pills: v }))} placeholder="Type a pill, press Enter…" />
          </label>
        )}

        <label className="cm-field">
          <span>Stat text</span>
          <input value={form.stat_text} onChange={set("stat_text")} placeholder="e.g. Board-aligned live & recorded classes" />
        </label>

        <div className="cm-row">
          <label className="cm-field">
            <span>CTA label</span>
            <input value={form.cta_label} onChange={set("cta_label")} placeholder="e.g. Explore School Courses" />
          </label>
          <label className="cm-field">
            <span>CTA link</span>
            <input value={form.cta_href} onChange={set("cta_href")} placeholder="/courses" />
          </label>
        </div>

        <div className="cm-row">
          <label className="cm-field">
            <span>Order</span>
            <input type="number" value={form.order} onChange={set("order")} />
          </label>
          <label className="cm-check" style={{ marginTop: 26 }}>
            <input type="checkbox" checked={form.is_active} onChange={set("is_active")} />
            <span>Active</span>
          </label>
        </div>

        {error && <div className="cm-form-error">{error}</div>}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className="confirm-ok"
            disabled={busy || !form.title.trim() && !form.stat_text.trim()}
            onClick={() => onSubmit({
              section,
              variant: form.variant,
              icon: form.icon,
              title: form.title.trim(),
              subtitle: form.subtitle.trim(),
              body: form.body,
              pills: form.pills,
              stat_text: form.stat_text.trim(),
              cta_label: form.cta_label.trim(),
              cta_href: form.cta_href.trim(),
              tint: form.tint,
              order: parseInt(form.order, 10) || 0,
              is_active: form.is_active,
            })}
          >
            {busy ? "Saving…" : initial ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ListItemsPanel({ section, notify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [variantFilter, setVariantFilter] = useState("");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const showVariant = section === "collaborate";

  const load = async () => {
    setLoading(true);
    const d = await getHomeListItems({ section, variant: showVariant ? (variantFilter || undefined) : undefined });
    setRows(Array.isArray(d) ? d : d.results || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [section, variantFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (payload) => {
    setBusy(true); setFormError("");
    try {
      if (modal.initial) {
        const updated = await updateHomeListItem(modal.initial.id, payload);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        notify("Item updated");
      } else {
        const created = await createHomeListItem(payload);
        setRows((prev) => [...prev, created]);
        notify("Item created");
      }
      setModal(null);
    } catch (e) {
      setFormError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await deleteHomeListItem(confirm.item.id);
      setRows((prev) => prev.filter((r) => r.id !== confirm.item.id));
      notify("Item deleted");
      setConfirm(null);
    } catch (e) {
      setConfirm((c) => ({ ...c, error: errText(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mod-chip-row">
        {showVariant && [["", "All"], ...VARIANT_CHOICES].map(([v, l]) => (
          <button key={v || "all"} className={`mod-chip${variantFilter === v ? " active" : ""}`} onClick={() => setVariantFilter(v)}>
            {l}
          </button>
        ))}
        <div className="cms-toolbar-spacer" />
        <button className="cm-add-btn" onClick={() => { setFormError(""); setModal({ initial: null }); }}>
          + New Item
        </button>
      </div>

      <div className="dashboard-card courses-table-card">
        <div className="courses-count">{rows.length} item{rows.length !== 1 ? "s" : ""}</div>
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No items yet for this section.</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr>
                {showVariant && <th>Type</th>}
                <th>Title</th><th>Order</th><th>Status</th><th aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {showVariant && <td><span className="mod-badge pal-blue">{VARIANT_LABEL[r.variant] || r.variant}</span></td>}
                  <td className="courses-title courses-desc" style={{ maxWidth: 420 }}>{r.title || r.stat_text}</td>
                  <td>{r.order}</td>
                  <td>
                    <span className={`mod-badge ${r.is_active ? "pal-green" : "pal-gray"}`}>
                      {r.is_active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="cm-actions">
                    <button className="cm-icon-btn" onClick={() => { setFormError(""); setModal({ initial: r }); }}>Edit</button>
                    <button className="cm-icon-btn cm-icon-btn--danger" onClick={() => setConfirm({ item: r })}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <ListItemFormModal
          section={section}
          showVariant={showVariant}
          initial={modal.initial}
          busy={busy}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={() => setModal(null)}
        />
      )}

      {confirm && (
        <ConfirmModal
          title="Delete item"
          message={`Delete "${confirm.item.title || confirm.item.stat_text}"? This can't be undone.`}
          extra={confirm.error ? <div className="cm-form-error">{confirm.error}</div> : null}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ Floaters (decorative badges, fixed slots) ═══════════════════════ */

function FloaterFormModal({ section, slot, slotLabel, initial, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    icon: initial?.icon || "",
    label: initial?.label || "",
    sublabel: initial?.sublabel || "",
    is_active: initial?.is_active ?? true,
  });

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card" onClick={(e) => e.stopPropagation()}>
        <h3>{initial ? "Edit" : "Add"} badge — {slotLabel}</h3>
        <p className="cm-hint">
          Slot is fixed to a pre-tested position on the page — it can't overlap
          anything else. Only the icon, text, and visibility can be edited.
        </p>

        <label className="cm-field">
          <span>Icon</span>
          <select value={form.icon} onChange={set("icon")}>
            {ICON_KEYS.map((k) => <option key={k} value={k}>{k || "— none —"}</option>)}
          </select>
        </label>

        <label className="cm-field">
          <span>Label</span>
          <input value={form.label} onChange={set("label")} maxLength={60} placeholder="e.g. Live + Recorded" />
        </label>
        <label className="cm-field">
          <span>Sublabel (optional)</span>
          <input value={form.sublabel} onChange={set("sublabel")} maxLength={80} placeholder="e.g. Classes 8–12 & more" />
        </label>

        <label className="cm-check">
          <input type="checkbox" checked={form.is_active} onChange={set("is_active")} />
          <span>Active (unticking removes the badge from the page)</span>
        </label>

        {error && <div className="cm-form-error">{error}</div>}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="confirm-ok" disabled={busy} onClick={() => onSubmit({ section, slot, ...form })}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FloatersPanel({ section, notify }) {
  const slots = FLOATER_SLOTS_BY_SECTION[section] || [];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getHomeFloaters({ section }).then((d) => {
      if (!alive) return;
      setRows(Array.isArray(d) ? d : d.results || []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [section]);

  const bySlot = useMemo(() => Object.fromEntries(rows.map((r) => [r.slot, r])), [rows]);

  const handleSubmit = async (payload) => {
    setBusy(true); setFormError("");
    try {
      const existing = bySlot[payload.slot];
      const saved = existing
        ? await updateHomeFloater(existing.id, payload)
        : await createHomeFloater(payload);
      setRows((prev) => [...prev.filter((r) => r.slot !== payload.slot), saved]);
      notify(`Badge ${existing ? "updated" : "added"}`);
      setModal(null);
    } catch (e) {
      setFormError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!slots.length) return null;

  return (
    <div>
      {loading ? (
        <div className="dashboard-loading">Loading…</div>
      ) : (
        <div className="cms-card-grid">
          {slots.map(([slotKey, slotLabel]) => {
            const r = bySlot[slotKey];
            return (
              <div className="cms-card" key={slotKey}>
                <div className="cms-card-body">
                  <div className="cms-card-title">{slotLabel}</div>
                  {r ? (
                    <>
                      <div className="cms-card-sub">{r.label || <em>No label yet</em>}</div>
                      {r.sublabel && <div className="cms-card-sub">{r.sublabel}</div>}
                      <span className={`mod-badge ${r.is_active ? "pal-green" : "pal-gray"}`}>
                        {r.is_active ? "Active" : "Hidden"}
                      </span>
                    </>
                  ) : (
                    <div className="cms-card-sub">Not set — page shows its default look.</div>
                  )}
                </div>
                <div className="cms-card-footer">
                  <button className="mod-btn ghost small" onClick={() => { setFormError(""); setModal({ slot: slotKey, slotLabel, initial: r || null }); }}>
                    {r ? "Edit" : "Add"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <FloaterFormModal
          section={section}
          slot={modal.slot}
          slotLabel={modal.slotLabel}
          initial={modal.initial}
          busy={busy}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ Section order (page-wide, not per-section) ═══════════════════════ */

function SectionOrderPanel({ notify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    getHomeSectionOrder().then((data) => {
      setRows(data || []);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const move = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    setBusy(true);
    setError("");
    try {
      await reorderHomeSections(next.map((r) => r.section));
      notify && notify("Homepage section order updated — live now, no deploy needed.");
    } catch (e) {
      setError(errText(e));
      load(); // reload the real order if the save failed, so the list never lies
    } finally {
      setBusy(false);
    }
  };

  const toggleVisible = async (row) => {
    setBusy(true);
    setError("");
    try {
      const updated = await updateHomeSectionOrder(row.id, { is_visible: !row.is_visible });
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      notify && notify(updated.is_visible ? "Section shown on the homepage." : "Section hidden from the homepage.");
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="cm-hint">Loading section order…</p>;

  return (
    <div>
      <p className="cm-hint">
        This is the order sections appear on the public homepage, top to
        bottom. Use the arrows to move a section; uncheck "Visible" to hide
        it from the live site without deleting its content. Changes apply
        immediately.
      </p>
      {error && <div className="cm-form-error">{error}</div>}
      <ol className="section-order-list">
        {rows.map((row, i) => (
          <li key={row.section} className={`section-order-row${row.is_visible ? "" : " is-hidden"}`}>
            <span className="section-order-index">{i + 1}</span>
            <span className="section-order-label">
              {SECTION_ORDER_LABELS[row.section] || row.section}
            </span>
            <label className="section-order-visible">
              <input
                type="checkbox"
                checked={row.is_visible}
                disabled={busy}
                onChange={() => toggleVisible(row)}
              />
              Visible
            </label>
            <div className="section-order-moves">
              <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${SECTION_ORDER_LABELS[row.section] || row.section} up`}>↑</button>
              <button type="button" disabled={busy || i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${SECTION_ORDER_LABELS[row.section] || row.section} down`}>↓</button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ═══════════════════════ Screen shell ═══════════════════════ */

const HomeContent = ({ onAction }) => {
  const [section, setSection] = useState("hero");
  const notify = (msg) => onAction && onAction(msg);

  return (
    <div>
      <h3 className="content-subsection-title">Homepage section order</h3>
      <SectionOrderPanel notify={notify} />

      <h3 className="content-subsection-title">Choose a section to edit its heading &amp; copy</h3>
      <div className="mod-chip-row">
        {HOME_SECTIONS.map(([v, l]) => (
          <button key={v} className={`mod-chip${section === v ? " active" : ""}`} onClick={() => setSection(v)}>
            {l}
          </button>
        ))}
      </div>

      <ContentBlockPanel key={`block-${section}`} section={section} notify={notify} />

      <h3 className="content-subsection-title">List items</h3>
      <ListItemsPanel key={`items-${section}`} section={section} notify={notify} />

      {!!FLOATER_SLOTS_BY_SECTION[section] && (
        <>
          <h3 className="content-subsection-title">Floating badges</h3>
          <FloatersPanel key={`floaters-${section}`} section={section} notify={notify} />
        </>
      )}
    </div>
  );
};

export default HomeContent;
