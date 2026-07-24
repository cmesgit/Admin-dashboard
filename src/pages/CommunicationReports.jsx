// PLACEMENT: src/pages/CommunicationReports.jsx   (NEW FILE — admin app)
// DEPLOY:    /app/shiksha-admin/src/pages/CommunicationReports.jsx
//
// CC-023 Administrator Console — the moderation queue: reports filed from
// CC-006 (report a conversation/person) and CC-010 (report one message),
// plus the suspension list those reports resolve into. Two tabs on one
// page since they're the same workflow (review a report → optionally
// suspend the person it's about) rather than two separate destinations.
import { useEffect, useState } from "react";
import { Flag, Ban, Trash2, Check, X, MessageSquare } from "lucide-react";
import {
  getReports, resolveReport, getSuspensions, suspendIdentity, liftSuspension,
  getAdminConversationMessages,
} from "../api/admin_communication";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";
import "../css/CommunicationReports.css";

const REASON_LABEL = {
  SPAM: "Spam or scam", HARASSMENT: "Harassment or bullying",
  INAPPROPRIATE: "Inappropriate content", OTHER: "Something else",
};
const STATUS_COLOR = { OPEN: "yellow", REVIEWED: "blue", ACTION_TAKEN: "green", DISMISSED: "gray" };

function ConversationViewerModal({ report, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getAdminConversationMessages(report.conversation_id)
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [report.conversation_id]);

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-card comm-convo-card" onClick={(e) => e.stopPropagation()}>
        <h3>Conversation</h3>
        <p>Context for the report on <code>{report.target_identity || "this thread"}</code>.</p>
        <div className="comm-convo-scroll">
          {error ? (
            <p className="forum-empty">Couldn't load this conversation.</p>
          ) : !data ? (
            <p className="forum-empty">Loading…</p>
          ) : data.messages.length === 0 ? (
            <p className="forum-empty">No messages in this conversation.</p>
          ) : (
            data.messages.map((m) => (
              <div
                key={m.id}
                className={"comm-convo-msg" + (m.id === report.message_id ? " comm-convo-msg-flagged" : "")}
              >
                <span className="comm-convo-msg-sender">{m.sender?.name || "Unknown"}</span>
                <span className="comm-convo-msg-body">{m.deleted ? <em>Removed by a moderator</em> : m.body}</span>
                <span className="comm-convo-msg-time">{new Date(m.created_at).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function ReportsTab() {
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // { report, action }
  const [note, setNote] = useState("");
  const [viewing, setViewing] = useState(null); // report being viewed in ConversationViewerModal

  const load = async () => {
    setLoading(true);
    try { setReports(await getReports(statusFilter)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAction = async () => {
    if (!confirm) return;
    await resolveReport(confirm.report.id, confirm.action, note);
    setConfirm(null); setNote("");
    load();
  };

  return (
    <>
      <div className="comm-filter-row">
        {["OPEN", "REVIEWED", "ACTION_TAKEN", "DISMISSED", ""].map((s) => (
          <button
            key={s || "all"}
            className={"comm-filter-chip" + (statusFilter === s ? " comm-filter-chip-active" : "")}
            onClick={() => setStatusFilter(s)}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="dashboard-card forum-table-card">
        <div className="forum-count">{loading ? "Loading…" : `${reports.length} report(s)`}</div>
        <table className="forum-table">
          <thead>
            <tr>
              <th>Reason</th><th>Target</th><th>Reporter</th><th>Message</th><th>Status</th><th>Resolution</th><th>Filed</th><th></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{REASON_LABEL[r.reason] || r.reason}{r.detail && <div className="comm-detail-text">{r.detail}</div>}</td>
                <td><code>{r.target_identity || "—"}</code></td>
                <td>{r.reporter_name}</td>
                <td className="forum-post-title">{r.message_preview || <em>No message (thread-level report)</em>}</td>
                <td><StatusBadge color={STATUS_COLOR[r.status]}>{r.status.replace("_", " ")}</StatusBadge></td>
                <td>
                  {r.resolved_by ? (
                    <>
                      {r.resolved_by}
                      <div className="comm-detail-text">{new Date(r.resolved_at).toLocaleDateString()}</div>
                      {r.resolution_note && <div className="comm-detail-text">{r.resolution_note}</div>}
                    </>
                  ) : "—"}
                </td>
                <td>{new Date(r.created_at).toLocaleDateString()}</td>
                <td>
                  <div className="comm-row-actions">
                    <button
                      className="comm-icon-btn"
                      title="View conversation"
                      disabled={!r.conversation_id}
                      onClick={() => setViewing(r)}
                    >
                      <MessageSquare size={15} />
                    </button>
                    {r.status === "OPEN" && (
                      <>
                        {r.message_id && (
                          <button className="comm-icon-btn" title="Remove message" onClick={() => setConfirm({ report: r, action: "remove_message" })}>
                            <Trash2 size={15} />
                          </button>
                        )}
                        <button className="comm-icon-btn comm-icon-btn-danger" title="Suspend user" onClick={() => setConfirm({ report: r, action: "suspend_user" })}>
                          <Ban size={15} />
                        </button>
                        <button className="comm-icon-btn" title="Dismiss" onClick={() => setConfirm({ report: r, action: "dismiss" })}>
                          <X size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && reports.length === 0 && (
              <tr><td colSpan={8} className="forum-empty">No reports here.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {confirm && (
        <ConfirmModal
          title={
            confirm.action === "remove_message" ? "Remove this message?" :
            confirm.action === "suspend_user" ? "Suspend this user from chat?" : "Dismiss this report?"
          }
          message={
            confirm.action === "remove_message" ? "The message will show \"Removed by a moderator\" to everyone in the thread." :
            confirm.action === "suspend_user" ? `${confirm.report.target_identity} will not be able to send any chat messages until you lift the suspension.` :
            "No action will be taken against the reported content or user."
          }
          extra={
            confirm.action !== "dismiss" && (
              <textarea className="comm-note-input" rows={2} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            )
          }
          onConfirm={runAction}
          onCancel={() => { setConfirm(null); setNote(""); }}
        />
      )}
      {viewing && <ConversationViewerModal report={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function SuspensionsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ identity_key: "", reason: "" });

  const load = async () => { setLoading(true); try { setItems(await getSuspensions()); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!form.identity_key.trim()) return;
    await suspendIdentity(form.identity_key.trim(), form.reason.trim());
    setForm({ identity_key: "", reason: "" });
    load();
  };

  const lift = async (key) => { await liftSuspension(key); load(); };

  return (
    <>
      <form className="dashboard-card comm-suspend-form" onSubmit={create}>
        <div>
          <label>Identity key</label>
          <input placeholder='e.g. "T:1234" or "L:uuid"' value={form.identity_key}
                 onChange={(e) => setForm({ ...form, identity_key: e.target.value })} />
        </div>
        <div>
          <label>Reason</label>
          <input placeholder="Optional" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>
        <button type="submit" className="comm-btn-primary"><Ban size={14} /> Suspend</button>
      </form>

      <div className="dashboard-card forum-table-card">
        <div className="forum-count">{loading ? "Loading…" : `${items.length} suspension(s)`}</div>
        <table className="forum-table">
          <thead><tr><th>Identity</th><th>Reason</th><th>Until</th><th>By</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td><code>{s.identity_key}</code></td>
                <td>{s.reason || "—"}</td>
                <td>{s.suspended_until ? new Date(s.suspended_until).toLocaleString() : <em>Indefinite</em>}</td>
                <td>{s.created_by || "—"}</td>
                <td><StatusBadge color={s.is_active ? "red" : "gray"}>{s.is_active ? "Active" : "Lifted/expired"}</StatusBadge></td>
                <td>{s.is_active && <button className="comm-icon-btn" title="Lift suspension" onClick={() => lift(s.identity_key)}><Check size={15} /></button>}</td>
              </tr>
            ))}
            {!loading && items.length === 0 && <tr><td colSpan={6} className="forum-empty">No suspensions on record.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function CommunicationReports() {
  const [tab, setTab] = useState("reports");
  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title"><Flag size={22} style={{ verticalAlign: "-3px", marginRight: 8 }} />Chat Moderation</h1>
      <div className="comm-tabs">
        <button className={"comm-tab" + (tab === "reports" ? " comm-tab-active" : "")} onClick={() => setTab("reports")}>
          <Flag size={14} /> Reports
        </button>
        <button className={"comm-tab" + (tab === "suspensions" ? " comm-tab-active" : "")} onClick={() => setTab("suspensions")}>
          <Ban size={14} /> Suspensions
        </button>
      </div>
      {tab === "reports" ? <ReportsTab /> : <SuspensionsTab />}
    </div>
  );
}
