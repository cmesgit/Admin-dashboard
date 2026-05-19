import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { getThreads, deleteThread } from "../api/admin";
import ConfirmModal from "../components/ConfirmModal";
import "../css/Forum.css";

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const mapThread = (t) => ({
  id: t.id,
  title: t.title,
  author: t.author_username,
  created_at: t.created_at,
  reply_count: t.reply_count ?? 0,
  upvote_count: t.upvote_count ?? 0,
});

const Forum = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      const pageSize = 100;
      const all = [];
      try {
        let page = 1;
        while (true) {
          const data = await getThreads({ page, page_size: pageSize, sort: "newest" });
          const results = data.results || [];
          all.push(...results);
          const count = typeof data.count === "number" ? data.count : all.length;
          if (results.length < pageSize || all.length >= count) break;
          page += 1;
        }
        if (!cancelled) setPosts(all.map(mapThread));
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAll();
    return () => { cancelled = true; };
  }, []);

  const handleDelete = (id) => {
    const post = posts.find((p) => p.id === id);
    setConfirm({
      title: "Delete Post?",
      message: `Are you sure you want to delete "${post.title}"?`,
      onConfirm: async () => {
        try {
          await deleteThread(id);
          setPosts((prev) => prev.filter((p) => p.id !== id));
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Forum Moderation</h1>

      <div className="dashboard-card forum-table-card">
        <div className="forum-count">{posts.length} post{posts.length !== 1 ? "s" : ""}</div>
        {loading ? (
          <div className="dashboard-loading">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="forum-empty">No forum posts.</div>
        ) : (
          <table className="forum-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Replies</th>
                <th>Upvotes</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td className="forum-post-title">{p.title}</td>
                  <td>{p.author}</td>
                  <td>{p.reply_count}</td>
                  <td>{p.upvote_count}</td>
                  <td>{formatDate(p.created_at)}</td>
                  <td>
                    <button
                      className="forum-delete-btn"
                      onClick={() => handleDelete(p.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default Forum;
