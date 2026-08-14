// Turn an axios error into a human string (detail or collected field errors).
// Mirrors the local helper already used in src/pages/Courses.jsx — pulled out
// here since the Content (CMS) tabs are spread across several files and all
// need the same "show the first error message" behavior (e.g. Announcements'
// ends_at > starts_at 400).

// A generic snake_case -> plain-English humanizer, with a small lookup for
// acronyms this platform actually uses in field names (UPI/UTR payment
// verification, OTP login, etc.) — without this, a multi-field validation
// error reads as raw backend identifiers ("upi_id: This field is
// required.") instead of a sentence a non-technical admin can act on.
const ACRONYMS = new Set(["id", "upi", "utr", "otp", "pin", "cta", "url", "api"]);
const NO_PREFIX_KEYS = new Set(["non_field_errors", "detail"]);

const humanizeField = (field) =>
  field
    .split("_")
    .filter(Boolean)
    .map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word))
    .join(" ")
    .replace(/^[a-z]/, (c) => c.toUpperCase());

export const errText = (e) => {
  const d = e?.response?.data;
  if (!d) return "Something went wrong. Please try again.";
  if (typeof d === "string") return d;
  // DRF serialises ValidationError("a plain message") as a JSON *array*, so
  // this has to come before the object branch below — otherwise
  // Object.entries turns it into "0: a plain message".
  if (Array.isArray(d)) return String(d[0] ?? "Request failed.");
  if (d.detail) return d.detail;
  try {
    const parts = Object.entries(d).map(([field, msgs]) => {
      const text = Array.isArray(msgs) ? msgs.join(" ") : String(msgs);
      return NO_PREFIX_KEYS.has(field) ? text : `${humanizeField(field)}: ${text}`;
    });
    return parts.join(" ") || "Request failed.";
  } catch {
    return "Request failed.";
  }
};
