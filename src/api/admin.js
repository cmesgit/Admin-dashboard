import api from "./apiClient";

export const getStats         = async ()       => (await api.get("/accounts/admin/stats/")).data;
export const getUsers         = async (params) => (await api.get("/accounts/admin/users/", { params })).data;
export const getUser          = async (id)     => (await api.get(`/accounts/admin/users/${id}/`)).data;
export const updateUser       = async (id, d)  => (await api.patch(`/accounts/admin/users/${id}/`, d)).data;
export const getApprovals     = async ()       => (await api.get("/accounts/admin/teacher-approvals/")).data;
export const actOnApproval    = async (id, action) => (await api.post(`/accounts/admin/teacher-approvals/${id}/action/`, { action })).data;
export const getCourses       = async (params) => (await api.get("/courses/admin/", { params })).data;
export const getPayments      = async (params) => (await api.get("/payments/admin/orders/", { params })).data;
export const getThreads       = async (params) => (await api.get("/forum/threads/", { params })).data;
export const deleteThread     = async (id)     => (await api.delete(`/forum/threads/${id}/delete/`)).data;

export const getEnrollmentRequests      = async (params) => (await api.get("/enrollments/admin/requests/", { params })).data;
export const actOnEnrollmentRequest     = async (id, action, admin_note = "") =>
  (await api.post(`/enrollments/admin/requests/${id}/action/`, { action, admin_note })).data;
