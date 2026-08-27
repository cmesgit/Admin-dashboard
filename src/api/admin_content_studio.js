// Content Studio API (design_handoff_content_studio).
//
// ⚠ The prefix is /content/admin/… on top of apiClient's /api base — NOT
// /admin/content/…, which the handoff spec and all five of its scaffolds use
// and which resolves to nothing. See content/urls.py + config/urls.py:42.
//
// One file per feature area, matching this app's existing api/ convention
// (admin_scholarship.js, admin_question_bank.js, …).
import api from "./apiClient";

const BASE = "/content/admin";

/** ⌘K palette. Queries shorter than 2 characters come back empty by design. */
export const searchContent = async (q, { signal } = {}) => {
  const { data } = await api.get(`${BASE}/search/`, { params: { q }, signal });
  return data;
};

/** The home screen's "Needs you" card. Always returns all three groups. */
export const getInbox = async () => {
  const { data } = await api.get(`${BASE}/inbox/`);
  return data;
};

/** Scheduled items in a date range. Empty days come back too. */
export const getCalendar = async (from, to) => {
  const { data } = await api.get(`${BASE}/calendar/`, { params: { from, to } });
  return data;
};

/** History feed, already grouped into days by the server. */
export const getActivity = async (limit = 50) => {
  const { data } = await api.get(`${BASE}/activity/`, { params: { limit } });
  return data;
};

/** Undo. Records a new revision rather than deleting one. */
export const restoreRevision = async (id) => {
  const { data } = await api.post(`${BASE}/revisions/${id}/restore/`);
  return data;
};

/** This author's pending edits for a page, plus its section list. */
export const getPageDraft = async (key) => {
  const { data } = await api.get(`${BASE}/pages/${key}/draft/`);
  return data;
};

/** Autosave. `sections` is { sectionKey: { field: value } }. */
export const savePageDraft = async (key, sections) => {
  const { data } = await api.put(`${BASE}/pages/${key}/draft/`, { sections });
  return data;
};

export const discardPageDraft = async (key) => {
  const { data } = await api.delete(`${BASE}/pages/${key}/draft/`);
  return data;
};

/** The publish checks. `can_publish` is false when anything blocks. */
export const getPageChecklist = async (key) => {
  const { data } = await api.get(`${BASE}/pages/${key}/checklist/`);
  return data;
};

/** Real destinations for a button, so the editor never shows a URL box. */
export const getLinkTargets = async () => {
  const { data } = await api.get(`${BASE}/link-targets/`);
  return data;
};

/** Applies this author's drafts onto the live rows in one transaction.
 *  Rejects with 409 + `blocking[]` when a check refuses. */
export const publishPage = async (key) => {
  const { data } = await api.post(`${BASE}/pages/${key}/publish/`);
  return data;
};

/** The Pictures library. Each asset carries usage_count and used_in[].
 *
 * Returns `{results, count, page, page_size, has_more}` — `count` is the real
 * table total, not the length of this page. `signal` matters: without it a slow
 * response for "her" can land after a fast one for "hero" and repaint the grid
 * with results for a query the box no longer contains. */
export const getMedia = async (q, { page = 1, signal } = {}) => {
  const { data } = await api.get(`${BASE}/media/`, {
    params: { ...(q ? { q } : {}), ...(page > 1 ? { page } : {}) },
    signal,
  });
  return data;
};

/** Upload one picture. Multipart — the browser sets the boundary itself. */
export const uploadMedia = async (file, altText = "") => {
  const form = new FormData();
  form.append("file", file);
  if (altText) form.append("alt_text", altText);
  const { data } = await api.post(`${BASE}/media/`, form);
  return data;
};

/** Delete. Rejects with a 409 carrying used_in[] when the picture is in use. */
export const deleteMedia = async (id) => {
  const { data } = await api.delete(`${BASE}/media/${id}/`);
  return data;
};

/** Reorder homepage sections.
 *
 * ⚠ `sections` must be the COMPLETE ordered list of section keys — the server
 * rejects a partial list with a 400, deliberately, so a stale tab can never
 * silently drop a section off the homepage.
 */
export const reorderSections = async (sections) => {
  const { data } = await api.post("/content/admin/home-section-order/reorder/", {
    sections,
  });
  return data;
};

/** Blog tags AND course categories on one screen. Reads across two apps. */
export const getLabels = async (q, { signal } = {}) => {
  const { data } = await api.get(`${BASE}/labels/`, {
    params: q ? { q } : {}, signal,
  });
  return data;
};

/** Repoints every relation in a transaction, then deletes the source.
 *  400s on merging into itself, or across differing CourseCategory groups. */
export const mergeLabels = async (kind, fromId, intoId) => {
  const { data } = await api.post(`${BASE}/labels/merge/`, {
    kind, from_id: fromId, into_id: intoId,
  });
  return data;
};

export const renameLabel = async (kind, id, name) => {
  const { data } = await api.patch(`${BASE}/labels/${kind}/${id}/`, { name });
  return data;
};

/** 409s with used_by when the label is still in use. */
export const deleteLabel = async (kind, id) => {
  const { data } = await api.delete(`${BASE}/labels/${kind}/${id}/`);
  return data;
};

/** How far each competitive exam has actually got. Every number is a real
 *  count — if it says zero subjects, there are zero subjects. */
export const getExamReadiness = async () => {
  const { data } = await api.get(`${BASE}/exams/readiness/`);
  return data;
};

/** Create a label of either kind. 409s on a case-variant tag, because
 *  ContentTag.slug is unique and slugified from the name. */
export const createLabel = async (kind, name, group) => {
  const { data } = await api.post(`${BASE}/labels/`, {
    kind, name, ...(group ? { group } : {}),
  });
  return data;
};
