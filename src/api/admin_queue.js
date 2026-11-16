// Admin v2 "to do" queue (design_handoff_admin_counsellor Phase 2).
//
// One call replacing the four separate list endpoints the sidebar badges used
// to measure. Those were counted by `len()`ing a PAGE of results, which is why
// today's Overview badge is wrong: chat's list views slice at 200, enrollments
// paginates at 50, and the enrollment call passed no status at all so it
// counted approved and rejected rows too. The server now does `.count()` on an
// explicit filter per kind — see dashboard/admin_queue.py.
import api from "./apiClient";

/** GET /api/dashboard/admin/queue/
 *
 *  → { total, generated_at, groups: [{kind, label, count, where, area, url}],
 *      unavailable: [{kind, reason}] }
 *
 *  `groups` carries only non-zero kinds and `total` is their sum, so the
 *  headline and the chips can never disagree. `unavailable` lists kinds this
 *  particular admin cannot act on (research needs the ADMIN role, not just
 *  staff) — shown as a note rather than counted, because "nothing to do" and
 *  "not yours to do" are different facts.
 */
export const getAdminQueue = async ({ signal } = {}) => {
  const { data } = await api.get("/dashboard/admin/queue/", { signal });
  return data;
};
