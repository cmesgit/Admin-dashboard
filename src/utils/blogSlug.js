// Client-side mirror of shiksha-backend/content/models.py's
// BlogPost._default_slug(). The backend only fills `slug` `if not self.slug`
// on save (it is never regenerated after creation, and there is no
// uniqueness suffixing — a collision is a hard 400), so this exists purely
// to show the admin what slug they're *about* to get before they save, not
// to compute the slug that's actually persisted. Keep this in sync with the
// backend by hand; there is no shared source of truth between the two repos.

// Mirrors Django's django.utils.text.slugify() step for step:
//   value = unicodedata.normalize("NFKD", value).encode("ascii","ignore").decode()
//   value = re.sub(r"[^\w\s-]", "", value.lower())
//   return re.sub(r"[-\s]+", "-", value).strip("-_")
// The key subtlety (found by diffing against the real backend): punctuation
// like `.`/`+`/`#`/`&` is DELETED, not turned into a hyphen, while `_` is a
// \w character and survives as-is. A naive "non-alphanumeric -> hyphen"
// mirror gets this wrong (".NET 8.0" -> "net-8-0" instead of the real
// "net-80"), which would make the slug preview lie right before save.
export const slugify = (s) =>
  (s || "")
    .toString()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics (the "ignore" of ascii-encode)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[-\s]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

export const deriveBlogSlug = ({ class_level, subject, chapter_number, title }) => {
  const parts = [];
  if (class_level && class_level !== "general") parts.push(`class-${class_level}`);
  if (subject && subject !== "general") parts.push(subject);
  if (chapter_number) {
    parts.push(`chapter-${chapter_number}`);
  } else {
    parts.push(slugify(title).slice(0, 80) || "post");
  }
  return parts.join("/");
};
