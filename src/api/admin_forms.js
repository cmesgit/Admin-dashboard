// Forms (design_handoff_admin_counsellor, Admin v2 Phase 5).
//
// ⚠ A DIRECTORY of the site's real forms, not a builder. Most forms already
// deliver into a screen that owns them (a teacher application becomes a
// pending TeacherProfile on /approvals); `managed_here` says which ones this
// screen works itself. Today that is Contact us — whose submissions had no
// console surface at all before this.
import api from "./apiClient";

const BASE = "/content/admin/forms";

/** GET → { results: [{key, name, where, fields, destination, url,
 *  managed_here, counts}] } */
export const getForms = async () => (await api.get(`${BASE}/`)).data;

/** GET → { results: [...], count, counts: {new, total} }
 *  `count` is the REAL total, not the page — the list is capped at 200. */
export const getContactSubmissions = async (params = {}) =>
  (await api.get(`${BASE}/contact/`, { params })).data;

/** PATCH. Only `status` and `handled_note` are writable; everything the
 *  visitor sent is read-only server-side. */
export const updateContactSubmission = async (id, body) =>
  (await api.patch(`${BASE}/contact/${id}/`, body)).data;
