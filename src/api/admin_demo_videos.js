// Landing-page demo videos — the clips behind the homepage's "Watch a demo"
// button. Backend: content.admin_views.DemoVideoAdminViewSet.
//
// ⚠ The prefix is /content/admin/… on top of apiClient's /api base — NOT
// /admin/content/…, which resolves to nothing (same trap as the other Studio
// API files).
//
// Uploads go browser → Bunny, never through Django (server-started uploads
// store zero bytes — see content/demo_video_bunny.py). So an upload is three
// steps: `createUploadSlot` (Django mints an empty Bunny video and signs a
// ticket), `uploadToBunny` (this browser sends the bytes), then a create or
// PATCH carrying the new `bunny_video_id`, which makes Django ask Bunny how
// encoding went.
import * as tus from "tus-js-client";
import api from "./apiClient";

const BASE = "/content/admin/demo-videos";
const TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";

/** GET → [{ id, key, title, blurb, order, status, bunny_video_id,
 *  bunny_status, status_label, duration_seconds, thumbnail_url, embed_url,
 *  on_the_site, is_live, updated_at }]. Includes hidden rows. */
export const getDemoVideos = async () => (await api.get(`${BASE}/`)).data;

/** POST. `bunny_video_id` is optional; the derived fields are server-owned. */
export const createDemoVideo = async (body) =>
  (await api.post(`${BASE}/`, body)).data;

/** PATCH by key. Sending a new `bunny_video_id` clears the old clip's runtime
 *  and thumbnail and re-reads Bunny. */
export const updateDemoVideo = async (key, body) =>
  (await api.patch(`${BASE}/${encodeURIComponent(key)}/`, body)).data;

/** DELETE removes the row only; the file stays in Bunny. */
export const deleteDemoVideo = async (key) =>
  (await api.delete(`${BASE}/${encodeURIComponent(key)}/`)).data;

/** POST → { ...row, reachable }. `reachable: false` means Bunny didn't answer,
 *  which is not the same as "the clip is broken". */
export const syncDemoVideo = async (key) =>
  (await api.post(`${BASE}/${encodeURIComponent(key)}/sync/`)).data;

/** POST → { video_id, library_id, expire, signature }. The only guid that can
 *  ever be signed is the one this call just minted. */
export const createUploadSlot = async (file) =>
  (await api.post(`${BASE}/upload-slot/`, {
    filename: file.name,
    size: file.size,
  })).data;

/** Sends `file` to Bunny with the ticket from `createUploadSlot`. Resolves
 *  when the bytes are in; Bunny then needs a while to encode, so the caller
 *  attaches the guid and polls `syncDemoVideo`. `onProgress(0..100)`. */
export const uploadToBunny = (file, ticket, onProgress) =>
  new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: TUS_ENDPOINT,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        AuthorizationSignature: ticket.signature,
        AuthorizationExpire: String(ticket.expire),
        VideoId: ticket.video_id,
        LibraryId: String(ticket.library_id),
      },
      metadata: {
        filetype: file.type || "application/octet-stream",
        title: file.name,
      },
      onError: reject,
      onProgress: (sent, total) => onProgress?.(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    });
    upload.start();
  });
