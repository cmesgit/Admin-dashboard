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
export const actOnApproval = async (id, action, reason = "") =>
  (await api.post(`/accounts/admin/teacher-approvals/${id}/action/`, { action, reason })).data;

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
// alias kept so older pages calling getCourses keep working
export const getCourses = getAcademicCourses;

/* ── Academic course management: Boards → Courses → Subjects ── */
export const getBoards   = async () =>
  safe(async () => (await api.get("/courses/admin/boards/")).data, []);
export const createBoard = async (data) =>
  (await api.post("/courses/admin/boards/", data)).data;
export const updateBoard = async (id, data) =>
  (await api.patch(`/courses/admin/boards/${id}/`, data)).data;
export const deleteBoard = async (id) =>
  (await api.delete(`/courses/admin/boards/${id}/`)).data;

export const getBoardCourses = async (boardId) =>
  safe(async () => (await api.get(`/courses/admin/boards/${boardId}/courses/`)).data, []);
export const createCourse = async (data) =>
  (await api.post("/courses/admin/courses/", data)).data;
export const deleteCourse = async (id) =>
  (await api.delete(`/courses/admin/courses/${id}/`)).data;

export const getCourseSubjects = async (courseId) =>
  safe(async () => (await api.get(`/courses/admin/courses/${courseId}/subjects/`)).data, []);
export const createSubject = async (courseId, formData) =>
  (await api.post(`/courses/admin/courses/${courseId}/subjects/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })).data;
export const deleteSubject = async (subjectId) =>
  (await api.delete(`/courses/admin/subjects/${subjectId}/`)).data;

export const getSkillCategories = async () =>
  safe(async () => (await api.get("/skill/categories/")).data, []);
export const getSkillExperts = async (params) =>
  safe(async () => (await api.get("/skill/teachers/", { params })).data, []);

/* ── Admin skill-expert roster (incl. suspended) + detail + suspend ── */
export const getAdminExperts = async () =>
  safe(async () => (await api.get("/skill/admin/experts/")).data, []);
export const getAdminExpert  = async (id) =>
  (await api.get(`/skill/admin/experts/${id}/`)).data;
export const suspendExpert   = async (id, action) =>
  (await api.post(`/skill/admin/experts/${id}/suspend/`, { action })).data;
export const getSkillApplications = async () =>
  safe(async () => (await api.get("/skill/admin/interview-queue/")).data, []);

/* ── Payments (gateway orders — only meaningful once a gateway is live) ── */
export const getPayments = async (params) =>
  safe(async () => (await api.get("/payments/admin/orders/", { params })).data, { results: [] });

/* ── Forum moderation ── */
export const getThreads   = async (params) =>
  safe(async () => (await api.get("/forum/threads/", { params })).data, { results: [] });
export const deleteThread = async (id) => (await api.delete(`/forum/threads/${id}/delete/`)).data;

/* ── Payment settings (global_settings.AdminGlobalSettingsView) ── */
export const getSettings    = async ()  => (await api.get("/admin/settings/")).data;
export const updateSettings = async (d) => (await api.patch("/admin/settings/", d)).data;

/* ── Skill-dev: evaluation submit + course review ── */
export const submitEvaluation  = async (appId, d) =>
  (await api.post(`/skill/admin/interviews/${appId}/evaluation/`, d)).data;
export const getSkillCourses   = async (params) =>
  safe(async () => (await api.get("/skill/admin/courses/", { params })).data, []);
export const reviewSkillCourse = async (id, action, reason="") =>
  (await api.post(`/skill/admin/courses/${id}/review/`, { action, reason })).data;

/* ── Skill-dev: expert advertising subscriptions (manual UPI) ──
   Teachers submit a UPI payment under "Promote my profile"; admin verifies the
   receipt here and approves (activates the ad) or rejects (back to pending). */
export const getAdSubscriptions    = async (params) =>
  safe(async () => (await api.get("/skill/admin/ad-subscriptions/", { params })).data, []);
export const approveAdSubscription = async (id) =>
  (await api.post(`/skill/admin/ad-subscriptions/${id}/approve/`, {})).data;
export const rejectAdSubscription  = async (id, reason="") =>
  (await api.post(`/skill/admin/ad-subscriptions/${id}/reject/`, { reason })).data;

/* ── Skill-dev: platform-wide session monitor (read-only) ── */
export const getSkillSessions = async (params) =>
  safe(async () => (await api.get("/skill/admin/sessions/", { params })).data,
       { sessions: [], counts: {} });

/* ── Skill-dev: per-user skill context (expert status + learner sessions) ── */
export const getUserSkillProfile = async (userId) =>
  safe(async () => (await api.get(`/skill/admin/users/${userId}/skill-profile/`)).data,
       { is_expert: false, expert: null, learner_sessions: [] });

/* ── Email verification: admin/self-service resend (public endpoint) ── */
export const resendVerification = async (email) =>
  (await api.post("/accounts/resend-verification/", { email })).data;

/* ── Academic course enrollment management ──
   GET  /enrollments/admin/enrollments/?status=ACTIVE|REVOKED&q=<text>
   POST /enrollments/admin/enrollments/<id>/action/  { action: revoke|reactivate } */
export const getEnrollments = async (params) =>
  safe(async () => (await api.get("/enrollments/admin/enrollments/", { params })).data,
       { results: [] });
export const actOnEnrollment = async (id, action, note = "") =>
  (await api.post(`/enrollments/admin/enrollments/${id}/action/`, { action, note })).data;

/* ── Agreement letters (admin editor + immutable version history) ── */
export const getAgreement         = async (key)        => (await api.get(`/accounts/admin/agreements/${key}/`)).data;
export const saveAgreement        = async (key, d)     => (await api.post(`/accounts/admin/agreements/${key}/save/`, d)).data;
export const getAgreementVersions = async (key)        => safe(async () => (await api.get(`/accounts/admin/agreements/${key}/versions/`)).data, []);
export const getAgreementVersion  = async (versionId)  => (await api.get(`/accounts/admin/agreements/versions/${versionId}/`)).data;
export const restoreAgreement     = async (versionId)  => (await api.post(`/accounts/admin/agreements/versions/${versionId}/restore/`, {})).data;
