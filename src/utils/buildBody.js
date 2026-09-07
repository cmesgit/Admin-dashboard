// Build a request body for admin create/edit forms.
//
// A File present (or `force`) ⇒ a FormData: arrays/objects are JSON-encoded
// per field (matching how every admin PATCH/POST that accepts a multipart
// file expects nested data alongside it — e.g. AdminCourseDetailView.patch's
// `details`/`categories` handling on the courses app, or the content admin
// endpoints' array fields). Otherwise a plain JSON-able object is returned
// unchanged.
//
// Pulled out of the near-identical local `buildBody` helpers duplicated in
// Showcase.jsx and BlogPosts.jsx, plus the inlined FormData-building in
// Courses.jsx's course- and subject-submit paths.
//
// `force` makes this always build a FormData even without a file — needed
// for endpoints (like the subject create/update ones) that are always sent
// as multipart regardless of whether an image was actually picked.
//
// `clearNulls` opts a caller into sending `null` as an empty string instead
// of dropping the key. FormData carries strings only, so a `null` had no
// representation and was silently skipped — which reads to the server as
// "leave this field alone", the exact opposite of what the form meant. DRF
// maps "" back to None for both related fields (RelatedField.get_value does
// `get(name, '') or None` on HTML input) and nullable booleans ('' is in
// BooleanField.NULL_VALUES), so the round trip is faithful. Off by default:
// the other callers rely on an omitted key meaning "unchanged", and flipping
// that for all of them would start clearing fields nobody touched.
export const buildBody = (
  fields, file, fileField = "image", force = false, clearNulls = false,
) => {
  if (!file && !force) return { data: fields, isMultipart: false };
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v === null || v === undefined) {
      if (clearNulls && v === null) fd.append(k, "");
      return;
    }
    if (Array.isArray(v) || typeof v === "object") fd.append(k, JSON.stringify(v));
    else fd.append(k, v);
  });
  if (file) fd.append(fileField, file);
  return { data: fd, isMultipart: true };
};
