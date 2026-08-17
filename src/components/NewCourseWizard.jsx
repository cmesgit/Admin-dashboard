import { useEffect, useState } from "react";
import { X, Plus, Trash2, Check } from "lucide-react";
import {
  getBoards,
  getCourseCategories,
  createCourse,
  createSubject,
  createBatch,
} from "../api/admin";
import { errText } from "../utils/errText";
import "../css/NewCourseWizard.css";

/*
 * New Course wizard — the header "New course" action.
 * Step 1  Course basics (board or competitive-exam category, title,
 *         description, price, access days)
 * Step 2  Subjects (planned chapters optional)
 * Step 3  First batch (name, code, year, capacity)
 * On finish: createCourse → createSubject(×n) → createBatch. Subjects/batch are
 * best-effort after the course exists, so a course is never lost to a later
 * failing sub-step.
 *
 * Board-linked (default, kind=ACADEMIC) courses require a board. Competitive
 * / Coaching (kind=COACHING) courses have no board/stream/class_level
 * (Course model leaves those NULL for coaching — see courses/models.py) and
 * are tagged instead with a CourseCategory from the "competitive" group
 * (NEET/JEE/UPSC/... — courses/admin/categories/, filtered client-side since
 * the endpoint has no ?group= support).
 */
const emptyCourse = {
  board_id: "",
  category_id: "",
  title: "",
  description: "",
  price_rupees: "",
  subscription_duration_days: "180",
};

const NewCourseWizard = ({ onClose, onCreated }) => {
  const [step, setStep] = useState(1);
  const [courseType, setCourseType] = useState("board"); // "board" | "competitive"
  const [boards, setBoards] = useState([]);
  const [competitiveCategories, setCompetitiveCategories] = useState([]);
  const [course, setCourse] = useState(emptyCourse);
  const [subjects, setSubjects] = useState([{ name: "", ch: "" }]);
  const [batch, setBatch] = useState({ name: "", code: "", year: "", capacity: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getBoards().then((b) => {
      setBoards(b || []);
      if (b && b.length) setCourse((c) => ({ ...c, board_id: String(b[0].id) }));
    });
    getCourseCategories().then((cats) => {
      const competitive = (cats || []).filter((c) => c.group === "competitive");
      setCompetitiveCategories(competitive);
      if (competitive.length) {
        setCourse((c) => ({ ...c, category_id: String(competitive[0].id) }));
      }
    });
  }, []);

  const setC = (k, v) => setCourse((c) => ({ ...c, [k]: v }));
  const setB = (k, v) => setBatch((b) => ({ ...b, [k]: v }));

  const canNext1 =
    course.title.trim() &&
    (courseType === "board" ? !!course.board_id : !!course.category_id);
  const canFinish = batch.name.trim() && batch.code.trim();

  const addSubject = () => setSubjects((s) => [...s, { name: "", ch: "" }]);
  const removeSubject = (i) => setSubjects((s) => s.filter((_, idx) => idx !== i));
  const setSubject = (i, k, v) =>
    setSubjects((s) => s.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));

  const toIntOrNull = (v) => (v === "" || v == null ? null : parseInt(v, 10));

  const finish = async () => {
    setBusy(true);
    setError("");
    try {
      const created = await createCourse({
        title: course.title.trim(),
        description: course.description || "",
        price: Math.max(0, Math.round((parseFloat(course.price_rupees) || 0) * 100)),
        subscription_duration_days: Math.max(
          1,
          parseInt(course.subscription_duration_days, 10) || 30
        ),
        ...(courseType === "competitive"
          ? { kind: "COACHING", categories: [Number(course.category_id)] }
          : { kind: "ACADEMIC", board_id: course.board_id }),
      });

      const courseId = created?.id;
      if (courseId) {
        for (const s of subjects) {
          const name = (s.name || "").trim();
          if (!name) continue;
          const fd = new FormData();
          fd.append("name", name);
          if (s.ch) fd.append("planned_chapters", s.ch);
          try {
            await createSubject(courseId, fd);
          } catch {
            /* best-effort — surfaced via the course readiness checklist later */
          }
        }
        try {
          await createBatch(courseId, {
            name: batch.name.trim(),
            code: batch.code.trim(),
            year: toIntOrNull(batch.year),
            capacity: toIntOrNull(batch.capacity),
            is_active: true,
          });
        } catch {
          /* best-effort */
        }
      }
      onCreated?.(created);
    } catch (e) {
      setError(errText(e) || "Could not create the course.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ncw-overlay" onClick={onClose}>
      <div className="ncw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ncw-head">
          <h2>New course</h2>
          <button className="ncw-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="ncw-steps">
          {["Basics", "Subjects", "First batch"].map((label, i) => (
            <div key={label} className={`ncw-step${step === i + 1 ? " active" : ""}${step > i + 1 ? " done" : ""}`}>
              <span className="ncw-step-dot">{step > i + 1 ? <Check size={12} /> : i + 1}</span>
              {label}
            </div>
          ))}
        </div>

        <div className="ncw-body">
          {step === 1 && (
            <>
              <div className="ncw-row ncw-type-toggle" role="radiogroup" aria-label="Course type">
                <label className={`ncw-type-opt${courseType === "board" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="ncw-course-type"
                    checked={courseType === "board"}
                    onChange={() => setCourseType("board")}
                  />
                  Board-linked
                </label>
                <label className={`ncw-type-opt${courseType === "competitive" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="ncw-course-type"
                    checked={courseType === "competitive"}
                    onChange={() => setCourseType("competitive")}
                  />
                  Competitive / Coaching
                </label>
              </div>
              {courseType === "board" ? (
                <label className="ncw-field">
                  <span>Board</span>
                  <select value={course.board_id} onChange={(e) => setC("board_id", e.target.value)}>
                    {boards.length === 0 && <option value="">No boards — create one in Courses first</option>}
                    {boards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="ncw-field">
                  <span>Exam category</span>
                  <select value={course.category_id} onChange={(e) => setC("category_id", e.target.value)}>
                    {competitiveCategories.length === 0 && (
                      <option value="">No competitive categories — add one in Content → Categories first</option>
                    )}
                    {competitiveCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="ncw-field">
                <span>Course title</span>
                <input
                  value={course.title}
                  onChange={(e) => setC("title", e.target.value)}
                  placeholder="e.g. Class 10 CBSE — Science"
                />
              </label>
              <label className="ncw-field">
                <span>Description</span>
                <textarea
                  rows={3}
                  value={course.description}
                  onChange={(e) => setC("description", e.target.value)}
                  placeholder="Short description shown to students"
                />
              </label>
              <div className="ncw-row">
                <label className="ncw-field">
                  <span>Price (₹)</span>
                  <input
                    type="number"
                    min="0"
                    value={course.price_rupees}
                    onChange={(e) => setC("price_rupees", e.target.value)}
                    placeholder="0 = free"
                  />
                </label>
                <label className="ncw-field">
                  <span>Access days</span>
                  <input
                    type="number"
                    min="1"
                    value={course.subscription_duration_days}
                    onChange={(e) => setC("subscription_duration_days", e.target.value)}
                  />
                </label>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="ncw-hint">Add the subjects this course will teach. Planned chapters are optional.</p>
              {subjects.map((s, i) => (
                <div key={i} className="ncw-row ncw-subject-row">
                  <input
                    className="ncw-grow"
                    value={s.name}
                    onChange={(e) => setSubject(i, "name", e.target.value)}
                    placeholder={`Subject ${i + 1} name`}
                  />
                  <input
                    className="ncw-ch"
                    type="number"
                    min="0"
                    value={s.ch}
                    onChange={(e) => setSubject(i, "ch", e.target.value)}
                    placeholder="Chapters"
                  />
                  {subjects.length > 1 && (
                    <button className="ncw-icon-btn" onClick={() => removeSubject(i)} aria-label="Remove subject">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
              <button className="ncw-add" onClick={addSubject}>
                <Plus size={14} /> Add subject
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <p className="ncw-hint">Every course needs at least one batch to deliver classes.</p>
              <div className="ncw-row">
                <label className="ncw-field">
                  <span>Batch name</span>
                  <input value={batch.name} onChange={(e) => setB("name", e.target.value)} placeholder="Morning 2026" />
                </label>
                <label className="ncw-field">
                  <span>Code</span>
                  <input value={batch.code} onChange={(e) => setB("code", e.target.value)} placeholder="B01" />
                </label>
              </div>
              <div className="ncw-row">
                <label className="ncw-field">
                  <span>Year</span>
                  <input type="number" value={batch.year} onChange={(e) => setB("year", e.target.value)} placeholder="2026" />
                </label>
                <label className="ncw-field">
                  <span>Capacity</span>
                  <input type="number" value={batch.capacity} onChange={(e) => setB("capacity", e.target.value)} placeholder="60" />
                </label>
              </div>
            </>
          )}

          {error && <div className="ncw-error">{error}</div>}
        </div>

        <div className="ncw-foot">
          {step > 1 ? (
            <button className="ncw-btn-ghost" onClick={() => setStep(step - 1)} disabled={busy}>
              Back
            </button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <button
              className="ncw-btn-primary"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !canNext1}
            >
              Continue
            </button>
          ) : (
            <button className="ncw-btn-primary" onClick={finish} disabled={!canFinish || busy}>
              {busy ? "Creating…" : "Create course"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewCourseWizard;
