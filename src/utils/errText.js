// Turn an axios error into a human string (detail or collected field errors).
// Mirrors the local helper already used in src/pages/Courses.jsx — pulled out
// here since the Content (CMS) tabs are spread across several files and all
// need the same "show the first error message" behavior (e.g. Announcements'
// ends_at > starts_at 400).
export const errText = (e) => {
  const d = e?.response?.data;
  if (!d) return "Something went wrong. Please try again.";
  if (typeof d === "string") return d;
  if (d.detail) return d.detail;
  try { return Object.values(d).flat().join(" ") || "Request failed."; }
  catch { return "Request failed."; }
};
