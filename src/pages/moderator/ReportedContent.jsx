import { useEffect, useState } from "react";
import { Trash2, ShieldOff, TriangleAlert, Ban } from "lucide-react";
import { getReports, dismissReport, deleteReport, warnReportTarget, banReportTarget } from "../../api/admin";
import NoteConfirmModal from "../../components/NoteConfirmModal";

const REASON_LABELS = {
  spam: "Spam",
  abusive: "Harassment",
  misleading: "Misinformation",
  other: "Inappropriate",
  duplicate: "Duplicate",
};
const REASON_TABS = ["", "spam", "abusive", "misleading", "other"];

const formatAgo = (iso) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const ReportedContent = ({ onCount }) => {
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // { type, row }

  const load = () => {
    setLoading(true);
    getReports({ reason: reason || undefined, status: "pending" })
      .then((d) => { setRows(d.results || []); onCount && onCount(d.count || 0); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [reason]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeRow = (id) => setRows((prev) => {
    const next = prev.filter((r) => r.id !== id);
    onCount && onCount(next.length);
    return next;
  });

  const dismiss = async (row) => { await dismissReport(row.id); removeRow(row.id); };
  const openDelete = (row) => setConfirm({ type: "delete", row });
  const openWarn = (row) => setConfirm({ type: "warn", row });
  const openBan = (row) => setConfirm({ type: "ban", row });

  const runConfirm = async (note) => {
    const { type, row } = confirm;
    setConfirm(null);
    if (type === "delete") await deleteReport(row.id, note);
    else if (type === "warn") await warnReportTarget(row.id, note);
    else if (type === "ban") await banReportTarget(row.id, note);
    removeRow(row.id);
  };

  return (
    <div>
      <div className="mod-toolbar">
        <select className="mod-select" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASON_TABS.map((r) => (
            <option key={r} value={r}>{r ? REASON_LABELS[r] : "All Reasons"}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="dashboard-loading">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="mod-empty">
          <h4>All clear!</h4>
          <p>No pending reports in this category.</p>
        </div>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="mod-row">
            <div className="mod-row-head">
              <span className="mod-pill reason">{REASON_LABELS[r.reason] || r.reason}</span>
              <span className="mod-pill type">{r.content_type}</span>
              <span className="mod-time">{formatAgo(r.created_at)}</span>
            </div>

            <div className="mod-content-box">
              {r.content_title && <div className="t">{r.content_title}</div>}
              {r.snippet && <div className="s">{r.snippet}</div>}
            </div>

            <div className="mod-people-row">
              <span className="mod-person">
                <span className="mod-avatar" style={{ background: r.reporter.color }}>{r.reporter.initials}</span>
                Reported by <strong>{r.reporter.display_name}</strong>
              </span>
              {r.author && (
                <span className="mod-person">
                  <span className="mod-avatar" style={{ background: r.author.color }}>{r.author.initials}</span>
                  Author <strong>{r.author.display_name}</strong>
                </span>
              )}
              <span>{r.report_count} report{r.report_count === 1 ? "" : "s"}</span>
            </div>

            <div className="mod-actions">
              <button className="mod-btn ghost" onClick={() => dismiss(r)}>Dismiss</button>
              <button className="mod-btn danger" onClick={() => openDelete(r)}><Trash2 size={14} /> Delete</button>
              <button className="mod-btn warn" onClick={() => openWarn(r)}><TriangleAlert size={14} /> Warn User</button>
              <button className="mod-btn ghost" style={{ color: "#c0392b" }} onClick={() => openBan(r)}><ShieldOff size={14} /> Ban</button>
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
      {confirm?.type === "warn" && (
        <NoteConfirmModal
          title="Warn User"
          message="A formal warning will be sent to the user. Repeated warnings may lead to a ban."
          notePlaceholder="Add a note to the warning (optional)…"
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

export default ReportedContent;
