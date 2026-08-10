import { useEffect, useState, useCallback } from "react";
import { Search } from "lucide-react";
import { getModActionHistory } from "../../api/rbac";

const ACTION_OPTIONS = [
  ["", "All actions"],
  ["dismiss", "Dismissed"], ["delete", "Removed"], ["warn", "Warned"],
  ["ban", "Banned"], ["unban", "Reinstated"], ["restore", "Restored"],
  ["suspend", "Suspended"], ["lock", "Locked"], ["unlock", "Unlocked"],
];

const TYPE_CLASS = { bad: "danger", warn: "warn", ok: "success" };

const ActionHistoryTab = () => {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [moderator, setModerator] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getModActionHistory({
        page, page_size: pageSize,
        ...(action ? { action } : {}),
        ...(moderator.trim() ? { moderator: moderator.trim() } : {}),
      });
      setRows(data.results || []);
      setCount(data.count || 0);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, action, moderator]);

  useEffect(() => {
    const t = setTimeout(load, moderator ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, moderator]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const fmt = (d) => (d ? new Date(d).toLocaleString() : "—");

  return (
    <div>
      <div className="rbac-toolbar">
        <div className="rbac-search">
          <Search size={16} />
          <input
            placeholder="Filter by moderator…"
            value={moderator}
            onChange={(e) => { setPage(1); setModerator(e.target.value); }}
          />
        </div>
        <select
          className="rbac-input rbac-select"
          value={action}
          onChange={(e) => { setPage(1); setAction(e.target.value); }}
        >
          {ACTION_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="rbac-count">{count} action{count === 1 ? "" : "s"}</span>
      </div>

      {loading ? (
        <div className="mod-empty">Loading history…</div>
      ) : rows.length === 0 ? (
        <div className="mod-empty">No moderator actions recorded.</div>
      ) : (
        <table className="mod-user-table">
          <thead>
            <tr><th>Action</th><th>Detail</th><th>Moderator</th><th>Target</th><th>Note</th><th>When</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className={`rbac-action-tag ${TYPE_CLASS[r.type] || ""}`}>{r.label}</span>
                </td>
                <td>{r.text}</td>
                <td>{r.moderator}</td>
                <td>{r.target_user || "—"}</td>
                <td className="rbac-note-cell">{r.note || "—"}</td>
                <td>{fmt(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div className="rbac-pagination">
          <button className="mod-btn ghost small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button className="mod-btn ghost small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ActionHistoryTab;
