// Instant Scholarship module — admin API calls. Split into its own file
// rather than growing admin.js further, matching the convention already
// used for admin_communication.js/admin_counseling.js/livestream.js/rbac.js.
//
// Every endpoint lives under /scholarship/admin/* on the backend
// (scholarship/admin_views.py), gated by IsAdmin — no extra auth handling
// needed here beyond the shared `api` instance's cookie-JWT.
import api from "./apiClient";

/* ── Settings (singleton) ── */
export const getScholarshipSettings = async () =>
  (await api.get("/scholarship/admin/settings/")).data;
export const updateScholarshipSettings = async (d) =>
  (await api.patch("/scholarship/admin/settings/", d)).data;

/* ── Bands ── */
export const getScholarshipBands = async () =>
  (await api.get("/scholarship/admin/bands/")).data;
export const createScholarshipBand = async (d) =>
  (await api.post("/scholarship/admin/bands/", d)).data;
export const updateScholarshipBand = async (id, d) =>
  (await api.patch(`/scholarship/admin/bands/${id}/`, d)).data;
export const deleteScholarshipBand = async (id) =>
  (await api.delete(`/scholarship/admin/bands/${id}/`)).data;

/* ── Question bank ── */
export const getQuestionBank = async (params) =>
  (await api.get("/scholarship/admin/question-bank/", { params })).data;
export const createQuestionBankItem = async (d) =>
  (await api.post("/scholarship/admin/question-bank/", d)).data;
export const updateQuestionBankItem = async (id, d) =>
  (await api.patch(`/scholarship/admin/question-bank/${id}/`, d)).data;
export const deleteQuestionBankItem = async (id) =>
  (await api.delete(`/scholarship/admin/question-bank/${id}/`)).data;
export const generateAiQuestions = async (d) =>
  (await api.post("/scholarship/admin/question-bank/generate-ai/", d)).data;
export const bulkCreateQuestionBankItems = async (questions) =>
  (await api.post("/scholarship/admin/question-bank/bulk-create/", { questions })).data;

/* ── Guardian verification queue ── */
export const getGuardianVerifications = async (params) =>
  (await api.get("/scholarship/admin/verifications/", { params })).data;
export const actionGuardianVerification = async (id, action, reason = "") =>
  (await api.post(`/scholarship/admin/verifications/${id}/action/`, { action, reason })).data;

/* ── Exam session monitor ── */
export const getExamSessions = async (params) =>
  (await api.get("/scholarship/admin/sessions/", { params })).data;
export const getExamSessionDetail = async (id) =>
  (await api.get(`/scholarship/admin/sessions/${id}/`)).data;
export const actionExamSession = async (id, action, notes = "") =>
  (await api.post(`/scholarship/admin/sessions/${id}/`, { action, notes })).data;

/* ── Eligibility ledger ── */
export const getEligibilityRecords = async (params) =>
  (await api.get("/scholarship/admin/eligibility/", { params })).data;
export const voidEligibilityRecord = async (id, reason) =>
  (await api.post(`/scholarship/admin/eligibility/${id}/void/`, { reason })).data;

/* ── Awards ── */
export const getScholarshipAwards = async (params) =>
  (await api.get("/scholarship/admin/awards/", { params })).data;
export const voidScholarshipAward = async (id, reason) =>
  (await api.post(`/scholarship/admin/awards/${id}/void/`, { reason })).data;

/* ── Dashboard stats ── */
export const getScholarshipStats = async () =>
  (await api.get("/scholarship/admin/stats/")).data;
