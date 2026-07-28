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
export const buildBody = (fields, file, fileField = "image", force = false) => {
  if (!file && !force) return { data: fields, isMultipart: false };
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v) || typeof v === "object") fd.append(k, JSON.stringify(v));
    else fd.append(k, v);
  });
  if (file) fd.append(fileField, file);
  return { data: fd, isMultipart: true };
};
