// RBAC service — roles, permissions, user↔role assignment, and read-only
// moderator action history. Mirrors accounts/rbac_views.py. Admin-only.
import api from "./apiClient";

// ── Roles ──
export const getRoles = async () => (await api.get("/accounts/admin/roles/")).data;
export const createRole = async (data) => (await api.post("/accounts/admin/roles/", data)).data;
export const updateRole = async (id, data) => (await api.patch(`/accounts/admin/roles/${id}/`, data)).data;
export const deleteRole = async (id) => (await api.delete(`/accounts/admin/roles/${id}/`)).data;

// ── Permissions ──
export const getPermissions = async () => (await api.get("/accounts/admin/permissions/")).data;
export const getRolePermissions = async (id) => (await api.get(`/accounts/admin/roles/${id}/permissions/`)).data;
export const setRolePermissions = async (id, permissions) =>
  (await api.put(`/accounts/admin/roles/${id}/permissions/`, { permissions })).data;

// ── User ↔ role assignment ──
export const getUserRoles = async (userId) => (await api.get(`/accounts/admin/users/${userId}/roles/`)).data;
export const assignRole = async (userId, role) =>
  (await api.post(`/accounts/admin/users/${userId}/roles/`, { role })).data;
export const revokeRole = async (userId, role) =>
  (await api.delete(`/accounts/admin/users/${userId}/roles/${role}/`)).data;
export const getRolesDirectory = async () => (await api.get("/accounts/admin/roles-directory/")).data;

// ── Read-only moderator action history ──
export const getModActionHistory = async (params) =>
  (await api.get("/accounts/admin/mod-actions/", { params })).data;
