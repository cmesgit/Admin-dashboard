import api from "./apiClient";

/* Never let a missing/optional endpoint crash a page (mirrors api/admin.js).
   A 404 is silently expected; anything else is a real outage worth logging
   so it doesn't look identical to "no data" in the UI. */
const safe = async (fn, fallback) => {
  try {
    return await fn();
  } catch (err) {
    if (err?.response?.status !== 404) {
      console.error("[livestream api] request failed, falling back to empty state:", err);
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

export const getLiveNow = async () =>
  safe(async () => (await api.get("/livestream/admin/live-now/")).data, { data: [] });

/* ── Recordings library (admin) ── */
export const getAdminRecordings = async (params) =>
  safe(async () => (await api.get("/livestream/admin/recordings/", { params })).data, { data: [] });

/* ── Webhook audit trail (admin) — LiveKitWebhookEvent, for diagnosing
   processing failures independent of any single session ── */
export const getAdminWebhookEvents = async (params) =>
  safe(async () => (await api.get("/livestream/admin/webhook-events/", { params })).data, { data: [], counts: {} });
