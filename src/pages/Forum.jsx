import { useState } from "react";
import { Trash2 } from "lucide-react";
import { mockForumPosts } from "../data/mockData";
import ConfirmModal from "../components/ConfirmModal";
import "../css/Forum.css";

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const Forum = () => {
  const [posts, setPosts] = useState([...mockForumPosts]);
  const [confirm, setConfirm] = useState(null);

  const handleDelete = (id) => {
    const post = posts.find((p) => p.id === id);
    setConfirm({
      title: "Delete Post?",
      message: `Are you sure you want to delete "${post.title}"?`,
      onConfirm: () => {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        setConfirm(null);
      },
    });
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Forum Moderation</h1>

      <div className="dashboard-card forum-table-card">
        <div className="forum-count">{posts.length} posts</div>
        {posts.length === 0 ? (
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
