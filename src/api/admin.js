import api from "./apiClient";

/* ── small helper: never let a missing/optional endpoint crash a page ── */
const safe = async (fn, fallback) => {
  try { return await fn(); } catch { return fallback; }
};

/* ── Dashboard ── */
export const getStats = async () => (await api.get("/accounts/admin/stats/")).data;

/* ── Users ── */
export const getUsers   = async (params) => (await api.get("/accounts/admin/users/", { params })).data;
export const getUser    = async (id)     => (await api.get(`/accounts/admin/users/${id}/`)).data;
export const updateUser = async (id, d)  => (await api.patch(`/accounts/admin/users/${id}/`, d)).data;

/* ── Teacher approvals (track-aware: items carry { track, track_label }) ── */
export const getApprovals  = async ()           => (await api.get("/accounts/admin/teacher-approvals/")).data;
export const actOnApproval = async (id, action) =>
  (await api.post(`/accounts/admin/teacher-approvals/${id}/action/`, { action })).data;

/* ── Enrollment requests (manual UPI flow) ── */
export const getEnrollmentRequests  = async (params) =>
  (await api.get("/enrollments/admin/requests/", { params })).data;
export const actOnEnrollmentRequest = async (id, action, admin_note = "") =>
  (await api.post(`/enrollments/admin/requests/${id}/action/`, { action, admin_note })).data;

/* ── Payment mode (pluggable: free / manual_upi / razorpay) ── */
export const getPaymentConfig = async () =>
  safe(async () => (await api.get("/enrollments/payment-config/")).data,
       { provider: "free", label: "Free (no payment)", is_free: true,
         requires_manual_proof: false, auto_activate: true, collects_money: false });

/* ── Courses: academic (courses app) + skill (skills app) ── */
export const getAcademicCourses = async (params) =>
  safe(async () => (await api.get("/courses/admin/", { params })).data, []);

export const getSkillCategories = async () =>
  safe(async () => (await api.get("/skill/categories/")).data, []);
export const getSkillExperts = async (params) =>
  safe(async () => (await api.get("/skill/teachers/", { params })).data, []);
export const getSkillApplications = async () =>
  safe(async () => (await api.get("/skill/admin/interview-queue/")).data, []);

/* ── Payments (gateway orders — only meaningful once a gateway is live) ── */
export const getPayments = async (params) =>
  safe(async () => (await api.get("/payments/admin/orders/", { params })).data, { results: [] });

/* ── Forum moderation ── */
export const getThreads   = async (params) =>
  safe(async () => (await api.get("/forum/threads/", { params })).data, { results: [] });
export const deleteThread = async (id) => (await api.delete(`/forum/threads/${id}/delete/`)).data;
