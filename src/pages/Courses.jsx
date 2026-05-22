import { useEffect, useMemo, useState } from "react";
import {
  getBoards,
  createBoard,
  deleteBoard,
  updateBoard,
  getBoardCourses,
  createCourse,
  deleteCourse,
  getCourseSubjects,
  createSubject,
  deleteSubject,
} from "../api/admin";
import ConfirmModal from "../components/ConfirmModal";
import "../css/Courses.css";

const BOARD_TYPES = [
  { value: "CENTRAL", label: "Central Board" },
  { value: "STATE", label: "State Board" },
];

/* ─────────────────────────────────────────────────────────── */

const Breadcrumb = ({ items, onClick }) => (
  <div className="adm-courses__crumbs">
    {items.map((it, i) => {
      const isLast = i === items.length - 1;
      return (
        <span key={it.key}>
          <button
            type="button"
            className={`adm-courses__crumb ${isLast ? "is-active" : ""}`}
            onClick={() => !isLast && onClick(it.key)}
            disabled={isLast}
          >
            {it.label}
          </button>
          {!isLast && <span className="adm-courses__crumb-sep">›</span>}
        </span>
      );
    })}
  </div>
);

/* ─────────────────────────────────────────────────────────── */

const CreateBoardModal = ({ onClose, onCreate }) => {
  const [name, setName] = useState("");
  const [boardType, setBoardType] = useState("CENTRAL");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setErr("");
    try {
      await onCreate({
        name: name.trim(),
        board_type: boardType,
        description: description.trim(),
        is_active: isActive,
      });
      onClose();
    } catch (e2) {
      setErr(e2?.response?.data?.detail || e2?.response?.data?.name?.[0] || "Failed to create board.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <form className="adm-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Add Board</h3>

        <label className="adm-field">
          <span>Name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CBSE, MBSE" autoFocus />
        </label>

        <label className="adm-field">
          <span>Type *</span>
          <select value={boardType} onChange={(e) => setBoardType(e.target.value)}>
            {BOARD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>

        <label className="adm-field">
          <span>Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description shown on the public site"
          />
        </label>

        <label className="adm-field adm-field--check">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>Active (uncheck for dormant / Coming Soon)</span>
        </label>

        {err && <p className="adm-modal__err">{err}</p>}

        <div className="adm-modal__actions">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="adm-btn adm-btn--primary" disabled={submitting}>
            {submitting ? "Adding…" : "Add Board"}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────── */

const CreateCourseModal = ({ board, onClose, onCreate }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceRupees, setPriceRupees] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setErr("");
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        price: Math.round((Number(priceRupees) || 0) * 100), // ₹ → paise
        subscription_duration_days: Number(durationDays) || 30,
        board_id: board.id,
      });
      onClose();
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Failed to create course.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <form className="adm-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Add Course in {board.name}</h3>

        <label className="adm-field">
          <span>Title *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Class 10" autoFocus />
        </label>

        <label className="adm-field">
          <span>Description</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short course description"
          />
        </label>

        <div className="adm-field-row">
          <label className="adm-field">
            <span>Price (₹)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={priceRupees}
              onChange={(e) => setPriceRupees(e.target.value)}
              placeholder="1500"
            />
          </label>

          <label className="adm-field">
            <span>Subscription duration (days)</span>
            <input
              type="number"
              min="1"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
            />
          </label>
        </div>

        {err && <p className="adm-modal__err">{err}</p>}

        <div className="adm-modal__actions">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="adm-btn adm-btn--primary" disabled={submitting}>
            {submitting ? "Adding…" : "Add Course"}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────── */

const CreateSubjectModal = ({ course, onClose, onCreate }) => {
  const [name, setName] = useState("");
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setErr("");
    try {
      const payload = { name: name.trim() };
      if (image) payload.image = image;
      await onCreate(payload);
      onClose();
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Failed to create subject.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <form className="adm-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Add Subject in {course.title}</h3>

        <label className="adm-field">
          <span>Name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mathematics" autoFocus />
        </label>

        <label className="adm-field">
          <span>Image (optional)</span>
          <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} />
        </label>

        {err && <p className="adm-modal__err">{err}</p>}

        <div className="adm-modal__actions">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="adm-btn adm-btn--primary" disabled={submitting}>
            {submitting ? "Adding…" : "Add Subject"}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────── */

const Courses = () => {
  // ── Navigation state ──
  const [view, setView] = useState("boards"); // "boards" | "courses" | "subjects"
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);

  // ── Data ──
  const [boards, setBoards] = useState([]);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);

  // ── Modal state ──
  const [showAddBoard, setShowAddBoard] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // { kind, id, label }

  // ── Load boards on mount + whenever returning to boards view ──
  const loadBoards = async () => {
    setLoading(true);
    try {
      const data = await getBoards();
      setBoards(Array.isArray(data) ? data : []);
    } catch {
      setBoards([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async (boardId) => {
    setLoading(true);
    try {
      const data = await getBoardCourses(boardId);
      setCourses(Array.isArray(data) ? data : []);
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async (courseId) => {
    setLoading(true);
    try {
      const data = await getCourseSubjects(courseId);
      setSubjects(Array.isArray(data) ? data : []);
    } catch {
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBoards(); }, []);

  // ── Navigation handlers ──
  const openBoard = (board) => {
    if (!board.is_active) return; // dormant boards aren't drillable
    setSelectedBoard(board);
    setView("courses");
    loadCourses(board.id);
  };

  const openCourse = (course) => {
    setSelectedCourse(course);
    setView("subjects");
    loadSubjects(course.id);
  };

  const navigateTo = (key) => {
    if (key === "boards") {
      setSelectedBoard(null);
      setSelectedCourse(null);
      setView("boards");
    } else if (key === "courses") {
      setSelectedCourse(null);
      setView("courses");
    }
  };

  // ── Mutations ──
  const handleCreateBoard = async (payload) => {
    await createBoard(payload);
    await loadBoards();
  };

  const handleCreateCourse = async (payload) => {
    await createCourse(payload);
    await loadCourses(selectedBoard.id);
  };

  const handleCreateSubject = async (payload) => {
    await createSubject(selectedCourse.id, payload);
    await loadSubjects(selectedCourse.id);
  };

  const handleToggleBoardActive = async (board, e) => {
    e.stopPropagation();
    await updateBoard(board.id, { is_active: !board.is_active });
    loadBoards();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.kind === "board") {
        await deleteBoard(pendingDelete.id);
        loadBoards();
      } else if (pendingDelete.kind === "course") {
        await deleteCourse(pendingDelete.id);
        loadCourses(selectedBoard.id);
      } else if (pendingDelete.kind === "subject") {
        await deleteSubject(pendingDelete.id);
        loadSubjects(selectedCourse.id);
      }
    } catch (e) {
      alert(e?.response?.data?.detail || "Delete failed.");
    } finally {
      setPendingDelete(null);
    }
  };

  // ── Grouped boards (for visual grouping by Central / State) ──
  const groupedBoards = useMemo(() => {
    const central = boards.filter((b) => b.board_type === "CENTRAL");
    const state = boards.filter((b) => b.board_type === "STATE");
    return { central, state };
  }, [boards]);

  /* ── Render ───────────────────────────────────────────── */

  const crumbs = (() => {
    if (view === "boards") return [{ key: "boards", label: "Boards" }];
    if (view === "courses") return [
      { key: "boards", label: "Boards" },
      { key: "courses", label: selectedBoard?.name || "Board" },
    ];
    return [
      { key: "boards", label: "Boards" },
      { key: "courses", label: selectedBoard?.name || "Board" },
      { key: "subjects", label: selectedCourse?.title || "Course" },
    ];
  })();

  return (
    <div className="dashboard-wrapper">
      <div className="adm-courses__head">
        <h1 className="dashboard-title">Course Management</h1>
        <Breadcrumb items={crumbs} onClick={navigateTo} />
      </div>

      {/* ── BOARDS VIEW ── */}
      {view === "boards" && (
        <div className="dashboard-card adm-courses__card">
          <div className="adm-courses__bar">
            <div className="adm-courses__count">
              {boards.length} board{boards.length !== 1 ? "s" : ""}
            </div>
            <button className="adm-btn adm-btn--primary" onClick={() => setShowAddBoard(true)}>
              + Add Board
            </button>
          </div>

          {loading ? (
            <div className="dashboard-loading">Loading…</div>
          ) : boards.length === 0 ? (
            <div className="dashboard-loading">No boards yet. Add your first board.</div>
          ) : (
            <>
              {["central", "state"].map((groupKey) => {
                const list = groupedBoards[groupKey];
                if (list.length === 0) return null;
                return (
                  <div key={groupKey} className="adm-courses__group">
                    <h3 className="adm-courses__group-title">
                      {groupKey === "central" ? "Central Board" : "State Board"}
                    </h3>
                    <div className="adm-courses__grid">
                      {list.map((b) => (
                        <article
                          key={b.id}
                          className={`adm-tile${b.is_active ? "" : " adm-tile--dormant"}`}
                          onClick={() => openBoard(b)}
                        >
                          {!b.is_active && (
                            <span className="adm-tile__badge">Coming Soon</span>
                          )}
                          <div className="adm-tile__title">{b.name}</div>
                          {b.description && (
                            <div className="adm-tile__desc">{b.description}</div>
                          )}
                          <div className="adm-tile__meta">
                            {b.course_count} course{b.course_count !== 1 ? "s" : ""}
                          </div>
                          <div className="adm-tile__actions">
                            <button
                              className="adm-tile__action"
                              onClick={(e) => handleToggleBoardActive(b, e)}
                              title={b.is_active ? "Mark as dormant" : "Mark as active"}
                            >
                              {b.is_active ? "Mark dormant" : "Mark active"}
                            </button>
                            <button
                              className="adm-tile__action adm-tile__action--danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete({ kind: "board", id: b.id, label: b.name });
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── COURSES VIEW ── */}
      {view === "courses" && selectedBoard && (
        <div className="dashboard-card adm-courses__card">
          <div className="adm-courses__bar">
            <div className="adm-courses__count">
              {courses.length} course{courses.length !== 1 ? "s" : ""} in {selectedBoard.name}
            </div>
            <button className="adm-btn adm-btn--primary" onClick={() => setShowAddCourse(true)}>
              + Add Course
            </button>
          </div>

          {loading ? (
            <div className="dashboard-loading">Loading…</div>
          ) : courses.length === 0 ? (
            <div className="dashboard-loading">No courses yet. Add the first one.</div>
          ) : (
            <div className="adm-courses__grid">
              {courses.map((c) => (
                <article
                  key={c.id}
                  className="adm-tile"
                  onClick={() => openCourse(c)}
                >
                  <div className="adm-tile__title">
                    {c.title}
                    {c.stream_name && <span className="adm-tile__stream"> · {c.stream_name}</span>}
                  </div>
                  {c.description && <div className="adm-tile__desc">{c.description}</div>}
                  <div className="adm-tile__meta">
                    <span>₹{(c.price / 100).toLocaleString("en-IN")}</span>
                    <span> · {c.subject_count} subject{c.subject_count !== 1 ? "s" : ""}</span>
                    <span> · {c.enrollment_count} enrolled</span>
                  </div>
                  <div className="adm-tile__actions">
                    <button
                      className="adm-tile__action adm-tile__action--danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete({ kind: "course", id: c.id, label: c.title });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SUBJECTS VIEW ── */}
      {view === "subjects" && selectedCourse && (
        <div className="dashboard-card adm-courses__card">
          <div className="adm-courses__bar">
            <div className="adm-courses__count">
              {subjects.length} subject{subjects.length !== 1 ? "s" : ""} in {selectedCourse.title}
            </div>
            <button className="adm-btn adm-btn--primary" onClick={() => setShowAddSubject(true)}>
              + Add Subject
            </button>
          </div>

          {loading ? (
            <div className="dashboard-loading">Loading…</div>
          ) : subjects.length === 0 ? (
            <div className="dashboard-loading">No subjects yet. Add the first subject.</div>
          ) : (
            <table className="adm-subjects-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Order</th>
                  <th>Name</th>
                  <th style={{ width: 80 }}>Image</th>
                  <th style={{ width: 110 }}></th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id}>
                    <td>{s.order}</td>
                    <td>{s.name}</td>
                    <td>
                      {s.image ? (
                        <img src={s.image} alt={s.name} className="adm-subjects-table__img" />
                      ) : (
                        <span className="adm-subjects-table__no-img">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="adm-tile__action adm-tile__action--danger"
                        onClick={() =>
                          setPendingDelete({ kind: "subject", id: s.id, label: s.name })
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {showAddBoard && (
        <CreateBoardModal
          onClose={() => setShowAddBoard(false)}
          onCreate={handleCreateBoard}
        />
      )}
      {showAddCourse && selectedBoard && (
        <CreateCourseModal
          board={selectedBoard}
          onClose={() => setShowAddCourse(false)}
          onCreate={handleCreateCourse}
        />
      )}
      {showAddSubject && selectedCourse && (
        <CreateSubjectModal
          course={selectedCourse}
          onClose={() => setShowAddSubject(false)}
          onCreate={handleCreateSubject}
        />
      )}
      {pendingDelete && (
        <ConfirmModal
          title={`Delete ${pendingDelete.kind}?`}
          message={`This will permanently delete "${pendingDelete.label}". This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
};

export default Courses;
