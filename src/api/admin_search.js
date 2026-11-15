// Console-wide search (design_handoff_admin_counsellor, Admin v2 Phase 5).
//
// The artboard's top bar reads "Find a student, course, teacher or page".
// `searchContent` (admin_content_studio.js) finds none of the first three —
// it is the CMS search — and it 403s entirely when content_studio_enabled is
// off, which is why the ⌘K palette used to be mounted only for Studio admins.
//
// This spans people + courses + (when the Studio flag allows it) the CMS,
// delegating the CMS half to that same search rather than reimplementing it.
import api from "./apiClient";

/** GET /api/dashboard/admin/search/?q=
 *
 *  → { query, results: [{kind, kind_label, title, where, url}], skipped: [] }
 *
 *  `url` is an ADMIN-APP route, not an API path — the palette navigates
 *  straight to it. Queries shorter than 2 characters come back empty by
 *  design; a single letter matches most of the database.
 *
 *  ⚠ `skipped` names the sources that were NOT searched (the CMS half when
 *  its flag is off), as distinct from sources that matched nothing. Surface
 *  it — "no results" and "we didn't look there" are different answers, and
 *  conflating them teaches admins to distrust the box.
 */
export const searchAdmin = async (q, { signal } = {}) => {
  const { data } = await api.get("/dashboard/admin/search/", {
    params: { q }, signal,
  });
  return data;
};
