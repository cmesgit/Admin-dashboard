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

/* ── Forum moderation: All Threads tab (unchanged from before) ── */
export const getThreads   = async (params) =>
  safe(async () => (await api.get("/forum/threads/", { params })).data, { results: [] });
export const deleteThread = async (id) => (await api.delete(`/forum/threads/${id}/delete/`)).data;

/* ── Moderator Panel: Reported Content ── */
export const getReports        = async (params) =>
  safe(async () => (await api.get("/forum/mod/reports/", { params })).data, { results: [], count: 0 });
export const dismissReport     = async (id) => (await api.post(`/forum/mod/reports/${id}/dismiss/`, {})).data;
export const deleteReport      = async (id, note = "") => (await api.post(`/forum/mod/reports/${id}/delete/`, { note })).data;
export const warnReportTarget  = async (id, note = "") => (await api.post(`/forum/mod/reports/${id}/warn/`, { note })).data;
export const banReportTarget   = async (id, note = "") => (await api.post(`/forum/mod/reports/${id}/ban/`, { note })).data;
export const suspendReportTarget = async (id, duration_days, note = "") =>
  (await api.post(`/forum/mod/reports/${id}/suspend/`, { duration_days, note })).data;
export const lockReport        = async (id, note = "") => (await api.post(`/forum/mod/reports/${id}/lock/`, { note })).data;
export const unlockReport      = async (id, note = "") => (await api.post(`/forum/mod/reports/${id}/unlock/`, { note })).data;

/* ── Moderator Panel: Auto-Rejected Queue ── */
export const getAutoRejected        = async (params) =>
  safe(async () => (await api.get("/forum/mod/auto-rejected/", { params })).data, { results: [], count: 0 });
export const deleteAutoRejected     = async (id, note = "") =>
  (await api.post(`/forum/mod/auto-rejected/${id}/delete/`, { note })).data;
export const restoreAutoRejected    = async (id) =>
  (await api.post(`/forum/mod/auto-rejected/${id}/restore/`, {})).data;
export const banAutoRejectedAuthor  = async (id, note = "") =>
  (await api.post(`/forum/mod/auto-rejected/${id}/ban-author/`, { note })).data;

/* ── Moderator Panel: User Management ── */
export const getModUsers = async (params) =>
  safe(async () => (await api.get("/forum/mod/users/", { params })).data, { results: [], count: 0 });
export const warnModUser  = async (id, note = "") => (await api.post(`/forum/mod/users/${id}/warn/`, { note })).data;
export const banModUser   = async (id, note = "") => (await api.post(`/forum/mod/users/${id}/ban/`, { note })).data;
export const unbanModUser = async (id, note = "") => (await api.post(`/forum/mod/users/${id}/unban/`, { note })).data;
export const suspendModUser = async (id, duration_days, note = "") =>
  (await api.post(`/forum/mod/users/${id}/suspend/`, { duration_days, note })).data;

/* ── Moderator Panel: Analytics ──
   header_stats: { open_reports, high_priority, banned_users, actions_today } */
export const getModAnalytics = async () =>
  safe(async () => (await api.get("/forum/mod/analytics/")).data,
       { kpis: [], reports_by_reason: [], recent_actions: [], this_month: {},
         header_stats: { open_reports: 0, high_priority: 0, banned_users: 0, actions_today: 0 } });

/* ── Moderator Panel: All Threads (moderator-only, sees locked/removed too) ── */
export const getModThreads    = async (params) =>
  safe(async () => (await api.get("/forum/mod/threads/", { params })).data, { results: [], count: 0 });
export const lockThread       = async (id, note = "") => (await api.post(`/forum/mod/threads/${id}/lock/`, { note })).data;
export const unlockThread     = async (id, note = "") => (await api.post(`/forum/mod/threads/${id}/unlock/`, { note })).data;
export const deleteModThread  = async (id, note = "") => (await api.post(`/forum/mod/threads/${id}/delete/`, { note })).data;
export const restoreModThread = async (id, note = "") => (await api.post(`/forum/mod/threads/${id}/restore/`, { note })).data;

/* ── Moderator Panel: Activity Log ── */
export const getModLog = async (params) =>
  safe(async () => (await api.get("/forum/mod/log/", { params })).data, { results: [], count: 0 });

/* ── Grant/revoke the MODERATOR role on a user (Users/UserDetail page) ── */
export const updateUserModerator = async (id, isModerator) =>
  (await api.patch(`/accounts/admin/users/${id}/`, { is_moderator: isModerator })).data;

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

/* ── Academy Quizzes (admin verification queue) ──
   GET  /quizzes/admin/?status=pending|approved|rejected|draft&subject=<id>&search=
   GET  /quizzes/admin/<id>/                → full quiz + questions
   POST /quizzes/admin/<id>/review/         { action: approve|reject, reason } */
export const getAcademyQuizzes    = async (params) =>
  safe(async () => (await api.get("/quizzes/admin/", { params })).data, []);
export const getAcademyQuizDetail = async (id) =>
  (await api.get(`/quizzes/admin/${id}/`)).data;
export const reviewAcademyQuiz    = async (id, action, reason = "") =>
  (await api.post(`/quizzes/admin/${id}/review/`, { action, reason })).data;

/* ══════════════════════════════════════════════════════════════════════
   Content (CMS): blog posts, current affairs, FAQs, announcements,
   homepage showcase cards, and tags. All endpoints require an is_staff
   (full admin) account — same gate shape as everything else above.
   ══════════════════════════════════════════════════════════════════════ */

/* Multipart is only used when a new file is actually picked; otherwise the
   caller passes a plain object and this sends ordinary JSON (mirrors the
   createSubject convention above). */
const multipartConfig = { headers: { "Content-Type": "multipart/form-data" } };

/* ── Content: Tags ── */
export const getContentTags    = async (params) =>
  safe(async () => (await api.get("/content/admin/tags/", { params })).data, []);
export const createContentTag  = async (data) =>
  (await api.post("/content/admin/tags/", data)).data;
export const updateContentTag  = async (id, data) =>
  (await api.patch(`/content/admin/tags/${id}/`, data)).data;
export const deleteContentTag  = async (id) =>
  (await api.delete(`/content/admin/tags/${id}/`)).data;

/* ── Content: FAQs (list supports ?page=home|courses|counselling|skills|general) ── */
export const getContentFaqs    = async (params) =>
  safe(async () => (await api.get("/content/admin/faqs/", { params })).data, []);
export const createContentFaq  = async (data) =>
  (await api.post("/content/admin/faqs/", data)).data;
export const updateContentFaq  = async (id, data) =>
  (await api.patch(`/content/admin/faqs/${id}/`, data)).data;
export const deleteContentFaq  = async (id) =>
  (await api.delete(`/content/admin/faqs/${id}/`)).data;

/* ── Content: Announcements ── */
export const getContentAnnouncements   = async (params) =>
  safe(async () => (await api.get("/content/admin/announcements/", { params })).data, []);
export const createContentAnnouncement = async (data) =>
  (await api.post("/content/admin/announcements/", data)).data;
export const updateContentAnnouncement = async (id, data) =>
  (await api.patch(`/content/admin/announcements/${id}/`, data)).data;
export const deleteContentAnnouncement = async (id) =>
  (await api.delete(`/content/admin/announcements/${id}/`)).data;

/* ── Content: Showcase Courses (homepage "Featured courses" grid cards) ── */
export const getContentShowcase    = async (params) =>
  safe(async () => (await api.get("/content/admin/showcase/", { params })).data, []);
export const createContentShowcase = async (data, isMultipart = false) =>
  (await api.post("/content/admin/showcase/", data, isMultipart ? multipartConfig : undefined)).data;
export const updateContentShowcase = async (id, data, isMultipart = false) =>
  (await api.patch(`/content/admin/showcase/${id}/`, data, isMultipart ? multipartConfig : undefined)).data;
export const deleteContentShowcase = async (id) =>
  (await api.delete(`/content/admin/showcase/${id}/`)).data;

/* ── Content: Blog Posts ── */
export const getContentBlogs      = async (params) =>
  safe(async () => (await api.get("/content/admin/blogs/", { params })).data, []);
export const createContentBlog    = async (data, isMultipart = false) =>
  (await api.post("/content/admin/blogs/", data, isMultipart ? multipartConfig : undefined)).data;
export const updateContentBlog    = async (id, data, isMultipart = false) =>
  (await api.patch(`/content/admin/blogs/${id}/`, data, isMultipart ? multipartConfig : undefined)).data;
export const deleteContentBlog    = async (id) =>
  (await api.delete(`/content/admin/blogs/${id}/`)).data;
export const publishContentBlog   = async (id) =>
  (await api.post(`/content/admin/blogs/${id}/publish/`, {})).data;
export const unpublishContentBlog = async (id) =>
  (await api.post(`/content/admin/blogs/${id}/unpublish/`, {})).data;

/* ── Content: Current Affairs (same CRUD + publish/unpublish shape as Blog
   Posts; the backend contract given to us didn't spell out the URL segment
   for this resource, so — matching "blogs" being short plural of the model
   name — this assumes "current-affairs". Flagged in the handoff report. ── */
export const getContentAffairs      = async (params) =>
  safe(async () => (await api.get("/content/admin/current-affairs/", { params })).data, []);
export const createContentAffair    = async (data) =>
  (await api.post("/content/admin/current-affairs/", data)).data;
export const updateContentAffair    = async (id, data) =>
  (await api.patch(`/content/admin/current-affairs/${id}/`, data)).data;
export const deleteContentAffair    = async (id) =>
  (await api.delete(`/content/admin/current-affairs/${id}/`)).data;
export const publishContentAffair   = async (id) =>
  (await api.post(`/content/admin/current-affairs/${id}/publish/`, {})).data;
export const unpublishContentAffair = async (id) =>
  (await api.post(`/content/admin/current-affairs/${id}/unpublish/`, {})).data;
