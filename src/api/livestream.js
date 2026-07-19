import api from "./apiClient";

/* Never let a missing/optional endpoint crash a page (mirrors api/admin.js). */
const safe = async (fn, fallback) => {
  try {
    return await fn();
  } catch {
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

export const getLiveNow = async () =>
  safe(async () => (await api.get("/livestream/admin/live-now/")).data, { data: [] });

/* ── Recordings library (admin) ── */
export const getAdminRecordings = async (params) =>
  safe(async () => (await api.get("/livestream/admin/recordings/", { params })).data, { data: [] });
