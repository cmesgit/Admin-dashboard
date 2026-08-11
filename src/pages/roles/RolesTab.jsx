import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Settings2, Lock, Pencil } from "lucide-react";
import {
  getRoles, createRole, updateRole, deleteRole,
  getPermissions, getRolePermissions, setRolePermissions,
} from "../../api/rbac";
import ConfirmModal from "../../components/ConfirmModal";

const RolesTab = ({ notify }) => {
  const [roles, setRoles] = useState([]);
  const [permGroups, setPermGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editRole, setEditRole] = useState(null);   // role being permission-edited
  const [editSet, setEditSet] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editDescId, setEditDescId] = useState(null);   // role.id being description-edited
  const [descInput, setDescInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([getRoles(), getPermissions()]);
      setRoles(r);
      setPermGroups(p);
    } catch {
      notify("Failed to load roles.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const openEditor = async (role) => {
    try {
      const data = await getRolePermissions(role.id);
      setEditRole(role);
      setEditSet(new Set(data.permissions || []));
    } catch {
      notify("Failed to load role permissions.");
    }
  };

  const togglePerm = (code) => {
    setEditSet((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      await setRolePermissions(editRole.id, [...editSet]);
      notify(`Updated permissions for ${editRole.name}.`);
      setEditRole(null);
      load();
    } catch {
      notify("Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  const submitCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createRole({ name: newName.trim(), description: newDesc.trim() });
      notify(`Created role ${newName.trim().toUpperCase()}.`);
      setCreating(false);
      setNewName(""); setNewDesc("");
      load();
    } catch (e) {
      notify(e?.response?.data?.name?.[0] || "Failed to create role.");
    } finally {
      setSaving(false);
    }
  };

  const startEditDesc = (role) => {
    setEditDescId(role.id);
    setDescInput(role.description || "");
  };

  const saveDesc = async (role) => {
    try {
      await updateRole(role.id, { description: descInput.trim() });
      setEditDescId(null);
      load();
    } catch {
      notify("Failed to save description.");
    }
  };

  const doDelete = async () => {
    try {
      await deleteRole(confirmDelete.id);
      notify(`Deleted role ${confirmDelete.name}.`);
      setConfirmDelete(null);
      load();
    } catch (e) {
      notify(e?.response?.data?.detail || "Failed to delete role.");
      setConfirmDelete(null);
    }
  };

  if (loading) return <div className="mod-empty">Loading roles…</div>;

  return (
    <div>
      <div className="rbac-toolbar">
        <button className="admin-new-btn" onClick={() => setCreating(true)}>
          <Plus size={15} /> New Role
        </button>
      </div>

      <div className="rbac-role-grid">
        {roles.map((role) => (
          <div key={role.id} className="rbac-role-card">
            <div className="rbac-role-top">
              <span className="rbac-role-name">
                {role.name}
                {role.is_builtin && (
                  <span className="rbac-builtin" title="Built-in role">
                    <Lock size={11} /> built-in
                  </span>
                )}
              </span>
            </div>
            {editDescId === role.id ? (
              <div className="rbac-role-desc-edit">
                <textarea
                  className="rbac-input"
                  rows={2}
                  autoFocus
                  placeholder="What can someone with this role do? (shown to admins assigning it)"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                />
                <div className="rbac-role-desc-edit-actions">
                  <button className="mod-btn ghost small" onClick={() => setEditDescId(null)}>Cancel</button>
                  <button className="mod-btn success small" onClick={() => saveDesc(role)}>Save</button>
                </div>
              </div>
            ) : (
              <p className="rbac-role-desc rbac-role-desc-editable" onClick={() => startEditDesc(role)}>
                {role.description || "Add a description of what this role can do…"}
                <Pencil size={11} />
              </p>
            )}
            <div className="rbac-role-stats">
              <span>{role.permission_count} permissions</span>
              <span>·</span>
              <span>{role.user_count} users</span>
            </div>
            <div className="rbac-role-actions">
              <button className="mod-btn ghost small" onClick={() => openEditor(role)}>
                <Settings2 size={14} /> Permissions
              </button>
              {!role.is_builtin && (
                <button className="mod-btn danger small" onClick={() => setConfirmDelete(role)}>
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {editRole && (
        <div className="confirm-overlay" onClick={() => setEditRole(null)}>
          <div className="rbac-matrix-card" onClick={(e) => e.stopPropagation()}>
            <h3>Permissions · {editRole.name}</h3>
            {editRole.is_builtin && (
              <p className="rbac-warn">
                This is a built-in role. Edit with care — its permissions gate core features.
              </p>
            )}
            <div className="rbac-matrix">
              {permGroups.map((group) => (
                <div key={group.category} className="rbac-matrix-group">
                  <h4>{group.category}</h4>
                  {group.permissions.map((p) => (
                    <label key={p.codename} className="rbac-perm-row" title={p.description || ""}>
                      <input
                        type="checkbox"
                        checked={editSet.has(p.codename)}
                        onChange={() => togglePerm(p.codename)}
                      />
                      <span className="rbac-perm-info">
                        <span className="rbac-perm-name">{p.name}</span>
                        {p.description && <span className="rbac-perm-desc">{p.description}</span>}
                      </span>
                      <code className="rbac-perm-code">{p.codename}</code>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setEditRole(null)}>Cancel</button>
              <button className="confirm-ok" onClick={savePermissions} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {creating && (
        <div className="confirm-overlay" onClick={() => setCreating(false)}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <h3>New Role</h3>
            <input
              className="rbac-input" placeholder="Role name (e.g. EDITOR)"
              value={newName} onChange={(e) => setNewName(e.target.value)}
            />
            <textarea
              className="rbac-input" placeholder="Description (optional)" rows={2}
              value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            />
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setCreating(false)}>Cancel</button>
              <button className="confirm-ok" onClick={submitCreate} disabled={saving || !newName.trim()}>
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Delete role ${confirmDelete.name}?`}
          message={`This removes the role and unassigns it from ${confirmDelete.user_count} user(s). This cannot be undone.`}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

export default RolesTab;
