import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Star, Send, Undo2, ExternalLink, Copy, ListChecks, Languages } from "lucide-react";
import {
  getContentBlogs, getContentBlog, createContentBlog,
  deleteContentBlog, publishContentBlog, unpublishContentBlog,
  duplicateTranslationContentBlog,
} from "../../api/admin";
import ConfirmModal from "../../components/ConfirmModal";
import { errText } from "../../utils/errText";
import { formatDate } from "../../utils/formatDate";
import { HOME_URL } from "../../config/urls";

const STATUS_PAL = { draft: "pal-gray", scheduled: "pal-blue", published: "pal-green", archived: "pal-gray" };
const LOCALE_LABELS = { en: "EN", hi: "HI" };

// The create/edit modal (BlogFormModal) was replaced by a full-page route
// (src/pages/content/BlogEditor.jsx, mounted at /content/blogs/new and
// /content/blogs/:id) — this file now only owns the list/search/publish/
// delete surface.
const BlogPosts = ({ onAction }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

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

  // Which translation_groups already have a Hindi row — computed from the
  // already-loaded list rather than a per-row API check, so "Duplicate as
  // Hindi" can hide itself on a row that already has a sibling without an
  // extra round trip per card.
  const hiTranslationGroups = useMemo(
    () => new Set(rows.filter((r) => r.locale === "hi").map((r) => r.translation_group)),
    [rows]
  );

  const handleDelete = async () => {
    if (!confirm) return;
    try {
      await deleteContentBlog(confirm.item.id);
      setRows((prev) => prev.filter((r) => r.id !== confirm.item.id));
      notify(`Deleted "${confirm.item.title}"`);
      setConfirm(null);
    } catch (e) {
      setConfirm((c) => ({ ...c, error: errText(e) }));
    }
  };

  // Duplicate: the list row (`p`) is the lightweight list-serializer shape,
  // which may not carry every field the editor needs (body_html, seo_*,
  // etc.) — so re-fetch the full detail object first rather than copying
  // straight off the row, same as the editor itself does after a create.
  const handleDuplicate = async (row) => {
    try {
      const full = await getContentBlog(row.id);
      const payload = {
        title: `${full.title} (Copy)`,
        slug: "", // cleared so the backend derives a fresh, non-colliding slug
        class_level: full.class_level,
        subject: full.subject,
        chapter_number: full.chapter_number ?? null,
        excerpt: full.excerpt || "",
        body_html: full.body_html || "",
        trusted_html: full.trusted_html ?? false,
        tags: full.tags || [],
        is_featured: false,
        seo_title: full.seo_title || "",
        seo_description: full.seo_description || "",
        // `status` and `publish_at` are deliberately omitted, not sent as
        // null: new posts already default to draft server-side (this create
        // endpoint never accepts `status` directly — see BlogEditor's
        // toApiFields), and `publish_at` isn't nullable at the model level
        // so an explicit null 400s — omitting the key lets the backend's
        // own default apply, exactly like a fresh "New Post" create.
        //
        // Cover image is NOT carried over: `full.cover` is a URL, not a
        // File, so copying it would need a fetch-blob-then-reupload round
        // trip. Skipped for this polish pass — the duplicate starts with no
        // cover and the author can re-attach one if needed.
      };
      const created = await createContentBlog(payload, false);
      notify(`Duplicated "${full.title}" as a new draft`);
      navigate(`/content/blogs/${created.id}`);
    } catch (e) {
      notify(errText(e));
    }
  };

  // Unlike handleDuplicate above, this is a single server-side action
  // (BlogPostAdminViewSet.duplicate_translation) rather than a client-side
  // fetch-then-recreate — the backend assigns translation_group/slug from
  // the source row itself and 409s if a Hindi sibling already exists, so
  // there's no client-side "which fields to copy" logic to duplicate here.
  const handleDuplicateAsHindi = async (row) => {
    try {
      const created = await duplicateTranslationContentBlog(row.id, "hi");
      setRows((prev) => [created, ...prev]);
      notify(`Created a Hindi translation of "${row.title}"`);
      navigate(`/content/blogs/${created.id}`);
    } catch (e) {
      notify(errText(e));
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

  const toggleSelectMode = () => {
    setSelectMode((v) => !v);
    setSelected(new Set());
  };

  const toggleRow = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visible.map((r) => r.id)));

  // Small team's worth of posts at a time (dozens, not thousands) — a loop of
  // per-post calls is the honest cost here; a real bulk endpoint is a later
  // optimization only if list sizes actually grow enough to need it.
  const handleBulkPublish = async (publish) => {
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      const results = await Promise.allSettled(
        ids.map((id) => (publish ? publishContentBlog(id) : unpublishContentBlog(id)))
      );
      setRows((prev) => prev.map((r, i) => {
        const idx = ids.indexOf(r.id);
        return idx === -1 || results[idx].status !== "fulfilled"
          ? r
          : { ...r, ...results[idx].value };
      }));
      const failed = results.filter((r) => r.status === "rejected").length;
      notify(failed > 0
        ? `${ids.length - failed} of ${ids.length} ${publish ? "published" : "unpublished"} (${failed} failed)`
        : `${publish ? "Published" : "Unpublished"} ${ids.length} post${ids.length === 1 ? "" : "s"}`);
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      const results = await Promise.allSettled(ids.map((id) => deleteContentBlog(id)));
      const succeededIds = new Set(ids.filter((_, i) => results[i].status === "fulfilled"));
      setRows((prev) => prev.filter((r) => !succeededIds.has(r.id)));
      const failed = ids.length - succeededIds.size;
      notify(failed > 0
        ? `Deleted ${succeededIds.size} of ${ids.length} (${failed} failed)`
        : `Deleted ${ids.length} post${ids.length === 1 ? "" : "s"}`);
      setSelected(new Set());
      setBulkDeleteConfirm(false);
    } finally {
      setBulkBusy(false);
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
        <button
          className={`mod-btn ghost small${selectMode ? " active" : ""}`}
          onClick={toggleSelectMode}
        >
          <ListChecks size={13} /> {selectMode ? "Cancel select" : "Select"}
        </button>
        <button className="cm-add-btn" onClick={() => navigate("/content/blogs/new")}>
          + New Post
        </button>
      </div>

      {selectMode && (
        <div className="cms-bulk-bar">
          <label className="cms-bulk-count">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={visible.length === 0}
            />
            {selected.size > 0 ? `${selected.size} selected` : `Select posts (${visible.length})`}
          </label>
          <button
            className="mod-btn success small"
            onClick={() => handleBulkPublish(true)}
            disabled={selected.size === 0 || bulkBusy}
          >
            <Send size={13} /> Publish selected
          </button>
          <button
            className="mod-btn warn small"
            onClick={() => handleBulkPublish(false)}
            disabled={selected.size === 0 || bulkBusy}
          >
            <Undo2 size={13} /> Unpublish selected
          </button>
          <button
            className="mod-btn danger small"
            onClick={() => setBulkDeleteConfirm(true)}
            disabled={selected.size === 0 || bulkBusy}
          >
            Delete selected
          </button>
        </div>
      )}

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
                {selectMode && (
                  <input
                    type="checkbox"
                    className="cms-card-select"
                    checked={selected.has(p.id)}
                    onChange={() => toggleRow(p.id)}
                    aria-label={`Select "${p.title}"`}
                  />
                )}
                {p.cover ? <img src={p.cover} alt="" /> : <FileText size={34} className="cms-card-thumb-icon" />}
                <span className={`mod-badge ${STATUS_PAL[p.status] || "pal-gray"} cms-card-status`}>{p.status || "draft"}</span>
              </div>
              <div className="cms-card-body">
                <div className="cms-card-title">
                  {p.is_featured && <Star size={13} fill="currentColor" style={{ color: "#f59e0b", marginRight: 5, verticalAlign: -1 }} />}
                  <span className="cms-card-locale-badge" title={p.locale === "hi" ? "Hindi" : "English"}>
                    {LOCALE_LABELS[p.locale] || p.locale}
                  </span>
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
                <button className="mod-btn ghost small" onClick={() => navigate(`/content/blogs/${p.id}`)}>Edit</button>
                {p.status === "published" ? (
                  <>
                    <button className="mod-btn warn small" onClick={() => togglePublish(p)}><Undo2 size={13} /> Unpublish</button>
                    <a
                      className="mod-btn ghost small"
                      href={`${HOME_URL}/blogs/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={13} /> View live
                    </a>
                  </>
                ) : (
                  <button className="mod-btn success small" onClick={() => togglePublish(p)}><Send size={13} /> Publish</button>
                )}
                <button className="mod-btn ghost small" onClick={() => handleDuplicate(p)}><Copy size={13} /> Duplicate</button>
                {p.locale !== "hi" && !hiTranslationGroups.has(p.translation_group) && (
                  <button className="mod-btn ghost small" onClick={() => handleDuplicateAsHindi(p)}>
                    <Languages size={13} /> Duplicate as Hindi
                  </button>
                )}
                <button className="mod-btn danger small" onClick={() => setConfirm({ item: p })}>Delete</button>
              </div>
            </div>
          ))}
        </div>
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

      {bulkDeleteConfirm && (
        <ConfirmModal
          title="Delete Blog Posts"
          message={`Delete ${selected.size} selected post${selected.size === 1 ? "" : "s"}? This can't be undone.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkDeleteConfirm(false)}
        />
      )}
    </div>
  );
};

export default BlogPosts;
