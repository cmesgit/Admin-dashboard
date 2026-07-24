// PLACEMENT: src/api/admin_communication.js   (NEW FILE — admin app)
// Communication Center closure — Stage D. Mirrors admin_counseling.js's
// pattern: a small, self-contained module for one console section, sharing
// the same `api` client instance every other admin module uses.

import api from "./apiClient";

/* ── Moderation queue (CC-006/010/023) ── */
export const getReports = async (status = "") =>
  (await api.get("/chat/admin/reports/", { params: status ? { status } : {} })).data;

export const resolveReport = async (id, action, note = "", until = undefined) =>
  (await api.post(`/chat/admin/reports/${id}/resolve/`, { action, note, until })).data;
  // action: remove_message | suspend_user | dismiss

export const removeMessage = async (messageId, reason = "") =>
  (await api.post(`/chat/admin/messages/${messageId}/remove/`, { reason })).data;

/* ── Message search/browse (standalone removal, no Report required) ── */
export const searchAdminMessages = async (params) =>
  (await api.get("/chat/admin/messages/", { params })).data;

/* ── Suspensions ── */
export const getSuspensions = async () => (await api.get("/chat/admin/suspensions/")).data;

export const suspendIdentity = async (identity_key, reason = "", until = undefined) =>
  (await api.post("/chat/admin/suspensions/", { identity_key, reason, until })).data;

export const liftSuspension = async (identityKey) =>
  (await api.post(`/chat/admin/suspensions/${encodeURIComponent(identityKey)}/lift/`)).data;

/* ── Platform broadcast (CC-023 broadcast tool) ── */
export const sendBroadcast = async (audience, title, body, link_url = "") =>
  (await api.post("/chat/admin/broadcast/", { audience, title, body, link_url })).data;
  // audience: all | all_students | all_teachers → { detail, recipients }

/* ── Academic Support tickets (CC-022 admin side) ── */
export const getAdminSupportTickets = async (status = "") =>
  (await api.get("/chat/admin/support/tickets/", { params: status ? { status } : {} })).data;

export const assignSupportTicket = async (id, assignee_id) =>
  (await api.post(`/chat/admin/support/tickets/${id}/assign/`, { assignee_id })).data;

export const setSupportTicketStatus = async (id, status) =>
  (await api.post(`/chat/admin/support/tickets/${id}/status/`, { status })).data;

// Ticket messages/reply reuse the same requester-facing endpoints — an admin
// authenticates the same way (IsAuthenticated + is_staff), and
// chat/views.py's _ticket_and_participant() auto-attaches a STAFF
// participant for any is_staff user on first touch, so no separate
// admin-only message endpoints are needed.
export const getTicketMessages = async (id) => (await api.get(`/chat/support/tickets/${id}/messages/`)).data;
export const replyToTicket = async (id, message) =>
  (await api.post(`/chat/support/tickets/${id}/reply/`, { message })).data;

/* ── Lightweight comms analytics ── */
export const getCommsLogs = async () => (await api.get("/chat/admin/logs/")).data;

/* ── Conversation context (read-only, for reviewing a report) ── */
export const getAdminConversationMessages = async (conversationId, limit = 50) =>
  (await api.get(`/chat/admin/conversations/${conversationId}/messages/`, { params: { limit } })).data;

/* ── Chat moderator oversight — chat's counterpart to admin.js's
   getModerationOverview (forum) ── */
export const getChatModerationOverview = async (range = "7d") =>
  (await api.get("/chat/admin/moderation-overview/", { params: { range } })).data;
