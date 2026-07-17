import { useEffect, useState } from "react";
import { getPermissions } from "../../api/rbac";

const PermissionsTab = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setGroups(await getPermissions());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="mod-empty">Loading permissions…</div>;

  return (
    <div className="rbac-perm-reference">
      <p className="rbac-sub">
        The full catalogue of granular permissions. Grant these to roles under
        the Roles tab, then assign roles to users under Assignments.
      </p>
      {groups.map((group) => (
        <div key={group.category} className="rbac-ref-group">
          <h3>{group.category}</h3>
          <table className="mod-user-table">
            <thead>
              <tr><th>Permission</th><th>Codename</th><th>Description</th></tr>
            </thead>
            <tbody>
              {group.permissions.map((p) => (
                <tr key={p.codename}>
                  <td>{p.name}</td>
                  <td><code className="rbac-perm-code">{p.codename}</code></td>
                  <td>{p.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default PermissionsTab;
