// Helpers for bridging <input type="datetime-local"> (which speaks a
// timezone-less "YYYY-MM-DDTHH:mm" string in the browser's local time) and
// the ISO-8601 datetime strings the backend sends/expects. Shared by
// Announcements (starts_at/ends_at), Blog Posts (publish_at), and Current
// Affairs (publish_at).

// ISO string from the API -> value for a datetime-local input, in the
// admin's local time zone (the most intuitive framing for a human editing it).
export const isoToLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// datetime-local input value -> ISO string (UTC) for the API. Empty input
// returns null so optional fields (e.g. Announcement.ends_at) clear cleanly.
export const localInputToIso = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};
