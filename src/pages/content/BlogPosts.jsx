import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Star, Send, Undo2, ExternalLink } from "lucide-react";
import {
  getContentBlogs, deleteContentBlog, publishContentBlog, unpublishContentBlog,
} from "../../api/admin";
import ConfirmModal from "../../components/ConfirmModal";
import { errText } from "../../utils/errText";
import { formatDate } from "../../utils/formatDate";
import { HOME_URL } from "../../config/urls";

const STATUS_PAL = { draft: "pal-gray", scheduled: "pal-blue", published: "pal-green", archived: "pal-gray" };

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
        <button className="cm-add-btn" onClick={() => navigate("/content/blogs/new")}>
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
    </div>
  );
};

export default BlogPosts;
