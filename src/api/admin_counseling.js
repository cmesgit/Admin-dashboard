// PLACEMENT: src/api/admin_counseling.js   (NEW FILE — admin app)
// Append these exports to api/admin.js, OR keep as a separate module and
// import from it in the two counselling pages — either works since both
// files share the same `api` client instance shape.

import api from "./apiClient";

/* ── Counselor applications (mirrors getApprovals/actOnApproval) ── */
export const getCounselorApplications = async (status = "pending") =>
  (await api.get("/counseling/admin/applications/", { params: { status } })).data;
  // → { results: [...], count, stats: {pending, approved} }

export const actOnCounselorApplication = async (id, action, note = "") =>
  (await api.post(`/counseling/admin/applications/${id}/action/`, { action, note })).data;
  // action: approve | reject | suspend | relist

/* ── Appointments oversight ── */
export const getCounselingAppointments = async (params = {}) =>
  (await api.get("/counseling/admin/appointments/", { params })).data;
  // params: {status, search} → { results: [...], count, stats: {upcoming, completed, counselors} }
