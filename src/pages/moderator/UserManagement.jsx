import { useEffect, useState } from "react";
import { getModUsers, warnModUser, banModUser, unbanModUser, suspendModUser } from "../../api/admin";
import NoteConfirmModal from "../../components/NoteConfirmModal";

const STATUS_TABS = [["all", "All Users"], ["active", "Active"], ["warned", "Warned"], ["suspended", "Suspended"], ["banned", "Banned"]];
const DURATIONS = [3, 7, 14, 30];

const reportClass = (n) => (n > 4 ? "mod-report-count-red" : n > 1 ? "mod-report-count-amber" : "mod-report-count-green");

const formatDate = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const UserManagement = ({ onAction }) => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // { type, row }

  const notify = (msg) => onAction && onAction(msg);

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

  const runConfirm = async (note, days) => {
    const { type, row } = confirm;
    setConfirm(null);
    if (type === "warn") {
      await warnModUser(row.id, note);
      patchRow(row.id, { status: "warned" });
      notify(`Warned ${row.username}`);
    } else if (type === "ban") {
      await banModUser(row.id, note);
      patchRow(row.id, { status: "banned" });
      notify(`Banned ${row.username}`);
    } else if (type === "suspend") {
      const res = await suspendModUser(row.id, days, note);
      patchRow(row.id, { status: "suspended", suspended_until: res?.suspended_until });
      notify(`Suspended ${row.username} for ${days} days`);
    } else if (type === "reinstate") {
      await unbanModUser(row.id, note);
      patchRow(row.id, { status: "active", suspended_until: null });
      notify(`Reinstated ${row.username}`);
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
            {rows.map((u) => {
              const banned = u.status === "banned";
              const suspended = u.status === "suspended";
              return (
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
                  <td>
                    <span
                      className={`mod-pill status-${u.status}`}
                      title={suspended && u.suspended_until ? `Suspended until ${formatDate(u.suspended_until)}` : undefined}
                    >
                      {u.status[0].toUpperCase() + u.status.slice(1)}
                    </span>
                    {suspended && u.suspended_until && (
                      <div className="mod-substatus">until {formatDate(u.suspended_until)}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {!banned && (
                        <>
                          <button className="mod-btn warn" onClick={() => setConfirm({ type: "warn", row: u })}>Warn</button>
                          <button className="mod-btn suspend" onClick={() => setConfirm({ type: "suspend", row: u })}>Suspend</button>
                          <button className="mod-btn danger" onClick={() => setConfirm({ type: "ban", row: u })}>Ban</button>
                        </>
                      )}
                      {(banned || suspended) && (
                        <button className="mod-btn success" onClick={() => setConfirm({ type: "reinstate", row: u })}>Reinstate</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
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
      {confirm?.type === "suspend" && (
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
      {confirm?.type === "ban" && (
        <NoteConfirmModal
          title="Ban User"
          message="This user will be permanently banned from posting, answering, and commenting."
          notePlaceholder="Reason for ban (shown to admin)…"
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.type === "reinstate" && (
        <NoteConfirmModal
          title="Reinstate User"
          message="This user will be restored to active status (clearing any ban or suspension) and can participate in the forum again."
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default UserManagement;
