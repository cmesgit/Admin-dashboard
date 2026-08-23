import { useEffect, useState } from "react";
import {
  getContentAnnouncements, createContentAnnouncement, updateContentAnnouncement, deleteContentAnnouncement,
} from "../../api/admin";
import ConfirmModal from "../../components/ConfirmModal";
import { errText } from "../../utils/errText";
import { isoToLocalInput, localInputToIso } from "../../utils/datetimeLocal";

const LEVEL_CHOICES = [["info", "Info"], ["success", "Success"], ["warning", "Warning"]];
const LEVEL_PAL = { info: "pal-blue", success: "pal-green", warning: "pal-yellow" };

const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/* ───────────────────────── Create/Edit modal ───────────────────────── */
function AnnouncementFormModal({ mode, initial, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    message: initial?.message || "",
    link_url: initial?.link_url || "",
    link_label: initial?.link_label || "",
    level: initial?.level || "info",
    starts_at: isoToLocalInput(initial?.starts_at) || isoToLocalInput(new Date().toISOString()),
    ends_at: isoToLocalInput(initial?.ends_at),
    order: initial?.order ?? 0,
    is_active: initial?.is_active ?? true,
  });

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = () => {
    onSubmit({
      message: form.message.trim(),
      link_url: form.link_url.trim(),
      link_label: form.link_label.trim(),
      level: form.level,
      starts_at: localInputToIso(form.starts_at),
      ends_at: form.ends_at ? localInputToIso(form.ends_at) : null,
      order: parseInt(form.order, 10) || 0,
      is_active: form.is_active,
    });
  };

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === "edit" ? "Edit Announcement" : "New Announcement"}</h3>

        <label className="cm-field">
          <span>Message</span>
          <textarea rows={3} value={form.message} onChange={set("message")} placeholder="e.g. Enrollment for the new batch opens Monday." autoFocus />
        </label>

        <div className="cm-row">
          <label className="cm-field">
            <span>Link URL (optional)</span>
            <input value={form.link_url} onChange={set("link_url")} placeholder="/courses" />
          </label>
          <label className="cm-field">
            <span>Link label (optional)</span>
            <input value={form.link_label} onChange={set("link_label")} placeholder="Learn more" />
          </label>
        </div>

        <label className="cm-field">
          <span>Level</span>
          <select value={form.level} onChange={set("level")}>
            {LEVEL_CHOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>

        <div className="cm-row">
          <label className="cm-field">
            <span>Starts at</span>
            <input type="datetime-local" value={form.starts_at} onChange={set("starts_at")} />
          </label>
          <label className="cm-field">
            <span>Ends at</span>
            <input type="datetime-local" value={form.ends_at} onChange={set("ends_at")} />
          </label>
        </div>
        <p className="cm-hint">Leave "Ends at" empty to run indefinitely.</p>

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
          <button className="confirm-ok" onClick={submit} disabled={busy || !form.message.trim()}>
            {busy ? "Saving…" : mode === "edit" ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

const Announcements = ({ onAction }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const notify = (msg) => onAction && onAction(msg);

  const load = async () => {
    setLoading(true);
    const d = await getContentAnnouncements();
    setLoadError(!!d?.__failed);
    setRows(Array.isArray(d) ? d : d.results || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (payload) => {
    setBusy(true); setFormError("");
    try {
      if (modal.mode === "edit") {
        const updated = await updateContentAnnouncement(modal.initial.id, payload);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        notify("Announcement updated");
      } else {
        const created = await createContentAnnouncement(payload);
        setRows((prev) => [...prev, created]);
        notify("Announcement created");
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
      await deleteContentAnnouncement(confirm.item.id);
      setRows((prev) => prev.filter((r) => r.id !== confirm.item.id));
      notify("Announcement deleted");
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
        <div className="cms-toolbar-spacer" />
        <button className="cm-add-btn" onClick={() => { setFormError(""); setModal({ mode: "create", initial: {} }); }}>
          + New Announcement
        </button>
      </div>

      <div className="dashboard-card courses-table-card">
        <div className="courses-count">{rows.length} announcement{rows.length !== 1 ? "s" : ""}</div>
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : loadError ? (
          <div className="dashboard-loading">Couldn't load announcements. <button className="cm-icon-btn" onClick={load}>Retry</button></div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No announcements yet.</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>Message</th><th>Level</th><th>Window</th><th>Status</th><th aria-label="actions" /></tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="courses-title courses-desc" style={{ maxWidth: 340 }}>{a.message}</td>
                  <td><span className={`mod-badge ${LEVEL_PAL[a.level] || "pal-gray"}`}>{a.level}</span></td>
                  <td style={{ fontSize: "0.82rem", color: "#6b7280" }}>
                    {formatDateTime(a.starts_at)} → {a.ends_at ? formatDateTime(a.ends_at) : "indefinite"}
                  </td>
                  <td>
                    <span className={`mod-badge ${a.is_active ? "pal-green" : "pal-gray"}`}>
                      {a.is_active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="cm-actions">
                    <button className="cm-icon-btn" onClick={() => { setFormError(""); setModal({ mode: "edit", initial: a }); }}>Edit</button>
                    <button className="cm-icon-btn cm-icon-btn--danger" onClick={() => setConfirm({ item: a })}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <AnnouncementFormModal
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
          title="Delete Announcement"
          message="Delete this announcement? This can't be undone."
          extra={confirm.error ? <div className="cm-form-error">{confirm.error}</div> : null}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default Announcements;
