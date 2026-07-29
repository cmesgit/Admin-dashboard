import { useEffect, useState } from "react";
import {
  getAdminSkillCategories, createSkillCategory, updateSkillCategory, deleteSkillCategory,
} from "../../api/admin";
import ConfirmModal from "../../components/ConfirmModal";
import ImageUploadField from "../../components/ImageUploadField";
import { errText } from "../../utils/errText";
import { buildBody } from "../../utils/buildBody";

/* ───────────────────────── Create/Edit modal ───────────────────────── */
function CategoryFormModal({ mode, initial, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    slug: initial?.slug || "",
    label: initial?.label || "",
    icon: initial?.icon || "",
    color: initial?.color || "",
    order: initial?.order ?? 0,
    is_active: initial?.is_active ?? true,
  });
  const [file, setFile] = useState(null);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = () => {
    const payload = {
      slug: form.slug.trim(),
      label: form.label.trim(),
      icon: form.icon.trim(),
      color: form.color.trim(),
      order: parseInt(form.order, 10) || 0,
      is_active: form.is_active,
    };
    onSubmit(payload, file);
  };

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === "edit" ? "Edit Category" : "New Category"}</h3>

        <div className="cm-row">
          <label className="cm-field">
            <span>Label</span>
            <input value={form.label} onChange={set("label")} placeholder="e.g. Coding & Web" autoFocus />
          </label>
          <label className="cm-field">
            <span>Slug</span>
            <input value={form.slug} onChange={set("slug")} placeholder="e.g. coding" />
          </label>
        </div>

        <div className="cm-row">
          <label className="cm-field">
            <span>Icon (emoji glyph, fallback when no image)</span>
            <input value={form.icon} onChange={set("icon")} placeholder="e.g. 💻" />
          </label>
          <label className="cm-field">
            <span>Color (hex accent)</span>
            <input value={form.color} onChange={set("color")} placeholder="#4f6df5" />
          </label>
        </div>

        <label className="cm-field">
          <span>Image (optional — used instead of the icon chip when set)</span>
          <ImageUploadField
            value={file}
            onChange={setFile}
            previewUrl={initial?.image}
            previewClassName="cm-thumb"
          />
        </label>

        <div className="cm-row">
          <label className="cm-field">
            <span>Order</span>
            <input type="number" value={form.order} onChange={set("order")} />
          </label>
          <label className="cm-check" style={{ marginTop: 26 }}>
            <input type="checkbox" checked={form.is_active} onChange={set("is_active")} />
            <span>Active (visible on the public site)</span>
          </label>
        </div>

        {error && <div className="cm-form-error">{error}</div>}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="confirm-ok" onClick={submit} disabled={busy || !form.label.trim() || !form.slug.trim()}>
            {busy ? "Saving…" : mode === "edit" ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

const Categories = ({ onAction }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const notify = (msg) => onAction && onAction(msg);

  const load = async () => {
    setLoading(true);
    const d = await getAdminSkillCategories();
    setRows(Array.isArray(d) ? d : d.results || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (payload, file) => {
    setBusy(true); setFormError("");
    try {
      const { data, isMultipart } = buildBody(payload, file);
      if (modal.mode === "edit") {
        const updated = await updateSkillCategory(modal.initial.id, data, isMultipart);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        notify(`Updated category "${updated.label}"`);
      } else {
        const created = await createSkillCategory(data, isMultipart);
        setRows((prev) => [...prev, created]);
        notify(`Created category "${created.label}"`);
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
      await deleteSkillCategory(confirm.item.id);
      setRows((prev) => prev.filter((r) => r.id !== confirm.item.id));
      notify(`Deleted category "${confirm.item.label}"`);
      setConfirm(null);
    } catch (e) {
      setConfirm((c) => ({ ...c, error: errText(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="cms-toolbar">
        <div className="courses-count" style={{ padding: 0 }}>{rows.length} categor{rows.length !== 1 ? "ies" : "y"}</div>
        <div className="cms-toolbar-spacer" />
        <button className="cm-add-btn" onClick={() => { setFormError(""); setModal({ mode: "create", initial: {} }); }}>
          + New Category
        </button>
      </div>

      <div className="dashboard-card courses-table-card">
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No categories yet.</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>Image</th><th>Label</th><th>Slug</th><th>Order</th><th>Status</th><th aria-label="actions" /></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.image ? (
                      <img src={c.image} alt="" className="cm-thumb" />
                    ) : (
                      <span
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 32, height: 32, borderRadius: 8, fontSize: 16,
                          background: c.color || "#e2e8f0",
                        }}
                      >
                        {c.icon}
                      </span>
                    )}
                  </td>
                  <td className="courses-title">{c.label}</td>
                  <td><span className="cm-code">{c.slug}</span></td>
                  <td>{c.order}</td>
                  <td>
                    <span className={`mod-badge ${c.is_active ? "pal-green" : "pal-gray"}`}>
                      {c.is_active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="cm-actions">
                    <button className="cm-icon-btn" onClick={() => { setFormError(""); setModal({ mode: "edit", initial: c }); }}>Edit</button>
                    <button className="cm-icon-btn cm-icon-btn--danger" onClick={() => setConfirm({ item: c })}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <CategoryFormModal
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
          title="Delete Category"
          message={`Delete category "${confirm.item.label}"? Experts using it keep their tag but the filter chip disappears. This can't be undone.`}
          extra={confirm.error ? <div className="cm-form-error">{confirm.error}</div> : null}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default Categories;
