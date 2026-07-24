// Message Search — browse/search chat messages and remove one standalone,
// independent of a filed Report. Backs AdminRemoveMessageView, which had a
// frontend API wrapper (removeMessage in admin_communication.js) but no
// screen that could ever call it outside a Report's own row.
import { useEffect, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { searchAdminMessages, removeMessage } from "../api/admin_communication";
import ConfirmModal from "../components/ConfirmModal";
import "../css/CommunicationReports.css";

export default function MessageSearch() {
  const [q, setQ] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // message pending removal
  const [reason, setReason] = useState("");

  const load = async (params) => {
    setLoading(true);
    try { setRows(await searchAdminMessages(params)); } finally { setLoading(false); }
  };
  useEffect(() => { load({}); }, []); // initial: most recent messages platform-wide

  const currentParams = () => ({
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(conversationId.trim() ? { conversation_id: conversationId.trim() } : {}),
  });

  const runSearch = (e) => {
    e.preventDefault();
    load(currentParams());
  };

  const runRemove = async () => {
    if (!confirm) return;
    await removeMessage(confirm.id, reason);
    setConfirm(null); setReason("");
    load(currentParams());
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title"><Search size={22} style={{ verticalAlign: "-3px", marginRight: 8 }} />Message Search</h1>

      <form className="dashboard-card comm-broadcast-form" onSubmit={runSearch} style={{ marginBottom: 20 }}>
        <label>Text contains</label>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search message body…" />
        <label>Conversation ID (optional)</label>
        <input value={conversationId} onChange={(e) => setConversationId(e.target.value)} placeholder="Narrow to one conversation…" />
        <button type="submit" className="comm-btn-primary"><Search size={14} /> Search</button>
      </form>

      <div className="dashboard-card forum-table-card">
        <div className="forum-count">{loading ? "Loading…" : `${rows.length} message(s)`}</div>
        <table className="forum-table">
          <thead>
            <tr>
              <th>Sender</th><th>Message</th><th>Type</th><th>Sent</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{m.sender?.name || "Unknown"}</td>
                <td className="forum-post-title">
                  {m.deleted ? <em>Removed by a moderator{m.deleted_reason ? ` — ${m.deleted_reason}` : ""}</em> : m.body}
                </td>
                <td>{m.message_type}</td>
                <td>{new Date(m.created_at).toLocaleString()}</td>
                <td>
                  {!m.deleted && (
                    <button className="comm-icon-btn" title="Remove message" onClick={() => setConfirm(m)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="forum-empty">No messages match this search.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {confirm && (
        <ConfirmModal
          title="Remove this message?"
          message={"The message will show \"Removed by a moderator\" to everyone in the thread."}
          extra={
            <textarea className="comm-note-input" rows={2} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          }
          onConfirm={runRemove}
          onCancel={() => { setConfirm(null); setReason(""); }}
        />
      )}
    </div>
  );
}
