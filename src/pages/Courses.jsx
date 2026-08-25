import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getBoards, createBoard, updateBoard, deleteBoard,
  getBoardCourses, getAllCourses, createCourse, getCourse, updateCourse, deleteCourse,
  getCourseSubjects, createSubject, updateSubject, deleteSubject,
  createChapter, updateChapter, deleteChapter,
  getSkillCategories, getSkillExperts, getSkillApplications,
  // ── new: batches + teacher assignment + progress/roster ──
  getCourseBatches, createBatch, updateBatch, deleteBatch,
  getBatchProgress, getBatchRoster, moveEnrollmentBatch,
  getAdminAcademyTeachers, getSubjectTeachers,
  assignSubjectTeacher, updateSubjectTeacher, removeSubjectTeacher,
  getCourseStaffing, bulkAssignTeacher,
  // ── new: course categories (multi-select on the course form) ──
  getCourseCategories,
} from "../api/admin";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";
import ImageUploadField from "../components/ImageUploadField";
import FeaturedCardPreview from "./content/preview/FeaturedCardPreview";
import NavMenuEntryPreview from "./content/preview/NavMenuEntryPreview";
import PlacementBadge from "./content/preview/PlacementBadge";
import TrackChips from "../components/TrackChips";
import { errText } from "../utils/errText";
import { formatDate } from "../utils/formatDate";
import { buildBody } from "../utils/buildBody";
import "../css/Courses.css";
import "../css/Content.css"; // for the collapsible SEO section (cms-details) + live preview panel

// Board types, by value. A lookup rather than a ternary: the table read
// `board_type === "STATE" ? "State" : "Central"`, so every value that was not
// STATE rendered as "Central" — meaning the moment a third type existed it
// would have been silently mislabelled rather than shown as unknown.
const BOARD_TYPE_LABELS = {
  CENTRAL: "Central",
  STATE: "State",
  COMPETITIVE: "Competitive exam",
};

const rupees = (paise) =>
  paise === null || paise === undefined ? "—" : `₹${(paise / 100).toLocaleString("en-IN")}`;
const roleLabel = (r) => (r === "ASSISTANT" ? "Assistant" : "Primary");

// Completeness/placement helpers for the course-list "content complete" /
// "shows up on" columns. `completeness`/`isIncomplete` accept EITHER shape a
// course can arrive in: the board-scoped list row (nested `details.syllabus`/
// `details.highlights`) or the edit form's flat state (`form.syllabus`/
// `form.highlights`) — `??` falls through to whichever is present, so the
// same function powers both the table row and the publish-guard check below.
const REQUIRED_COURSE_FIELDS = {
  Thumbnail: (c) => !!c.thumbnail,
  Description: (c) => !!c.description,
  Syllabus: (c) => !!(c.details?.syllabus ?? c.syllabus),
  Highlights: (c) => !!(c.details?.highlights ?? c.highlights),
  "SEO title": (c) => !!c.seo_title,
};

function completeness(course) {
  const keys = Object.keys(REQUIRED_COURSE_FIELDS);
  const missing = keys.filter((k) => !REQUIRED_COURSE_FIELDS[k](course));
  return { pct: Math.round(((keys.length - missing.length) / keys.length) * 100), missing };
}

const isIncomplete = (course) => completeness(course).pct < 100;

function placementsFor(course, board) {
  if (course.status !== "PUBLISHED") return ["Not published anywhere"];
  const items = ["Catalog"];
  if (course.is_featured) items.push("Homepage");
  if ((course.categories || []).some((cat) => cat.group === "competitive")) items.push("Navbar");
  if (board) items.push(`Navbar (${board.name})`);
  return items;
}

const TABS = [
  { key: "academy", label: "Academy" },
  { key: "skill", label: "Skill Dev" },
];

/* ───────────────────────── Create/Edit modal ───────────────────────── */
function FormModal({ type, mode, initial, busy, error, onSubmit, onCancel, board }) {
  const [form, setForm] = useState(initial || {});
  const [file, setFile] = useState(null);
  const [categoryOptions, setCategoryOptions] = useState([]);
  // Holds "PUBLISHED" while the confirm-to-override dialog is open for an
  // incomplete course; the status field itself isn't updated until confirmed.
  const [publishConfirm, setPublishConfirm] = useState(null);

  useEffect(() => {
    if (type !== "course") return;
    getCourseCategories().then((rows) => setCategoryOptions(Array.isArray(rows) ? rows : []));
  }, [type]);

  // Instant local preview for a newly-picked-but-not-yet-uploaded thumbnail
  // (ImageUploadField only shows the filename, not a rendered preview) —
  // fed into the live preview panel below. The URL is revoked once it's no
  // longer the current one, so we don't leak blob URLs across edits.
  const filePreviewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl); }, [filePreviewUrl]);

  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const toggleCategory = (id) =>
    setForm((f) => {
      const cur = f.categories || [];
      return {
        ...f,
        categories: cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id],
      };
    });

  const heading =
    `${mode === "edit" ? "Edit" : "New"} ` +
    { board: "Board", course: "Course", subject: "Subject", batch: "Batch" }[type];

  const isCourse = type === "course";

  // ── Live preview: where this course will actually show up on the real
  // site, and (if featured) a mini render of its homepage card. ──
  const selectedCategoryObjs = (form.categories || [])
    .map((id) => categoryOptions.find((c) => c.id === id))
    .filter(Boolean);
  const hasCompetitiveCategory = selectedCategoryObjs.some((c) => c.group === "competitive");
  const placementItems = isCourse
    ? [
        { label: "Catalog", sublabel: "/courses" },
        ...(form.is_featured ? [{ label: "Homepage", sublabel: "Featured Grid" }] : []),
        ...(hasCompetitiveCategory ? [{ label: "Navbar", sublabel: "Competitive Exams column" }] : []),
        ...(board ? [{ label: "Navbar", sublabel: `School Education → ${board.name}` }] : []),
      ]
    : [];
  const showNavPreview = hasCompetitiveCategory || !!board;

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div
        className={`cm-form-card${isCourse ? " cm-form-card--wide cm-form-card--with-preview" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{heading}</h3>

        <div className={isCourse ? "cm-form-split" : undefined}>
        <div className={isCourse ? "cm-form-main" : undefined}>

        {type === "board" && (
          <>
            <label className="cm-field">
              <span>Name</span>
              <input value={form.name || ""} onChange={set("name")} placeholder="e.g. CBSE" autoFocus />
            </label>
            <label className="cm-field">
              <span>Type</span>
              <select value={form.board_type || "CENTRAL"} onChange={set("board_type")}>
                <option value="CENTRAL">Central</option>
                <option value="STATE">State</option>
                {/* A competitive exam is a syllabus authority a course hangs
                    off, same as a board — but it is neither central nor
                    state, and labelling MPSC or NEET as a "Central board" on
                    a public catalog page is simply wrong. */}
                <option value="COMPETITIVE">Competitive exam</option>
              </select>
            </label>
            <label className="cm-field">
              <span>Description</span>
              <input value={form.description || ""} onChange={set("description")} placeholder="Optional" />
            </label>
            <label className="cm-check">
              <input type="checkbox" checked={form.is_active ?? true} onChange={set("is_active")} />
              <span>Active (visible on the public site)</span>
            </label>
            <label className="cm-field">
              <span>Logo (shown on board cards / filters)</span>
              <ImageUploadField value={file} onChange={setFile} previewUrl={form.logo} />
            </label>
          </>
        )}

        {type === "course" && (
          <>
            <label className="cm-field">
              <span>Title</span>
              <input value={form.title || ""} onChange={set("title")} placeholder="e.g. Class 12 Science" autoFocus />
            </label>
            <label className="cm-field">
              <span>Description</span>
              <textarea rows={3} value={form.description || ""} onChange={set("description")} placeholder="Optional" />
            </label>
            {/* Course type + class level. Both are writable on CourseSerializer
                but were missing from this form, so every course created here
                was silently ACADEMIC with no class level — the only way to get
                a COACHING (competitive) course was the create_competitive_courses
                management command or Django admin. That is why competitive exams
                had no admin workflow. */}
            <div className="cm-row">
              <label className="cm-field">
                <span>Course type</span>
                <select value={form.kind || "ACADEMIC"} onChange={set("kind")}>
                  <option value="ACADEMIC">Academic (board / class)</option>
                  <option value="COACHING">Coaching (competitive exam)</option>
                </select>
              </label>
              <label className="cm-field">
                <span>Class level</span>
                {/* A coaching course spans no single class — the backend stores
                    NULL for these — so the picker is disabled rather than
                    offering a value that would be wrong whatever you chose. */}
                <select
                  value={form.kind === "COACHING" ? "" : (form.class_level ?? "")}
                  onChange={set("class_level")}
                  disabled={form.kind === "COACHING"}
                >
                  <option value="">
                    {form.kind === "COACHING" ? "Not applicable" : "None"}
                  </option>
                  {[6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <option key={n} value={n}>Class {n}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="cm-row">
              <label className="cm-field">
                <span>Price (₹)</span>
                <input type="number" min="0" value={form.price_rupees ?? 0} onChange={set("price_rupees")} />
              </label>
              <label className="cm-field">
                <span>MRP (₹, optional)</span>
                <input type="number" min="0" value={form.mrp_rupees ?? ""} onChange={set("mrp_rupees")} placeholder="Struck-through list price" />
              </label>
              <label className="cm-field">
                <span>Access (days)</span>
                <input type="number" min="1" value={form.subscription_duration_days ?? 30} onChange={set("subscription_duration_days")} />
              </label>
            </div>
            <div className="cm-row">
              <label className="cm-field">
                <span>Discount label</span>
                <input value={form.discount_label || ""} onChange={set("discount_label")} placeholder="e.g. 20% off" />
              </label>
              <label className="cm-field">
                <span>Badge</span>
                <input value={form.badge || ""} onChange={set("badge")} placeholder="e.g. Bestseller" />
              </label>
              <label className="cm-field">
                <span>Status</span>
                <select
                  value={form.status || "DRAFT"}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === "PUBLISHED" && isIncomplete(form)) {
                      setPublishConfirm(next);
                      return;
                    }
                    setForm((f) => ({ ...f, status: next }));
                  }}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                  <option value="COMING_SOON">Coming Soon</option>
                </select>
              </label>
            </div>
            <div className="cm-row">
              <label className="cm-check" style={{ marginTop: 0 }}>
                <input type="checkbox" checked={form.is_featured ?? false} onChange={set("is_featured")} />
                <span>Featured</span>
              </label>
              <label className="cm-field">
                <span>Display order</span>
                <input type="number" value={form.display_order ?? 0} onChange={set("display_order")} />
              </label>
            </div>
            <p className="cm-hint">
              Only Published courses (with an open batch) appear in the public catalog.
              The platform is currently free — price applies only when a paid payment mode is switched on.
            </p>

            <label className="cm-field">
              <span>Thumbnail (16:9)</span>
              <ImageUploadField value={file} onChange={setFile} previewUrl={form.thumbnail} />
            </label>

            <label className="cm-field">
              <span>Categories</span>
              <div className="cm-checkbox-group">
                {categoryOptions.length === 0 ? (
                  <span className="cm-muted">No categories yet — add some from the Content → Categories tab.</span>
                ) : (
                  categoryOptions.map((cat) => (
                    <label className="cm-check cm-check--inline" key={cat.id}>
                      <input
                        type="checkbox"
                        checked={(form.categories || []).includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                      />
                      <span>{cat.name}</span>
                    </label>
                  ))
                )}
              </div>
            </label>

            <label className="cm-field">
              <span>Promo video URL</span>
              <input value={form.promo_video_url || ""} onChange={set("promo_video_url")} placeholder="https://…" />
            </label>

            <h4 className="cm-subheading">Course details</h4>
            <div className="cm-row">
              <label className="cm-field">
                <span>Level</span>
                <input value={form.level || ""} onChange={set("level")} placeholder="e.g. Intermediate" />
              </label>
              <label className="cm-field">
                <span>Duration (weeks)</span>
                <input type="number" min="0" value={form.duration_weeks ?? ""} onChange={set("duration_weeks")} />
              </label>
              <label className="cm-field">
                <span>Language</span>
                <input value={form.language || ""} onChange={set("language")} placeholder="English" />
              </label>
            </div>
            <label className="cm-field">
              <span>Requirements</span>
              <textarea rows={2} value={form.requirements || ""} onChange={set("requirements")} placeholder="Optional" />
            </label>
            <label className="cm-field">
              <span>Syllabus</span>
              <textarea rows={4} value={form.syllabus || ""} onChange={set("syllabus")} placeholder="Optional" />
            </label>
            <label className="cm-field">
              <span>Highlights (one per line — the "What you'll learn" list)</span>
              <textarea rows={4} value={form.highlights || ""} onChange={set("highlights")} placeholder={"e.g.\nMaster core concepts\nSolve past-year papers"} />
            </label>
            <label className="cm-field">
              <span>Includes (one per line — the "This course includes" list)</span>
              <textarea rows={4} value={form.includes || ""} onChange={set("includes")} placeholder={"e.g.\n24/7 access\nDownloadable notes"} />
            </label>

            <details className="cms-details">
              <summary>SEO</summary>
              <label className="cm-field">
                <span>SEO title</span>
                <input value={form.seo_title || ""} onChange={set("seo_title")} />
              </label>
              <label className="cm-field">
                <span>SEO description</span>
                <textarea rows={2} value={form.seo_description || ""} onChange={set("seo_description")} />
              </label>
            </details>
          </>
        )}

        {type === "subject" && (
          <>
            <label className="cm-field">
              <span>Name</span>
              <input value={form.name || ""} onChange={set("name")} placeholder="e.g. Physics" autoFocus />
            </label>
            <label className="cm-field">
              <span>Order</span>
              <input type="number" min="1" value={form.order ?? ""} onChange={set("order")} placeholder="Auto (added to end)" />
            </label>
            <label className="cm-field">
              <span>Textbook</span>
              <input value={form.textbook || ""} onChange={set("textbook")} placeholder="e.g. NCERT Mathematics" />
            </label>
            <label className="cm-field">
              <span>Image</span>
              <ImageUploadField value={file} onChange={setFile} previewUrl={form.image} />
            </label>
          </>
        )}

        {type === "batch" && (
          <>
            <div className="cm-row">
              <label className="cm-field">
                <span>Name</span>
                <input value={form.name || ""} onChange={set("name")} placeholder="e.g. Morning 2026" autoFocus />
              </label>
              <label className="cm-field">
                <span>Code</span>
                <input value={form.code || ""} onChange={set("code")} placeholder="e.g. A13" />
              </label>
            </div>
            <div className="cm-row">
              <label className="cm-field">
                <span>Year</span>
                <input type="number" value={form.year ?? ""} onChange={set("year")} placeholder="e.g. 2026" />
              </label>
              <label className="cm-field">
                <span>Capacity</span>
                <input type="number" min="1" value={form.capacity ?? ""} onChange={set("capacity")} placeholder="Blank = unlimited" />
              </label>
            </div>
            <div className="cm-row">
              <label className="cm-field">
                <span>Start date</span>
                <input type="date" value={form.start_date || ""} onChange={set("start_date")} />
              </label>
              <label className="cm-field">
                <span>End date</span>
                <input type="date" value={form.end_date || ""} onChange={set("end_date")} />
              </label>
            </div>
            <label className="cm-field">
              <span>Price override (₹)</span>
              <input type="number" min="0" value={form.price_override ?? ""} onChange={set("price_override")} placeholder="Blank = use course price" />
            </label>
            <label className="cm-check">
              <input type="checkbox" checked={form.is_active ?? true} onChange={set("is_active")} />
              <span>Active (open for new enrollments)</span>
            </label>
            <p className="cm-hint">
              Students are placed in a batch when you approve their enrollment request.
              A full batch blocks further approvals into it.
            </p>
          </>
        )}

        </div>

        {isCourse && (
          <aside className="cms-preview-panel">
            <span className="cms-preview-panel-label">Live preview</span>
            <PlacementBadge items={placementItems} />
            {form.is_featured && (
              <FeaturedCardPreview
                title={form.title}
                priceLabel={form.price_rupees}
                mrp={form.mrp_rupees || null}
                discountLabel={form.discount_label}
                thumbnailUrl={filePreviewUrl || form.thumbnail || null}
                // No ribbon here on purpose. The homepage card's ribbon comes
                // from ShowcaseCourse.ribbon, edited on the Showcase screen —
                // /courses/public/featured/ reads card.ribbon and never looks at
                // Course.badge. Passing form.badge made this "Live preview"
                // show a ribbon the live site would not render. (Course.badge
                // does drive a ribbon, but on the catalog page, not this card.)
                isComingSoon={form.status === "COMING_SOON"}
              />
            )}
            {showNavPreview && (
              <NavMenuEntryPreview
                label={form.title || "Untitled course"}
                comingSoon={form.status === "COMING_SOON"}
              />
            )}
          </aside>
        )}

        </div>

        {error && <div className="cm-form-error">{error}</div>}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="confirm-ok" onClick={() => onSubmit(form, file)} disabled={busy}>
            {busy ? "Saving…" : mode === "edit" ? "Save" : "Create"}
          </button>
        </div>
      </div>

      {publishConfirm && (
        <ConfirmModal
          title="Publish incomplete course?"
          message={`This course is missing: ${completeness(form).missing.join(", ")}. Publish it anyway?`}
          onConfirm={() => {
            setForm((f) => ({ ...f, status: publishConfirm }));
            setPublishConfirm(null);
          }}
          onCancel={() => setPublishConfirm(null)}
        />
      )}
    </div>
  );
}

/* ───────────────────── Teacher assignment modal ───────────────────── */
function TeacherAssignModal({ subject, onClose, onChanged }) {
  const [assigned, setAssigned] = useState([]);
  const [pool, setPool] = useState([]);
  const [poolCount, setPoolCount] = useState(0);
  const [poolHasMore, setPoolHasMore] = useState(false);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("PRIMARY");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    const list = await getSubjectTeachers(subject.id);
    setAssigned(Array.isArray(list) ? list : []);
  }, [subject.id]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const list = await getSubjectTeachers(subject.id);
      if (cancel) return;
      setAssigned(Array.isArray(list) ? list : []);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [subject.id]);

  // Server-side search — debounced, so a teacher outside the server's first
  // page (result truncation is now real: 50 rows, see getAdminAcademyTeachers)
  // is still reachable by typing their exact name/email.
  useEffect(() => {
    let cancel = false;
    const t = setTimeout(() => {
      getAdminAcademyTeachers(q).then((res) => {
        if (cancel) return;
        setPool(res.data || []);
        setPoolCount(res.count || 0);
        setPoolHasMore(!!res.has_more);
      });
    }, q ? 300 : 0);
    return () => { cancel = true; clearTimeout(t); };
  }, [q, subject.id]);

  const assignedIds = new Set(assigned.map((t) => t.user_id));
  const matches = pool.filter((t) => !assignedIds.has(t.user_id));

  const runAction = async (id, fn) => {
    setBusyId(id); setErr("");
    try { await fn(); await refresh(); onChanged?.(); }
    catch (e) { setErr(errText(e)); }
    finally { setBusyId(null); }
  };

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="cm-form-card cm-form-card--wide" onClick={(e) => e.stopPropagation()}>
        <h3>Teachers · {subject.name}</h3>

        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : (
          <>
            {assigned.length === 0 ? (
              <p className="cm-empty-note">No teachers assigned yet. Add one below.</p>
            ) : (
              <div className="cm-assign-list">
                {assigned.map((t) => (
                  <div className="cm-assign-row" key={t.assignment_id}>
                    <div className="cm-assign-face">
                      {t.photo ? (
                        <img src={t.photo} alt="" className="cm-avatar" />
                      ) : (
                        <span className="cm-avatar cm-avatar--fallback">
                          {(t.name || "?").trim().charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="cm-assign-meta">
                        <span className="cm-assign-name">{t.name}</span>
                        <span className="cm-assign-sub">
                          {t.qualification || t.email}
                          {t.rating ? ` · ★ ${t.rating}` : ""}
                        </span>
                        <TrackChips tracks={t.tracks} />
                      </div>
                    </div>
                    <div className="cm-assign-controls">
                      <select
                        value={t.display_role}
                        disabled={busyId === t.assignment_id}
                        onChange={(e) =>
                          runAction(t.assignment_id, () => updateSubjectTeacher(t.assignment_id, e.target.value))
                        }
                      >
                        <option value="PRIMARY">Primary</option>
                        <option value="ASSISTANT">Assistant</option>
                      </select>
                      <button
                        className="cm-icon-btn cm-icon-btn--danger"
                        disabled={busyId === t.assignment_id}
                        onClick={() =>
                          runAction(t.assignment_id, () => removeSubjectTeacher(t.assignment_id))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="cm-assign-add">
              <div className="cm-assign-add-head">
                <span className="cm-assign-add-title">Assign a teacher</span>
                <div className="cm-role-toggle">
                  <button
                    className={`cm-role-opt${role === "PRIMARY" ? " active" : ""}`}
                    onClick={() => setRole("PRIMARY")}
                  >
                    Primary
                  </button>
                  <button
                    className={`cm-role-opt${role === "ASSISTANT" ? " active" : ""}`}
                    onClick={() => setRole("ASSISTANT")}
                  >
                    Assistant
                  </button>
                </div>
              </div>
              <input
                className="cm-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search approved teachers by name or email"
              />
              {poolHasMore && (
                <p className="cm-hint">
                  Showing {pool.length} of {poolCount} — refine your search.
                </p>
              )}
              <div className="cm-pool-list">
                {matches.length === 0 ? (
                  <div className="cm-pool-empty">
                    {pool.length === 0
                      ? "No approved teachers found."
                      : "No matches — everyone matching is already assigned."}
                  </div>
                ) : (
                  matches.map((t) => (
                    <div className="cm-pool-row" key={t.user_id}>
                      <div className="cm-assign-meta">
                        <span className="cm-assign-name">{t.name}</span>
                        <span className="cm-assign-sub">{t.qualification || t.email}</span>
                        <TrackChips tracks={t.tracks} />
                      </div>
                      <button
                        className="cm-icon-btn"
                        disabled={busyId === t.user_id}
                        onClick={() =>
                          runAction(t.user_id, () => assignSubjectTeacher(subject.id, t.user_id, role))
                        }
                      >
                        {busyId === t.user_id ? "Adding…" : `+ Add`}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {err && <div className="cm-form-error">{err}</div>}
          </>
        )}

        <div className="confirm-actions">
          <button className="confirm-ok" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Bulk teacher assignment modal ─────────────────────
   One teacher → many subjects of the same course in a single request.
   Reuses the exact same server-side-search teacher picker (+ TrackChips)
   as TeacherAssignModal above, just swapping "pick a subject" for
   "pick many subjects". */
function BulkAssignModal({ course, subjects, teachersBySubject, onClose, onAssigned }) {
  const [pool, setPool] = useState([]);
  const [poolCount, setPoolCount] = useState(0);
  const [poolHasMore, setPoolHasMore] = useState(false);
  const [q, setQ] = useState("");
  const [teacherId, setTeacherId] = useState(null);
  const [role, setRole] = useState("PRIMARY");
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  // Server-side search — debounced, same convention as TeacherAssignModal.
  useEffect(() => {
    let cancel = false;
    const t = setTimeout(() => {
      getAdminAcademyTeachers(q).then((res) => {
        if (cancel) return;
        setPool(res.data || []);
        setPoolCount(res.count || 0);
        setPoolHasMore(!!res.has_more);
      });
    }, q ? 300 : 0);
    return () => { cancel = true; clearTimeout(t); };
  }, [q]);

  const toggleSubject = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const selectAll = () => setSelected(new Set(subjects.map((s) => s.id)));
  const selectNone = () => setSelected(new Set());

  const submit = async () => {
    if (!teacherId || selected.size === 0) return;
    setBusy(true); setErr("");
    try {
      const res = await bulkAssignTeacher(course.id, {
        teacher_id: teacherId,
        subject_ids: Array.from(selected),
        display_role: role,
      });
      setResult(res);
      onAssigned?.();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="cm-form-card cm-form-card--wide" onClick={(e) => e.stopPropagation()}>
        <h3>Bulk assign teacher · {course.title}</h3>

        {result ? (
          <>
            <p className="cm-empty-note">
              Assigned to {result.assigned} subject{result.assigned !== 1 ? "s" : ""}.
              {result.skipped_already_assigned?.length > 0 &&
                ` ${result.skipped_already_assigned.length} skipped (already assigned).`}
              {result.skipped_not_in_course?.length > 0 &&
                ` ${result.skipped_not_in_course.length} skipped (not in this course).`}
            </p>
            <div className="confirm-actions">
              <button className="confirm-ok" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <>
            <div className="cm-assign-add-head">
              <span className="cm-assign-add-title">Teacher</span>
              <div className="cm-role-toggle">
                <button
                  className={`cm-role-opt${role === "PRIMARY" ? " active" : ""}`}
                  onClick={() => setRole("PRIMARY")}
                >
                  Primary
                </button>
                <button
                  className={`cm-role-opt${role === "ASSISTANT" ? " active" : ""}`}
                  onClick={() => setRole("ASSISTANT")}
                >
                  Assistant
                </button>
              </div>
            </div>
            <input
              className="cm-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search approved teachers by name or email"
            />
            {poolHasMore && (
              <p className="cm-hint">
                Showing {pool.length} of {poolCount} — refine your search.
              </p>
            )}
            <div className="cm-pool-list">
              {pool.length === 0 ? (
                <div className="cm-pool-empty">No approved teachers found.</div>
              ) : (
                pool.map((t) => (
                  <div className="cm-pool-row" key={t.user_id}>
                    <div className="cm-assign-meta">
                      <span className="cm-assign-name">{t.name}</span>
                      <span className="cm-assign-sub">{t.qualification || t.email}</span>
                      <TrackChips tracks={t.tracks} />
                    </div>
                    <button
                      className="cm-icon-btn"
                      style={teacherId === t.user_id ? { borderColor: "#4f6df5", color: "#4f6df5" } : undefined}
                      onClick={() => setTeacherId(t.user_id)}
                    >
                      {teacherId === t.user_id ? "Selected" : "Select"}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="cm-assign-add-head" style={{ marginTop: 16 }}>
              <span className="cm-assign-add-title">Subjects ({selected.size} selected)</span>
              <div className="cm-assign-controls">
                <button className="cm-icon-btn" onClick={selectAll}>Select all</button>
                <button className="cm-icon-btn" onClick={selectNone}>Select none</button>
              </div>
            </div>
            <div className="cm-checkbox-group">
              {subjects.map((s) => {
                const hasTeachers = (teachersBySubject[s.id] || []).length > 0;
                return (
                  <label className="cm-check cm-check--inline" key={s.id}>
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSubject(s.id)} />
                    <span>
                      {s.name}
                      {!hasTeachers && <em className="cm-chip-role"> unstaffed</em>}
                    </span>
                  </label>
                );
              })}
            </div>

            {err && <div className="cm-form-error">{err}</div>}

            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="confirm-ok" onClick={submit} disabled={busy || !teacherId || selected.size === 0}>
                {busy ? "Assigning…" : `Assign to ${selected.size} subject${selected.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────────────── Chapter content modal ───────────────────── */
function ChapterModal({ subject, onClose, onChanged }) {
  const [chapters, setChapters] = useState(subject.chapters || []);
  const [editingId, setEditingId] = useState(null); // chapter id being edited, or "new"
  // `order` is part of the draft so a chapter can be positioned by typing a
  // number. Before this the only control was the ↑/↓ arrows, which cost two
  // PATCHes per step — moving chapter 20 to the top meant 19 clicks and 38
  // requests. Blank means "leave where it is" (or append, for a new chapter).
  const [draft, setDraft] = useState({ title: "", content_html: "", trusted_html: false, order: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Every other delete on this screen routes through ConfirmModal; this one
  // used to fire straight from the button, sitting right next to Edit and the
  // reorder arrows, so a misclick destroyed a chapter's content_html for good.
  const [confirmDel, setConfirmDel] = useState(null);

  const startNew = () => {
    setDraft({ title: "", content_html: "", trusted_html: false, order: "" });
    setEditingId("new");
    setErr("");
  };
  const startEdit = (ch) => {
    setDraft({
      title: ch.title, content_html: ch.content_html || "",
      trusted_html: !!ch.trusted_html, order: ch.order ?? "",
    });
    setEditingId(ch.id);
    setErr("");
  };

  const save = async () => {
    setBusy(true); setErr("");
    try {
      // Blank order is omitted rather than sent as "" or 0, so an untouched
      // field keeps the server's own sequencing instead of silently jumping
      // the chapter to position 0.
      const { order, ...rest } = draft;
      const parsed = parseInt(order, 10);
      const payload = Number.isNaN(parsed) ? rest : { ...rest, order: parsed };
      if (editingId === "new") {
        const created = await createChapter(subject.id, payload);
        setChapters((cs) => [...cs, created]);
      } else {
        const updated = await updateChapter(editingId, payload);
        setChapters((cs) => cs.map((c) => (c.id === editingId ? updated : c)));
      }
      setEditingId(null);
      onChanged?.();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (ch) => {
    setBusy(true); setErr("");
    try {
      await deleteChapter(ch.id);
      setChapters((cs) => cs.filter((c) => c.id !== ch.id));
      setConfirmDel(null);
      onChanged?.();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [chapters],
  );

  // Assigns order = target array position (idx/otherIdx) rather than
  // swapping the chapters' existing `order` values — two chapters can share
  // the same order (e.g. both default to 0 via the custom-chapter upload
  // path), which would make a value-swap a silent no-op. Runs the two PATCHes
  // sequentially, not in parallel: if the second fails after the first
  // already landed, the server would otherwise be left with only one side of
  // the swap applied with no client-visible sign of it — compensate by
  // reverting the first PATCH so a failed reorder doesn't silently corrupt
  // server state.
  const move = async (idx, direction) => {
    const otherIdx = idx + direction;
    if (otherIdx < 0 || otherIdx >= sortedChapters.length) return;
    const ch = sortedChapters[idx];
    const other = sortedChapters[otherIdx];
    setBusy(true); setErr("");
    try {
      const updatedA = await updateChapter(ch.id, { order: otherIdx });
      try {
        const updatedB = await updateChapter(other.id, { order: idx });
        setChapters((cs) => cs.map((c) => {
          if (c.id === updatedA.id) return updatedA;
          if (c.id === updatedB.id) return updatedB;
          return c;
        }));
        onChanged?.();
      } catch (e) {
        try {
          const reverted = await updateChapter(ch.id, { order: idx });
          setChapters((cs) => cs.map((c) => (c.id === reverted.id ? reverted : c)));
        } catch {
          // Best-effort revert; surface the original failure either way.
        }
        throw e;
      }
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="cm-form-card cm-form-card--wide" onClick={(e) => e.stopPropagation()}>
        <h3>Chapters · {subject.name}</h3>

        {chapters.length === 0 && editingId !== "new" ? (
          <p className="cm-empty-note">No chapters yet. Add the first one below.</p>
        ) : (
          <div className="cm-assign-list">
            {sortedChapters.map((ch, idx) =>
              editingId === ch.id ? (
                <div className="cm-chapter-edit" key={ch.id}>
                  <label className="cm-field">
                    <span>Title</span>
                    <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                  </label>
                  <label className="cm-field">
                    <span>Order</span>
                    <input type="number" min="0" value={draft.order}
                      onChange={(e) => setDraft((d) => ({ ...d, order: e.target.value }))}
                      placeholder="Leave blank to keep the current position" />
                  </label>
                  <label className="cm-field">
                    <span>Content</span>
                    <textarea rows={5} value={draft.content_html}
                      onChange={(e) => setDraft((d) => ({ ...d, content_html: e.target.value }))}
                      placeholder="Chapter notes as HTML — sanitized on save." />
                  </label>
                  {err && <div className="cm-form-error">{err}</div>}
                  <div className="confirm-actions">
                    <button className="confirm-cancel" onClick={() => setEditingId(null)} disabled={busy}>Cancel</button>
                    <button className="confirm-ok" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
                  </div>
                </div>
              ) : (
                <div className="cm-assign-row" key={ch.id}>
                  <div className="cm-assign-meta">
                    <span className="cm-assign-name">{ch.order}. {ch.title}</span>
                    <span className="cm-assign-sub">
                      {ch.content_html ? "Has content" : "No content yet"}
                    </span>
                  </div>
                  <div className="cm-assign-controls">
                    <button className="cm-icon-btn" disabled={busy || idx === 0} onClick={() => move(idx, -1)} aria-label="Move up">↑</button>
                    <button className="cm-icon-btn" disabled={busy || idx === sortedChapters.length - 1} onClick={() => move(idx, 1)} aria-label="Move down">↓</button>
                    <button className="cm-icon-btn" disabled={busy} onClick={() => startEdit(ch)}>Edit</button>
                    <button className="cm-icon-btn cm-icon-btn--danger" disabled={busy} onClick={() => setConfirmDel(ch)}>Delete</button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {editingId === "new" ? (
          <div className="cm-chapter-edit">
            <label className="cm-field">
              <span>Title</span>
              <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} autoFocus />
            </label>
            <label className="cm-field">
              <span>Order</span>
              <input type="number" min="0" value={draft.order}
                onChange={(e) => setDraft((d) => ({ ...d, order: e.target.value }))}
                placeholder="Auto (added to end)" />
            </label>
            <label className="cm-field">
              <span>Content</span>
              <textarea rows={5} value={draft.content_html}
                onChange={(e) => setDraft((d) => ({ ...d, content_html: e.target.value }))}
                placeholder="Chapter notes as HTML — sanitized on save." />
            </label>
            {err && <div className="cm-form-error">{err}</div>}
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setEditingId(null)} disabled={busy}>Cancel</button>
              <button className="confirm-ok" onClick={save} disabled={busy}>{busy ? "Saving…" : "Add"}</button>
            </div>
          </div>
        ) : (
          <button className="cm-add-btn" onClick={startNew}>+ Add Chapter</button>
        )}

        <div className="confirm-actions">
          <button className="confirm-ok" onClick={onClose}>Done</button>
        </div>
      </div>

      {/* Wrapped in a stopPropagation layer on purpose: ConfirmModal's own
          backdrop calls onCancel but doesn't stop the click, so without this
          dismissing the confirm would bubble to the overlay above and close
          the whole chapter editor with it. */}
      {confirmDel && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmModal
            title="Delete chapter"
            message={`Delete "${confirmDel.title}"? Its content is removed with it. This can't be undone.`}
            extra={err ? <div className="cm-form-error">{err}</div> : null}
            onConfirm={() => remove(confirmDel)}
            onCancel={() => setConfirmDel(null)}
          />
        </div>
      )}
    </div>
  );
}

/* ───────────────────── Batch progress modal (read-only) ───────────────────── */
function ProgressBar({ percent }) {
  return (
    <div className="cm-progress" aria-label={`${percent}% covered`}>
      <div className="cm-progress__fill" style={{ width: `${Math.min(100, percent || 0)}%` }} />
    </div>
  );
}

function BatchProgressModal({ batch, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const d = await getBatchProgress(batch.id);
      if (!cancel) { setData(d); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [batch.id]);

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="cm-form-card cm-form-card--wide" onClick={(e) => e.stopPropagation()}>
        <h3>Progress · {batch.name} <span className="cm-code">{batch.code}</span></h3>

        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : !data ? (
          <p className="cm-empty-note">Couldn’t load progress for this batch.</p>
        ) : (
          <>
            <div className="cm-progress-overall">
              <div className="cm-progress-overall-top">
                <span>{data.chapters_done} / {data.chapters_total} chapters covered</span>
                <strong>{data.percent}%</strong>
              </div>
              <ProgressBar percent={data.percent} />
            </div>

            {(data.subjects || []).length === 0 ? (
              <p className="cm-empty-note">This course has no chapters yet.</p>
            ) : (
              <div className="cm-prog-subjects">
                {data.subjects.map((s) => (
                  <div className="cm-prog-subject" key={s.id}>
                    <div className="cm-prog-subject-head">
                      <span className="cm-prog-subject-name">{s.name}</span>
                      <span className="cm-prog-subject-count">
                        {s.chapters_done}/{s.chapters_total} · {s.percent}%
                      </span>
                    </div>
                    <ProgressBar percent={s.percent} />
                    <ul className="cm-chapter-list">
                      {s.chapters.map((c) => (
                        <li key={c.id} className={`cm-chapter${c.is_covered ? " done" : ""}`}>
                          <span className="cm-chapter-tick" aria-hidden>{c.is_covered ? "✓" : "○"}</span>
                          <span className="cm-chapter-title">{c.title}</span>
                          {c.note ? <span className="cm-chapter-note">“{c.note}”</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <p className="cm-hint">Teachers mark coverage from the teacher app. This view is read-only.</p>
          </>
        )}

        <div className="confirm-actions">
          <button className="confirm-ok" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Batch roster modal ─────────────────────
   Membership manager, not just a list: an admin looking at "who is in A13"
   almost always wants to move someone out of it, so each row can be
   reassigned to a sibling batch of the same course (or detached to
   course-wide) right here. */
function BatchRosterModal({ batch, siblingBatches = [], onClose, onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    const d = await getBatchRoster(batch.id, { status: "ACTIVE" });
    setRows(d?.results || []);
    setLoading(false);
  }, [batch.id]);

  useEffect(() => { load(); }, [load]);

  const move = async (row, targetId) => {
    if (!targetId) return; // "Keep here" — the placeholder option, not an action
    setErr("");
    setBusyId(row.id);
    try {
      // "__none__" is the sentinel for detach; "" is the no-op placeholder, so
      // they can't share a value.
      await moveEnrollmentBatch(row.id, targetId === "__none__" ? null : targetId);
      await load();
      onChanged?.();
    } catch (e) {
      const d = e?.response?.data;
      setErr(
        Array.isArray(d) ? String(d[0])
          : d?.batch ? String(Array.isArray(d.batch) ? d.batch[0] : d.batch)
          : d?.detail || "Could not move that student."
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="cm-form-card cm-form-card--wide" onClick={(e) => e.stopPropagation()}>
        <h3>Roster · {batch.name} <span className="cm-code">{batch.code}</span></h3>

        {err && <p className="cm-empty-note" style={{ color: "#b3261e" }}>{err}</p>}

        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : rows.length === 0 ? (
          <p className="cm-empty-note">No active students in this batch yet.</p>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>Student</th><th>Email</th><th>Enrolled</th><th>Move to</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="courses-title">
                    {r.learner_profile_id ? (
                      <button
                        type="button"
                        className="cm-linkish"
                        onClick={() => navigate(`/students/${r.learner_profile_id}`)}
                      >
                        {r.user_name || "—"}
                      </button>
                    ) : (r.user_name || "—")}
                  </td>
                  <td>{r.user_email}</td>
                  <td>{formatDate(r.enrolled_at)}</td>
                  <td>
                    <select
                      value=""
                      disabled={busyId === r.id}
                      onChange={(e) => move(r, e.target.value)}
                    >
                      <option value="">
                        {busyId === r.id ? "Moving…" : "Keep here"}
                      </option>
                      <option value="__none__">Course-wide (no batch)</option>
                      {siblingBatches
                        .filter((b) => b.id !== batch.id)
                        .map((b) => (
                          <option key={b.id} value={b.id} disabled={b.is_full}>
                            {b.name} ({b.code}){b.is_full ? " — full" : ""}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="confirm-actions">
          <button className="confirm-ok" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Page ───────────────────────────── */
const Courses = () => {
  // The tab lives in the URL, not just component state, for two reasons:
  // refreshing or deep-linking used to silently drop you back on Academy, and
  // AdminLayout's "New course" button needs to know which tab you are on. That
  // button is Academy-only (its wizard writes an Academy course and offers
  // board-linked / competitive options), but it was gated on pathname alone,
  // so it stayed visible over the read-only Skill Dev tab and looked like a
  // Skill Dev course-creation flow that asked for a board.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "skill" ? "skill" : "academy";
  const setTab = (next) => {
    const sp = new URLSearchParams(searchParams);
    if (next === "academy") sp.delete("tab");
    else sp.set("tab", next);
    setSearchParams(sp, { replace: true });
  };

  // Academy drill-down: boards → courses (per board) → subjects|batches (per course)
  // "all-courses" is a sibling entry point (flat, cross-board list) that
  // feeds into the SAME subjects|batches levels — it never replaces the
  // boards→courses drill-down, only skips straight past it.
  const [nav, setNav] = useState({ level: "boards", board: null, course: null });
  const [boards, setBoards] = useState([]);
  const [courses, setCourses] = useState([]);
  // `safe()` tags a failed request's empty fallback with a non-enumerable
  // `__failed` flag precisely so a screen can tell "the request broke" apart
  // from "there is genuinely nothing here". This page rendered both as
  // "No courses match this search/filter.", so an outage looked like an empty
  // catalog.
  const [loadFailed, setLoadFailed] = useState(false);
  const [allCourses, setAllCourses] = useState([]);
  const [allCoursesSearch, setAllCoursesSearch] = useState("");
  const [allCoursesBoardFilter, setAllCoursesBoardFilter] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [batches, setBatches] = useState([]);
  const [teachersBySubject, setTeachersBySubject] = useState({});
  const [unstaffedCount, setUnstaffedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Skill Dev (read-only overview, unchanged)
  const [categories, setCategories] = useState([]);
  const [experts, setExperts] = useState([]);
  const [applications, setApplications] = useState([]);

  const [modal, setModal] = useState(null);       // { type, mode, initial }
  const [confirm, setConfirm] = useState(null);    // { kind, item, message, error? }
  const [teacherModal, setTeacherModal] = useState(null);   // subject
  const [bulkAssignModal, setBulkAssignModal] = useState(false);
  const [chapterModal, setChapterModal] = useState(null);   // subject
  const [progressModal, setProgressModal] = useState(null); // batch
  const [rosterModal, setRosterModal] = useState(null);     // batch
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const loadBoards = useCallback(async () => {
    setLoading(true);
    const b = await getBoards();
    setBoards(Array.isArray(b) ? b : []);
    setLoading(false);
  }, []);
  const loadCourses = useCallback(async (boardId) => {
    setLoading(true);
    const c = await getBoardCourses(boardId);
    setLoadFailed(!!c?.__failed);
    setCourses(Array.isArray(c) ? c : []);
    setLoading(false);
  }, []);
  // Reorder within a board. Assigns each course the position it is moving TO
  // (index * STEP) rather than swapping the two display_order values, because
  // every course starts at 0 on an un-numbered install and swapping two zeros
  // is a silent no-op — the same trap the chapter reorder above documents.
  //
  // STEP matches courses/management/commands/number_course_display_order.py, so
  // arrow-clicks and the type-a-number path stay on the same scale.
  //
  // Offered only in the board-scoped list: "All Courses" spans boards, where a
  // single position has no meaning.
  const ORDER_STEP = 10;
  const moveCourse = async (idx, direction) => {
    const otherIdx = idx + direction;
    if (otherIdx < 0 || otherIdx >= courses.length) return;
    const a = courses[idx];
    const b = courses[otherIdx];
    setLoading(true);
    try {
      await updateCourse(a.id, { display_order: (otherIdx + 1) * ORDER_STEP });
      try {
        await updateCourse(b.id, { display_order: (idx + 1) * ORDER_STEP });
      } catch (inner) {
        // Don't leave one half applied with nothing on screen to explain it.
        await updateCourse(a.id, { display_order: a.display_order ?? 0 });
        throw inner;
      }
      await loadCourses(nav.board?.id);
    } catch (e) {
      setLoading(false);
      alert(errText(e));
    }
  };
  const loadAllCourses = useCallback(async (params = {}) => {
    setLoading(true);
    const c = await getAllCourses(params);
    setLoadFailed(!!c?.__failed);
    setAllCourses(Array.isArray(c) ? c : []);
    setLoading(false);
  }, []);
  // Single whole-course staffing-grid call — replaces the previous N+1
  // (one getSubjectTeachers request per subject) that also re-ran on every
  // assignment change. Populates the SAME { [subjectId]: teachers[] } shape
  // the Subjects table's Teachers-column chips already consume, so that
  // rendering path is untouched.
  const loadStaffing = useCallback(async (courseId) => {
    const data = await getCourseStaffing(courseId);
    const map = {};
    (data?.subjects || []).forEach((s) => {
      map[s.id] = Array.isArray(s.teachers) ? s.teachers : [];
    });
    setTeachersBySubject(map);
    setUnstaffedCount(data?.unstaffed_count ?? 0);
  }, []);
  const loadSubjects = useCallback(async (courseId) => {
    setLoading(true);
    const s = await getCourseSubjects(courseId);
    const list = Array.isArray(s) ? s : [];
    setSubjects(list);
    setLoading(false);
    loadStaffing(courseId);
  }, [loadStaffing]);
  const loadBatches = useCallback(async (courseId) => {
    setLoading(true);
    const b = await getCourseBatches(courseId);
    setBatches(Array.isArray(b) ? b : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadBoards(); }, [loadBoards]);

  // Server-side search/filter for the All Courses tab, debounced same as
  // the teacher-picker search elsewhere in this file. Only fires while
  // that tab is actually the active level.
  useEffect(() => {
    if (nav.level !== "all-courses") return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      loadAllCourses({
        ...(allCoursesSearch ? { search: allCoursesSearch } : {}),
        ...(allCoursesBoardFilter ? { board: allCoursesBoardFilter } : {}),
      });
    }, allCoursesSearch ? 300 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [nav.level, allCoursesSearch, allCoursesBoardFilter, loadAllCourses]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSkillCategories(), getSkillExperts(), getSkillApplications()])
      .then(([cats, exp, apps]) => {
        if (cancelled) return;
        setCategories(Array.isArray(cats) ? cats : cats.results || []);
        setExperts(Array.isArray(exp) ? exp : exp.results || []);
        setApplications(Array.isArray(apps) ? apps : apps.results || []);
      });
    return () => { cancelled = true; };
  }, []);

  // navigation
  const openBoard = (board) => { setNav({ level: "courses", board, course: null }); loadCourses(board.id); };
  const openCourse = (course) => { setNav((n) => ({ ...n, level: "subjects", course })); loadSubjects(course.id); };
  const openBatches = (course) => { setNav((n) => ({ ...n, level: "batches", course })); loadBatches(course.id); };
  const goBoards = () => { setNav({ level: "boards", board: null, course: null }); loadBoards(); };
  const goCourses = () => { setNav((n) => ({ ...n, level: "courses", course: null })); if (nav.board) loadCourses(nav.board.id); };
  const goSubjects = () => { if (!nav.course) return; setNav((n) => ({ ...n, level: "subjects" })); loadSubjects(nav.course.id); };
  const goBatches = () => { if (!nav.course) return; setNav((n) => ({ ...n, level: "batches" })); loadBatches(nav.course.id); };

  // "All Courses" — flat cross-board list, a sibling entry point to Boards.
  const goAllCourses = () => {
    setNav({ level: "all-courses", board: null, course: null });
    setAllCoursesSearch(""); setAllCoursesBoardFilter("");
    loadAllCourses();
  };
  // Opening a course from the flat list still lands on the exact same
  // Subjects/Batches views as the Boards drill-down — but nav.board has to
  // be populated with the course's real board (row carries board_id/
  // board_name from the new admin/courses/ GET) so the breadcrumb's board
  // crumb and "back up to this board's course list" (goCourses) keep
  // working exactly as if the admin had drilled down via Boards.
  const openCourseFromAllCourses = (course, level = "subjects") => {
    // A board-less course (every competitive course is one) must leave
    // nav.board NULL, not {id: undefined}. The latter is truthy, so
    // goCourses' `if (nav.board)` guard passed and it called
    // loadCourses(undefined) → 404 → swallowed to [] → "No courses in this
    // board yet."
    const board = course.board_id ? { id: course.board_id, name: course.board_name } : null;
    setNav({ level, board, course });
    if (level === "batches") loadBatches(course.id); else loadSubjects(course.id);
  };

  // Refresh whichever course list the admin is actually looking at. The
  // save handler used to hardcode loadCourses(nav.board.id), which threw a
  // TypeError at the all-courses level — AFTER setModal(null) had already
  // run, so the error landed in `formError` inside the now-unmounted modal.
  // The save had succeeded server-side, but the row still showed the old
  // status and nothing was reported: "publish didn't work".
  const refreshCourseList = async () => {
    if (nav.level === "all-courses") await loadAllCourses();
    else if (nav.board?.id) await loadCourses(nav.board.id);
  };

  const openCreate = (type, initial = {}) => { setFormError(""); setModal({ type, mode: "create", initial }); };
  const openEdit = (type, initial) => { setFormError(""); setModal({ type, mode: "edit", initial }); };

  const openEditCourse = async (c) => {
    setFormError("");
    // The board-scoped course list doesn't carry `details`/thumbnail at full
    // fidelity, so fetch the single-course admin shape before opening the form.
    const full = await getCourse(c.id).catch(() => null);
    const details = full?.details || {};
    openEdit("course", {
      id: c.id,
      title: full?.title ?? c.title,
      description: full?.description ?? c.description,
      price_rupees: ((full?.price ?? c.price) || 0) / 100,
      subscription_duration_days: full?.subscription_duration_days ?? c.subscription_duration_days ?? 30,
      status: full?.status ?? c.status ?? "DRAFT",
      kind: full?.kind ?? c.kind ?? "ACADEMIC",
      class_level: full?.class_level ?? c.class_level ?? "",
      thumbnail: full?.thumbnail ?? c.thumbnail ?? null,
      mrp_rupees: full?.mrp != null ? full.mrp / 100 : "",
      discount_label: full?.discount_label || "",
      badge: full?.badge || "",
      is_featured: full?.is_featured ?? false,
      display_order: full?.display_order ?? 0,
      seo_title: full?.seo_title || "",
      seo_description: full?.seo_description || "",
      promo_video_url: full?.promo_video_url || "",
      categories: (full?.categories || []).map((cat) => cat.id),
      level: details.level || "",
      duration_weeks: details.duration_weeks ?? "",
      language: details.language || "English",
      requirements: details.requirements || "",
      syllabus: details.syllabus || "",
      highlights: details.highlights || "",
      includes: details.includes || "",
    });
  };

  const handleSubmit = async (form, file) => {
    setBusy(true); setFormError("");
    try {
      if (modal.type === "board") {
        const payload = {
          name: (form.name || "").trim(),
          board_type: form.board_type || "CENTRAL",
          description: form.description || "",
          is_active: form.is_active ?? true,
        };
        const { data, isMultipart } = buildBody(payload, file, "logo");
        if (modal.mode === "edit") await updateBoard(modal.initial.id, data, isMultipart);
        else await createBoard(data, isMultipart);
        setModal(null);
        await loadBoards();
      } else if (modal.type === "course") {
        const basePayload = {
          title: (form.title || "").trim(),
          description: form.description || "",
          price: Math.max(0, Math.round((parseFloat(form.price_rupees) || 0) * 100)),
          mrp: form.mrp_rupees === "" || form.mrp_rupees == null
            ? null
            : Math.max(0, Math.round((parseFloat(form.mrp_rupees) || 0) * 100)),
          discount_label: form.discount_label || "",
          badge: form.badge || "",
          is_featured: form.is_featured ?? false,
          display_order: form.display_order === "" || form.display_order == null ? 0 : parseInt(form.display_order, 10) || 0,
          seo_title: form.seo_title || "",
          seo_description: form.seo_description || "",
          promo_video_url: form.promo_video_url || "",
          subscription_duration_days: Math.max(1, parseInt(form.subscription_duration_days, 10) || 30),
          status: form.status || "DRAFT",
          // Both are writable CourseSerializer fields that this form never
          // sent, so every course it created defaulted to ACADEMIC/no class.
          // A coaching course spans no single class — the model documents
          // class_level as NULL for exactly these — so force it null rather
          // than persisting whatever the picker last held before it disabled.
          kind: form.kind === "COACHING" ? "COACHING" : "ACADEMIC",
          class_level:
            form.kind === "COACHING" || form.class_level === "" || form.class_level == null
              ? null
              : parseInt(form.class_level, 10) || null,
        };
        // `details` (nested CourseDetail row) and `categories` (M2M ids) are
        // not writable CourseSerializer fields — the backend reads them off
        // request.data directly (AdminCourseDetailView.patch), JSON-encoded
        // under multipart. buildBody's generic array/object → JSON.stringify
        // handling covers both automatically.
        const detailsPayload = {
          level: form.level || "",
          duration_weeks: form.duration_weeks === "" || form.duration_weeks == null ? 0 : parseInt(form.duration_weeks, 10) || 0,
          syllabus: form.syllabus || "",
          language: form.language || "English",
          requirements: form.requirements || "",
          // Anything added here (and NOT here) is what actually gets saved —
          // fields missing from this object are silently wiped on save.
          highlights: form.highlights || "",
          includes: form.includes || "",
        };
        const categoriesPayload = (form.categories || []).map((id) => Number(id));
        const fields = {
          ...basePayload,
          details: detailsPayload,
          categories: categoriesPayload,
          // `nav.board?.id`, not `nav.board.id`. At the all-courses level
          // nav.board is null, so the bare deref threw a TypeError — and
          // because it fired before the request, creating a board-less
          // (competitive) course from that view was impossible.
          ...(modal.mode !== "edit" && nav.board?.id ? { board_id: nav.board.id } : {}),
        };
        const { data, isMultipart } = buildBody(fields, file, "thumbnail");
        if (modal.mode === "edit") await updateCourse(modal.initial.id, data, isMultipart);
        else await createCourse(data, isMultipart);
        setModal(null);
        await refreshCourseList();
      } else if (modal.type === "subject") {
        // Always multipart, even without a new file (matches the previous
        // inline FormData build — createSubject/updateSubject expect
        // multipart regardless).
        // `form.order || undefined` dropped 0 and any cleared value, because
        // both are falsy — so typing 0, or emptying the field to re-sequence,
        // sent no `order` at all and the save looked like it did nothing.
        // Blank still means "let the server append"; 0 is a real position.
        const orderRaw = form.order;
        const orderNum =
          orderRaw === "" || orderRaw === null || orderRaw === undefined
            ? undefined
            : Number.isNaN(parseInt(orderRaw, 10)) ? undefined : parseInt(orderRaw, 10);
        const { data } = buildBody(
          { name: (form.name || "").trim(), order: orderNum, textbook: form.textbook || "" },
          file, "image", true,
        );
        if (modal.mode === "edit") await updateSubject(modal.initial.id, data);
        else await createSubject(nav.course.id, data);
        setModal(null);
        await loadSubjects(nav.course.id);
      } else if (modal.type === "batch") {
        const toIntOrNull = (v) => (v === "" || v === null || v === undefined ? null : parseInt(v, 10));
        const toPaiseOrNull = (v) =>
          v === "" || v === null || v === undefined ? null : Math.max(0, Math.round((parseFloat(v) || 0) * 100));
        const payload = {
          name: (form.name || "").trim(),
          code: (form.code || "").trim(),
          year: toIntOrNull(form.year),
          capacity: toIntOrNull(form.capacity),
          price_override: toPaiseOrNull(form.price_override),
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          is_active: form.is_active ?? true,
        };
        if (modal.mode === "edit") await updateBatch(modal.initial.id, payload);
        else await createBatch(nav.course.id, payload);
        setModal(null);
        await loadBatches(nav.course.id);
      }
    } catch (e) {
      setFormError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    const { kind, item } = confirm;
    setBusy(true);
    try {
      if (kind === "board") { await deleteBoard(item.id); setConfirm(null); await loadBoards(); }
      else if (kind === "course") { await deleteCourse(item.id); setConfirm(null); await loadCourses(nav.board.id); }
      else if (kind === "subject") { await deleteSubject(item.id); setConfirm(null); await loadSubjects(nav.course.id); }
      else if (kind === "batch") { await deleteBatch(item.id); setConfirm(null); await loadBatches(nav.course.id); }
    } catch (e) {
      setConfirm((c) => ({ ...c, error: errText(e) }));
    } finally {
      setBusy(false);
    }
  };

  /* Segmented Subjects | Batches switcher, shown inside a course. */
  const renderCourseSubnav = () => (
    <div className="cm-subnav">
      <button className={`cm-subnav-tab${nav.level === "subjects" ? " active" : ""}`} onClick={goSubjects}>
        Subjects
      </button>
      <button className={`cm-subnav-tab${nav.level === "batches" ? " active" : ""}`} onClick={goBatches}>
        Batches
      </button>
    </div>
  );

  /* ── renderers ── */
  const renderBoards = () => (
    <div className="dashboard-card courses-table-card">
      <div className="cm-card-head">
        <div className="courses-count">{boards.length} board{boards.length !== 1 ? "s" : ""}</div>
        <button className="cm-add-btn" onClick={() => openCreate("board", { board_type: "CENTRAL", is_active: true })}>
          + New Board
        </button>
      </div>
      {loading ? (
        <div className="dashboard-loading">Loading…</div>
      ) : boards.length === 0 ? (
        <div className="dashboard-loading">No boards yet. Create one to start adding courses.</div>
      ) : (
        <table className="courses-table">
          <thead>
            <tr><th>Board</th><th>Type</th><th>Courses</th><th>Status</th><th aria-label="actions" /></tr>
          </thead>
          <tbody>
            {boards.map((b) => (
              <tr key={b.id}>
                <td className="courses-title">
                  <button className="cm-link" onClick={() => openBoard(b)}>{b.name}</button>
                </td>
                <td>{BOARD_TYPE_LABELS[b.board_type] || b.board_type}</td>
                <td>{b.course_count ?? 0}</td>
                <td>
                  <StatusBadge color={b.is_active ? "green" : "gray"}>
                    {b.is_active ? "Active" : "Hidden"}
                  </StatusBadge>
                </td>
                <td className="cm-actions">
                  <button className="cm-icon-btn" onClick={() => openBoard(b)}>Open</button>
                  <button className="cm-icon-btn" onClick={() => openEdit("board", {
                    id: b.id, name: b.name, board_type: b.board_type,
                    description: b.description, is_active: b.is_active, logo: b.logo,
                  })}>Edit</button>
                  <button className="cm-icon-btn cm-icon-btn--danger"
                    onClick={() => setConfirm({ kind: "board", item: b, message: `Delete board "${b.name}"? A board with courses can't be deleted — remove its courses first.` })}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderCourses = () => (
    <div className="dashboard-card courses-table-card">
      <div className="cm-card-head">
        <div className="courses-count">
          {loading
            ? "Loading courses…"
            : `${courses.length} course${courses.length !== 1 ? "s" : ""} in ${nav.board?.name ?? ""}`}
        </div>
        <button className="cm-add-btn" onClick={() => openCreate("course", { price_rupees: 0, subscription_duration_days: 30 })}>
          + New Course
        </button>
      </div>
      {/* Says out loud what the # column and the arrows actually do. Editors
          had no way to know the number was visitor-facing. */}
      {!loading && !loadFailed && courses.length > 1 && (
        <div className="cm-hint" style={{ padding: "10px 20px", borderBottom: "1px solid #f0f0f0" }}>
          Use ↑ ↓ to reorder. The order here is the order visitors see.
        </div>
      )}
      {loading ? (
        <div className="dashboard-loading">Loading…</div>
      ) : loadFailed ? (
        <div className="cm-form-error" style={{ margin: 20 }}>
          Couldn’t load this board’s courses — the request failed. This board is
          not necessarily empty.{" "}
          <button className="cm-linkish" onClick={() => loadCourses(nav.board?.id)}>
            Retry
          </button>
        </div>
      ) : courses.length === 0 ? (
        <div className="dashboard-loading">No courses in this board yet. Create the first one.</div>
      ) : (
        <table className="courses-table">
          <thead>
            <tr>
              {/* Display order was editable in the course modal but shown
                  nowhere, so there was no way to see the current sequence you
                  were editing against. Same `#` idiom as the subjects table. */}
              <th title="The order here is the order visitors see.">#</th>
              <th>Course</th><th>Status</th><th>Content complete</th><th>Shows up on</th>
              <th>Fee</th><th>Access</th><th>Subjects</th><th>Enrolled</th><th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {courses.map((c, idx) => {
              const { pct, missing } = completeness(c);
              const incomplete = pct < 100;
              const publishedIncomplete = c.status === "PUBLISHED" && incomplete;
              return (
                <tr key={c.id}>
                  <td>{c.display_order ?? 0}</td>
                  <td className="courses-title">
                    <button className="cm-link" onClick={() => openCourse(c)}>{c.title}</button>
                  </td>
                  <td>
                    <StatusBadge
                      color={
                        c.status === "PUBLISHED" ? "green"
                        : c.status === "ARCHIVED" ? "gray"
                        : c.status === "COMING_SOON" ? "orange"
                        : "yellow"
                      }
                    >
                      {c.status === "PUBLISHED" ? "Published"
                        : c.status === "ARCHIVED" ? "Archived"
                        : c.status === "COMING_SOON" ? "Coming Soon"
                        : "Draft"}
                    </StatusBadge>
                    {publishedIncomplete && (
                      <div className="cm-warning" style={{ marginTop: 4 }}>⚠ published incomplete</div>
                    )}
                  </td>
                  <td>
                    <ProgressBar percent={pct} />
                    {missing.length > 0 && (
                      <div className="cm-muted" style={{ marginTop: 4 }}>Missing: {missing.join(", ")}</div>
                    )}
                  </td>
                  <td>
                    {placementsFor(c, nav.board).map((label) => (
                      <span key={label} className="courses-chip" style={{ marginRight: 4, marginBottom: 4, display: "inline-block" }}>
                        {label}
                      </span>
                    ))}
                  </td>
                  <td>{rupees(c.price)}</td>
                  <td>{c.subscription_duration_days ? `${c.subscription_duration_days}d` : "—"}</td>
                  <td>{c.subject_count ?? 0}</td>
                  <td>{c.enrollment_count ?? 0}</td>
                  <td className="cm-actions">
                    {/* Same arrow idiom as the chapter and homepage-section
                        reorder controls already on this screen. */}
                    <button className="cm-icon-btn" disabled={loading || idx === 0}
                            onClick={() => moveCourse(idx, -1)} aria-label="Move up">↑</button>
                    <button className="cm-icon-btn" disabled={loading || idx === courses.length - 1}
                            onClick={() => moveCourse(idx, 1)} aria-label="Move down">↓</button>
                    <button className="cm-icon-btn" onClick={() => openCourse(c)}>Subjects</button>
                    <button className="cm-icon-btn" onClick={() => openBatches(c)}>Batches</button>
                    <button className="cm-icon-btn" onClick={() => openEditCourse(c)}>Edit</button>
                    <button className="cm-icon-btn cm-icon-btn--danger"
                      onClick={() => setConfirm({ kind: "course", item: c, message: `Delete course "${c.title}"? Its subjects and content links are removed too. This can't be undone.` })}>
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  /* Flat, searchable list of every course across every board — an ADDITION
     alongside the Boards drill-down (renderBoards/renderCourses above),
     not a replacement. Same visual pattern (dashboard-card courses-table-card
     / cm-card-head / courses-table / StatusBadge / cm-icon-btn) as the
     rest of this page. */
  const renderAllCourses = () => (
    <div className="dashboard-card courses-table-card">
      <div className="cm-card-head">
        <div className="courses-count">
          {/* Not rendered while loading: showing "0 courses across all boards"
              next to a spinner reads as a definitive empty result that has
              already come back. */}
          {loading
            ? "Loading courses…"
            : `${allCourses.length} course${allCourses.length !== 1 ? "s" : ""} across all boards`}
        </div>
      </div>
      <div className="cm-row" style={{ padding: "12px 20px", borderBottom: "1px solid #f0f0f0" }}>
        <input
          className="cm-search"
          style={{ marginBottom: 0, maxWidth: 340 }}
          value={allCoursesSearch}
          onChange={(e) => setAllCoursesSearch(e.target.value)}
          placeholder="Search courses by title"
        />
        <select
          className="cm-search"
          style={{ marginBottom: 0, maxWidth: 240 }}
          value={allCoursesBoardFilter}
          onChange={(e) => setAllCoursesBoardFilter(e.target.value)}
        >
          <option value="">All boards</option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <div className="dashboard-loading">Loading…</div>
      ) : loadFailed ? (
        <div className="cm-form-error" style={{ margin: 20 }}>
          Couldn’t load courses — the request failed. This is not an empty
          catalog.{" "}
          <button className="cm-linkish" onClick={() => loadAllCourses()}>
            Retry
          </button>
        </div>
      ) : allCourses.length === 0 ? (
        <div className="dashboard-loading">No courses match this search/filter.</div>
      ) : (
        <table className="courses-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Course</th><th>Board</th><th>Status</th><th>Content complete</th>
              <th>Fee</th><th>Access</th><th>Subjects</th><th>Enrolled</th><th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {allCourses.map((c) => {
              const { pct, missing } = completeness(c);
              const publishedIncomplete = c.status === "PUBLISHED" && pct < 100;
              return (
                <tr key={c.id}>
                  <td>{c.display_order ?? 0}</td>
                  <td className="courses-title">
                    <button className="cm-link" onClick={() => openCourseFromAllCourses(c)}>{c.title}</button>
                  </td>
                  <td>{c.board_name || "—"}</td>
                  <td>
                    <StatusBadge
                      color={
                        c.status === "PUBLISHED" ? "green"
                        : c.status === "ARCHIVED" ? "gray"
                        : c.status === "COMING_SOON" ? "orange"
                        : "yellow"
                      }
                    >
                      {c.status === "PUBLISHED" ? "Published"
                        : c.status === "ARCHIVED" ? "Archived"
                        : c.status === "COMING_SOON" ? "Coming Soon"
                        : "Draft"}
                    </StatusBadge>
                    {publishedIncomplete && (
                      <div className="cm-warning" style={{ marginTop: 4 }}>⚠ published incomplete</div>
                    )}
                  </td>
                  <td>
                    <ProgressBar percent={pct} />
                    {missing.length > 0 && (
                      <div className="cm-muted" style={{ marginTop: 4 }}>Missing: {missing.join(", ")}</div>
                    )}
                  </td>
                  <td>{rupees(c.price)}</td>
                  <td>{c.subscription_duration_days ? `${c.subscription_duration_days}d` : "—"}</td>
                  <td>{c.subject_count ?? 0}</td>
                  <td>{c.enrollment_count ?? 0}</td>
                  <td className="cm-actions">
                    <button className="cm-icon-btn" onClick={() => openCourseFromAllCourses(c)}>Subjects</button>
                    <button className="cm-icon-btn" onClick={() => openCourseFromAllCourses(c, "batches")}>Batches</button>
                    {/* Edit — and therefore the Status dropdown, which is the
                        ONLY publish control in this app — used to exist only
                        in the board drill-down. Competitive courses have
                        board = NULL (see create_competitive_courses.py), so
                        they appear in no board's list and were unreachable
                        from that Edit button: an admin could see one sitting
                        at "Coming Soon" and had no way to publish it. This
                        flat list is the only place they're reachable. */}
                    <button className="cm-icon-btn" onClick={() => openEditCourse(c)}>Edit</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderSubjects = () => (
    <>
      {renderCourseSubnav()}
      <div className="dashboard-card courses-table-card">
        <div className="cm-card-head">
          <div className="courses-count">
            {subjects.length} subject{subjects.length !== 1 ? "s" : ""} in {nav.course?.title}
            {unstaffedCount > 0 && (
              <span className="cm-muted" style={{ marginLeft: 8 }}>
                · {unstaffedCount} subject{unstaffedCount !== 1 ? "s" : ""} have no teacher
              </span>
            )}
          </div>
          <div className="cm-actions">
            <button
              className="cm-icon-btn"
              disabled={subjects.length === 0}
              onClick={() => setBulkAssignModal(true)}
            >
              Bulk assign teacher
            </button>
            <button className="cm-add-btn" onClick={() => openCreate("subject", {})}>
              + Add Subject
            </button>
          </div>
        </div>
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : subjects.length === 0 ? (
          <div className="dashboard-loading">No subjects yet. Add the first one to this course.</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>#</th><th>Subject</th><th>Teachers</th><th>Image</th><th aria-label="actions" /></tr>
            </thead>
            <tbody>
              {subjects.map((s) => {
                const ts = teachersBySubject[s.id] || [];
                return (
                  <tr key={s.id}>
                    <td>{s.order}</td>
                    <td className="courses-title">{s.name}</td>
                    <td>
                      {ts.length === 0 ? (
                        <span className="cm-muted">Unassigned</span>
                      ) : (
                        <span className="cm-teacher-chips">
                          {ts.map((t) => (
                            <span key={t.assignment_id} className="cm-teacher-chip" title={roleLabel(t.display_role)}>
                              {t.photo ? (
                                <img src={t.photo} alt="" className="cm-chip-avatar" />
                              ) : (
                                <span className="cm-chip-avatar cm-chip-avatar--fallback">
                                  {(t.name || "?").trim().charAt(0).toUpperCase()}
                                </span>
                              )}
                              {t.name}
                              {t.display_role === "ASSISTANT" && <em className="cm-chip-role">asst</em>}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td>{s.image ? <img src={s.image} alt="" className="cm-thumb" /> : "—"}</td>
                    <td className="cm-actions">
                      <button className="cm-icon-btn" onClick={() => setChapterModal(s)}>
                        Chapters{s.chapters?.length ? ` (${s.chapters.length})` : ""}
                      </button>
                      <button className="cm-icon-btn" onClick={() => setTeacherModal(s)}>Teachers</button>
                      <button className="cm-icon-btn" onClick={() => openEdit("subject", {
                        id: s.id, name: s.name, order: s.order, textbook: s.textbook, image: s.image,
                      })}>Edit</button>
                      <button className="cm-icon-btn cm-icon-btn--danger"
                        onClick={() => setConfirm({ kind: "subject", item: s, message: `Delete subject "${s.name}"?` })}>
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );

  const renderBatches = () => (
    <>
      {renderCourseSubnav()}
      <div className="dashboard-card courses-table-card">
        <div className="cm-card-head">
          <div className="courses-count">
            {batches.length} batch{batches.length !== 1 ? "es" : ""} in {nav.course?.title}
          </div>
          <button className="cm-add-btn" onClick={() => openCreate("batch", { is_active: true })}>
            + New Batch
          </button>
        </div>
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : batches.length === 0 ? (
          <div className="dashboard-loading">No batches yet. Create one, then place students in it when approving enrollments.</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>Batch</th><th>Code</th><th>Year</th><th>Price</th><th>Seats</th><th>Status</th><th aria-label="actions" /></tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td className="courses-title">{b.name}</td>
                  <td><span className="cm-code">{b.code}</span></td>
                  <td>{b.year || "—"}</td>
                  <td>
                    {rupees(b.effective_price)}
                    {b.price_override != null && <small className="cm-file-name"> (override)</small>}
                  </td>
                  <td>
                    <span className={b.is_full ? "cm-seats cm-seats--full" : "cm-seats"}>
                      {b.seats_taken}
                      {b.capacity != null ? ` / ${b.capacity}` : " / ∞"}
                    </span>
                  </td>
                  <td>
                    <StatusBadge color={b.is_active ? "green" : "gray"}>
                      {b.is_active ? "Active" : "Closed"}
                    </StatusBadge>
                  </td>
                  <td className="cm-actions">
                    <button className="cm-icon-btn" onClick={() => setProgressModal(b)}>Progress</button>
                    <button className="cm-icon-btn" onClick={() => setRosterModal(b)}>Roster</button>
                    <button className="cm-icon-btn" onClick={() => openEdit("batch", {
                      id: b.id, name: b.name, code: b.code, year: b.year ?? "",
                      capacity: b.capacity ?? "", start_date: b.start_date || "",
                      end_date: b.end_date || "", is_active: b.is_active,
                      price_override: b.price_override != null ? b.price_override / 100 : "",
                    })}>Edit</button>
                    <button className="cm-icon-btn cm-icon-btn--danger"
                      onClick={() => setConfirm({ kind: "batch", item: b, message: `Delete batch "${b.name}" (${b.code})? Students in it will be unassigned (not removed), and this batch's progress marks are cleared.` })}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Course Management</h1>

      <div className="courses-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`courses-tab${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ACADEMY: Boards → Courses → Subjects | Batches ── */}
      {tab === "academy" && (
        <>
          <div className="cm-crumbs">
            <button className="cm-crumb" onClick={goBoards} disabled={nav.level === "boards"}>Boards</button>
            <button className="cm-crumb" onClick={goAllCourses} disabled={nav.level === "all-courses"}>All Courses</button>
            {nav.board && (
              <>
                <span className="cm-crumb-sep">/</span>
                <button className="cm-crumb" onClick={goCourses} disabled={nav.level === "courses"}>{nav.board.name}</button>
              </>
            )}
            {nav.course && (
              <>
                <span className="cm-crumb-sep">/</span>
                <span className="cm-crumb cm-crumb--current">{nav.course.title}</span>
              </>
            )}
          </div>

          {nav.level === "boards" && renderBoards()}
          {nav.level === "all-courses" && renderAllCourses()}
          {nav.level === "courses" && renderCourses()}
          {nav.level === "subjects" && renderSubjects()}
          {nav.level === "batches" && renderBatches()}
        </>
      )}

      {/* ── SKILL DEV (read-only overview) ── */}
      {tab === "skill" && (
        <>
          <div className="dashboard-card courses-table-card">
            <div className="courses-count">Skill categories</div>
            {categories.length === 0 ? (
              <div className="dashboard-loading">No categories yet.</div>
            ) : (
              <div className="courses-chips">
                {categories.map((cat) => (
                  <span key={cat.id || cat.slug} className="courses-chip">
                    {cat.icon ? `${cat.icon} ` : ""}{cat.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="dashboard-card courses-table-card">
            <div className="courses-count">
              {applications.length} skill application{applications.length !== 1 ? "s" : ""} in review
            </div>
            {applications.length === 0 ? (
              <div className="dashboard-loading">No pending skill applications.</div>
            ) : (
              <table className="courses-table">
                <thead>
                  <tr><th>Applicant</th><th>Skill</th><th>Stage</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {applications.map((a) => (
                    <tr key={a.id}>
                      <td className="courses-title">{a.user_name || a.user_email || a.applicant || "—"}</td>
                      <td>{a.skill_name || "—"}</td>
                      <td>{a.stage || "—"}</td>
                      <td><StatusBadge color="yellow">{a.status || "—"}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="dashboard-card courses-table-card">
            <div className="courses-count">
              {experts.length} listed expert{experts.length !== 1 ? "s" : ""}
            </div>
            {experts.length === 0 ? (
              <div className="dashboard-loading">No experts listed yet.</div>
            ) : (
              <table className="courses-table">
                <thead>
                  <tr><th>Expert</th><th>Headline</th><th>Rate</th></tr>
                </thead>
                <tbody>
                  {experts.map((e) => (
                    <tr key={e.id}>
                      <td className="courses-title">{e.display_name || e.name || "—"}</td>
                      <td className="courses-desc">{e.headline || "—"}</td>
                      <td>{rupees(e.hourly_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {modal && (
        <FormModal
          type={modal.type}
          mode={modal.mode}
          initial={modal.initial}
          busy={busy}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={() => setModal(null)}
          board={nav.board}
        />
      )}

      {teacherModal && (
        <TeacherAssignModal
          subject={teacherModal}
          onClose={() => setTeacherModal(null)}
          onChanged={() => nav.course && loadStaffing(nav.course.id)}
        />
      )}

      {bulkAssignModal && nav.course && (
        <BulkAssignModal
          course={nav.course}
          subjects={subjects}
          teachersBySubject={teachersBySubject}
          onClose={() => setBulkAssignModal(false)}
          onAssigned={() => loadStaffing(nav.course.id)}
        />
      )}

      {chapterModal && (
        <ChapterModal
          subject={chapterModal}
          onClose={() => { setChapterModal(null); loadSubjects(nav.course.id); }}
        />
      )}

      {progressModal && (
        <BatchProgressModal batch={progressModal} onClose={() => setProgressModal(null)} />
      )}

      {rosterModal && (
        <BatchRosterModal
          batch={rosterModal}
          siblingBatches={batches}
          onClose={() => setRosterModal(null)}
          onChanged={() => nav.course && loadBatches(nav.course.id)}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={`Delete ${confirm.kind}`}
          message={confirm.message}
          extra={confirm.error ? <div className="cm-form-error">{confirm.error}</div> : null}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default Courses;
