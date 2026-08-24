// src/api/admin_question_bank.js
// ──────────────────────────────────────────────────────────────────────────
// A1 · Question Bank Review (design_handoff_quiz_system §A1, Phase 7).
//
// The admin half of the curation loop. Teachers suggest questions to the
// shared ShikshaCom bank from their own builder; nothing here gates whether
// their tests run — accepting only decides what other teachers and student
// chapter-practice can draw on.
//
// Per this app's convention, one file per feature area (see
// admin_scholarship.js, admin_live_rules.js).
// ──────────────────────────────────────────────────────────────────────────
import api from "./apiClient";

/** The queue plus its headline counts. Defaults to `suggested` server-side —
 *  the questions actually waiting on an admin. */
export const getReviewQueue = async (params = {}) =>
  (await api.get("/quizzes/admin/question-bank/queue/", { params })).data;

/** One decision. `action` is "accept" | "request_changes"; feedback is
 *  REQUIRED for the latter (the teacher sees it on the question itself).
 *  Optionally remaps the chapter, or promotes the teacher's own chapter
 *  into the syllabus. */
export const reviewQuestion = async (id, body) =>
  (await api.patch(`/quizzes/admin/question-bank/${id}/review/`, body)).data;

/** "Accept all N from <teacher>". All-or-nothing server-side. */
export const bulkReviewQuestions = async (body) =>
  (await api.post("/quizzes/admin/question-bank/bulk-review/", body)).data;

/** The AI master switch lives on GlobalSettings, not on this feature —
 *  same endpoint the live-rules panel writes. */
export const getGlobalSettings = async () =>
  (await api.get("/admin/settings/")).data;

export const setAiDrafting = async (enabled) =>
  (await api.patch("/admin/settings/", { ai_question_drafting_enabled: enabled })).data;

/** Chapters of a subject, for the review panel's remap control. */
export const getSubjectChapters = async (subjectId) =>
  (await api.get(`/courses/subjects/${subjectId}/chapters/`)).data;
