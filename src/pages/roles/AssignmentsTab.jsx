import { useEffect, useState, useCallback, useRef } from "react";
import { Search, UserPlus, UserMinus } from "lucide-react";
import { getUsers } from "../../api/admin";
import { getRoles, assignRole, revokeRole, getRolesDirectory } from "../../api/rbac";

const AssignmentsTab = ({ notify }) => {
  const [directory, setDirectory] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pickRole, setPickRole] = useState("MODERATOR");
  const [busyId, setBusyId] = useState(null);
  const debounceRef = useRef(null);

  const loadDirectory = useCallback(async () => {
    try {
      const [dir, r] = await Promise.all([getRolesDirectory(), getRoles()]);
      setDirectory(dir);
      setRoles(r);
    } catch {
      notify("Failed to load assignments.");
    }
  }, [notify]);

  useEffect(() => { loadDirectory(); }, [loadDirectory]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!search.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await getUsers({ search: search.trim(), page_size: 10 });
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const doAssign = async (userId) => {
    setBusyId(userId);
    try {
      await assignRole(userId, pickRole);
      notify(`Assigned ${pickRole}.`);
      loadDirectory();
    } catch (e) {
      notify(e?.response?.data?.role?.[0] || "Failed to assign role.");
    } finally {
      setBusyId(null);
    }
  };

  const doRevoke = async (userId, role) => {
    setBusyId(userId + role);
    try {
      await revokeRole(userId, role);
      notify(`Revoked ${role}.`);
      loadDirectory();
    } catch (e) {
      notify(e?.response?.data?.detail || "Failed to revoke role.");
    } finally {
      setBusyId(null);
    }
  };

  const fmt = (d) => (d ? new Date(d).toLocaleDateString() : "—");
  const roleDesc = (name) => roles.find((r) => r.name === name)?.description;
  const selectedRoleDesc = roleDesc(pickRole);

  return (
    <div>
      {/* Assign a role to a user */}
      <div className="rbac-assign-box">
        <h3>Assign a role</h3>
        <div className="rbac-assign-controls">
          <div className="rbac-search">
            <Search size={16} />
            <input
              placeholder="Search users by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select value={pickRole} onChange={(e) => setPickRole(e.target.value)} className="rbac-input rbac-select">
            {roles.map((r) => (
              <option key={r.id} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>
        {selectedRoleDesc && <p className="rbac-role-desc">{selectedRoleDesc}</p>}

        {searching && <div className="mod-empty">Searching…</div>}
        {!searching && search.trim() && results.length === 0 && (
          <div className="mod-empty">No users found.</div>
        )}
        {results.length > 0 && (
          <div className="rbac-result-list">
            {results.map((u) => (
              <div key={u.id} className="rbac-result-row">
                <div>
                  <div className="rbac-user-name">{u.profile?.full_name || u.username}</div>
                  <div className="rbac-user-email">{u.email}</div>
                  {Array.isArray(u.roles) && u.roles.length > 0 && (
                    <div className="rbac-user-roles">{u.roles.join(", ")}</div>
                  )}
                </div>
                <button
                  className="mod-btn success small"
                  disabled={busyId === u.id}
                  onClick={() => doAssign(u.id)}
                >
                  <UserPlus size={14} /> Assign {pickRole}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current staff-role holders */}
      {directory.map((group) => (
        <div key={group.role} className="rbac-dir-group">
          <h3>{group.role} <span className="rbac-count">({group.users.length})</span></h3>
          {roleDesc(group.role) && <p className="rbac-role-desc">{roleDesc(group.role)}</p>}
          {group.users.length === 0 ? (
            <div className="mod-empty">No users hold this role.</div>
          ) : (
            <table className="mod-user-table">
              <thead>
                <tr>
                  <th>User</th><th>Email</th><th>Assigned by</th><th>Assigned</th><th></th>
                </tr>
              </thead>
              <tbody>
                {group.users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.email}</td>
                    <td>{u.approved_by || "—"}</td>
                    <td>{fmt(u.approved_at)}</td>
                    <td>
                      <button
                        className="mod-btn danger small"
                        disabled={busyId === u.id + group.role}
                        onClick={() => doRevoke(u.id, group.role)}
                      >
                        <UserMinus size={14} /> Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
};

export default AssignmentsTab;
