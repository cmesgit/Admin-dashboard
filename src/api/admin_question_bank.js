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

// ──────────────────────────────────────────────────────────────────────────
// The STANDALONE bank (design_handoff_public_quiz_hub, Phase 2).
//
// A different collection from the review queue above, and the distinction is
// load-bearing: that queue is teachers' questions waiting on an answer and
// deliberately excludes `quiz__isnull=True` rows, so the thousands of rows
// the PYQ importer creates appear ONLY here. Nothing else in the console can
// see them, and Question.objects.publishable() needs `accepted`, so this
// screen is the only path from an import to anything a learner can practise.
//
// These endpoints are gated on GlobalSettings.public_quiz_hub_enabled and
// answer 503 when it is off — not 403. "The feature is switched off" is a
// different answer from "you may not", and the screen says so.
//
// NOT wrapped in admin.js's `safe()`: that helper turns a failure into an
// empty array, which on a curation screen would render a full bank as "there
// is nothing here" and invite someone to re-import. Let it throw; the page
// catches and says the request failed.
// ──────────────────────────────────────────────────────────────────────────

/** One page of standalone bank questions.
 *  Filters: search, subject, exam, difficulty, year, state, untagged=1,
 *  flagged=1|0, page, page_size. Paginated by DEFAULT here (unlike the two
 *  older bank endpoints, whose pagination stayed opt-in for back-compat), so
 *  the response is always {count, next, previous, results}. */
export const getBankQuestions = async (params = {}, { signal } = {}) =>
  (await api.get("/quizzes/admin/bank/", { params, signal })).data;

/** Headline counts, fetched once per screen load rather than riding along
 *  with every page of results — see the view's docstring. */
export const getBankSummary = async () =>
  (await api.get("/quizzes/admin/bank/summary/")).data;

/** Author one from scratch. Created `accepted` (an admin writing a question
 *  IS the review) but still not publishable without an explanation. */
export const createBankQuestion = async (body) =>
  (await api.post("/quizzes/admin/bank/", body)).data;

/** Partial edit. Omit `choices` to leave the options alone; send them and
 *  exactly one must be is_correct. */
export const updateBankQuestion = async (id, body) =>
  (await api.patch(`/quizzes/admin/bank/${id}/`, body)).data;

/** Refuses with 409 + `used_by` when a learner has already answered it —
 *  deleting would cascade their answers and silently rewrite a past score. */
export const deleteBankQuestion = async (id) =>
  (await api.delete(`/quizzes/admin/bank/${id}/`)).data;

/** The tag taxonomy, for the filter rails and the form's tag picker.
 *  Each row carries question_count, effective_status and status_downgraded. */
/** ⚠ UNPAGINATED — this one returns a BARE ARRAY, not a {count, results}
 *  envelope like /admin/bank/ does. Don't write one generic fetcher. */
export const getQuestionTags = async (params = {}) =>
  (await api.get("/quizzes/admin/tags/", { params })).data;

export const createQuestionTag = async (body) =>
  (await api.post("/quizzes/admin/tags/", body)).data;

/** `status` is the rail control: live / soon / hidden. The server computes
 *  `effective_status` and DEGRADES a `live` tag with no live questions back
 *  to `soon` — live is a floor, not an override — reporting the disagreement
 *  as `status_downgraded` rather than resolving it silently. */
export const updateQuestionTag = async (id, body) =>
  (await api.patch(`/quizzes/admin/tags/${id}/`, body)).data;

/** 409 + {question_count} when the tag is still applied to anything.
 *  ⚠ That count is RAW usage; the `question_count` on the list row is
 *  publishable-only. They legitimately differ for the same tag. */
export const deleteQuestionTag = async (id) =>
  (await api.delete(`/quizzes/admin/tags/${id}/`)).data;

/** Atomic, and refuses across `kind`. */
export const mergeQuestionTags = async (sourceIds, targetId) =>
  (await api.post("/quizzes/admin/tags/merge/", {
    source_ids: sourceIds, target_id: targetId,
  })).data;

// ──────────────────────────────────────────────────────────────────────────
// PRACTICE SETS — what the public hub actually shows (Phase 5b).
//
// A set stores CRITERIA, not questions: subject (+ optional exam and
// difficulty) and a size. The paper is resolved from the bank at read time,
// so `available_count` moves on its own as questions are accepted.
// ──────────────────────────────────────────────────────────────────────────

export const getPracticeSets = async (params = {}, { signal } = {}) =>
  (await api.get("/quizzes/admin/sets/", { params, signal })).data;

export const createPracticeSet = async (body) =>
  (await api.post("/quizzes/admin/sets/", body)).data;

/** Publishing a set that matches nothing is refused with 400 — the server
 *  will not put a card on the site that opens onto an empty paper. */
export const updatePracticeSet = async (id, body) =>
  (await api.patch(`/quizzes/admin/sets/${id}/`, body)).data;

/** 409 + {attempt_count} once anyone has practised it. */
export const deletePracticeSet = async (id) =>
  (await api.delete(`/quizzes/admin/sets/${id}/`)).data;
