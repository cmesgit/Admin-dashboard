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

<<<<<<< HEAD
// ── Boards ──────────────────────────────────────────────
export const getBoards     = async ()      => (await api.get("/courses/admin/boards/")).data;
export const createBoard   = async (data)  => (await api.post("/courses/admin/boards/", data)).data;
export const updateBoard   = async (id, d) => (await api.patch(`/courses/admin/boards/${id}/`, d)).data;
export const deleteBoard   = async (id)    => (await api.delete(`/courses/admin/boards/${id}/`)).data;

// ── Courses (per board) ─────────────────────────────────
export const getBoardCourses = async (boardId) =>
  (await api.get(`/courses/admin/boards/${boardId}/courses/`)).data;
export const createCourse  = async (data) => (await api.post("/courses/admin/courses/", data)).data;
export const deleteCourse  = async (id)   => (await api.delete(`/courses/admin/courses/${id}/`)).data;

// ── Subjects (per course) ───────────────────────────────
export const getCourseSubjects = async (courseId) =>
  (await api.get(`/courses/admin/courses/${courseId}/subjects/`)).data;
export const createSubject = async (courseId, data) => {
  // data may include an image File → send as FormData
  if (data && data.image instanceof File) {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") fd.append(k, v);
    });
    return (await api.post(`/courses/admin/courses/${courseId}/subjects/`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    })).data;
  }
  return (await api.post(`/courses/admin/courses/${courseId}/subjects/`, data)).data;
};
export const deleteSubject = async (id) => (await api.delete(`/courses/admin/subjects/${id}/`)).data;
=======
// --- payment settings (global_settings.AdminGlobalSettingsView) ---
export const getSettings    = async ()  => (await api.get("/admin/settings/")).data;
export const updateSettings = async (d) => (await api.patch("/admin/settings/", d)).data;

// --- skill-dev expert screening ---
export const getSkillApplications = async ()         => (await api.get("/skill/admin/interview-queue/")).data;
export const submitEvaluation     = async (appId, d) => (await api.post(`/skill/admin/interviews/${appId}/evaluation/`, d)).data;

// --- skill-dev course review ---
export const getSkillCourses   = async (params)              => (await api.get("/skill/admin/courses/", { params })).data;
export const reviewSkillCourse = async (id, action, reason="") => (await api.post(`/skill/admin/courses/${id}/review/`, { action, reason })).data;
>>>>>>> cc3301e (sdsdsdsd)
