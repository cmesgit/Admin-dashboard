import { useEffect, useState } from "react";
import {
  getCourseCategories, createCourseCategory, updateCourseCategory, deleteCourseCategory,
} from "../../api/admin";
import ConfirmModal from "../../components/ConfirmModal";
import { errText } from "../../utils/errText";

// Same three groups CourseCategory.GROUP_CHOICES defines server-side — powers
// the public catalog's category/group filters and the navbar's "competitive"
// tab.
const GROUP_CHOICES = [
  ["boards", "Boards"],
  ["class8-12", "Class 8-12"],
  ["competitive", "Competitive"],
];
const GROUP_LABEL = Object.fromEntries(GROUP_CHOICES);

/* ───────────────────────── Create/Edit modal ───────────────────────── */
function CategoryFormModal({ mode, initial, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    group: initial?.group || "boards",
    blurb: initial?.blurb || "",
    icon: initial?.icon || "",
    display_order: initial?.display_order ?? 0,
    is_active: initial?.is_active ?? true,
  });

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = () => {
    onSubmit({
      name: form.name.trim(),
      group: form.group,
      blurb: form.blurb,
      icon: form.icon.trim(),
      display_order: parseInt(form.display_order, 10) || 0,
      is_active: form.is_active,
    });
  };

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === "edit" ? "Edit Category" : "New Category"}</h3>

        <label className="cm-field">
          <span>Name</span>
          <input value={form.name} onChange={set("name")} placeholder="e.g. CBSE" autoFocus />
        </label>

        {mode === "edit" && initial?.slug && (
          <p className="cm-hint">Slug: <code>{initial.slug}</code> (auto-generated, read-only)</p>
        )}

        <label className="cm-field">
          <span>Group</span>
          <select value={form.group} onChange={set("group")}>
            {GROUP_CHOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>

        <label className="cm-field">
          <span>Blurb</span>
          <textarea rows={2} value={form.blurb} onChange={set("blurb")} placeholder="Short description shown under the category" />
        </label>

        <div className="cm-row">
          <label className="cm-field">
            <span>Icon</span>
            <input value={form.icon} onChange={set("icon")} placeholder="e.g. book" />
          </label>
          <label className="cm-field">
            <span>Display order</span>
            <input type="number" value={form.display_order} onChange={set("display_order")} />
          </label>
        </div>

        <label className="cm-check">
          <input type="checkbox" checked={form.is_active} onChange={set("is_active")} />
          <span>Active (visible on the public site)</span>
        </label>

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
  const [modal, setModal] = useState(null); // { mode, initial }
  const [confirm, setConfirm] = useState(null); // { item, error? }
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const notify = (msg) => onAction && onAction(msg);

  const load = async () => {
    setLoading(true);
    const d = await getCourseCategories();
    setRows(Array.isArray(d) ? d : d.results || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (payload) => {
    setBusy(true); setFormError("");
    try {
      if (modal.mode === "edit") {
        const updated = await updateCourseCategory(modal.initial.id, payload);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        notify(`Updated category "${updated.name}"`);
      } else {
        const created = await createCourseCategory(payload);
        setRows((prev) => [...prev, created]);
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
      await deleteCourseCategory(confirm.item.id);
      setRows((prev) => prev.filter((r) => r.id !== confirm.item.id));
      notify(`Deleted category "${confirm.item.name}"`);
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
          <div className="dashboard-loading">No categories yet. Create one to power the course multi-select and catalog filters.</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>Name</th><th>Slug</th><th>Group</th><th>Order</th><th>Status</th><th aria-label="actions" /></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="courses-title">{c.icon ? `${c.icon} ` : ""}{c.name}</td>
                  <td><span className="cm-code">{c.slug}</span></td>
                  <td><span className="mod-badge pal-blue">{GROUP_LABEL[c.group] || c.group}</span></td>
                  <td>{c.display_order}</td>
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
          message={`Delete category "${confirm.item.name}"? Courses using it will simply lose this tag. This can't be undone.`}
          extra={confirm.error ? <div className="cm-form-error">{confirm.error}</div> : null}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default Categories;
