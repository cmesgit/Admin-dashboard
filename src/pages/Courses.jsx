import { useEffect, useState, useCallback } from "react";
import {
  getBoards, createBoard, updateBoard, deleteBoard,
  getBoardCourses, createCourse, deleteCourse,
  getCourseSubjects, createSubject, deleteSubject,
  getSkillCategories, getSkillExperts, getSkillApplications,
} from "../api/admin";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";
import "../css/Courses.css";

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const rupees = (paise) =>
  paise === null || paise === undefined ? "—" : `₹${(paise / 100).toLocaleString("en-IN")}`;

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
    { board: "Board", course: "Course", subject: "Subject" }[type];

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card" onClick={(e) => e.stopPropagation()}>
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
            </div>
            <p className="cm-hint">
              The platform is currently free — price applies only when a paid payment mode is switched on.
            </p>
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
              <span>Image</span>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file && <small className="cm-file-name">{file.name}</small>}
            </label>
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

/* ───────────────────────────── Page ───────────────────────────── */
const Courses = () => {
  const [tab, setTab] = useState("academy");

  // Academy drill-down: boards → courses (per board) → subjects (per course)
  const [nav, setNav] = useState({ level: "boards", board: null, course: null });
  const [boards, setBoards] = useState([]);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Skill Dev (read-only overview, unchanged)
  const [categories, setCategories] = useState([]);
  const [experts, setExperts] = useState([]);
  const [applications, setApplications] = useState([]);

  const [modal, setModal] = useState(null);     // { type, mode, initial }
  const [confirm, setConfirm] = useState(null);  // { kind, item, message, error? }
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
  const loadSubjects = useCallback(async (courseId) => {
    setLoading(true);
    const s = await getCourseSubjects(courseId);
    setSubjects(Array.isArray(s) ? s : []);
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
  const goBoards = () => { setNav({ level: "boards", board: null, course: null }); loadBoards(); };
  const goCourses = () => { setNav((n) => ({ ...n, level: "courses", course: null })); if (nav.board) loadCourses(nav.board.id); };

  const openCreate = (type, initial = {}) => { setFormError(""); setModal({ type, mode: "create", initial }); };
  const openEdit = (type, initial) => { setFormError(""); setModal({ type, mode: "edit", initial }); };

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
        const payload = {
          title: (form.title || "").trim(),
          description: form.description || "",
          price: Math.max(0, Math.round((parseFloat(form.price_rupees) || 0) * 100)),
          subscription_duration_days: Math.max(1, parseInt(form.subscription_duration_days, 10) || 30),
          board_id: nav.board.id,
        };
        await createCourse(payload);
        setModal(null);
        await loadCourses(nav.board.id);
      } else if (modal.type === "subject") {
        const fd = new FormData();
        fd.append("name", (form.name || "").trim());
        if (form.order) fd.append("order", form.order);
        if (file) fd.append("image", file);
        await createSubject(nav.course.id, fd);
        setModal(null);
        await loadSubjects(nav.course.id);
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
    } catch (e) {
      setConfirm((c) => ({ ...c, error: errText(e) }));
    } finally {
      setBusy(false);
    }
  };

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
            <tr><th>Course</th><th>Fee</th><th>Access</th><th>Subjects</th><th>Enrolled</th><th aria-label="actions" /></tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id}>
                <td className="courses-title">
                  <button className="cm-link" onClick={() => openCourse(c)}>{c.title}</button>
                </td>
                <td>{rupees(c.price)}</td>
                <td>{c.subscription_duration_days ? `${c.subscription_duration_days}d` : "—"}</td>
                <td>{c.subject_count ?? 0}</td>
                <td>{c.enrollment_count ?? 0}</td>
                <td className="cm-actions">
                  <button className="cm-icon-btn" onClick={() => openCourse(c)}>Subjects</button>
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
            <tr><th>#</th><th>Subject</th><th>Image</th><th aria-label="actions" /></tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id}>
                <td>{s.order}</td>
                <td className="courses-title">{s.name}</td>
                <td>{s.image ? <img src={s.image} alt="" className="cm-thumb" /> : "—"}</td>
                <td className="cm-actions">
                  <button className="cm-icon-btn cm-icon-btn--danger"
                    onClick={() => setConfirm({ kind: "subject", item: s, message: `Delete subject "${s.name}"?` })}>
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

      {/* ── ACADEMY: Boards → Courses → Subjects ── */}
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
