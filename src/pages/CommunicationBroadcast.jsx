// PLACEMENT: src/pages/CommunicationBroadcast.jsx   (NEW FILE — admin app)
// DEPLOY:    /app/shiksha-admin/src/pages/CommunicationBroadcast.jsx
//
// CC-023 broadcast tool. Deliberately a platform-wide NOTIFICATION blast
// (not a Conversation) — see chat/services.py's send_admin_broadcast()
// docstring for why a per-course Announcement (CC-015, which this admin
// app doesn't need — that's the course teacher's own tool inside the
// Course Hub) and a platform-wide admin blast are different enough
// mechanisms to stay separate.
import { useEffect, useState } from "react";
import { Send, BarChart3 } from "lucide-react";
import { sendBroadcast, getCommsLogs } from "../api/admin_communication";
import "../css/CommunicationReports.css";

const AUDIENCES = [
  ["all", "Everyone"],
  ["all_students", "All students"],
  ["all_teachers", "All teachers"],
];

function LogsPanel() {
  const [logs, setLogs] = useState(null);
  useEffect(() => { getCommsLogs().then(setLogs).catch(() => setLogs(null)); }, []);
  if (!logs) return null;
  const cards = [
    ["Messages today", logs.messages_today],
    ["Messages (7d)", logs.messages_last_7_days],
    ["Active threads (7d)", logs.active_conversations_last_7_days],
    ["Open reports", logs.open_reports],
    ["Open support tickets", logs.open_support_tickets],
    ["Active suspensions", logs.active_suspensions],
  ];
  return (
    <div className="dashboard-cards" style={{ marginTop: 28 }}>
      {cards.map(([label, value]) => (
        <div className="dashboard-card" key={label}>
          <h3>{value}</h3>
          <p>{label}</p>
        </div>
      ))}
    </div>
  );
}

export default function CommunicationBroadcast() {
  const [audience, setAudience] = useState("all_students");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const send = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const r = await sendBroadcast(audience, title.trim(), body.trim(), linkUrl.trim());
      setResult({ ok: true, recipients: r.recipients });
      setTitle(""); setBody(""); setLinkUrl("");
    } catch {
      setResult({ ok: false });
    }
    setSending(false);
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title"><Send size={22} style={{ verticalAlign: "-3px", marginRight: 8 }} />Platform Broadcast</h1>

      <form className="dashboard-card comm-broadcast-form" onSubmit={send}>
        <label>Audience</label>
        <div className="comm-filter-row">
          {AUDIENCES.map(([val, label]) => (
            <button type="button" key={val} className={"comm-filter-chip" + (audience === val ? " comm-filter-chip-active" : "")}
                    onClick={() => setAudience(val)}>
              {label}
            </button>
          ))}
        </div>

        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Scheduled maintenance tonight" maxLength={255} required />

        <label>Message</label>
        <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details for the recipient…" />

        <label>Link (optional)</label>
        <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/some/in-app/path" />

        <button type="submit" className="comm-btn-primary" disabled={sending || !title.trim()}>
          <Send size={14} /> {sending ? "Sending…" : "Send broadcast"}
        </button>

        {result && (
          result.ok
            ? <div className="comm-result comm-result-ok">Sent to {result.recipients} recipient(s).</div>
            : <div className="comm-result comm-result-err">Couldn't send — please try again.</div>
        )}
      </form>

      <h2 className="comm-section-title"><BarChart3 size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />At a glance</h2>
      <LogsPanel />
    </div>
  );
}
