// Add study material or an assignment from the admin console, on a teacher's
// behalf.
//
// THE ONE IDEA THIS FORM IS BUILT AROUND: content belongs to a teacher, not to
// the admin who added it. Every screen that shows academy content reaches it
// through teaching staff — the teacher lists scope by teaching assignment, and
// the edit and delete gates ask whether you teach the subject. So content owned
// by an admin account is content nobody can look after: students can see it and
// no teacher's screen lists it. That is why "Who looks after it" is a step of
// its own rather than a footnote, and why it cannot be skipped.
//
// The second idea: the two content types do not share a staffing rule.
// Materials are gated on teaching the SUBJECT at all; assignments are gated on
// teaching it IN THE CHOSEN BATCH. So the teacher list is filtered per type,
// and a teacher who is perfectly valid for a material can be the wrong answer
// for an assignment in Batch B. Offering them anyway would render a choice the
// server refuses, with an error naming a batch the admin never considered.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Check, CircleAlert, FileText, Paperclip, Trash2,
  UserRound, UploadCloud,
} from "lucide-react";
import {
  createAssignment, createMaterial, getAcademyOptions, uploadMaterialFile,
} from "../../api/admin_academy_content";
import { errText } from "../../utils/errText";

const STEPS = ["Where it goes", "Who looks after it", "The content"];

const TYPE_MATERIAL = "material";
const TYPE_ASSIGNMENT = "assignment";

// Default due date for a new assignment: a week out. The serializer refuses a
// date before today (calendar-date compare in IST), so an empty field would be
// a guaranteed 400 on the last step.
const defaultDue = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  // datetime-local wants a local ISO string with no zone and no seconds.
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EMPTY = {
  type: TYPE_MATERIAL,
  courseId: "",
  subjectId: "",
  batchId: "",
  teacherId: "",
  chapterId: "",
  customChapter: "",
  title: "",
  description: "",
  dueDate: defaultDue(),
  maxMarks: 20,
  isPublished: true,
};

const NewAcademyContentDialog = ({ onClose, onCreated }) => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [courses, setCourses] = useState(null);
  const [tree, setTree] = useState(null);       // one course's subjects/batches
  const [treeLoading, setTreeLoading] = useState(false);
  const [files, setFiles] = useState([]);       // {id, file_name} temp rows
  const [uploading, setUploading] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [result, setResult] = useState(null);
  const fileInput = useRef(null);
  const titleRef = useRef(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // ── options ────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getAcademyOptions();
        if (alive) setCourses(data.courses || []);
      } catch (e) {
        if (alive) setError(errText(e));
      }
    })();
    return () => { alive = false; };
  }, []);

  const pickCourse = useCallback(async (courseId) => {
    // Everything downstream of the course is invalidated, not kept: a subject
    // id from the previous course would pass the form's own readiness check and
    // then fail the server's triangle guard.
    set({
      courseId, subjectId: "", batchId: "", teacherId: "",
      chapterId: "", customChapter: "",
    });
    setTree(null);
    if (!courseId) return;
    setTreeLoading(true);
    try {
      setTree(await getAcademyOptions(courseId));
      setError("");
    } catch (e) {
      setError(errText(e));
    } finally {
      setTreeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === 2) titleRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  // ── derived ────────────────────────────────────────────────────────
  const subject = useMemo(
    () => (tree?.subjects || []).find((s) => s.id === form.subjectId) || null,
    [tree, form.subjectId],
  );

  const isAssignment = form.type === TYPE_ASSIGNMENT;

  // The staffing rule, applied client-side exactly as the server applies it.
  //
  //   material   → teaches_subject: ANY active assignment on the subject
  //   assignment → is_teacher_of:   a course-wide row, OR a row for THIS batch
  //
  // With no batch chosen yet an assignment has nothing to check against, so
  // the list stays empty rather than showing everyone and then rejecting some.
  const eligible = useMemo(() => {
    const all = subject?.teachers || [];
    if (!isAssignment) return all;
    if (!form.batchId) return [];
    return all.filter(
      (t) => t.course_wide || (t.batch_ids || []).includes(form.batchId),
    );
  }, [subject, isAssignment, form.batchId]);

  // Staffed on the subject, but not for the batch this assignment is for.
  // Worth naming: it is the difference between "assign somebody" and "pick a
  // different batch", and the two need different actions.
  const wrongBatchOnly =
    isAssignment && !!form.batchId && eligible.length === 0 &&
    (subject?.teachers || []).length > 0;

  const chosenBatch = useMemo(
    () => (tree?.batches || []).find((b) => b.id === form.batchId) || null,
    [tree, form.batchId],
  );

  const whereReady = form.courseId && form.subjectId &&
    (!isAssignment || form.batchId);
  const whoReady = !!form.teacherId;
  const contentReady = form.title.trim() &&
    (isAssignment ? !!form.dueDate : files.length > 0);

  const stepReady = [whereReady, whoReady, contentReady][step];

  // ── files ──────────────────────────────────────────────────────────
  const sendFiles = async (picked) => {
    const list = Array.from(picked || []);
    if (!list.length) return;
    setUploading(list.map((f) => f.name));
    setError("");
    try {
      // Sequential, matching the Pictures screen: a dropped folder would
      // otherwise open one socket per file and the last few time out.
      const added = [];
      for (const file of list) {
        added.push(await uploadMaterialFile(file));
      }
      setFiles((prev) => [...prev, ...added]);
    } catch (e) {
      // The validator rejects by extension and size, and the message names
      // which — surface it verbatim rather than "upload failed".
      setError(errText(e));
    } finally {
      setUploading([]);
    }
  };

  // ── submit ─────────────────────────────────────────────────────────
  const submit = async () => {
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      const shared = {
        teacherId: form.teacherId,
        subjectId: form.subjectId,
        chapterId: form.chapterId || "",
        customChapter: form.customChapter.trim(),
        batchId: form.batchId || "",
        title: form.title.trim(),
        description: form.description.trim(),
      };
      const data = isAssignment
        ? await createAssignment({
            ...shared,
            dueDate: new Date(form.dueDate).toISOString(),
            // Left undefined when the field is blank or nonsense, so the
            // model's own default (100) applies. `Number("") || 0` turned a
            // cleared "Out of" box into a zero-mark assignment, which the
            // backend accepts — max_marks has no minimum validator.
            maxMarks: Number(form.maxMarks) > 0
              ? Number(form.maxMarks)
              : undefined,
            isPublished: form.isPublished,
          })
        : await createMaterial({
            ...shared,
            fileIds: files.map((f) => f.id),
          });

      const teacher = eligible.find((t) => t.id === form.teacherId);
      const created = {
        type: form.type,
        id: data.id,
        title: form.title.trim(),
        teacherName: teacher?.name || "the chosen teacher",
        subjectName: subject?.name || "",
        batchName: chosenBatch?.name || null,
        isPublished: isAssignment ? form.isPublished : true,
      };
      setResult(created);
      onCreated?.(created);
    } catch (e) {
      const body = e?.response?.data;
      if (body && typeof body === "object" && !Array.isArray(body)) {
        setFieldErrors(body);
        // Bounce back to the step that owns the rejected field, so the fix is
        // where the message is. A staffing refusal arrives as
        // non_field_errors and belongs to the teacher step.
        if (body.teacher_id || body.non_field_errors) setStep(1);
        else if (body.subject_id || body.batch_id) setStep(0);
      }
      setError(errText(e));
    } finally {
      setSaving(false);
    }
  };

  // ── created ────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="cs-palette-overlay">
        <div className="cs-confirm cs-confirm--wide" role="dialog" aria-modal="true">
          <h2 className="cs-card__title">
            <Check size={16} aria-hidden="true" /> {result.title} added
          </h2>
          <p className="cs-field__hint">
            Filed under <strong>{result.teacherName}</strong> on{" "}
            {result.subjectName}
            {result.batchName ? ` · ${result.batchName}` : " · every batch"}.
            It is in their My Resources list now, and they can edit it.
          </p>
          <p className={result.isPublished ? "cs-field__hint" : "cs-field__warn"}>
            {result.isPublished
              ? "Students in scope can see it, and have been notified."
              : "Saved as a draft — no student can see it until the teacher publishes it."}
          </p>
          <div className="cs-confirm__actions">
            <button type="button" className="cs-btn-ghost" onClick={onClose}>
              Done
            </button>
            <button
              type="button"
              className="cs-btn-primary"
              onClick={() => {
                // Keep the course/subject/batch/teacher, clear the content.
                // Adding five worksheets to one subject is the normal case and
                // re-picking the same four things each time is the tedium.
                setResult(null);
                setFiles([]);
                setForm((f) => ({
                  ...f, title: "", description: "", chapterId: "",
                  customChapter: "",
                }));
                setStep(2);
              }}
            >
              Add another here <ArrowRight size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── form ───────────────────────────────────────────────────────────
  return (
    <div
      className="cs-palette-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="cs-confirm cs-confirm--wide" role="dialog" aria-modal="true">
        <h2 className="cs-card__title">Add academy content</h2>

        <div className="cs-steps">
          {STEPS.map((label, i) => (
            <span key={label} className={`cs-step${i <= step ? " is-done" : ""}`}>
              {i < step && <Check size={11} aria-hidden="true" />}
              {label}
            </span>
          ))}
        </div>

        {error && <p className="cs-error">{error}</p>}

        {step === 0 && (
          <>
            <div className="cs-field">
              <span className="cs-field__label">What are you adding</span>
              <div className="acc-typerow">
                {[
                  {
                    value: TYPE_MATERIAL, icon: Paperclip, label: "Study material",
                    hint: "Files students can download. Visible as soon as it is saved.",
                  },
                  {
                    value: TYPE_ASSIGNMENT, icon: FileText, label: "Assignment",
                    hint: "Has a due date and a mark. Students submit against it.",
                  },
                ].map(({ value, icon: Icon, label, hint }) => (
                  <button
                    key={value}
                    type="button"
                    className={`acc-typecard${form.type === value ? " is-on" : ""}`}
                    onClick={() => set({ type: value, teacherId: "" })}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span className="acc-typecard__label">{label}</span>
                    <span className="acc-typecard__hint">{hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="acc-course">
                Which course
              </label>
              <select
                id="acc-course"
                className="cs-input cs-input--block"
                value={form.courseId}
                onChange={(e) => pickCourse(e.target.value)}
                disabled={!courses}
              >
                <option value="">{courses ? "Choose one…" : "Loading…"}</option>
                {(courses || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.status !== "PUBLISHED" ? ` — ${c.status.toLowerCase()}` : ""}
                    {c.subject_count === 0 ? " — no subjects" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="acc-subject">
                Which subject
              </label>
              <select
                id="acc-subject"
                className="cs-input cs-input--block"
                value={form.subjectId}
                onChange={(e) => set({ subjectId: e.target.value, teacherId: "", chapterId: "" })}
                disabled={!tree || treeLoading}
              >
                <option value="">
                  {treeLoading ? "Loading…" : tree ? "Choose one…" : "Pick a course first"}
                </option>
                {(tree?.subjects || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.teachers.length === 0 ? " — nobody teaches it" : ""}
                  </option>
                ))}
              </select>
              {fieldErrors.subject_id && (
                <p className="cs-field__warn">{String(fieldErrors.subject_id)}</p>
              )}
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="acc-batch">
                Which batch{isAssignment ? "" : " (optional)"}
              </label>
              <select
                id="acc-batch"
                className="cs-input cs-input--block"
                value={form.batchId}
                onChange={(e) => set({ batchId: e.target.value, teacherId: "" })}
                disabled={!tree || treeLoading}
              >
                <option value="">
                  {isAssignment ? "Choose one…" : "Every batch of this course"}
                </option>
                {(tree?.batches || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code}){b.is_active ? "" : " — archived"}
                  </option>
                ))}
              </select>
              <p className="cs-field__hint">
                {isAssignment
                  ? "Required. Due dates are per cohort, so an assignment always belongs to one batch."
                  : "Leave this alone unless the file is only for one cohort — course-wide material is reused by every batch."}
              </p>
              {fieldErrors.batch_id && (
                <p className="cs-field__warn">{String(fieldErrors.batch_id)}</p>
              )}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="cs-field">
              <label className="cs-field__label" htmlFor="acc-teacher">
                Who looks after it
              </label>
              {eligible.length > 0 ? (
                <>
                  <select
                    id="acc-teacher"
                    className="cs-input cs-input--block"
                    value={form.teacherId}
                    onChange={(e) => set({ teacherId: e.target.value })}
                  >
                    <option value="">Choose one…</option>
                    {eligible.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.course_wide ? " — all batches" : " — this batch only"}
                      </option>
                    ))}
                  </select>
                  <p className="cs-field__hint">
                    This is who owns it. It appears in their My Resources list
                    and they can edit it; your admin account is not offered,
                    because content nobody teaches is content nobody maintains.
                  </p>
                </>
              ) : (
                <div className="cs-note cs-note--warn">
                  <CircleAlert size={12} aria-hidden="true" />{" "}
                  {wrongBatchOnly ? (
                    <>
                      {subject?.name} has teaching staff, but nobody who covers{" "}
                      <strong>{chosenBatch?.name}</strong>. Either pick a batch
                      they do cover, or add an assignment for this batch on the{" "}
                      <Link to={`/courses?course=${form.courseId}`}>
                        course’s staffing
                      </Link>{" "}
                      first.
                    </>
                  ) : (
                    <>
                      Nobody teaches {subject?.name || "this subject"} yet, so
                      there is nobody to own this. Assign a teacher on the{" "}
                      <Link to={`/courses?course=${form.courseId}`}>
                        course’s staffing
                      </Link>{" "}
                      and come back.
                    </>
                  )}
                </div>
              )}
              {fieldErrors.teacher_id && (
                <p className="cs-field__warn">{String(fieldErrors.teacher_id)}</p>
              )}
              {fieldErrors.non_field_errors && (
                <p className="cs-field__warn">
                  {String(fieldErrors.non_field_errors)}
                </p>
              )}
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="acc-chapter">
                Which chapter (optional)
              </label>
              <select
                id="acc-chapter"
                className="cs-input cs-input--block"
                value={form.chapterId}
                onChange={(e) => set({ chapterId: e.target.value, customChapter: "" })}
              >
                <option value="">No particular chapter</option>
                {(subject?.chapters || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              {!form.chapterId && (
                <input
                  className="cs-input cs-input--block"
                  value={form.customChapter}
                  placeholder="…or type a new chapter name"
                  onChange={(e) => set({ customChapter: e.target.value })}
                />
              )}
              <p className="cs-field__hint">
                A new name here creates a real chapter on the subject, credited
                to the teacher above — not to you.
              </p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="cs-field">
              <label className="cs-field__label" htmlFor="acc-title">
                Title
              </label>
              <input
                id="acc-title"
                ref={titleRef}
                className="cs-input cs-input--block"
                value={form.title}
                placeholder={isAssignment ? "Worksheet 3 — Newton’s laws" : "Chapter 4 notes"}
                onChange={(e) => set({ title: e.target.value })}
              />
              {fieldErrors.title && (
                <p className="cs-field__warn">{String(fieldErrors.title)}</p>
              )}
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="acc-desc">
                Description (optional)
              </label>
              <textarea
                id="acc-desc"
                className="cs-input cs-input--block cs-textarea"
                rows={3}
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </div>

            {!isAssignment && (
              <div className="cs-field">
                <span className="cs-field__label">Files</span>
                <div className="cs-dropzone">
                  <UploadCloud size={20} aria-hidden="true" />
                  <p className="cs-dropzone__title">Add the files students download</p>
                  <p className="cs-dropzone__sub">
                    <button
                      type="button"
                      className="cs-linklike"
                      onClick={() => fileInput.current?.click()}
                    >
                      choose from your computer
                    </button>
                  </p>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    hidden
                    onChange={(e) => {
                      sendFiles(e.target.files);
                      // Cleared so re-picking the same file fires onChange again.
                      e.target.value = "";
                    }}
                  />
                  {uploading.length > 0 && (
                    <p className="cs-dropzone__sub">
                      Uploading {uploading.join(", ")}…
                    </p>
                  )}
                </div>
                {files.map((f) => (
                  <div key={f.id} className="acc-filerow">
                    <Paperclip size={12} aria-hidden="true" />
                    <span className="acc-filerow__name">{f.file_name}</span>
                    <button
                      type="button"
                      className="cs-btn-ghost cs-btn-primary--sm"
                      onClick={() =>
                        setFiles((prev) => prev.filter((x) => x.id !== f.id))
                      }
                      aria-label={`Remove ${f.file_name}`}
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <p className="cs-field__hint">
                  PDF, Word, PowerPoint, Excel, images, audio and text, up to
                  50 MB each. Programs and web pages are refused.
                  {files.length === 0 && " At least one file is required."}
                </p>
              </div>
            )}

            {isAssignment && (
              <>
                <div className="cs-field">
                  <label className="cs-field__label" htmlFor="acc-due">
                    Due
                  </label>
                  <input
                    id="acc-due"
                    type="datetime-local"
                    className="cs-input cs-input--block"
                    value={form.dueDate}
                    onChange={(e) => set({ dueDate: e.target.value })}
                  />
                  {fieldErrors.due_date && (
                    <p className="cs-field__warn">{String(fieldErrors.due_date)}</p>
                  )}
                </div>

                <div className="cs-field">
                  <label className="cs-field__label" htmlFor="acc-marks">
                    Out of
                  </label>
                  <input
                    id="acc-marks"
                    type="number"
                    min="1"
                    className="cs-input cs-input--block"
                    value={form.maxMarks}
                    onChange={(e) => set({ maxMarks: e.target.value })}
                  />
                </div>

                <div className="cs-field">
                  <label className="cs-field__labelrow" htmlFor="acc-publish">
                    <input
                      id="acc-publish"
                      type="checkbox"
                      checked={form.isPublished}
                      onChange={(e) => set({ isPublished: e.target.checked })}
                    />
                    <span className="cs-field__label">
                      Release it to students now
                    </span>
                  </label>
                  <p className={form.isPublished ? "cs-field__hint" : "cs-field__warn"}>
                    {form.isPublished
                      ? "Every student in scope is notified as soon as you save."
                      : "Saved as a draft. Only the teacher sees it until they publish."}
                  </p>
                </div>
              </>
            )}

            <p className="cs-field__hint">
              <UserRound size={11} aria-hidden="true" /> Goes to{" "}
              {eligible.find((t) => t.id === form.teacherId)?.name || "—"} on{" "}
              {subject?.name}
              {chosenBatch ? ` · ${chosenBatch.name}` : " · every batch"}.
            </p>
          </>
        )}

        <div className="cs-confirm__actions">
          {step > 0 && (
            <button
              type="button"
              className="cs-btn-ghost"
              disabled={saving}
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft size={13} aria-hidden="true" /> Back
            </button>
          )}
          <button
            type="button"
            className="cs-btn-ghost"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="cs-btn-primary"
              disabled={!stepReady}
              onClick={() => setStep((s) => s + 1)}
            >
              Next <ArrowRight size={13} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="cs-btn-primary"
              disabled={saving || !contentReady || uploading.length > 0}
              onClick={submit}
            >
              {saving ? "Saving…" : isAssignment ? "Create assignment" : "Add material"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewAcademyContentDialog;
