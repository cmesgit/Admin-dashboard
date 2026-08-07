// src/pages/HomeCms.jsx  (NEW)
//
// Admin editor for the frontend home page's CMS-backed sections: Hero
// banner, Browse Categories, and the closing CTA. Each is a plain
// ModelViewSet on the backend (content/admin_views.py) — the public site
// serves the first `is_active` row (by `order`) for Hero/CTA, and every
// active row (ordered) for Categories. Mirrors the list/FormModal/
// ConfirmModal pattern already used in Courses.jsx.

import { useEffect, useState, useCallback } from "react";
import {
  getHeroBanners, createHeroBanner, updateHeroBanner, deleteHeroBanner,
  getHomeCategoriesAdmin, createHomeCategory, updateHomeCategory, deleteHomeCategory,
  getHomeCtas, createHomeCta, updateHomeCta, deleteHomeCta,
} from "../api/admin";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";
import "../css/Courses.css";

const TABS = [
  { key: "hero", label: "Hero Banner" },
  { key: "categories", label: "Browse Categories" },
  { key: "cta", label: "Closing CTA" },
];

const ICONS = [
  { value: "school", label: "School" },
  { value: "target", label: "Target" },
  { value: "briefcase", label: "Briefcase" },
];
const GRADIENTS = [
  { value: "green", label: "Green" },
  { value: "warm", label: "Warm" },
  { value: "cool", label: "Cool" },
];

const errText = (e) => {
  const d = e?.response?.data;
  if (!d) return "Something went wrong. Please try again.";
  if (typeof d === "string") return d;
  if (d.detail) return d.detail;
  try { return Object.values(d).flat().join(" ") || "Request failed."; }
  catch { return "Request failed."; }
};

/* ───────────────────────── Create/Edit modal ───────────────────────── */
function FormModal({ type, mode, initial, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial || {});
  const [file, setFile] = useState(null);

  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const heading =
    `${mode === "edit" ? "Edit" : "New"} ` +
    { hero: "Hero Banner", category: "Category", cta: "CTA" }[type];

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card" onClick={(e) => e.stopPropagation()}>
        <h3>{heading}</h3>

        {type === "hero" && (
          <>
            <label className="cm-field">
              <span>Eyebrow (badge above heading)</span>
              <input value={form.eyebrow || ""} onChange={set("eyebrow")} placeholder="e.g. Trusted by 50,000+ Students" autoFocus />
            </label>
            <div className="cm-row">
              <label className="cm-field">
                <span>Heading</span>
                <input value={form.heading || ""} onChange={set("heading")} placeholder="e.g. Learn every day & ace school and" />
              </label>
              <label className="cm-field">
                <span>Heading highlight</span>
                <input value={form.heading_highlight || ""} onChange={set("heading_highlight")} placeholder="e.g. competitive exams" />
              </label>
            </div>
            <label className="cm-field">
              <span>Subheading</span>
              <textarea rows={3} value={form.subheading || ""} onChange={set("subheading")} placeholder="Optional" />
            </label>
            <div className="cm-row">
              <label className="cm-field">
                <span>Primary CTA text</span>
                <input value={form.primary_cta_text || ""} onChange={set("primary_cta_text")} placeholder="e.g. Get Started" />
              </label>
              <label className="cm-field">
                <span>Primary CTA link</span>
                <input value={form.primary_cta_link || ""} onChange={set("primary_cta_link")} placeholder="/signup" />
              </label>
            </div>
            <div className="cm-row">
              <label className="cm-field">
                <span>Secondary CTA text</span>
                <input value={form.secondary_cta_text || ""} onChange={set("secondary_cta_text")} placeholder="Optional" />
              </label>
              <label className="cm-field">
                <span>Secondary CTA link</span>
                <input value={form.secondary_cta_link || ""} onChange={set("secondary_cta_link")} placeholder="Optional" />
              </label>
            </div>
            <label className="cm-field">
              <span>Image</span>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file && <small className="cm-file-name">{file.name}</small>}
            </label>
            <label className="cm-field">
              <span>Image URL (used if no image file is uploaded)</span>
              <input value={form.image_url || ""} onChange={set("image_url")} placeholder="Optional" />
            </label>
            <div className="cm-row">
              <label className="cm-field">
                <span>Order</span>
                <input type="number" min="0" value={form.order ?? 0} onChange={set("order")} />
              </label>
              <label className="cm-check" style={{ alignSelf: "center" }}>
                <input type="checkbox" checked={form.is_active ?? true} onChange={set("is_active")} />
                <span>Active</span>
              </label>
            </div>
            <p className="cm-hint">
              The public site shows the first active banner, ordered by "Order" — set several and flip
              which one is active to schedule a swap.
            </p>
          </>
        )}

        {type === "category" && (
          <>
            <div className="cm-row">
              <label className="cm-field">
                <span>Name</span>
                <input value={form.name || ""} onChange={set("name")} placeholder="e.g. School Education" autoFocus />
              </label>
              <label className="cm-field">
                <span>Tagline</span>
                <input value={form.tagline || ""} onChange={set("tagline")} placeholder="e.g. Classes 8–12 · CBSE, NCERT & MBSE" />
              </label>
            </div>
            <label className="cm-field">
              <span>Pills (comma-separated)</span>
              <input value={form.pills || ""} onChange={set("pills")} placeholder="Mathematics, Science, English, Social Studies" />
            </label>
            <label className="cm-field">
              <span>Stat line</span>
              <input value={form.stat_text || ""} onChange={set("stat_text")} placeholder="e.g. Board-aligned live & recorded classes" />
            </label>
            <div className="cm-row">
              <label className="cm-field">
                <span>Button text</span>
                <input value={form.cta_text || ""} onChange={set("cta_text")} placeholder="e.g. Explore School Courses" />
              </label>
              <label className="cm-field">
                <span>Button link</span>
                <input value={form.link_path || ""} onChange={set("link_path")} placeholder="/courses" />
              </label>
            </div>
            <div className="cm-row">
              <label className="cm-field">
                <span>Icon</span>
                <select value={form.icon || "school"} onChange={set("icon")}>
                  {ICONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="cm-field">
                <span>Gradient</span>
                <select value={form.gradient || "green"} onChange={set("gradient")}>
                  {GRADIENTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>
            <div className="cm-row">
              <label className="cm-field">
                <span>Order</span>
                <input type="number" min="0" value={form.order ?? 0} onChange={set("order")} />
              </label>
              <label className="cm-check" style={{ alignSelf: "center" }}>
                <input type="checkbox" checked={form.is_active ?? true} onChange={set("is_active")} />
                <span>Active</span>
              </label>
            </div>
          </>
        )}

        {type === "cta" && (
          <>
            <div className="cm-row">
              <label className="cm-field">
                <span>Eyebrow</span>
                <input value={form.eyebrow || ""} onChange={set("eyebrow")} placeholder="e.g. Start Your Journey" autoFocus />
              </label>
              <label className="cm-field">
                <span>Heading</span>
                <input value={form.heading || ""} onChange={set("heading")} placeholder="e.g. Your learning starts here" />
              </label>
            </div>
            <label className="cm-field">
              <span>Subheading</span>
              <textarea rows={3} value={form.subheading || ""} onChange={set("subheading")} placeholder="Optional" />
            </label>
            <div className="cm-row">
              <label className="cm-field">
                <span>Primary button text</span>
                <input value={form.primary_text || ""} onChange={set("primary_text")} placeholder="e.g. Create free account" />
              </label>
              <label className="cm-field">
                <span>Primary button link</span>
                <input value={form.primary_link || ""} onChange={set("primary_link")} placeholder="/signup" />
              </label>
            </div>
            <div className="cm-row">
              <label className="cm-field">
                <span>Secondary button text</span>
                <input value={form.secondary_text || ""} onChange={set("secondary_text")} placeholder="e.g. Browse as guest" />
              </label>
              <label className="cm-field">
                <span>Secondary button link</span>
                <input value={form.secondary_link || ""} onChange={set("secondary_link")} placeholder="Optional — blank scrolls to Browse Categories" />
              </label>
            </div>
            <div className="cm-row">
              <label className="cm-field">
                <span>Order</span>
                <input type="number" min="0" value={form.order ?? 0} onChange={set("order")} />
              </label>
              <label className="cm-check" style={{ alignSelf: "center" }}>
                <input type="checkbox" checked={form.is_active ?? true} onChange={set("is_active")} />
                <span>Active</span>
              </label>
            </div>
            <p className="cm-hint">
              The public site shows the first active CTA, ordered by "Order".
            </p>
          </>
        )}

        {error && <div className="cm-form-error">{error}</div>}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="confirm-ok" onClick={() => onSubmit(form, file)} disabled={busy}>
            {busy ? "Saving…" : mode === "edit" ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Page ───────────────────────────── */
const HomeCms = () => {
  const [tab, setTab] = useState("hero");

  const [heroes, setHeroes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ctas, setCtas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(null);     // { type, mode, initial }
  const [confirm, setConfirm] = useState(null);  // { kind, item, message, error? }
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const loadHeroes = useCallback(async () => {
    setLoading(true);
    setHeroes(await getHeroBanners());
    setLoading(false);
  }, []);
  const loadCategories = useCallback(async () => {
    setLoading(true);
    setCategories(await getHomeCategoriesAdmin());
    setLoading(false);
  }, []);
  const loadCtas = useCallback(async () => {
    setLoading(true);
    setCtas(await getHomeCtas());
    setLoading(false);
  }, []);

  const loadTab = useCallback((t) => {
    if (t === "hero") return loadHeroes();
    if (t === "categories") return loadCategories();
    return loadCtas();
  }, [loadHeroes, loadCategories, loadCtas]);

  useEffect(() => { loadTab(tab); }, [tab, loadTab]);

  const openCreate = (type, initial = {}) => { setFormError(""); setModal({ type, mode: "create", initial }); };
  const openEdit = (type, initial) => { setFormError(""); setModal({ type, mode: "edit", initial }); };

  const handleSubmit = async (form, file) => {
    setBusy(true); setFormError("");
    try {
      if (modal.type === "hero") {
        const payload = file
          ? (() => {
              const fd = new FormData();
              fd.append("eyebrow", form.eyebrow || "");
              fd.append("heading", form.heading || "");
              fd.append("heading_highlight", form.heading_highlight || "");
              fd.append("subheading", form.subheading || "");
              fd.append("primary_cta_text", form.primary_cta_text || "Get Started");
              fd.append("primary_cta_link", form.primary_cta_link || "/signup");
              fd.append("secondary_cta_text", form.secondary_cta_text || "");
              fd.append("secondary_cta_link", form.secondary_cta_link || "");
              fd.append("image_url", form.image_url || "");
              fd.append("order", parseInt(form.order, 10) || 0);
              fd.append("is_active", form.is_active ?? true);
              fd.append("image", file);
              return fd;
            })()
          : {
              eyebrow: form.eyebrow || "",
              heading: form.heading || "",
              heading_highlight: form.heading_highlight || "",
              subheading: form.subheading || "",
              primary_cta_text: form.primary_cta_text || "Get Started",
              primary_cta_link: form.primary_cta_link || "/signup",
              secondary_cta_text: form.secondary_cta_text || "",
              secondary_cta_link: form.secondary_cta_link || "",
              image_url: form.image_url || "",
              order: parseInt(form.order, 10) || 0,
              is_active: form.is_active ?? true,
            };
        if (modal.mode === "edit") await updateHeroBanner(modal.initial.id, payload);
        else await createHeroBanner(payload);
        setModal(null);
        await loadHeroes();
      } else if (modal.type === "category") {
        const payload = {
          name: (form.name || "").trim(),
          tagline: form.tagline || "",
          pills: typeof form.pills === "string"
            ? form.pills.split(",").map((s) => s.trim()).filter(Boolean)
            : (form.pills || []),
          stat_text: form.stat_text || "",
          cta_text: form.cta_text || "Explore",
          link_path: form.link_path || "/courses",
          icon: form.icon || "school",
          gradient: form.gradient || "green",
          order: parseInt(form.order, 10) || 0,
          is_active: form.is_active ?? true,
        };
        if (modal.mode === "edit") await updateHomeCategory(modal.initial.id, payload);
        else await createHomeCategory(payload);
        setModal(null);
        await loadCategories();
      } else if (modal.type === "cta") {
        const payload = {
          eyebrow: form.eyebrow || "",
          heading: form.heading || "",
          subheading: form.subheading || "",
          primary_text: form.primary_text || "Create free account",
          primary_link: form.primary_link || "/signup",
          secondary_text: form.secondary_text || "",
          secondary_link: form.secondary_link || "",
          order: parseInt(form.order, 10) || 0,
          is_active: form.is_active ?? true,
        };
        if (modal.mode === "edit") await updateHomeCta(modal.initial.id, payload);
        else await createHomeCta(payload);
        setModal(null);
        await loadCtas();
      }
    } catch (e) {
      setFormError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    const { kind, item } = confirm;
    setBusy(true);
    try {
      if (kind === "hero") { await deleteHeroBanner(item.id); setConfirm(null); await loadHeroes(); }
      else if (kind === "category") { await deleteHomeCategory(item.id); setConfirm(null); await loadCategories(); }
      else if (kind === "cta") { await deleteHomeCta(item.id); setConfirm(null); await loadCtas(); }
    } catch (e) {
      setConfirm((c) => ({ ...c, error: errText(e) }));
    } finally {
      setBusy(false);
    }
  };

  const renderHeroes = () => (
    <div className="dashboard-card courses-table-card">
      <div className="cm-card-head">
        <div className="courses-count">{heroes.length} banner{heroes.length !== 1 ? "s" : ""}</div>
        <button className="cm-add-btn" onClick={() => openCreate("hero", { is_active: true, order: heroes.length })}>
          + New Banner
        </button>
      </div>
      {loading ? (
        <div className="dashboard-loading">Loading…</div>
      ) : heroes.length === 0 ? (
        <div className="dashboard-loading">No hero banners yet — the home page falls back to its built-in copy.</div>
      ) : (
        <table className="courses-table">
          <thead>
            <tr><th>Heading</th><th>Order</th><th>Status</th><th aria-label="actions" /></tr>
          </thead>
          <tbody>
            {heroes.map((h) => (
              <tr key={h.id}>
                <td className="courses-title">
                  {h.heading} {h.heading_highlight && <em>{h.heading_highlight}</em>}
                </td>
                <td>{h.order}</td>
                <td>
                  <StatusBadge color={h.is_active ? "green" : "gray"}>
                    {h.is_active ? "Active" : "Hidden"}
                  </StatusBadge>
                </td>
                <td className="cm-actions">
                  <button className="cm-icon-btn" onClick={() => openEdit("hero", {
                    id: h.id, eyebrow: h.eyebrow, heading: h.heading,
                    heading_highlight: h.heading_highlight, subheading: h.subheading,
                    primary_cta_text: h.primary_cta_text, primary_cta_link: h.primary_cta_link,
                    secondary_cta_text: h.secondary_cta_text, secondary_cta_link: h.secondary_cta_link,
                    image_url: h.image_url, order: h.order, is_active: h.is_active,
                  })}>Edit</button>
                  <button className="cm-icon-btn cm-icon-btn--danger"
                    onClick={() => setConfirm({ kind: "hero", item: h, message: `Delete this hero banner? The home page falls back to its built-in copy if none are left.` })}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderCategories = () => (
    <div className="dashboard-card courses-table-card">
      <div className="cm-card-head">
        <div className="courses-count">{categories.length} categor{categories.length !== 1 ? "ies" : "y"}</div>
        <button className="cm-add-btn" onClick={() => openCreate("category", { is_active: true, order: categories.length, icon: "school", gradient: "green" })}>
          + New Category
        </button>
      </div>
      {loading ? (
        <div className="dashboard-loading">Loading…</div>
      ) : categories.length === 0 ? (
        <div className="dashboard-loading">No categories yet — the home page falls back to its built-in cards.</div>
      ) : (
        <table className="courses-table">
          <thead>
            <tr><th>Name</th><th>Gradient</th><th>Order</th><th>Status</th><th aria-label="actions" /></tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="courses-title">{c.name}</td>
                <td>{GRADIENTS.find((g) => g.value === c.gradient)?.label || c.gradient}</td>
                <td>{c.order}</td>
                <td>
                  <StatusBadge color={c.is_active ? "green" : "gray"}>
                    {c.is_active ? "Active" : "Hidden"}
                  </StatusBadge>
                </td>
                <td className="cm-actions">
                  <button className="cm-icon-btn" onClick={() => openEdit("category", {
                    id: c.id, name: c.name, tagline: c.tagline,
                    pills: (c.pills || []).join(", "), stat_text: c.stat_text,
                    cta_text: c.cta_text, link_path: c.link_path, icon: c.icon,
                    gradient: c.gradient, order: c.order, is_active: c.is_active,
                  })}>Edit</button>
                  <button className="cm-icon-btn cm-icon-btn--danger"
                    onClick={() => setConfirm({ kind: "category", item: c, message: `Delete category "${c.name}"?` })}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderCtas = () => (
    <div className="dashboard-card courses-table-card">
      <div className="cm-card-head">
        <div className="courses-count">{ctas.length} CTA{ctas.length !== 1 ? "s" : ""}</div>
        <button className="cm-add-btn" onClick={() => openCreate("cta", { is_active: true, order: ctas.length })}>
          + New CTA
        </button>
      </div>
      {loading ? (
        <div className="dashboard-loading">Loading…</div>
      ) : ctas.length === 0 ? (
        <div className="dashboard-loading">No CTAs yet — the home page falls back to its built-in copy.</div>
      ) : (
        <table className="courses-table">
          <thead>
            <tr><th>Heading</th><th>Order</th><th>Status</th><th aria-label="actions" /></tr>
          </thead>
          <tbody>
            {ctas.map((c) => (
              <tr key={c.id}>
                <td className="courses-title">{c.heading}</td>
                <td>{c.order}</td>
                <td>
                  <StatusBadge color={c.is_active ? "green" : "gray"}>
                    {c.is_active ? "Active" : "Hidden"}
                  </StatusBadge>
                </td>
                <td className="cm-actions">
                  <button className="cm-icon-btn" onClick={() => openEdit("cta", {
                    id: c.id, eyebrow: c.eyebrow, heading: c.heading, subheading: c.subheading,
                    primary_text: c.primary_text, primary_link: c.primary_link,
                    secondary_text: c.secondary_text, secondary_link: c.secondary_link,
                    order: c.order, is_active: c.is_active,
                  })}>Edit</button>
                  <button className="cm-icon-btn cm-icon-btn--danger"
                    onClick={() => setConfirm({ kind: "cta", item: c, message: `Delete this CTA?` })}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Home Page CMS</h1>

      <div className="courses-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`courses-tab${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "hero" && renderHeroes()}
      {tab === "categories" && renderCategories()}
      {tab === "cta" && renderCtas()}

      {modal && (
        <FormModal
          type={modal.type}
          mode={modal.mode}
          initial={modal.initial}
          busy={busy}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={() => setModal(null)}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={`Delete ${confirm.kind}`}
          message={confirm.message}
          extra={confirm.error ? <div className="cm-form-error">{confirm.error}</div> : null}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default HomeCms;
