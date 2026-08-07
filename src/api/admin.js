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
export const actOnEnrollmentRequest = async (id, action, admin_note = "", batch = undefined) =>
  (await api.post(`/enrollments/admin/requests/${id}/action/`,
    batch ? { action, admin_note, batch } : { action, admin_note })).data;

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

/* ── Academy: batches (courses app) ── */
export const getCourseBatches = async (courseId) =>
  safe(async () => (await api.get(`/courses/admin/courses/${courseId}/batches/`)).data, []);
export const createBatch = async (courseId, data) =>
  (await api.post(`/courses/admin/courses/${courseId}/batches/`, data)).data;
export const updateBatch = async (batchId, data) =>
  (await api.patch(`/courses/admin/batches/${batchId}/`, data)).data;
export const deleteBatch = async (batchId) =>
  (await api.delete(`/courses/admin/batches/${batchId}/`)).data;

/* Batch progress (read-only for admin) + roster. Requires the per-batch
   progress endpoint and the Enrollment.batch FK from the backend patch. */
export const getBatchProgress = async (batchId) =>
  safe(async () => (await api.get(`/courses/batches/${batchId}/progress/`)).data, null);
export const getBatchRoster = async (batchId, params = {}) =>
  safe(async () =>
    (await api.get(`/enrollments/admin/batch-roster/`, { params: { batch: batchId, ...params } })).data,
    { results: [] });

/* ── Academy: subject-teacher assignment ── */
export const getAdminAcademyTeachers = async (q = "") =>
  safe(async () => (await api.get(`/courses/admin/teachers/`, { params: q ? { q } : {} })).data, []);
export const getSubjectTeachers = async (subjectId) =>
  safe(async () => (await api.get(`/courses/admin/subjects/${subjectId}/teachers/`)).data, []);
export const assignSubjectTeacher = async (subjectId, teacherId, display_role = "PRIMARY") =>
  (await api.post(`/courses/admin/subjects/${subjectId}/teachers/`, { teacher_id: teacherId, display_role })).data;
export const updateSubjectTeacher = async (assignmentId, display_role) =>
  (await api.patch(`/courses/admin/subject-teachers/${assignmentId}/`, { display_role })).data;
export const removeSubjectTeacher = async (assignmentId) =>
  (await api.delete(`/courses/admin/subject-teachers/${assignmentId}/`)).data;

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

/* ── Home page CMS: hero banner / browse categories / closing CTA ──
   All three are plain ModelViewSets (content/admin_views.py) paginated by
   AdminPagination — list responses are unwrapped to a bare array here so
   callers don't need to know about .results. */
const multipartIfFile = (data) =>
  data instanceof FormData ? { headers: { "Content-Type": "multipart/form-data" } } : undefined;

export const getHeroBanners   = async () =>
  safe(async () => (await api.get("/content/admin/hero/")).data.results, []);
export const createHeroBanner = async (data) =>
  (await api.post("/content/admin/hero/", data, multipartIfFile(data))).data;
export const updateHeroBanner = async (id, data) =>
  (await api.patch(`/content/admin/hero/${id}/`, data, multipartIfFile(data))).data;
export const deleteHeroBanner = async (id) =>
  (await api.delete(`/content/admin/hero/${id}/`)).data;

export const getHomeCategoriesAdmin = async () =>
  safe(async () => (await api.get("/content/admin/categories/")).data.results, []);
export const createHomeCategory = async (data) =>
  (await api.post("/content/admin/categories/", data)).data;
export const updateHomeCategory = async (id, data) =>
  (await api.patch(`/content/admin/categories/${id}/`, data)).data;
export const deleteHomeCategory = async (id) =>
  (await api.delete(`/content/admin/categories/${id}/`)).data;

export const getHomeCtas   = async () =>
  safe(async () => (await api.get("/content/admin/cta/")).data.results, []);
export const createHomeCta = async (data) =>
  (await api.post("/content/admin/cta/", data)).data;
export const updateHomeCta = async (id, data) =>
  (await api.patch(`/content/admin/cta/${id}/`, data)).data;
export const deleteHomeCta = async (id) =>
  (await api.delete(`/content/admin/cta/${id}/`)).data;
