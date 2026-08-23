import { useEffect, useState } from "react";
import { getContentTags, createContentTag, updateContentTag, deleteContentTag } from "../../api/admin";
import ConfirmModal from "../../components/ConfirmModal";
import { errText } from "../../utils/errText";

/* ───────────────────────── Create/Edit modal ───────────────────────── */
function TagFormModal({ mode, initial, busy, error, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || "");

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === "edit" ? "Edit Tag" : "New Tag"}</h3>

        <label className="cm-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Board Exams" autoFocus />
        </label>

        {mode === "edit" && initial?.slug && (
          <p className="cm-hint">Slug: <code>{initial.slug}</code> (auto-generated, read-only)</p>
        )}

        {error && <div className="cm-form-error">{error}</div>}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="confirm-ok" onClick={() => onSubmit({ name: name.trim() })} disabled={busy || !name.trim()}>
            {busy ? "Saving…" : mode === "edit" ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

const Tags = ({ onAction }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // { mode, initial }
  const [confirm, setConfirm] = useState(null); // { item, error? }
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const notify = (msg) => onAction && onAction(msg);

  const load = async () => {
    setLoading(true);
    const d = await getContentTags({ q: q || undefined });
    setLoadError(!!d?.__failed);
    setRows(Array.isArray(d) ? d : d.results || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Light debounce so typing in the search box doesn't hammer the API.
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const handleSubmit = async (payload) => {
    setBusy(true); setFormError("");
    try {
      if (modal.mode === "edit") {
        const updated = await updateContentTag(modal.initial.id, payload);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        notify(`Updated tag "${updated.name}"`);
      } else {
        const created = await createContentTag(payload);
        setRows((prev) => [created, ...prev]);
        notify(`Created tag "${created.name}"`);
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
      await deleteContentTag(confirm.item.id);
      setRows((prev) => prev.filter((r) => r.id !== confirm.item.id));
      notify(`Deleted tag "${confirm.item.name}"`);
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
        <input
          className="mod-search"
          style={{ maxWidth: 320 }}
          placeholder="Search tags…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="cms-toolbar-spacer" />
        <button className="cm-add-btn" onClick={() => { setFormError(""); setModal({ mode: "create", initial: {} }); }}>
          + New Tag
        </button>
      </div>

      <div className="dashboard-card courses-table-card">
        <div className="courses-count">{rows.length} tag{rows.length !== 1 ? "s" : ""}</div>
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : loadError ? (
          <div className="dashboard-loading">Couldn't load tags. <button className="cm-icon-btn" onClick={load}>Retry</button></div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No tags yet. Create one to start tagging blog posts and current affairs.</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>Name</th><th>Slug</th><th aria-label="actions" /></tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="courses-title">{t.name}</td>
                  <td><span className="cm-code">{t.slug}</span></td>
                  <td className="cm-actions">
                    <button className="cm-icon-btn" onClick={() => { setFormError(""); setModal({ mode: "edit", initial: t }); }}>Edit</button>
                    <button className="cm-icon-btn cm-icon-btn--danger" onClick={() => setConfirm({ item: t })}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <TagFormModal
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
          title="Delete Tag"
          message={`Delete tag "${confirm.item.name}"? This can't be undone.`}
          extra={confirm.error ? <div className="cm-form-error">{confirm.error}</div> : null}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default Tags;
