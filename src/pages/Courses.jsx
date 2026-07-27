import { useEffect, useState, useCallback } from "react";
import {
  getBoards, createBoard, updateBoard, deleteBoard,
  getBoardCourses, createCourse, getCourse, updateCourse, deleteCourse,
  getCourseSubjects, createSubject, updateSubject, deleteSubject,
  createChapter, updateChapter, deleteChapter,
  getSkillCategories, getSkillExperts, getSkillApplications,
  // ── new: batches + teacher assignment + progress/roster ──
  getCourseBatches, createBatch, updateBatch, deleteBatch,
  getBatchProgress, getBatchRoster,
  getAdminAcademyTeachers, getSubjectTeachers,
  assignSubjectTeacher, updateSubjectTeacher, removeSubjectTeacher,
} from "../api/admin";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";
import "../css/Courses.css";

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const rupees = (paise) =>
  paise === null || paise === undefined ? "—" : `₹${(paise / 100).toLocaleString("en-IN")}`;
const roleLabel = (r) => (r === "ASSISTANT" ? "Assistant" : "Primary");

const TABS = [
  { key: "academy", label: "Academy" },
  { key: "skill", label: "Skill Dev" },
];

/* Turn an axios error into a human string (detail or collected field errors). */
const errText = (e) => {
  const d = e?.response?.data;
  if (!d) return "Something went wrong. Please try again.";
  if (typeof d === "string") return d;
  if (d.detail) return d.detail;
  try { return Object.values(d).flat().join(" ") || "Request failed."; }
  catch { return "Request failed."; }
};

/* ───────────────────────── Create/Edit modal ───────────────────────── */
function FormModal({ type, mode, initial, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial || {});
  const [file, setFile] = useState(null);

  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const heading =
    `${mode === "edit" ? "Edit" : "New"} ` +
    { board: "Board", course: "Course", subject: "Subject", batch: "Batch" }[type];

  const isCourse = type === "course";

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className={`cm-form-card${isCourse ? " cm-form-card--wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <h3>{heading}</h3>

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
            <div className="cm-row">
              <label className="cm-field">
                <span>Price (₹)</span>
                <input type="number" min="0" value={form.price_rupees ?? 0} onChange={set("price_rupees")} />
              </label>
              <label className="cm-field">
                <span>Access (days)</span>
                <input type="number" min="1" value={form.subscription_duration_days ?? 30} onChange={set("subscription_duration_days")} />
              </label>
              <label className="cm-field">
                <span>Status</span>
                <select value={form.status || "DRAFT"} onChange={set("status")}>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
            </div>
            <p className="cm-hint">
              Only Published courses (with an open batch) appear in the public catalog.
              The platform is currently free — price applies only when a paid payment mode is switched on.
            </p>

            <label className="cm-field">
              <span>Thumbnail (16:9)</span>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file ? (
                <small className="cm-file-name">{file.name}</small>
              ) : form.thumbnail ? (
                <img src={form.thumbnail} alt="" className="cm-thumb" />
              ) : null}
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
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file ? (
                <small className="cm-file-name">{file.name}</small>
              ) : form.image ? (
                <img src={form.image} alt="" className="cm-thumb" />
              ) : null}
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

        {error && <div className="cm-form-error">{error}</div>}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="confirm-ok" onClick={() => onSubmit(form, file)} disabled={busy}>
            {busy ? "Saving…" : mode === "edit" ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Teacher assignment modal ───────────────────── */
function TeacherAssignModal({ subject, onClose, onChanged }) {
  const [assigned, setAssigned] = useState([]);
  const [pool, setPool] = useState([]);
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
      const [list, teachers] = await Promise.all([
        getSubjectTeachers(subject.id),
        getAdminAcademyTeachers(),
      ]);
      if (cancel) return;
      setAssigned(Array.isArray(list) ? list : []);
      setPool(Array.isArray(teachers) ? teachers : []);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [subject.id]);

  const assignedIds = new Set(assigned.map((t) => t.user_id));
  const matches = pool.filter(
    (t) =>
      !assignedIds.has(t.user_id) &&
      ((t.name || "").toLowerCase().includes(q.toLowerCase()) ||
        (t.email || "").toLowerCase().includes(q.toLowerCase()))
  );

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
              <div className="cm-pool-list">
                {matches.length === 0 ? (
                  <div className="cm-pool-empty">
                    {pool.length === 0
                      ? "No approved teachers found."
                      : "No matches — everyone matching is already assigned."}
                  </div>
                ) : (
                  matches.slice(0, 30).map((t) => (
                    <div className="cm-pool-row" key={t.user_id}>
                      <div className="cm-assign-meta">
                        <span className="cm-assign-name">{t.name}</span>
                        <span className="cm-assign-sub">{t.qualification || t.email}</span>
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

/* ───────────────────── Chapter content modal ───────────────────── */
function ChapterModal({ subject, onClose, onChanged }) {
  const [chapters, setChapters] = useState(subject.chapters || []);
  const [editingId, setEditingId] = useState(null); // chapter id being edited, or "new"
  const [draft, setDraft] = useState({ title: "", content_html: "", trusted_html: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const startNew = () => {
    setDraft({ title: "", content_html: "", trusted_html: false });
    setEditingId("new");
    setErr("");
  };
  const startEdit = (ch) => {
    setDraft({ title: ch.title, content_html: ch.content_html || "", trusted_html: !!ch.trusted_html });
    setEditingId(ch.id);
    setErr("");
  };

  const save = async () => {
    setBusy(true); setErr("");
    try {
      if (editingId === "new") {
        const created = await createChapter(subject.id, draft);
        setChapters((cs) => [...cs, created]);
      } else {
        const updated = await updateChapter(editingId, draft);
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
      onChanged?.();
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
            {chapters.map((ch) =>
              editingId === ch.id ? (
                <div className="cm-chapter-edit" key={ch.id}>
                  <label className="cm-field">
                    <span>Title</span>
                    <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
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
                    <button className="cm-icon-btn" disabled={busy} onClick={() => startEdit(ch)}>Edit</button>
                    <button className="cm-icon-btn cm-icon-btn--danger" disabled={busy} onClick={() => remove(ch)}>Delete</button>
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

/* ───────────────────── Batch roster modal ───────────────────── */
function BatchRosterModal({ batch, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const d = await getBatchRoster(batch.id, { status: "ACTIVE" });
      if (!cancel) { setRows(d?.results || []); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [batch.id]);

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="cm-form-card cm-form-card--wide" onClick={(e) => e.stopPropagation()}>
        <h3>Roster · {batch.name} <span className="cm-code">{batch.code}</span></h3>

        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : rows.length === 0 ? (
          <p className="cm-empty-note">No active students in this batch yet.</p>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>Student</th><th>Email</th><th>Enrolled</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="courses-title">{r.user_name || "—"}</td>
                  <td>{r.user_email}</td>
                  <td>{formatDate(r.enrolled_at)}</td>
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
  const [tab, setTab] = useState("academy");

  // Academy drill-down: boards → courses (per board) → subjects|batches (per course)
  const [nav, setNav] = useState({ level: "boards", board: null, course: null });
  const [boards, setBoards] = useState([]);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [batches, setBatches] = useState([]);
  const [teachersBySubject, setTeachersBySubject] = useState({});
  const [loading, setLoading] = useState(true);

  // Skill Dev (read-only overview, unchanged)
  const [categories, setCategories] = useState([]);
  const [experts, setExperts] = useState([]);
  const [applications, setApplications] = useState([]);

  const [modal, setModal] = useState(null);       // { type, mode, initial }
  const [confirm, setConfirm] = useState(null);    // { kind, item, message, error? }
  const [teacherModal, setTeacherModal] = useState(null);   // subject
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
    setCourses(Array.isArray(c) ? c : []);
    setLoading(false);
  }, []);
  const loadSubjectTeachers = useCallback(async (subjectList) => {
    const entries = await Promise.allSettled(
      subjectList.map(async (s) => [s.id, await getSubjectTeachers(s.id)])
    );
    const map = {};
    entries.forEach((r) => {
      if (r.status === "fulfilled") {
        const [id, list] = r.value;
        map[id] = Array.isArray(list) ? list : [];
      }
    });
    setTeachersBySubject(map);
  }, []);
  const loadSubjects = useCallback(async (courseId) => {
    setLoading(true);
    const s = await getCourseSubjects(courseId);
    const list = Array.isArray(s) ? s : [];
    setSubjects(list);
    setLoading(false);
    loadSubjectTeachers(list);
  }, [loadSubjectTeachers]);
  const loadBatches = useCallback(async (courseId) => {
    setLoading(true);
    const b = await getCourseBatches(courseId);
    setBatches(Array.isArray(b) ? b : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadBoards(); }, [loadBoards]);

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
      thumbnail: full?.thumbnail ?? c.thumbnail ?? null,
      level: details.level || "",
      duration_weeks: details.duration_weeks ?? "",
      language: details.language || "English",
      requirements: details.requirements || "",
      syllabus: details.syllabus || "",
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
        if (modal.mode === "edit") await updateBoard(modal.initial.id, payload);
        else await createBoard(payload);
        setModal(null);
        await loadBoards();
      } else if (modal.type === "course") {
        const basePayload = {
          title: (form.title || "").trim(),
          description: form.description || "",
          price: Math.max(0, Math.round((parseFloat(form.price_rupees) || 0) * 100)),
          subscription_duration_days: Math.max(1, parseInt(form.subscription_duration_days, 10) || 30),
          status: form.status || "DRAFT",
        };
        const detailsPayload = {
          level: form.level || "",
          duration_weeks: form.duration_weeks === "" || form.duration_weeks == null ? 0 : parseInt(form.duration_weeks, 10) || 0,
          syllabus: form.syllabus || "",
          language: form.language || "English",
          requirements: form.requirements || "",
        };
        if (file) {
          const fd = new FormData();
          Object.entries(basePayload).forEach(([k, v]) => fd.append(k, v));
          fd.append("details", JSON.stringify(detailsPayload));
          fd.append("thumbnail", file);
          if (modal.mode !== "edit") fd.append("board_id", nav.board.id);
          if (modal.mode === "edit") await updateCourse(modal.initial.id, fd, true);
          else await createCourse(fd, true);
        } else {
          const payload = { ...basePayload, details: detailsPayload };
          if (modal.mode === "edit") await updateCourse(modal.initial.id, payload);
          else await createCourse({ ...payload, board_id: nav.board.id });
        }
        setModal(null);
        await loadCourses(nav.board.id);
      } else if (modal.type === "subject") {
        const fd = new FormData();
        fd.append("name", (form.name || "").trim());
        if (form.order) fd.append("order", form.order);
        fd.append("textbook", form.textbook || "");
        if (file) fd.append("image", file);
        if (modal.mode === "edit") await updateSubject(modal.initial.id, fd);
        else await createSubject(nav.course.id, fd);
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
                <td>{b.board_type === "STATE" ? "State" : "Central"}</td>
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
                    description: b.description, is_active: b.is_active,
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
          {courses.length} course{courses.length !== 1 ? "s" : ""} in {nav.board?.name}
        </div>
        <button className="cm-add-btn" onClick={() => openCreate("course", { price_rupees: 0, subscription_duration_days: 30 })}>
          + New Course
        </button>
      </div>
      {loading ? (
        <div className="dashboard-loading">Loading…</div>
      ) : courses.length === 0 ? (
        <div className="dashboard-loading">No courses in this board yet. Create the first one.</div>
      ) : (
        <table className="courses-table">
          <thead>
            <tr><th>Course</th><th>Status</th><th>Fee</th><th>Access</th><th>Subjects</th><th>Enrolled</th><th aria-label="actions" /></tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id}>
                <td className="courses-title">
                  <button className="cm-link" onClick={() => openCourse(c)}>{c.title}</button>
                </td>
                <td>
                  <StatusBadge color={c.status === "PUBLISHED" ? "green" : c.status === "ARCHIVED" ? "gray" : "yellow"}>
                    {c.status === "PUBLISHED" ? "Published" : c.status === "ARCHIVED" ? "Archived" : "Draft"}
                  </StatusBadge>
                </td>
                <td>{rupees(c.price)}</td>
                <td>{c.subscription_duration_days ? `${c.subscription_duration_days}d` : "—"}</td>
                <td>{c.subject_count ?? 0}</td>
                <td>{c.enrollment_count ?? 0}</td>
                <td className="cm-actions">
                  <button className="cm-icon-btn" onClick={() => openCourse(c)}>Subjects</button>
                  <button className="cm-icon-btn" onClick={() => openBatches(c)}>Batches</button>
                  <button className="cm-icon-btn" onClick={() => openEditCourse(c)}>Edit</button>
                  <button className="cm-icon-btn cm-icon-btn--danger"
                    onClick={() => setConfirm({ kind: "course", item: c, message: `Delete course "${c.title}"? Its subjects and content links are removed too. This can't be undone.` })}>
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

  const renderSubjects = () => (
    <>
      {renderCourseSubnav()}
      <div className="dashboard-card courses-table-card">
        <div className="cm-card-head">
          <div className="courses-count">
            {subjects.length} subject{subjects.length !== 1 ? "s" : ""} in {nav.course?.title}
          </div>
          <button className="cm-add-btn" onClick={() => openCreate("subject", {})}>
            + Add Subject
          </button>
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
        />
      )}

      {teacherModal && (
        <TeacherAssignModal
          subject={teacherModal}
          onClose={() => setTeacherModal(null)}
          onChanged={() => { const s = subjects.find((x) => x.id === teacherModal.id); if (s) loadSubjectTeachers(subjects); }}
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
        <BatchRosterModal batch={rosterModal} onClose={() => setRosterModal(null)} />
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
