import { useEffect, useRef, useState } from "react";
import { getContentFaqs, createContentFaq, updateContentFaq, deleteContentFaq } from "../../api/admin";
import ConfirmModal from "../../components/ConfirmModal";
import HtmlToolbar from "../../components/HtmlToolbar";
import { errText } from "../../utils/errText";

const PAGE_CHOICES = [
  ["home", "Home"],
  ["courses", "Courses"],
  ["counselling", "Counselling"],
  ["skills", "Skills"],
  ["general", "General"],
];
const PAGE_LABEL = Object.fromEntries(PAGE_CHOICES);
const PAGE_FILTERS = [["", "All pages"], ...PAGE_CHOICES];

/* ───────────────────────── Create/Edit modal ───────────────────────── */
function FaqFormModal({ mode, initial, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    page: initial?.page || "general",
    question: initial?.question || "",
    answer_html: initial?.answer_html || "",
    order: initial?.order ?? 0,
    is_active: initial?.is_active ?? true,
  });
  const answerRef = useRef(null);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === "edit" ? "Edit FAQ" : "New FAQ"}</h3>

        <label className="cm-field">
          <span>Page</span>
          <select value={form.page} onChange={set("page")}>
            {PAGE_CHOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>

        <label className="cm-field">
          <span>Question</span>
          <input value={form.question} onChange={set("question")} placeholder="e.g. How do I enroll?" autoFocus />
        </label>

        <label className="cm-field">
          <span>Answer (HTML)</span>
          <HtmlToolbar textareaRef={answerRef} value={form.answer_html} onChange={(v) => setForm((f) => ({ ...f, answer_html: v }))} />
          <textarea ref={answerRef} rows={8} value={form.answer_html} onChange={set("answer_html")} placeholder="<p>Plain HTML — this is rendered as-is on the site.</p>" />
        </label>
        <p className="cm-hint">Plain HTML, not a rich text editor — matches how Django admin itself falls back to a plain textarea for this field.</p>

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
            disabled={busy || !form.question.trim() || !form.answer_html.trim()}
            onClick={() => onSubmit({
              page: form.page,
              question: form.question.trim(),
              answer_html: form.answer_html,
              order: parseInt(form.order, 10) || 0,
              is_active: form.is_active,
            })}
          >
            {busy ? "Saving…" : mode === "edit" ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

const Faqs = ({ onAction }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [page, setPage] = useState("");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const notify = (msg) => onAction && onAction(msg);

  const load = async () => {
    setLoading(true);
    // Filter param is page_key, not page — "page" collides with DRF's own
    // pagination query param on this list endpoint.
    const d = await getContentFaqs({ page_key: page || undefined });
    setLoadError(!!d?.__failed);
    setRows(Array.isArray(d) ? d : d.results || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (payload) => {
    setBusy(true); setFormError("");
    try {
      if (modal.mode === "edit") {
        const updated = await updateContentFaq(modal.initial.id, payload);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        notify("FAQ updated");
      } else {
        const created = await createContentFaq(payload);
        setRows((prev) => [...prev, created]);
        notify("FAQ created");
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
      await deleteContentFaq(confirm.item.id);
      setRows((prev) => prev.filter((r) => r.id !== confirm.item.id));
      notify("FAQ deleted");
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
        {PAGE_FILTERS.map(([v, l]) => (
          <button key={v || "all"} className={`mod-chip${page === v ? " active" : ""}`} onClick={() => setPage(v)}>
            {l}
          </button>
        ))}
        <div className="cms-toolbar-spacer" />
        <button className="cm-add-btn" onClick={() => { setFormError(""); setModal({ mode: "create", initial: {} }); }}>
          + New FAQ
        </button>
      </div>

      <div className="dashboard-card courses-table-card">
        <div className="courses-count">{rows.length} FAQ{rows.length !== 1 ? "s" : ""}</div>
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : loadError ? (
          <div className="dashboard-loading">Couldn't load FAQs. <button className="cm-icon-btn" onClick={load}>Retry</button></div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No FAQs yet for this filter.</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>Page</th><th>Question</th><th>Order</th><th>Status</th><th aria-label="actions" /></tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id}>
                  <td><span className="mod-badge pal-blue">{PAGE_LABEL[f.page] || f.page}</span></td>
                  <td className="courses-title courses-desc" style={{ maxWidth: 420 }}>{f.question}</td>
                  <td>{f.order}</td>
                  <td>
                    <span className={`mod-badge ${f.is_active ? "pal-green" : "pal-gray"}`}>
                      {f.is_active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="cm-actions">
                    <button className="cm-icon-btn" onClick={() => { setFormError(""); setModal({ mode: "edit", initial: f }); }}>Edit</button>
                    <button className="cm-icon-btn cm-icon-btn--danger" onClick={() => setConfirm({ item: f })}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <FaqFormModal
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
          title="Delete FAQ"
          message={`Delete "${confirm.item.question}"? This can't be undone.`}
          extra={confirm.error ? <div className="cm-form-error">{confirm.error}</div> : null}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default Faqs;
