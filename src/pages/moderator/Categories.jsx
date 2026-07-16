import { useEffect, useState } from "react";
import {
  getModCategories, createModCategory, updateModCategory,
  deleteModCategory, restoreModCategory,
} from "../../api/admin";
import ConfirmModal from "../../components/ConfirmModal";
import { errText } from "../../utils/errText";

/* ───────────────────────── Create/Edit modal ───────────────────────── */
function CategoryFormModal({ mode, initial, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    slug: initial?.id || "",
    desc: initial?.desc || "",
    initials: initial?.initials || "",
    color: initial?.color || "#125027",
    topic: initial?.topic || "",
    order: initial?.order ?? 0,
  });
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = () => onSubmit({
    name: form.name.trim(),
    slug: form.slug.trim() || undefined,
    description: form.desc.trim(),
    initials: form.initials.trim(),
    color: form.color.trim(),
    topic: form.topic.trim(),
    order: Number(form.order) || 0,
  });

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === "edit" ? "Edit Category" : "New Category"}</h3>

        <label className="cm-field">
          <span>Name</span>
          <input value={form.name} onChange={set("name")} placeholder="e.g. Career Guidance" autoFocus />
        </label>

        <label className="cm-field">
          <span>Slug</span>
          <input value={form.slug} onChange={set("slug")} placeholder="auto-generated from name if left blank" />
        </label>

        <label className="cm-field">
          <span>Description</span>
          <input value={form.desc} onChange={set("desc")} placeholder="Shown on the category tile" />
        </label>

        <label className="cm-field">
          <span>Topic tag</span>
          <input value={form.topic} onChange={set("topic")} placeholder="Which question tag this category groups" />
        </label>

        <div style={{ display: "flex", gap: 12 }}>
          <label className="cm-field" style={{ flex: 1 }}>
            <span>Initials</span>
            <input value={form.initials} onChange={set("initials")} maxLength={4} placeholder="CG" />
          </label>
          <label className="cm-field" style={{ flex: 1 }}>
            <span>Color</span>
            <input type="color" value={form.color} onChange={set("color")} />
          </label>
          <label className="cm-field" style={{ flex: 1 }}>
            <span>Order</span>
            <input type="number" min={0} value={form.order} onChange={set("order")} />
          </label>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
          <span className="mod-avatar" style={{ background: form.color }}>
            {form.initials || "??"}
          </span>
          <span>{form.name || "Category name"}</span>
        </div>

        {error && <div className="cm-form-error">{error}</div>}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="confirm-ok" onClick={submit} disabled={busy || !form.name.trim()}>
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
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // { mode, initial }
  const [confirm, setConfirm] = useState(null); // { item, error? }
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const notify = (msg) => onAction && onAction(msg);

  const load = async () => {
    setLoading(true);
    const d = await getModCategories();
    setRows(d.results || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = rows.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  const handleSubmit = async (payload) => {
    setBusy(true); setFormError("");
    try {
      if (modal.mode === "edit") {
        const updated = await updateModCategory(modal.initial.id, payload);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        notify(`Updated category "${updated.name}"`);
      } else {
        const created = await createModCategory(payload);
        setRows((prev) => [created, ...prev]);
        notify(`Created category "${created.name}"`);
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
      await deleteModCategory(confirm.item.id);
      setRows((prev) => prev.map((r) => (r.id === confirm.item.id ? { ...r, is_active: false } : r)));
      notify(`Deactivated category "${confirm.item.name}"`);
      setConfirm(null);
    } catch (e) {
      setConfirm((c) => ({ ...c, error: errText(e) }));
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (item) => {
    setBusy(true);
    try {
      await restoreModCategory(item.id);
      setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, is_active: true } : r)));
      notify(`Restored category "${item.name}"`);
    } catch (e) {
      notify(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="cms-toolbar">
        <input
          className="mod-search"
          style={{ maxWidth: 320 }}
          placeholder="Search categories…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="cms-toolbar-spacer" />
        <button className="cm-add-btn" onClick={() => { setFormError(""); setModal({ mode: "create", initial: {} }); }}>
          + New Category
        </button>
      </div>

      <div className="dashboard-card courses-table-card">
        <div className="courses-count">{visible.length} categor{visible.length !== 1 ? "ies" : "y"}</div>
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="dashboard-loading">No categories yet. Create one to let students browse questions by topic.</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>Category</th><th>Slug</th><th>Topic</th><th>Order</th><th>Status</th><th aria-label="actions" /></tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.55 }}>
                  <td className="courses-title">
                    <div className="mod-person">
                      <span className="mod-avatar" style={{ background: c.color }}>{c.initials}</span>
                      <div>{c.name}</div>
                    </div>
                  </td>
                  <td><span className="cm-code">{c.id}</span></td>
                  <td>{c.topic}</td>
                  <td>{c.order}</td>
                  <td>{c.is_active ? "Active" : "Inactive"}</td>
                  <td className="cm-actions">
                    <button className="cm-icon-btn" onClick={() => { setFormError(""); setModal({ mode: "edit", initial: c }); }}>Edit</button>
                    {c.is_active ? (
                      <button className="cm-icon-btn cm-icon-btn--danger" onClick={() => setConfirm({ item: c })}>Delete</button>
                    ) : (
                      <button className="cm-icon-btn" onClick={() => handleRestore(c)} disabled={busy}>Restore</button>
                    )}
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
          message={`Deactivate category "${confirm.item.name}"? It will disappear from the forum but can be restored later.`}
          extra={confirm.error ? <div className="cm-form-error">{confirm.error}</div> : null}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default Categories;
