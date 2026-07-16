import { useEffect, useState } from "react";
import { Trash2, CircleCheck, ShieldOff } from "lucide-react";
import { getAutoRejected, deleteAutoRejected, restoreAutoRejected, banAutoRejectedAuthor } from "../../api/admin";
import NoteConfirmModal from "../../components/NoteConfirmModal";

const formatAgo = (iso) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const AutoRejected = ({ onCount }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // { type: 'delete'|'ban', row }

  const load = () => {
    setLoading(true);
    getAutoRejected({ status: "pending" })
      .then((d) => { setRows(d.results || []); onCount && onCount(d.count || 0); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const removeRow = (id) => setRows((prev) => {
    const next = prev.filter((r) => r.id !== id);
    onCount && onCount(next.length);
    return next;
  });

  const restore = async (row) => {
    await restoreAutoRejected(row.id);
    removeRow(row.id);
  };

  const runConfirm = async (note) => {
    const { type, row } = confirm;
    setConfirm(null);
    if (type === "delete") await deleteAutoRejected(row.id, note);
    else if (type === "ban") await banAutoRejectedAuthor(row.id, note);
    removeRow(row.id);
  };

  return (
    <div>
      <div className="mod-banner">
        <strong>Auto-Moderation Active</strong>
        <p>
          All new posts go <strong>live immediately</strong>. Our content scanner automatically detects and
          rejects harmful, abusive, or fraudulent posts before they appear publicly. Review auto-rejected
          posts below and confirm or override each decision.
        </p>
      </div>

      <div className="mod-toolbar">
        <strong>Auto-Rejected Posts</strong>
        <span style={{ color: "#888", fontSize: "0.85rem" }}>
          Flagged by content scanner · never shown publicly · review each decision
        </span>
        <span className="mod-pill autorejected">{rows.length} flagged</span>
      </div>

      {loading ? (
        <div className="dashboard-loading">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="mod-empty">
          <h4>No flagged posts</h4>
          <p>The content scanner found nothing harmful. All posts are live.</p>
        </div>
      ) : (
        rows.map((p) => (
          <div key={p.id} className="mod-row">
            <div className="mod-row-head">
              <span className="mod-pill autorejected">Auto-Rejected</span>
              <span className="mod-pill type">{p.kind}</span>
              <span className="mod-time">{formatAgo(p.created_at)}</span>
            </div>

            <div className="mod-flags">
              <span className="label">Detected violations</span>
              {p.categories.map((c) => (
                <span key={c.key} className="mod-flag-chip">{c.label}</span>
              ))}
            </div>

            <div className="mod-content-box">
              {p.title && <div className="t">{p.title}</div>}
              {p.content && <div className="s">{p.content}</div>}
              {p.thread_title && <div className="s">On thread: {p.thread_title}</div>}
            </div>

            <div className="mod-people-row">
              <span className="mod-person">
                <span className="mod-avatar" style={{ background: p.author.color }}>{p.author.initials}</span>
                <strong>{p.author.display_name}</strong>
              </span>
            </div>

            <div className="mod-actions">
              <button className="mod-btn danger" onClick={() => setConfirm({ type: "delete", row: p })}>
                <Trash2 size={14} /> Confirm &amp; Delete
              </button>
              <button className="mod-btn ghost" onClick={() => restore(p)}>
                <CircleCheck size={14} /> Override — Restore Post
              </button>
              <button className="mod-btn ghost" style={{ color: "#c0392b" }} onClick={() => setConfirm({ type: "ban", row: p })}>
                <ShieldOff size={14} /> Ban Author
              </button>
            </div>
          </div>
        ))
      )}

      {confirm?.type === "delete" && (
        <NoteConfirmModal
          title="Delete Content"
          message="This will permanently remove the content from the forum. The author will be notified."
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.type === "ban" && (
        <NoteConfirmModal
          title="Ban User"
          message="This user will be banned from posting, answering, and commenting on ShikshaCom."
          notePlaceholder="Reason for ban (shown to admin)…"
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default AutoRejected;
