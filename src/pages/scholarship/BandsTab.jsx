import { useEffect, useState } from "react";
import {
  getScholarshipBands, createScholarshipBand, updateScholarshipBand, deleteScholarshipBand,
} from "../../api/admin_scholarship";
import ConfirmModal from "../../components/ConfirmModal";
import { errText } from "../../utils/errText";

function BandFormModal({ mode, initial, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    min_correct: initial?.min_correct ?? 0,
    max_correct: initial?.max_correct ?? 0,
    discount_pct: initial?.discount_pct ?? 0,
    is_active: initial?.is_active ?? true,
  });
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = () => {
    onSubmit({
      min_correct: Number(form.min_correct),
      max_correct: Number(form.max_correct),
      discount_pct: Number(form.discount_pct),
      is_active: form.is_active,
    });
  };

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === "edit" ? "Edit Band" : "New Band"}</h3>
        <div className="cm-row">
          <label className="cm-field">
            <span>Min correct</span>
            <input type="number" min={0} value={form.min_correct} onChange={set("min_correct")} autoFocus />
          </label>
          <label className="cm-field">
            <span>Max correct</span>
            <input type="number" min={0} value={form.max_correct} onChange={set("max_correct")} />
          </label>
        </div>
        <label className="cm-field">
          <span>Discount %</span>
          <input type="number" min={0} max={100} value={form.discount_pct} onChange={set("discount_pct")} />
        </label>
        <label className="cm-check" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={form.is_active} onChange={set("is_active")} />
          <span>Active</span>
        </label>

        {error && <div className="cm-form-error">{error}</div>}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="confirm-ok" onClick={submit} disabled={busy || Number(form.min_correct) > Number(form.max_correct)}>
            {busy ? "Saving…" : mode === "edit" ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BandsTab({ onAction }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const notify = (msg) => onAction && onAction(msg);

  const load = async () => {
    setLoading(true);
    const d = await getScholarshipBands();
    setRows((Array.isArray(d) ? d : d.results || []).sort((a, b) => b.min_correct - a.min_correct));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (payload) => {
    setBusy(true); setFormError("");
    try {
      if (modal.mode === "edit") {
        const updated = await updateScholarshipBand(modal.initial.id, payload);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)).sort((a, b) => b.min_correct - a.min_correct));
        notify(`Updated band ${updated.min_correct}-${updated.max_correct}`);
      } else {
        const created = await createScholarshipBand(payload);
        setRows((prev) => [...prev, created].sort((a, b) => b.min_correct - a.min_correct));
        notify(`Created band ${created.min_correct}-${created.max_correct}`);
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
      await deleteScholarshipBand(confirm.item.id);
      setRows((prev) => prev.filter((r) => r.id !== confirm.item.id));
      notify(`Deleted band ${confirm.item.min_correct}-${confirm.item.max_correct}`);
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
        <div className="courses-count" style={{ padding: 0 }}>{rows.length} band{rows.length !== 1 ? "s" : ""}</div>
        <div className="cms-toolbar-spacer" />
        <button className="cm-add-btn" onClick={() => { setFormError(""); setModal({ mode: "create", initial: {} }); }}>
          + New Band
        </button>
      </div>

      <div className="dashboard-card courses-table-card">
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No bands configured — no scholarship can be awarded until at least one exists.</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>Correct answers</th><th>Discount</th><th>Status</th><th aria-label="actions" /></tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td className="courses-title">{b.min_correct}–{b.max_correct}</td>
                  <td>{b.discount_pct}%</td>
                  <td>
                    <span className={`mod-badge ${b.is_active ? "pal-green" : "pal-gray"}`}>
                      {b.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="cm-actions">
                    <button className="cm-icon-btn" onClick={() => { setFormError(""); setModal({ mode: "edit", initial: b }); }}>Edit</button>
                    <button className="cm-icon-btn cm-icon-btn--danger" onClick={() => setConfirm({ item: b })}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <BandFormModal
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
          title="Delete Band"
          message={`Delete the ${confirm.item.min_correct}-${confirm.item.max_correct} band? Past awards already granted at this band are unaffected — only future scoring changes.`}
          extra={confirm.error ? <div className="cm-form-error">{confirm.error}</div> : null}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
