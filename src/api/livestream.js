import api from "./apiClient";

/* Never let a missing/optional endpoint crash a page (mirrors api/admin.js).
   A 404 is silently expected; anything else is a real outage worth logging
   so it doesn't look identical to "no data" in the UI.

   On a real (non-404) failure the fallback is ALSO tagged with a
   non-enumerable `__failed` flag, exactly as api/admin.js's twin does. This
   file's copy had drifted and tagged nothing, so a page following the
   documented "read d.__failed" pattern read `undefined` forever and a dead
   backend still rendered as "No recordings found." — the precise failure the
   flag exists to prevent. Non-enumerable so it stays invisible to
   JSON.stringify/spread/Object.keys and every existing call site. */
const safe = async (fn, fallback) => {
  try {
    return await fn();
  } catch (err) {
    if (err?.response?.status !== 404) {
      console.error("[livestream api] request failed, falling back to empty state:", err);
      if (fallback && typeof fallback === "object") {
        Object.defineProperty(fallback, "__failed", { value: true, enumerable: false, configurable: true });
      }
    }
    return fallback;
  }
};

/* ── Live Streams hub + Livestream Monitor (admin, is_staff) ── */
export const getAdminStreams = async (status = "all") =>
  safe(async () => (await api.get("/livestream/admin/streams/", { params: { status } })).data, { data: [] });

export const getAdminStream = async (id) =>
  (await api.get(`/livestream/admin/streams/${id}/`)).data;

export const postAdminStreamChat = async (id, text) =>
  (await api.post(`/livestream/admin/streams/${id}/chat/`, { text })).data;

export const endAdminStream = async (id) =>
  (await api.post(`/livestream/admin/streams/${id}/end/`, {})).data;

/* Watch a class live. Returns a SUBSCRIBE-ONLY LiveKit token: the admin can
   see and hear but cannot publish, and is hidden from the participant list —
   the class is not told it is being observed. Deliberately not wrapped in
   safe(): a silent fallback here would leave the player showing an empty
   room, which reads as "the class isn't running" rather than "this failed".
   Every call is recorded server-side against the admin's account. */
export const spectateAdminStream = async (id, reason = "") =>
  (await api.post(`/livestream/admin/streams/${id}/spectate/`, { reason })).data;

/* Fetch a SHORT-LIVED, SIGNED embed URL for one recording. Lives under the
   courses prefix, not livestream — the admin recordings LIST is
   /livestream/admin/recordings/ but its `id` is a courses.SessionRecording id,
   which is what this endpoint takes.

   This replaces the admin player composing
   `https://iframe.mediadelivery.net/embed/{LIBRARY_ID}/{guid}` itself from a
   library id shipped in the bundle: that URL was permanent and
   unauthenticated, so it could be copied out and shared forever, and Bunny's
   embed token auth could never be turned on without breaking every player.
   The endpoint re-runs the entitlement check on EVERY playback (staff pass via
   _require_recording_viewer's is_staff branch) and returns a URL that expires.

   Deliberately NOT wrapped in safe(), for the same reason as
   spectateAdminStream above: safe() turns a failure into an empty fallback
   tagged __failed, so a broken playback call would render as a working player
   with nothing in it — which reads as "this recording is empty" rather than
   "this failed". The caller must see the status code (403/404/503) and say so.

   Note `token_auth: false` in the response is the server's honest signal that
   BUNNY_STREAM_TOKEN_KEY is unset — the URL is still the old permanent one.
   A 200 is not proof that playback is gated. */
export const getRecordingPlayback = async (id) =>
  (await api.get(`/courses/recordings/${id}/playback/`)).data;

export const getLiveNow = async () =>
  safe(async () => (await api.get("/livestream/admin/live-now/")).data, { data: [] });

/* ── Recordings library (admin) ── */
export const getAdminRecordings = async (params) =>
  safe(async () => (await api.get("/livestream/admin/recordings/", { params })).data, { data: [] });

/* Edit one recording's metadata. PARTIAL update — send only what changed.
   Note this is the SHARED recording endpoint under the courses prefix, NOT a
   parallel admin-only write route. That is deliberate: a second write path
   would fork the field whitelist (SessionRecordingUpdateSerializer) and the
   batch/chapter validation, which is exactly how the recordings and materials
   DELETE rules drifted apart before — one allowed any co-teacher, the other
   only the uploader, so on one screen the button worked and on the other it
   always 403'd. Both admin and teacher now go through the same serializer and
   the same _require_recording_editor gate, which admits is_staff.

   Deliberately NOT wrapped in safe(), like spectateAdminStream above: safe()
   turns a failure into an empty fallback, and a MUTATION whose failure is
   invisible is worse than useless — the modal would close on a save that
   never happened. The caller must see the DRF field-error dict and show it.
   PUT is not implemented server-side (405); partial PATCH is the contract. */
export const updateAdminRecording = async (id, payload) =>
  (await api.patch(`/courses/recordings/${id}/`, payload)).data;

/* Delete one recording — 204, no body. Shares _require_recording_editor with
   the PATCH above for the same anti-drift reason. Also deliberately NOT
   wrapped in safe(): a swallowed failure would drop the row from the table
   while it still exists on the server, so the next refresh resurrects it.
   Note the trailing `/delete/` segment — the bare detail route is the
   GET/PATCH one and does not accept DELETE. */
export const deleteAdminRecording = async (id) =>
  (await api.delete(`/courses/recordings/${id}/delete/`)).data;

/* ── Option sources for the recording edit form ───────────────────────────
   Both are per-SUBJECT, because a recording's subject is immutable: the
   update serializer deliberately omits `subject` from its whitelist, so the
   only valid batches/chapters are the ones under the row's existing subject.

   Batches: courses/subjects/<id>/batches/ is named for the teacher form it
   was built for, but its guard is `request.user.is_staff or
   teaches_subject(...)` — staff pass, verified in teacher_batch_views.py. */
export const getSubjectBatches = async (subjectId) =>
  safe(async () => (await api.get(`/courses/subjects/${subjectId}/batches/`)).data, []);

/* Chapters: this is the ONLY chapter-list route in the backend that accepts
   GET, and it must stay that way round. `courses/admin/subjects/<id>/chapters/`
   sounds like the admin twin and is the one the handoff named, but it is
   POST-only (an APIView with no `get`) so it answers 405 — don't "correct"
   this path to that one.

   This used to 403 for any pure admin: SubjectChaptersView guards on
   _require_subject_access(), which admitted an enrolled learner or an assigned
   teacher and had no is_staff branch. That gate now short-circuits on
   `user.is_staff` (courses/views.py) — the third per-subject gate to need it,
   after the recordings per-id gate and the materials read gate — so staff get
   a real chapter list here and the field is a normal editable select. */
export const getSubjectChapters = async (subjectId) =>
  safe(async () => (await api.get(`/courses/subjects/${subjectId}/chapters/`)).data, []);

/* ── Webhook audit trail (admin) — LiveKitWebhookEvent, for diagnosing
   processing failures independent of any single session ── */
export const getAdminWebhookEvents = async (params) =>
  safe(async () => (await api.get("/livestream/admin/webhook-events/", { params })).data, { data: [], counts: {} });
