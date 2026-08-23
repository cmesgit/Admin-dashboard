import { useEffect, useMemo, useState } from "react";
import { Send, Undo2 } from "lucide-react";
import {
  getContentAffairs, createContentAffair, updateContentAffair, deleteContentAffair,
  publishContentAffair, unpublishContentAffair,
} from "../../api/admin";
import ConfirmModal from "../../components/ConfirmModal";
import TagChipInput from "../../components/TagChipInput";
import { errText } from "../../utils/errText";
import { formatDate } from "../../utils/formatDate";
import { isoToLocalInput, localInputToIso } from "../../utils/datetimeLocal";

const CATEGORIES = [
  "national", "international", "economy", "polity",
  "science-tech", "environment", "sports", "awards", "misc",
];
const CATEGORY_FILTERS = [["", "All categories"], ...CATEGORIES.map((c) => [c, c])];
const STATUS_PAL = { draft: "pal-gray", scheduled: "pal-blue", published: "pal-green", archived: "pal-gray" };

/* ───────────────────────── Create/Edit modal ───────────────────────── */
function AffairFormModal({ mode, initial, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    title: initial?.title || "",
    slug: initial?.slug || "",
    affair_date: initial?.affair_date || new Date().toISOString().slice(0, 10),
    category: initial?.category || "national",
    summary: initial?.summary || "",
    body_html: initial?.body_html || "",
    source_name: initial?.source_name || "",
    source_url: initial?.source_url || "",
    tags: initial?.tags || [],
    publish_at: isoToLocalInput(initial?.publish_at),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () => {
    onSubmit({
      title: form.title.trim(),
      slug: form.slug.trim(),
      affair_date: form.affair_date,
      category: form.category,
      summary: form.summary,
      body_html: form.body_html,
      source_name: form.source_name.trim(),
      source_url: form.source_url.trim(),
      tags: form.tags,
      // OMIT the key when the admin left "Publish at" blank — do not send
      // null. CurrentAffair.publish_at is DateTimeField(default=timezone.now)
      // with no null=True, so DRF builds it allow_null=False and an explicit
      // null 400s with "This field may not be null." On create the field
      // starts blank, so every create that didn't manually set a date failed.
      // Omitting it lets the model default apply.
      ...(form.publish_at ? { publish_at: localInputToIso(form.publish_at) } : {}),
    });
  };

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card cm-form-card--wide" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === "edit" ? "Edit Current Affair" : "New Current Affair"}</h3>

        {mode === "edit" && initial && (
          <div className="cms-readonly-grid">
            <div><span>Status</span><b><span className={`mod-badge ${STATUS_PAL[initial.status] || "pal-gray"}`}>{initial.status || "draft"}</span></b></div>
            <div><span>Created</span><b>{formatDate(initial.created_at)}</b></div>
            <div><span>Updated</span><b>{formatDate(initial.updated_at)}</b></div>
          </div>
        )}

        <label className="cm-field">
          <span>Title</span>
          <input value={form.title} onChange={set("title")} placeholder="e.g. India signs new trade agreement" autoFocus />
        </label>

        <label className="cm-field">
          <span>Slug (optional)</span>
          <input value={form.slug} onChange={set("slug")} placeholder="Leave blank to auto-generate" />
        </label>

        <div className="cm-row">
          <label className="cm-field">
            <span>Affair date</span>
            <input type="date" value={form.affair_date} onChange={set("affair_date")} />
          </label>
          <label className="cm-field">
            <span>Category</span>
            <select value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>

        <label className="cm-field">
          <span>Summary</span>
          <textarea rows={3} value={form.summary} onChange={set("summary")} placeholder="Short summary shown in listings" />
        </label>

        <label className="cm-field">
          <span>Body (HTML)</span>
          <textarea rows={8} value={form.body_html} onChange={set("body_html")} placeholder="<p>Full write-up as plain HTML…</p>" />
        </label>
        <p className="cm-hint">Plain HTML, not a rich text editor.</p>

        <div className="cm-row">
          <label className="cm-field">
            <span>Source name</span>
            <input value={form.source_name} onChange={set("source_name")} placeholder="e.g. PIB" />
          </label>
          <label className="cm-field">
            <span>Source URL</span>
            <input value={form.source_url} onChange={set("source_url")} placeholder="https://…" />
          </label>
        </div>

        <label className="cm-field">
          <span>Tags</span>
          <TagChipInput value={form.tags} onChange={(v) => setForm((f) => ({ ...f, tags: v }))} placeholder="Type a tag, press Enter…" />
        </label>

        <label className="cm-field">
          <span>Publish at (for scheduling)</span>
          <input type="datetime-local" value={form.publish_at} onChange={set("publish_at")} />
        </label>
        <p className="cm-hint">This sets the scheduled time only — actual publish state is controlled by the Publish / Unpublish action.</p>

        {error && <div className="cm-form-error">{error}</div>}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="confirm-ok" onClick={submit} disabled={busy || !form.title.trim()}>
            {busy ? "Saving…" : mode === "edit" ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

const CurrentAffairs = ({ onAction }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const notify = (msg) => onAction && onAction(msg);

  const load = async () => {
    setLoading(true);
    const d = await getContentAffairs();
    setLoadError(!!d?.__failed);
    setRows(Array.isArray(d) ? d : d.results || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    let v = category ? rows.filter((r) => r.category === category) : rows;
    const q = search.trim().toLowerCase();
    if (q) v = v.filter((r) => (r.title || "").toLowerCase().includes(q));
    return v;
  }, [rows, category, search]);

  const handleSubmit = async (payload) => {
    setBusy(true); setFormError("");
    try {
      if (modal.mode === "edit") {
        const updated = await updateContentAffair(modal.initial.id, payload);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        notify(`Updated "${updated.title}"`);
      } else {
        const created = await createContentAffair(payload);
        setRows((prev) => [created, ...prev]);
        notify(`Created "${created.title}"`);
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
      await deleteContentAffair(confirm.item.id);
      setRows((prev) => prev.filter((r) => r.id !== confirm.item.id));
      notify(`Deleted "${confirm.item.title}"`);
      setConfirm(null);
    } catch (e) {
      setConfirm((c) => ({ ...c, error: errText(e) }));
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async (row) => {
    try {
      const updated = row.status === "published"
        ? await unpublishContentAffair(row.id)
        : await publishContentAffair(row.id);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
      notify(row.status === "published" ? `Unpublished "${row.title}"` : `Published "${row.title}"`);
    } catch (e) {
      notify(errText(e));
    }
  };

  return (
    <div>
      <div className="mod-chip-row">
        {CATEGORY_FILTERS.map(([v, l]) => (
          <button key={v || "all"} className={`mod-chip${category === v ? " active" : ""}`} onClick={() => setCategory(v)}>
            {l}
          </button>
        ))}
        <input
          className="mod-search"
          style={{ marginLeft: "auto", minWidth: 220 }}
          placeholder="Search by title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="cm-add-btn" onClick={() => { setFormError(""); setModal({ mode: "create", initial: {} }); }}>
          + New Entry
        </button>
      </div>

      <div className="dashboard-card courses-table-card">
        <div className="courses-count">{visible.length} entr{visible.length !== 1 ? "ies" : "y"}</div>
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : loadError ? (
          <div className="dashboard-loading">Couldn't load current affairs. <button className="cm-icon-btn" onClick={load}>Retry</button></div>
        ) : visible.length === 0 ? (
          <div className="dashboard-loading">No current affairs entries match this filter.</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>Title</th><th>Category</th><th>Affair date</th><th>Status</th><th aria-label="actions" /></tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.id}>
                  <td className="courses-title">{a.title}</td>
                  <td><span className="mod-badge pal-blue">{a.category}</span></td>
                  <td>{formatDate(a.affair_date)}</td>
                  <td><span className={`mod-badge ${STATUS_PAL[a.status] || "pal-gray"}`}>{a.status || "draft"}</span></td>
                  <td className="cm-actions">
                    <button className="cm-icon-btn" onClick={() => { setFormError(""); setModal({ mode: "edit", initial: a }); }}>Edit</button>
                    {a.status === "published" ? (
                      <button className="cm-icon-btn" onClick={() => togglePublish(a)}><Undo2 size={13} /> Unpublish</button>
                    ) : (
                      <button className="cm-icon-btn" onClick={() => togglePublish(a)}><Send size={13} /> Publish</button>
                    )}
                    <button className="cm-icon-btn cm-icon-btn--danger" onClick={() => setConfirm({ item: a })}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <AffairFormModal
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
          title="Delete Current Affair"
          message={`Delete "${confirm.item.title}"? This can't be undone.`}
          extra={confirm.error ? <div className="cm-form-error">{confirm.error}</div> : null}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default CurrentAffairs;
