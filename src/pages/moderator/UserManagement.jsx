import { useEffect, useState } from "react";
import { getModUsers, warnModUser, banModUser, unbanModUser } from "../../api/admin";
import NoteConfirmModal from "../../components/NoteConfirmModal";

const STATUS_TABS = [["all", "All Users"], ["active", "Active"], ["warned", "Warned"], ["banned", "Banned"]];

const reportClass = (n) => (n > 4 ? "mod-report-count-red" : n > 1 ? "mod-report-count-amber" : "mod-report-count-green");

const UserManagement = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // { type, row }

  const load = () => {
    setLoading(true);
    getModUsers({ search: search || undefined, status })
      .then((d) => setRows(d.results || []))
      .finally(() => setLoading(false));
  };
  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearchSubmit = (e) => { e.preventDefault(); load(); };

  const patchRow = (id, patch) =>
    setRows((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  const runConfirm = async (note) => {
    const { type, row } = confirm;
    setConfirm(null);
    if (type === "warn") {
      await warnModUser(row.id, note);
      patchRow(row.id, { status: "warned" });
    } else if (type === "ban") {
      await banModUser(row.id, note);
      patchRow(row.id, { status: "banned" });
    } else if (type === "unban") {
      await unbanModUser(row.id, note);
      patchRow(row.id, { status: "active" });
    }
  };

  return (
    <div>
      <div className="mod-toolbar">
        <form onSubmit={onSearchSubmit} style={{ flex: 1, display: "flex", gap: 10 }}>
          <input
            className="mod-search"
            placeholder="Search users by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
        <select className="mod-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_TABS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="dashboard-loading">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="mod-empty"><h4>No users found</h4></div>
      ) : (
        <table className="mod-user-table">
          <thead>
            <tr><th>User</th><th>Posts</th><th>Reports</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="mod-person">
                    <span className="mod-avatar" style={{ background: u.color }}>{u.initials}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.username}</div>
                      <div style={{ color: "#888", fontSize: "0.78rem" }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>{u.posts}</td>
                <td style={{ textAlign: "center" }}>
                  <span className={reportClass(u.reports)}>{u.reports}</span>
                </td>
                <td><span className={`mod-pill status-${u.status}`}>{u.status[0].toUpperCase() + u.status.slice(1)}</span></td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="mod-btn warn" onClick={() => setConfirm({ type: "warn", row: u })}>Warn</button>
                    {u.status === "banned" ? (
                      <button className="mod-btn success" onClick={() => setConfirm({ type: "unban", row: u })}>Unban</button>
                    ) : (
                      <button className="mod-btn danger" onClick={() => setConfirm({ type: "ban", row: u })}>Ban</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
          message="This user will be permanently banned from posting, answering, and commenting."
          notePlaceholder="Reason for ban (shown to admin)…"
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.type === "unban" && (
        <NoteConfirmModal
          title="Lift Ban"
          message="This user will be restored to active status and can participate in the forum again."
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default UserManagement;
