// src/api/admin_live_rules.js
//
// Live Session Rules (screen 11). The 16 `live_*` fields live on the SAME
// GlobalSettings singleton Payment Settings edits — see
// shiksha-backend/global_settings/{models,serializers,views}.py. There is no
// separate "live rules" resource on the backend: it's the exact same
// GET/PATCH /admin/settings/ endpoint `../api/admin.js`'s getSettings /
// updateSettings already call, just a different subset of fields on the same
// object. This file is kept separate anyway (matching this app's per-feature
// api-file convention — see admin_scholarship.js, admin_communication.js)
// with names matching the design handoff (03-FRONTEND.md): getLiveRules() /
// updateLiveRules(patch).
import api from "./apiClient";

export const getLiveRules = async () => (await api.get("/admin/settings/")).data;
export const updateLiveRules = async (patch) => (await api.patch("/admin/settings/", patch)).data;

/* ── Live session stats (4 top stat cards) ──
   03-FRONTEND.md calls for a `/admin/live-sessions/stats/` endpoint (rooms
   live now, participants today, bytes pending expiry, remote-assist count).
   NOT IMPLEMENTED ON THE BACKEND YET — it wasn't part of the Phase 1 backend
   build (see sessions_app/urls.py: no such route exists). Calling it will
   404. getLiveSessionStats() therefore swallows any failure and resolves to
   `null` so the page can render a "—" placeholder instead of fabricating
   numbers or blocking the rest of the form on a missing endpoint. Wire this
   up for real once the stats endpoint ships. */
export const getLiveSessionStats = async () => {
  try {
    return (await api.get("/admin/live-sessions/stats/")).data;
  } catch {
    return null;
  }
};
