// Shared short date formatter ("28 Jul 2026") — was defined identically in
// Courses.jsx and content/BlogPosts.jsx.
export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
