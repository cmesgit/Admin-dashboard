// Redirects (design_handoff_admin_counsellor, Admin v2 Phase 5).
//
// ⚠ The prefix is /content/admin/… on top of apiClient's /api base — NOT
// /admin/content/…, which resolves to nothing. Same trap the rest of the
// Studio API files call out.
import api from "./apiClient";

const BASE = "/content/admin/redirects";

/** GET → { results: [{id, from_path, to_path, permanent, is_active, hits,
 *  last_hit_at, note, created_at}], count } */
export const getRedirects = async (q = "") => {
  const { data } = await api.get(`${BASE}/`, { params: q ? { q } : {} });
  return data;
};

/** POST. The server normalises both paths and refuses self-redirects, loops
 *  through existing rules, redirecting the site root, and duplicates — each
 *  with a per-field message, so surface `err.response.data` as-is rather
 *  than a generic "couldn't save". */
export const createRedirect = async (body) =>
  (await api.post(`${BASE}/`, body)).data;

export const updateRedirect = async (id, body) =>
  (await api.patch(`${BASE}/${id}/`, body)).data;

export const deleteRedirect = async (id) =>
  (await api.delete(`${BASE}/${id}/`)).data;
