import { useEffect, useState } from "react";
import { Lock, Unlock, Trash2, RotateCcw } from "lucide-react";
import { getModThreads, lockThread, unlockThread, deleteModThread, restoreModThread } from "../../api/admin";
import NoteConfirmModal from "../../components/NoteConfirmModal";

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// Moderator-only thread list — unlike the public thread browser, this can
// see (and act on) locked and removed threads too.
const AllThreads = ({ onAction }) => {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // { kind, row }

  const notify = (msg) => onAction && onAction(msg);

  const load = async () => {
    setLoading(true);
    const pageSize = 100;
    const all = [];
    try {
      let page = 1;
      while (true) {
        const data = await getModThreads({ page, page_size: pageSize });
        const results = data.results || [];
        all.push(...results);
        const count = typeof data.count === "number" ? data.count : all.length;
        if (results.length < pageSize || all.length >= count) break;
        page += 1;
      }
      setThreads(all);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const patchRow = (id, patch) =>
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const runConfirm = async (note) => {
    const { kind, row } = confirm;
    setConfirm(null);
    if (kind === "lock") {
      await lockThread(row.id, note);
      patchRow(row.id, { is_locked: true });
      notify(`Locked "${row.title}"`);
    } else if (kind === "unlock") {
      await unlockThread(row.id, note);
      patchRow(row.id, { is_locked: false });
      notify(`Unlocked "${row.title}"`);
    } else if (kind === "delete") {
      await deleteModThread(row.id, note);
      patchRow(row.id, { is_removed: true });
      notify(`Removed "${row.title}"`);
    } else if (kind === "restore") {
      await restoreModThread(row.id, note);
      patchRow(row.id, { is_removed: false });
      notify(`Restored "${row.title}"`);
    }
  };

  return (
    <div>
      <div className="mod-threads-table-wrap">
        <div className="mod-table-count">{threads.length} thread{threads.length !== 1 ? "s" : ""}</div>
        {loading ? (
          <div className="dashboard-loading">Loading...</div>
        ) : threads.length === 0 ? (
          <div className="mod-empty"><h4>No forum threads.</h4></div>
        ) : (
          <table className="mod-thread-table">
            <thead>
              <tr>
                <th>Thread</th>
                <th>Author</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {threads.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="mod-thread-title">{t.title}</div>
                    <div className="mod-thread-meta">
                      {t.reply_count ?? 0} replies · {t.upvote_count ?? 0} upvotes · {formatDate(t.created_at)}
                    </div>
                  </td>
                  <td>{t.author}</td>
                  <td>
                    {t.is_removed ? (
                      <span className="mod-badge pal-red">Removed</span>
                    ) : t.is_locked ? (
                      <span className="mod-badge pal-blue">Locked</span>
                    ) : (
                      <span className="mod-badge pal-green">Active</span>
                    )}
                  </td>
                  <td>
                    <div className="mod-thread-actions">
                      {t.is_locked ? (
                        <button className="mod-btn info small" onClick={() => setConfirm({ kind: "unlock", row: t })}>
                          <Unlock size={13} /> Unlock
                        </button>
                      ) : (
                        <button className="mod-btn info small" onClick={() => setConfirm({ kind: "lock", row: t })}>
                          <Lock size={13} /> Lock
                        </button>
                      )}
                      {t.is_removed ? (
                        <button className="mod-btn success small" onClick={() => setConfirm({ kind: "restore", row: t })}>
                          <RotateCcw size={13} /> Restore
                        </button>
                      ) : (
                        <button className="mod-btn danger small" onClick={() => setConfirm({ kind: "delete", row: t })}>
                          <Trash2 size={13} /> Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
          title="Remove Thread"
          message="Remove this thread from the forum. You can restore it later from this tab."
          notePlaceholder="Reason for removal…"
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === "restore" && (
        <NoteConfirmModal
          title="Restore Thread"
          message="Make this thread visible in the forum again."
          notePlaceholder="Optional note…"
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default AllThreads;
