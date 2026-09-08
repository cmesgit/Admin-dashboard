// Academy content from the admin console: one list of everything students are
// given, and the two create paths an admin has.
//
// ⚠ THREE DIFFERENT PREFIXES, on purpose. apiClient's baseURL already ends in
// /api, so these are the wire paths:
//
//   /dashboard/admin/academy/…   the list and the option tree (dashboard app —
//                                they span courses, materials, assignments,
//                                quizzes and recordings, so they belong to no
//                                single content app)
//   /materials/…                 material upload — THE SAME endpoints the
//                                teacher dashboard posts to
//   /assignments/teacher/create/ assignment create — likewise
//
// The last two are deliberately not admin-only twins. A parallel admin
// endpoint would be a second copy of the file validators, the batch/subject
// triangle guard and the student notification fan-out, and the copies would
// drift — which is how content created from Django's own /admin/ ends up
// subtly broken. Instead the shared endpoints accept a `teacher_id`, and every
// staffing check runs against THAT teacher. See courses.services
// .resolve_content_author on the backend.
//
// So `teacher_id` is not optional metadata: without it the request means "file
// this under me", and an admin has no teacher context, so it 403s.
import api from "./apiClient";

const ACADEMY = "/dashboard/admin/academy";

// Mirrors src/api/admin.js's `safe`. Repeated rather than imported because
// admin.js does not export it, and a list endpoint that throws takes the whole
// screen down. Read `__failed` before rendering "there is nothing here" — an
// outage and an empty catalogue look identical otherwise.
const safe = async (fn, fallback) => {
  try {
    return await fn();
  } catch (err) {
    if (err?.response?.status !== 404) {
      console.error("[academy content] request failed:", err);
      if (fallback && typeof fallback === "object") {
        Object.defineProperty(fallback, "__failed", {
          value: true,
          enumerable: false,
          configurable: true,
        });
      }
    }
    return fallback;
  }
};

/** The content list. Every parameter optional; see the view's docstring. */
export const getAcademyResources = async (params = {}) =>
  safe(
    async () => (await api.get(`${ACADEMY}/resources/`, { params })).data,
    { count: 0, results: [], totals: {}, truncated: false },
  );

/**
 * Options for the create forms.
 *
 * No argument → `{courses: […]}`. With a course id → that course's batches,
 * and its subjects each carrying their chapters and their staffing.
 *
 * NOT safe()-wrapped: a create form with no options is not a form, so the
 * dialog has to be able to show a real error instead of an empty select.
 */
export const getAcademyOptions = async (courseId) =>
  (await api.get(`${ACADEMY}/options/`, {
    params: courseId ? { course_id: courseId } : undefined,
  })).data;

/**
 * Upload one file and get back an unclaimed temp row.
 *
 * Two-step by design: the bytes are validated and stored first, then a second
 * request turns them into student-visible material. The temp row is owned by
 * the ADMIN (whoever uploaded it) even when the material will be owned by a
 * teacher — the claim in step two matches on the uploader, so it has to be.
 *
 * No Content-Type header: axios sets the multipart boundary from the FormData.
 */
export const uploadMaterialFile = async (file) => {
  const form = new FormData();
  form.append("file", file);
  return (await api.post("/materials/files/upload/", form)).data;
};

/**
 * Create a study material owned by `teacherId`.
 *
 * `fileIds` are ids from uploadMaterialFile and at least one is required.
 * Multipart because that is the only body this endpoint parses, and
 * `file_ids` has to arrive as a repeated field rather than an array.
 */
export const createMaterial = async ({
  teacherId, subjectId, chapterId, customChapter, batchId,
  title, description, fileIds,
}) => {
  const form = new FormData();
  form.append("teacher_id", teacherId);
  form.append("subject_id", subjectId);
  form.append("title", title);
  if (description) form.append("description", description);
  // Sent only when set. An empty chapter_id is not "no chapter" to this
  // endpoint — it is a lookup for the empty string.
  if (chapterId) form.append("chapter_id", chapterId);
  else if (customChapter) form.append("custom_chapter", customChapter);
  if (batchId) form.append("batch_id", batchId);
  // Repeated, not JSON: the view reads request.data.getlist("file_ids").
  (fileIds || []).forEach((id) => form.append("file_ids", id));
  return (await api.post("/materials/materials/upload/", form)).data;
};

/**
 * Create an assignment owned by `teacherId`.
 *
 * JSON, not multipart — attachments are deliberately not offered here. The
 * teacher screen handles those, and an admin adding one would need the same
 * per-file validator loop for no benefit the first version needs.
 *
 * `batchId` is REQUIRED by the serializer: due dates are cohort-relative, so
 * a course-wide assignment is a legacy shape that is no longer creatable.
 */
export const createAssignment = async ({
  teacherId, subjectId, chapterId, customChapter, batchId,
  title, description, dueDate, maxMarks, isPublished,
}) => {
  const body = {
    teacher_id: teacherId,
    subject_id: subjectId,
    batch_id: batchId,
    title,
    description: description || "",
    due_date: dueDate,
    is_published: isPublished,
  };
  // Omitted rather than sent as 0 or null when unset: `max_marks` is optional
  // on the serializer and the model defaults it to 100, but it has no minimum
  // validator, so a 0 sent explicitly is stored as a zero-mark assignment.
  if (maxMarks !== undefined && maxMarks !== null) body.max_marks = maxMarks;
  if (chapterId) body.chapter_id = chapterId;
  else if (customChapter) body.custom_chapter = customChapter;
  return (await api.post("/assignments/teacher/create/", body)).data;
};
