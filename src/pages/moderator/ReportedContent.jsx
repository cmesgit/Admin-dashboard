import { useEffect, useState } from "react";
import { Check, TriangleAlert, Lock, Unlock, CircleUserRound, Ban, Trash2, ShieldCheck } from "lucide-react";
import {
  getReports, dismissReport, deleteReport, warnReportTarget, banReportTarget,
  suspendReportTarget, lockReport, unlockReport,
} from "../../api/admin";
import NoteConfirmModal from "../../components/NoteConfirmModal";

const REASON_LABELS = {
  spam: "Spam",
  abusive: "Harassment",
  misleading: "Misinformation",
  other: "Inappropriate",
  duplicate: "Duplicate",
};

// Severity is derived client-side from the report reason — the backend
// doesn't carry a severity field. Mapping per the design's rough sense of
// how bad each reason tends to be: abusive is high, misleading/other are
// medium, spam/duplicate are low-stakes housekeeping.
const SEVERITY = { abusive: "high", misleading: "med", other: "med", spam: "low", duplicate: "low" };
const SEV_LABEL = { high: "High", med: "Medium", low: "Low" };
const SEV_PAL = { high: "pal-red", med: "pal-yellow", low: "pal-gray" };
const SEV_RANK = { high: 0, med: 1, low: 2 };
const severityOf = (reason) => SEVERITY[reason] || "low";

const FILTERS = [
  ["pending", "Pending"],
  ["high", "High priority"],
  ["resolved", "Resolved"],
];

const DURATIONS = [3, 7, 14, 30];

const formatAgo = (iso) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const ReportedContent = ({ onCount, onAction }) => {
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind, row }

  // Session-local visual state for actions the report-list endpoint doesn't
  // expose a field for (the API contract doesn't give us per-report lock/
  // removed flags or a specific resolution label — only note what we did).
  const [locked, setLocked] = useState({});     // id -> bool
  const [removed, setRemoved] = useState({});   // id -> bool
  const [resolution, setResolution] = useState({}); // id -> label string

  const notify = (msg) => onAction && onAction(msg);

  // The tab badge always reflects the true pending count, independent of
  // whichever filter chip is selected below.
  const refreshBadge = () => {
    getReports({ status: "pending" }).then((d) => {
      onCount && onCount(typeof d.count === "number" ? d.count : (d.results || []).length);
    });
  };

  const load = () => {
    setLoading(true);
    const status = filter === "resolved" ? "resolved" : "pending";
    getReports({ status })
      .then((d) => setRows(d.results || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filter]);
  useEffect(refreshBadge, []);

  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  let visible = filter === "high" ? rows.filter((r) => severityOf(r.reason) === "high") : rows;
  const q = search.trim().toLowerCase();
  if (q) {
    visible = visible.filter((r) =>
      (r.content_title || "").toLowerCase().includes(q) ||
      (r.snippet || "").toLowerCase().includes(q) ||
      (r.reporter?.display_name || "").toLowerCase().includes(q) ||
      (REASON_LABELS[r.reason] || "").toLowerCase().includes(q)
    );
  }
  visible = [...visible].sort((a, b) => SEV_RANK[severityOf(a.reason)] - SEV_RANK[severityOf(b.reason)]);

  const selected = visible.find((r) => r.id === selectedId) || visible[0] || null;

  // Any escalation (dismiss/warn/ban/suspend/delete) resolves the report and
  // drops it out of the pending queue. Lock/Unlock act on the thread but
  // leave the report itself pending for further review.
  const finishAction = (row, label, { resolves = true } = {}) => {
    setResolution((m) => ({ ...m, [row.id]: label }));
    if (resolves) removeRow(row.id);
    notify(label);
    refreshBadge();
  };

  const dismiss = async (row) => {
    await dismissReport(row.id);
    finishAction(row, "Report dismissed");
  };

  const runConfirm = async (note, days) => {
    const { kind, row } = confirm;
    setConfirm(null);
    if (kind === "warn") {
      await warnReportTarget(row.id, note);
      finishAction(row, `Warned ${row.author?.display_name || "user"}`);
    } else if (kind === "ban") {
      await banReportTarget(row.id, note);
      finishAction(row, `Banned ${row.author?.display_name || "user"}`);
    } else if (kind === "suspend") {
      await suspendReportTarget(row.id, days, note);
      finishAction(row, `Suspended ${row.author?.display_name || "user"} for ${days} days`);
    } else if (kind === "delete") {
      await deleteReport(row.id, note);
      setRemoved((m) => ({ ...m, [row.id]: true }));
      finishAction(row, "Thread removed");
    } else if (kind === "lock") {
      await lockReport(row.id, note);
      setLocked((m) => ({ ...m, [row.id]: true }));
      finishAction(row, "Thread locked", { resolves: false });
    } else if (kind === "unlock") {
      await unlockReport(row.id, note);
      setLocked((m) => ({ ...m, [row.id]: false }));
      finishAction(row, "Thread unlocked", { resolves: false });
    }
  };

  return (
    <div>
      <div className="mod-chip-row">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            className={`mod-chip${filter === key ? " active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
        <input
          className="mod-search"
          style={{ marginLeft: "auto", minWidth: 240 }}
          placeholder="Search reports…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="dashboard-loading">Loading...</div>
      ) : (
        <div className="mod-reports-grid">
          <div className="mod-queue-col">
            <div className="mod-queue-count">
              {visible.length} {visible.length === 1 ? "report" : "reports"} · sorted by priority
            </div>
            <div className="mod-queue-list">
              {visible.length === 0 ? (
                <div className="mod-empty">
                  <h4>All clear!</h4>
                  <p>No reports match this filter.</p>
                </div>
              ) : (
                visible.map((r) => {
                  const sev = severityOf(r.reason);
                  const isSelected = selected && selected.id === r.id;
                  return (
                    <button
                      key={r.id}
                      className={`mod-report-card${isSelected ? " selected" : ""}`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <div className="mod-report-card-head">
                        <span className={`mod-badge ${SEV_PAL[sev]}`}>{SEV_LABEL[sev]}</span>
                        <span className="mod-time">{formatAgo(r.created_at)}</span>
                      </div>
                      <div className="mod-report-card-title">{r.content_title || "(untitled content)"}</div>
                      <div className="mod-report-card-reason">{REASON_LABELS[r.reason] || r.reason}</div>
                      <div className="mod-report-card-meta">
                        <span>by {r.reporter?.display_name || "unknown"}</span>
                        <span>·</span>
                        <span>{r.report_count} report{r.report_count === 1 ? "" : "s"}</span>
                        {filter === "resolved" && (
                          <span className="mod-badge pal-green">{resolution[r.id] || "Resolved"}</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {selected ? (
            <div className="mod-review-panel">
              <div className="mod-review-head">
                <div className="flags">
                  <span className={`mod-badge ${SEV_PAL[severityOf(selected.reason)]}`}>
                    {SEV_LABEL[severityOf(selected.reason)]} priority
                  </span>
                  <span>Reason: <strong style={{ color: "#374151" }}>{REASON_LABELS[selected.reason] || selected.reason}</strong></span>
                  {locked[selected.id] && <span className="mod-badge pal-blue">Locked</span>}
                  {removed[selected.id] && <span className="mod-badge pal-red">Removed</span>}
                </div>
                <h2>{selected.content_title || "(untitled content)"}</h2>
              </div>

              <div className="mod-review-body">
                <div className="mod-reporter-box">
                  <div className="head">
                    <TriangleAlert size={15} color="#dc2626" />
                    <span className="label">Report from {selected.reporter?.display_name || "unknown"}</span>
                    <span className="time">{formatAgo(selected.created_at)}</span>
                  </div>
                  <div className="desc">Reported for: {REASON_LABELS[selected.reason] || selected.reason}</div>
                  <div className="count">
                    {selected.report_count} member{selected.report_count === 1 ? " has" : "s have"} reported this content
                  </div>
                </div>

                <div>
                  <div className="mod-review-section-label">Reported content</div>
                  <div className="mod-reported-content">
                    {selected.author && (
                      <div className="author-row">
                        <span className="mod-avatar" style={{ background: selected.author.color }}>
                          {selected.author.initials}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="author-name">{selected.author.display_name}</div>
                          <div className="author-meta">Author</div>
                        </div>
                        {selected.content_type && <span className="type-pill">{selected.content_type}</span>}
                      </div>
                    )}
                    {selected.snippet && <div className="body">{selected.snippet}</div>}
                  </div>
                </div>

                <div>
                  <div className="mod-review-section-label">Take action</div>
                  <div className="mod-review-actions">
                    <button className="mod-btn ghost" onClick={() => dismiss(selected)}>
                      <Check size={14} /> Dismiss
                    </button>
                    <button className="mod-btn warn" onClick={() => setConfirm({ kind: "warn", row: selected })}>
                      <TriangleAlert size={14} /> Warn user
                    </button>
                    {locked[selected.id] ? (
                      <button className="mod-btn info" onClick={() => setConfirm({ kind: "unlock", row: selected })}>
                        <Unlock size={14} /> Unlock thread
                      </button>
                    ) : (
                      <button className="mod-btn info" onClick={() => setConfirm({ kind: "lock", row: selected })}>
                        <Lock size={14} /> Lock thread
                      </button>
                    )}
                    <button className="mod-btn suspend" onClick={() => setConfirm({ kind: "suspend", row: selected })}>
                      <CircleUserRound size={14} /> Suspend
                    </button>
                    <button className="mod-btn danger" onClick={() => setConfirm({ kind: "ban", row: selected })}>
                      <Ban size={14} /> Ban user
                    </button>
                    {removed[selected.id] ? (
                      <button className="mod-btn ghost" disabled>
                        <ShieldCheck size={14} /> Removed
                      </button>
                    ) : (
                      <button className="mod-btn danger" onClick={() => setConfirm({ kind: "delete", row: selected })}>
                        <Trash2 size={14} /> Delete thread
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mod-review-empty">
              <ShieldCheck size={46} strokeWidth={1.6} />
              <div className="title">Queue cleared</div>
              <div className="sub">No report selected. Nice work keeping the forum clean.</div>
            </div>
          )}
        </div>
      )}

      {confirm?.kind === "warn" && (
        <NoteConfirmModal
          title="Warn User"
          message="A formal warning will be sent to the user. Repeated warnings may lead to a ban."
          notePlaceholder="Add a note to the warning (optional)…"
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === "ban" && (
        <NoteConfirmModal
          title="Ban User"
          message="This user will be banned from posting, answering, and commenting on ShikshaCom."
          notePlaceholder="Reason for ban (shown to admin)…"
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === "suspend" && (
        <NoteConfirmModal
          title="Suspend User"
          message="Temporarily block this user from posting. Access returns automatically when the suspension ends."
          notePlaceholder="Reason for suspension…"
          durationOptions={DURATIONS}
          defaultDays={7}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === "lock" && (
        <NoteConfirmModal
          title="Lock Thread"
          message="Keep the thread visible but stop any new replies."
          notePlaceholder="Optional note for the audit log…"
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === "unlock" && (
        <NoteConfirmModal
          title="Unlock Thread"
          message="Re-open this thread so members can reply again."
          notePlaceholder="Optional note for the audit log…"
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === "delete" && (
        <NoteConfirmModal
          title="Delete Thread"
          message="This will remove the content from the forum and notify the author. Threads can be restored later from the All Threads tab."
          notePlaceholder="Reason for removal (recommended)…"
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default ReportedContent;
