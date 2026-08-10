/**
 * StudentDetail.jsx — one student (LearnerProfile).
 *
 * Structure mirrors UserDetail.jsx (back button, .ud-grid cards, the single
 * `confirm` state object feeding ConfirmModal, a local toast + timer).
 *
 * ⚠️ The "Account activity" card is deliberately separated and labelled.
 * Video progress and session attendance are stored against the ACCOUNT, not
 * the learner profile, so on an account with siblings those numbers belong to
 * the family, not to the student on screen. Everything in the other cards is
 * genuinely per-student. Don't merge the two.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  getStudent,
  updateStudent,
  setStudentActive,
  getCourseBatches,
  actOnEnrollment,
  moveEnrollmentBatch,
} from "../api/admin";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";
import Toast from "../components/Toast";
import "../css/UserDetail.css";
import "../css/Students.css";

const CLASS_OPTIONS = ["", "8", "9", "10", "11", "12"];
const STREAM_OPTIONS = [["", "—"], ["science", "Science"], ["commerce", "Commerce"], ["arts", "Arts"]];
const BOARD_OPTIONS = [
  ["", "—"], ["cbse", "CBSE"], ["icse", "ICSE"], ["mbse", "MBSE"],
  ["nios", "NIOS"], ["other", "Other"],
];
const GENDER_OPTIONS = [
  ["", "—"], ["male", "Male"], ["female", "Female"],
  ["other", "Other"], ["prefer_not_to_say", "Prefer not to say"],
];
const STUDYING_OPTIONS = [["", "—"], ["yes", "Yes"], ["no", "No"]];

/* Fields the form owns, so we only ever PATCH what the admin can actually see
   and edit (never a blind spread of the whole payload back at the server). */
const EDITABLE = [
  "display_name", "first_name", "last_name", "student_id", "phone",
  "gender", "date_of_birth", "state", "district", "city_town", "pin_code",
  "school_name", "academic_year", "currently_studying", "current_class",
  "stream", "board", "board_other",
  "father_name", "father_phone", "mother_name", "mother_phone",
  "guardian_name", "guardian_phone", "parent_guardian_email",
];

const StudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState("");
  const [batchesByCourse, setBatchesByCourse] = useState({});
  const toastTimer = useRef(null);

  const fireToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const hydrate = useCallback((data) => {
    setStudent(data);
    const d = data.details || {};
    const next = {};
    EDITABLE.forEach((f) => { next[f] = d[f] ?? ""; });
    setForm(next);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      hydrate(await getStudent(id));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, hydrate]);

  useEffect(() => { load(); }, [load]);

  /* Batch pickers are per-course and only fetched once per course actually
     present in this student's enrollments. */
  useEffect(() => {
    if (!student?.enrollments?.length) return;
    const ids = [...new Set(student.enrollments.map((e) => e.course_id))];
    Promise.all(
      ids.map((cid) => getCourseBatches(cid).then((b) => [cid, b || []]))
    ).then((pairs) => setBatchesByCourse(Object.fromEntries(pairs)));
  }, [student?.enrollments]);

  const setField = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const apiError = (e) => {
    const d = e?.response?.data;
    if (!d) return "Something went wrong.";
    if (typeof d === "string") return d;
    // DRF serialises ValidationError("a plain message") as a JSON *array*, so
    // this has to come before the object branch — otherwise Object.entries
    // turns it into "0: a plain message".
    if (Array.isArray(d)) return String(d[0] ?? "Something went wrong.");
    if (d.detail) return String(d.detail);
    const first = Object.entries(d)[0];
    if (!first) return "Something went wrong.";
    const [k, v] = first;
    const msg = Array.isArray(v) ? v[0] : v;
    // Field errors keep their field name; non_field_errors read better bare.
    return k === "non_field_errors" ? String(msg) : `${k}: ${msg}`;
  };

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      hydrate(await updateStudent(id, form));
      fireToast("Student details saved");
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = () => {
    const next = !student.is_active;
    setConfirm({
      title: next ? "Reactivate this student?" : "Deactivate this student?",
      message: next
        ? "They will be able to use this profile again."
        : "This hides the student's profile without touching the account or their siblings.",
      onConfirm: async () => {
        setErr("");
        try {
          await setStudentActive(id, next);
          await load();
          fireToast(next ? "Student reactivated" : "Student deactivated");
        } catch (e) {
          setErr(apiError(e));
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  const enrollmentAction = (enr, action) => {
    setConfirm({
      title: action === "revoke" ? "Revoke this enrollment?" : "Reactivate this enrollment?",
      message: `${enr.course_title} — ${action === "revoke"
        ? "the student loses access to this course."
        : "access to this course is restored."}`,
      onConfirm: async () => {
        setErr("");
        try {
          await actOnEnrollment(enr.id, action);
          await load();
          fireToast(action === "revoke" ? "Enrollment revoked" : "Enrollment reactivated");
        } catch (e) {
          setErr(apiError(e));
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  const changeBatch = async (enr, batchId) => {
    setErr("");
    try {
      await moveEnrollmentBatch(enr.id, batchId || null);
      await load();
      fireToast("Batch updated");
    } catch (e) {
      setErr(apiError(e));
    }
  };

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  if (loading) {
    return (
      <div className="dashboard-wrapper">
        <div className="dashboard-loading">Loading student...</div>
      </div>
    );
  }
  if (!student) {
    return (
      <div className="dashboard-wrapper">
        <div className="dashboard-loading">Student not found.</div>
      </div>
    );
  }

  const acct = student.account || {};
  const shared = student.account_scoped?.shared_across_profiles || 1;

  const field = (label, f, type = "text", opts = null, full = false) => (
    <div className={`stu-field${full ? " full" : ""}`} key={f}>
      <label>{label}</label>
      {opts ? (
        <select value={form[f] ?? ""} onChange={setField(f)}>
          {opts.map((o) => {
            const [v, l] = Array.isArray(o) ? o : [o, o ? `Class ${o}` : "—"];
            return <option key={v} value={v}>{l}</option>;
          })}
        </select>
      ) : (
        <input type={type} value={form[f] ?? ""} onChange={setField(f)} />
      )}
    </div>
  );

  return (
    <div className="dashboard-wrapper">
      <button className="ud-back" onClick={() => navigate("/students")}>
        <ArrowLeft size={18} /> Back to Students
      </button>

      <h1 className="dashboard-title" style={{ marginBottom: 4 }}>
        {student.full_name || student.display_name}
      </h1>
      <p className="stu-subtitle">
        {acct.email}
        {student.relationship === "DEPENDENT" && " · dependent profile"}
        {student.sibling_count > 0 &&
          ` · shares this account with ${student.sibling_count} other student${student.sibling_count !== 1 ? "s" : ""}`}
      </p>

      {err && <div className="stu-err">{err}</div>}

      <div className="stu-detail-grid">
        <div className="stu-col">
          {/* ── editable details ── */}
          <div className="dashboard-card">
            <div className="stu-card-head">
              <h3>Student details</h3>
              <StatusBadge color={student.is_complete ? "green" : "yellow"}>
                {student.is_complete ? "Profile complete" : "Profile incomplete"}
              </StatusBadge>
            </div>
            <div className="stu-form-grid">
              {field("Display name", "display_name")}
              {field("Student ID", "student_id")}
              {field("First name", "first_name")}
              {field("Last name", "last_name")}
              {field("Phone", "phone")}
              {field("Date of birth", "date_of_birth", "date")}
              {field("Gender", "gender", "text", GENDER_OPTIONS)}
              {field("Currently studying", "currently_studying", "text", STUDYING_OPTIONS)}
              {field("Class", "current_class", "text", CLASS_OPTIONS)}
              {field("Stream", "stream", "text", STREAM_OPTIONS)}
              {field("Board", "board", "text", BOARD_OPTIONS)}
              {field("Board (other)", "board_other")}
              {field("School", "school_name", "text", null, true)}
              {field("Academic year", "academic_year")}
              {field("State", "state")}
              {field("District", "district")}
              {field("City / town", "city_town")}
              {field("PIN code", "pin_code")}
            </div>

            <div className="stu-card-head" style={{ marginTop: 20 }}>
              <h3>Guardian contact</h3>
            </div>
            <div className="stu-form-grid">
              {field("Father's name", "father_name")}
              {field("Father's phone", "father_phone")}
              {field("Mother's name", "mother_name")}
              {field("Mother's phone", "mother_phone")}
              {field("Guardian's name", "guardian_name")}
              {field("Guardian's phone", "guardian_phone")}
              {field("Parent / guardian email", "parent_guardian_email", "text", null, true)}
            </div>

            <div className="stu-actions">
              <button className="stu-btn stu-btn--primary" onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
              <button className="stu-btn" onClick={load} disabled={saving}>
                Reset
              </button>
            </div>
          </div>

          {/* ── enrollments ── */}
          <div className="dashboard-card">
            <div className="stu-card-head">
              <h3>Enrollments</h3>
            </div>
            <p className="stu-hint">
              Moving a student to another batch changes which batch-scoped
              assignments, materials and recordings they see.
            </p>
            {student.enrollments?.length ? (
              <table className="stu-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Batch</th>
                    <th>Subscription</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {student.enrollments.map((e) => {
                    const batches = batchesByCourse[e.course_id] || [];
                    return (
                      <tr key={e.id}>
                        <td>
                          {e.course_title}
                          {e.is_legacy_profile_link && (
                            <span
                              className="stu-legacy-chip"
                              title="Enrolled before per-student profiles existed; counted against this account's default student."
                            >
                              legacy
                            </span>
                          )}
                        </td>
                        <td>
                          <select
                            className="stu-batch-select"
                            value={e.batch_id || ""}
                            onChange={(ev) => changeBatch(e, ev.target.value)}
                          >
                            <option value="">Course-wide (no batch)</option>
                            {batches.map((b) => (
                              <option
                                key={b.id}
                                value={b.id}
                                disabled={b.is_full && b.id !== e.batch_id}
                              >
                                {b.name} ({b.code})
                                {b.is_full && b.id !== e.batch_id ? " — full" : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {e.subscription ? (
                            <StatusBadge color={e.subscription.is_valid ? "green" : "red"}>
                              {e.subscription.is_valid
                                ? `Valid to ${fmtDate(e.subscription.expires_at)}`
                                : e.subscription.status}
                            </StatusBadge>
                          ) : (
                            <span className="stu-muted">None</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge color={e.status === "ACTIVE" ? "green" : "red"}>
                            {e.status}
                          </StatusBadge>
                        </td>
                        <td>
                          <div className="stu-row-actions">
                            {e.status === "ACTIVE" ? (
                              <button
                                className="stu-btn stu-btn--sm stu-btn--danger"
                                onClick={() => enrollmentAction(e, "revoke")}
                              >
                                Revoke
                              </button>
                            ) : (
                              <button
                                className="stu-btn stu-btn--sm"
                                onClick={() => enrollmentAction(e, "reactivate")}
                              >
                                Reactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="stu-empty">Not enrolled in any course.</div>
            )}
          </div>
        </div>

        <div className="stu-col">
          {/* ── account + siblings ── */}
          <div className="dashboard-card">
            <div className="stu-card-head">
              <h3>Account</h3>
              <StatusBadge color={acct.is_verified ? "green" : "red"}>
                {acct.is_verified ? "Verified" : "Unverified"}
              </StatusBadge>
            </div>
            <div className="ud-field">
              <label>Email</label>
              <span>{acct.email}</span>
            </div>
            <div className="stu-actions">
              <button className="stu-btn stu-btn--sm" onClick={() => navigate(`/users/${acct.id}`)}>
                Open account
              </button>
            </div>

            {student.siblings?.length > 0 && (
              <>
                <div className="stu-card-head" style={{ marginTop: 18 }}>
                  <h3>Other students on this account</h3>
                </div>
                {student.siblings.map((s) => (
                  <div className="stu-sib-row" key={s.id}>
                    <button className="stu-sib-link" onClick={() => navigate(`/students/${s.id}`)}>
                      {s.full_name || s.display_name}
                    </button>
                    <span className="stu-muted">
                      {s.current_class ? `Class ${s.current_class}` : "—"}
                      {!s.is_active && " · inactive"}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* ── per-student academic activity ── */}
          <div className="dashboard-card">
            <div className="stu-card-head">
              <h3>Academic activity</h3>
            </div>
            <div className="stu-stat-row">
              <div className="stu-stat">
                <b>{student.quiz_avg_pct ?? "—"}{student.quiz_avg_pct != null && "%"}</b>
                <span>Quiz average</span>
              </div>
              <div className="stu-stat">
                <b>{student.quiz_attempts?.length ?? 0}</b>
                <span>Quiz attempts</span>
              </div>
              <div className="stu-stat">
                <b>{student.assignment_submissions?.length ?? 0}</b>
                <span>Submissions</span>
              </div>
            </div>

            {student.quiz_attempts?.length > 0 && (
              <table className="stu-table" style={{ marginTop: 14 }}>
                <thead>
                  <tr><th>Quiz</th><th>Score</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {student.quiz_attempts.slice(0, 8).map((a) => (
                    <tr key={a.id}>
                      <td>{a.quiz_title || "—"}</td>
                      <td>{a.total_marks ? `${a.score}/${a.total_marks}` : a.score}</td>
                      <td>
                        <StatusBadge color={a.status === "SUBMITTED" ? "green" : "gray"}>
                          {a.status}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {student.assignment_submissions?.length > 0 && (
              <table className="stu-table" style={{ marginTop: 14 }}>
                <thead>
                  <tr><th>Assignment</th><th>Submitted</th></tr>
                </thead>
                <tbody>
                  {student.assignment_submissions.slice(0, 8).map((s) => (
                    <tr key={s.id}>
                      <td>{s.assignment_title || "—"}</td>
                      <td>{fmtDate(s.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!student.quiz_attempts?.length && !student.assignment_submissions?.length && (
              <div className="stu-empty">No quiz or assignment activity yet.</div>
            )}
          </div>

          {/* ── Skill Dev — per-student (SkillSession has its own profile FK) ── */}
          {student.skill_sessions?.length > 0 && (
            <div className="dashboard-card">
              <div className="stu-card-head">
                <h3>Skill Dev sessions</h3>
                <StatusBadge color="purple">
                  {student.skill_sessions.length}
                </StatusBadge>
              </div>
              <table className="stu-table">
                <thead>
                  <tr><th>Expert</th><th>When</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {student.skill_sessions.slice(0, 8).map((s) => (
                    <tr key={s.id}>
                      <td>{s.expert || "—"}</td>
                      <td>{s.scheduled_for ? fmtDate(s.scheduled_for) : "—"}</td>
                      <td>
                        <StatusBadge
                          color={
                            s.status === "completed" ? "green"
                              : s.status === "cancelled" ? "red"
                              : s.status === "confirmed" ? "blue"
                              : "gray"
                          }
                        >
                          {s.status}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── account-scoped: NOT this student's own figures ── */}
          <div className="dashboard-card">
            <div className="stu-card-head">
              <h3>Account activity</h3>
            </div>
            {shared > 1 ? (
              <div className="stu-shared-note">
                Watch time and attendance are recorded against the <b>account</b>,
                not the individual student — these totals are shared across all{" "}
                {shared} students on this account and cannot be attributed to{" "}
                {student.full_name || student.display_name} alone.
              </div>
            ) : (
              <p className="stu-hint">
                Recorded against the account. This account has one student, so
                these figures are theirs.
              </p>
            )}
            <div className="stu-stat-row">
              <div className="stu-stat">
                <b>{student.account_scoped?.live_attendance_hours ?? 0}h</b>
                <span>Live attendance</span>
              </div>
              <div className="stu-stat">
                <b>{student.account_scoped?.videos_watched ?? 0}</b>
                <span>Recordings opened</span>
              </div>
              <div className="stu-stat">
                <b>{shared}</b>
                <span>Students sharing</span>
              </div>
            </div>
          </div>

          {/* ── danger zone ── */}
          <div className="dashboard-card">
            <div className="stu-card-head">
              <h3>Status</h3>
              <StatusBadge color={student.is_active ? "green" : "red"}>
                {student.is_active ? "Active" : "Inactive"}
              </StatusBadge>
            </div>
            <p className="stu-hint">
              Deactivating hides just this student. The account and any siblings
              are unaffected — an account must always keep at least one active
              student, so its last one can't be deactivated here.
            </p>
            <div className="stu-actions">
              <button
                className={`stu-btn ${student.is_active ? "stu-btn--danger" : "stu-btn--primary"}`}
                onClick={toggleActive}
              >
                {student.is_active ? "Deactivate student" : "Reactivate student"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      <Toast message={toast} />
    </div>
  );
};

export default StudentDetail;
