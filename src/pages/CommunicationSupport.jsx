// PLACEMENT: src/pages/CommunicationSupport.jsx   (NEW FILE — admin app)
// DEPLOY:    /app/shiksha-admin/src/pages/CommunicationSupport.jsx
//
// CC-022 Academic Support — the admin/staff side. A ticket is a normal
// chat.SupportTicket; replying here calls the SAME requester-facing reply
// endpoint the student/teacher app's SupportView.jsx uses — the backend
// auto-attaches a STAFF participant for any is_staff user on first touch
// (see chat/services.py's attach_staff_participant()), so there's no
// separate "admin reply" endpoint to keep in sync.
import { useEffect, useState } from "react";
import { LifeBuoy, Send, ChevronLeft } from "lucide-react";
import {
  getAdminSupportTickets, assignSupportTicket, setSupportTicketStatus,
  getTicketMessages, replyToTicket,
} from "../api/admin_communication";
import { useAuth } from "../contexts/AuthContext";
import StatusBadge from "../components/StatusBadge";
import "../css/CommunicationReports.css";

const STATUS_COLOR = { OPEN: "yellow", IN_PROGRESS: "blue", RESOLVED: "green", CLOSED: "gray" };
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

function TicketDetail({ ticket, onBack, onChanged }) {
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = () => getTicketMessages(ticket.id).then(setMessages);
  useEffect(() => { load(); }, [ticket.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reply = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try { await replyToTicket(ticket.id, draft.trim()); setDraft(""); await load(); onChanged(); }
    finally { setSending(false); }
  };

  const changeStatus = async (status) => { await setSupportTicketStatus(ticket.id, status); onChanged(); };

  return (
    <div className="dashboard-card comm-ticket-detail">
      <button className="comm-back-btn" onClick={onBack}><ChevronLeft size={14} /> All tickets</button>
      <h2>{ticket.subject}</h2>
      <div className="comm-ticket-meta">
        <span>{ticket.requester_name}</span> · <span>{ticket.category}</span> ·
        <select value={ticket.status} onChange={(e) => changeStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
      </div>

      <div className="comm-ticket-thread">
        {messages === null ? <div className="forum-empty">Loading…</div> : messages.map((m) => (
          <div key={m.id} className={"comm-ticket-msg" + (m.sender?.identity?.startsWith("S:") ? " comm-ticket-msg-staff" : "")}>
            <strong>{m.sender?.name || "Unknown"}</strong>
            <p>{m.deleted ? <em>Message deleted</em> : m.body}</p>
            <span>{new Date(m.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="comm-ticket-reply">
        <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Reply to this ticket…" />
        <button className="comm-btn-primary" disabled={!draft.trim() || sending} onClick={reply}><Send size={14} /></button>
      </div>
    </div>
  );
}

export default function CommunicationSupport() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setTickets(await getAdminSupportTickets(statusFilter)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const assignToMe = async (id) => {
    if (!user?.id) return;
    await assignSupportTicket(id, user.id);
    load();
  };

  if (active) {
    return <div className="dashboard-wrapper">
      <TicketDetail ticket={active} onBack={() => { setActive(null); load(); }} onChanged={load} />
    </div>;
  }

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title"><LifeBuoy size={22} style={{ verticalAlign: "-3px", marginRight: 8 }} />Support Tickets</h1>

      <div className="comm-filter-row">
        {["", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
          <button key={s || "all"} className={"comm-filter-chip" + (statusFilter === s ? " comm-filter-chip-active" : "")}
                  onClick={() => setStatusFilter(s)}>
            {s ? s.replace("_", " ") : "All"}
          </button>
        ))}
      </div>

      <div className="dashboard-card forum-table-card">
        <div className="forum-count">{loading ? "Loading…" : `${tickets.length} ticket(s)`}</div>
        <table className="forum-table">
          <thead><tr><th>Subject</th><th>From</th><th>Category</th><th>Status</th><th>Assignee</th><th>Updated</th><th></th></tr></thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td className="forum-post-title" style={{ cursor: "pointer" }} onClick={() => setActive(t)}>{t.subject}</td>
                <td>{t.requester_name}</td>
                <td>{t.category}</td>
                <td><StatusBadge color={STATUS_COLOR[t.status]}>{t.status.replace("_", " ")}</StatusBadge></td>
                <td>{t.assignee || <button className="comm-icon-btn" onClick={() => assignToMe(t.id)}>Assign to me</button>}</td>
                <td>{new Date(t.updated_at).toLocaleDateString()}</td>
                <td><button className="comm-icon-btn" onClick={() => setActive(t)}>Open</button></td>
              </tr>
            ))}
            {!loading && tickets.length === 0 && <tr><td colSpan={7} className="forum-empty">No tickets here.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
