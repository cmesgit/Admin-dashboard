import { useEffect, useMemo, useState } from "react";
import { FileText, Star, Send, Undo2 } from "lucide-react";
import {
  getContentBlogs, createContentBlog, updateContentBlog, deleteContentBlog,
  publishContentBlog, unpublishContentBlog,
} from "../../api/admin";
import ConfirmModal from "../../components/ConfirmModal";
import TagChipInput from "../../components/TagChipInput";
import { errText } from "../../utils/errText";
import { isoToLocalInput, localInputToIso } from "../../utils/datetimeLocal";

const CLASS_LEVELS = ["8", "9", "10", "11", "12", "general"];
const SUBJECTS = [
  "science", "mathematics", "history", "geography", "economics",
  "civics", "political-science", "english", "general",
];
const STATUS_PAL = { draft: "pal-gray", scheduled: "pal-blue", published: "pal-green", archived: "pal-gray" };

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/* ───────────────────────── Create/Edit modal ───────────────────────── */
function BlogFormModal({ mode, initial, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    title: initial?.title || "",
    slug: initial?.slug || "",
    class_level: initial?.class_level || "general",
    subject: initial?.subject || "general",
    chapter_number: initial?.chapter_number ?? "",
    excerpt: initial?.excerpt || "",
    body_html: initial?.body_html || "",
    trusted_html: initial?.trusted_html ?? false,
    tags: initial?.tags || [],
    is_featured: initial?.is_featured ?? false,
    seo_title: initial?.seo_title || "",
    seo_description: initial?.seo_description || "",
    publish_at: isoToLocalInput(initial?.publish_at),
  });
  const [file, setFile] = useState(null);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = () => {
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      class_level: form.class_level,
      subject: form.subject,
      chapter_number: form.chapter_number === "" ? null : parseInt(form.chapter_number, 10),
      excerpt: form.excerpt,
      body_html: form.body_html,
      trusted_html: form.trusted_html,
      tags: form.tags,
      is_featured: form.is_featured,
      seo_title: form.seo_title,
      seo_description: form.seo_description,
      publish_at: form.publish_at ? localInputToIso(form.publish_at) : null,
    };
    onSubmit(payload, file);
  };

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card cm-form-card--wide" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === "edit" ? "Edit Blog Post" : "New Blog Post"}</h3>

        {mode === "edit" && initial && (
          <div className="cms-readonly-grid">
            <div><span>Status</span><b><span className={`mod-badge ${STATUS_PAL[initial.status] || "pal-gray"}`}>{initial.status || "draft"}</span></b></div>
            <div><span>Author</span><b>{initial.author_name || "—"}</b></div>
            <div><span>Reading time</span><b>{initial.reading_minutes ? `${initial.reading_minutes} min` : "—"}</b></div>
            <div><span>Views</span><b>{initial.view_count ?? 0}</b></div>
            <div><span>Created</span><b>{formatDate(initial.created_at)}</b></div>
            <div><span>Updated</span><b>{formatDate(initial.updated_at)}</b></div>
          </div>
        )}

        <label className="cm-field">
          <span>Title</span>
          <input value={form.title} onChange={set("title")} placeholder="e.g. How to prepare for Class 10 boards" autoFocus />
        </label>

        <label className="cm-field">
          <span>Slug (optional)</span>
          <input value={form.slug} onChange={set("slug")} placeholder="Leave blank to auto-generate from class, subject & chapter" />
        </label>

        <div className="cm-row">
          <label className="cm-field">
            <span>Class level</span>
            <select value={form.class_level} onChange={set("class_level")}>
              {CLASS_LEVELS.map((v) => <option key={v} value={v}>{v === "general" ? "General" : `Class ${v}`}</option>)}
            </select>
          </label>
          <label className="cm-field">
            <span>Subject</span>
            <select value={form.subject} onChange={set("subject")}>
              {SUBJECTS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className="cm-field">
            <span>Chapter # (optional)</span>
            <input type="number" min="1" value={form.chapter_number} onChange={set("chapter_number")} />
          </label>
        </div>

        <label className="cm-field">
          <span>Excerpt</span>
          <textarea rows={2} value={form.excerpt} onChange={set("excerpt")} placeholder="Short summary shown in listings" />
        </label>

        {mode === "edit" && initial?.cover && (
          <img src={initial.cover} alt="" className="cms-image-preview" />
        )}
        <label className="cm-field">
          <span>Cover image</span>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          {file && <small className="cm-file-name">{file.name}</small>}
        </label>

        <label className="cm-field">
          <span>Body (HTML)</span>
          <textarea rows={10} value={form.body_html} onChange={set("body_html")} placeholder="<p>Post body as plain HTML…</p>" />
        </label>
        <p className="cm-hint">Plain HTML, not a rich text editor — same fallback-to-textarea approach as the FAQ answer field.</p>

        <label className="cm-check">
          <input type="checkbox" checked={form.trusted_html} onChange={set("trusted_html")} />
          <span>Skip HTML sanitization (only for trusted imported content)</span>
        </label>

        <label className="cm-field">
          <span>Tags</span>
          <TagChipInput value={form.tags} onChange={(v) => setForm((f) => ({ ...f, tags: v }))} placeholder="Type a tag, press Enter…" />
        </label>

        <div className="cm-row">
          <label className="cm-check" style={{ marginTop: 0 }}>
            <input type="checkbox" checked={form.is_featured} onChange={set("is_featured")} />
            <span>Feature this post</span>
          </label>
          <label className="cm-field">
            <span>Publish at (for scheduling)</span>
            <input type="datetime-local" value={form.publish_at} onChange={set("publish_at")} />
          </label>
        </div>
        <p className="cm-hint">This sets the scheduled time only — actual publish state is controlled by the Publish / Unpublish action, not this field.</p>

        <details className="cms-details">
          <summary>SEO (optional)</summary>
          <label className="cm-field">
            <span>SEO title</span>
            <input value={form.seo_title} onChange={set("seo_title")} />
          </label>
          <label className="cm-field">
            <span>SEO description</span>
            <textarea rows={2} value={form.seo_description} onChange={set("seo_description")} />
          </label>
        </details>

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

const buildBody = (payload, file, fileField) => {
  if (!file) return { data: payload, isMultipart: false };
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v) || typeof v === "object") fd.append(k, JSON.stringify(v));
    else fd.append(k, v);
  });
  fd.append(fileField, file);
  return { data: fd, isMultipart: true };
};

const BlogPosts = ({ onAction }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const notify = (msg) => onAction && onAction(msg);

  const load = async () => {
    setLoading(true);
    const d = await getContentBlogs();
    setRows(Array.isArray(d) ? d : d.results || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.title || "").toLowerCase().includes(q) ||
      (r.subject || "").toLowerCase().includes(q) ||
      (r.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [rows, search]);

  const handleSubmit = async (payload, file) => {
    setBusy(true); setFormError("");
    try {
      const { data, isMultipart } = buildBody(payload, file, "cover");
      if (modal.mode === "edit") {
        const updated = await updateContentBlog(modal.initial.id, data, isMultipart);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        notify(`Updated "${updated.title}"`);
      } else {
        const created = await createContentBlog(data, isMultipart);
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
      await deleteContentBlog(confirm.item.id);
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
        ? await unpublishContentBlog(row.id)
        : await publishContentBlog(row.id);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
      notify(row.status === "published" ? `Unpublished "${row.title}"` : `Published "${row.title}"`);
    } catch (e) {
      notify(errText(e));
    }
  };

  return (
    <div>
      <div className="cms-toolbar">
        <input
          className="mod-search"
          style={{ maxWidth: 320 }}
          placeholder="Search by title, subject or tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="cms-toolbar-spacer" />
        <button className="cm-add-btn" onClick={() => { setFormError(""); setModal({ mode: "create", initial: {} }); }}>
          + New Post
        </button>
      </div>

      {loading ? (
        <div className="dashboard-loading">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="dashboard-card">
          <div className="dashboard-loading">{rows.length === 0 ? "No blog posts yet." : "No posts match this search."}</div>
        </div>
      ) : (
        <div className="cms-card-grid">
          {visible.map((p) => (
            <div className="cms-card" key={p.id}>
              <div className="cms-card-thumb">
                {p.cover ? <img src={p.cover} alt="" /> : <FileText size={34} className="cms-card-thumb-icon" />}
                <span className={`mod-badge ${STATUS_PAL[p.status] || "pal-gray"} cms-card-status`}>{p.status || "draft"}</span>
              </div>
              <div className="cms-card-body">
                <div className="cms-card-title">
                  {p.is_featured && <Star size={13} fill="currentColor" style={{ color: "#f59e0b", marginRight: 5, verticalAlign: -1 }} />}
                  {p.title}
                </div>
                <div className="cms-card-sub">
                  {p.class_level === "general" ? "General" : `Class ${p.class_level}`} · {p.subject}
                </div>
                <div className="cms-card-meta">
                  <span>{p.reading_minutes ? `${p.reading_minutes} min read` : ""}</span>
                  {p.reading_minutes ? <span>·</span> : null}
                  <span>{p.view_count ?? 0} views</span>
                </div>
                <div className="cms-card-sub">by {p.author_name || "—"} · {formatDate(p.created_at)}</div>
                {(p.tags || []).length > 0 && (
                  <div className="cms-card-chips">
                    {p.tags.map((t) => <span className="cms-card-chip" key={t}>{t}</span>)}
                  </div>
                )}
              </div>
              <div className="cms-card-footer">
                <button className="mod-btn ghost small" onClick={() => { setFormError(""); setModal({ mode: "edit", initial: p }); }}>Edit</button>
                {p.status === "published" ? (
                  <button className="mod-btn warn small" onClick={() => togglePublish(p)}><Undo2 size={13} /> Unpublish</button>
                ) : (
                  <button className="mod-btn success small" onClick={() => togglePublish(p)}><Send size={13} /> Publish</button>
                )}
                <button className="mod-btn danger small" onClick={() => setConfirm({ item: p })}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <BlogFormModal
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
          title="Delete Blog Post"
          message={`Delete "${confirm.item.title}"? This can't be undone.`}
          extra={confirm.error ? <div className="cm-form-error">{confirm.error}</div> : null}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default BlogPosts;
