/**
 * Students.jsx — the student directory.
 *
 * A "student" here is a LearnerProfile, not a User: one account can hold
 * several learner profiles (a parent with three children is one account and
 * three students). This list is therefore FLAT — one row per student, with the
 * shared account email as a column — so the row count is the real student
 * count. /users remains the *account* directory; the two are not substitutes.
 *
 * Pagination/search/pager markup mirror Users.jsx so both directories behave
 * identically. Users.css is imported for that shared table+pager vocabulary.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import {
  getStudents,
  getAcademicCourses,
  getCourseBatches,
  bulkAssignBatch,
} from "../api/admin";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import "../css/Users.css";
import "../css/Students.css";

const PAGE_SIZE = 25;

const CLASS_OPTIONS = ["8", "9", "10", "11", "12"];
const STREAM_OPTIONS = [
  ["science", "Science"],
  ["commerce", "Commerce"],
  ["arts", "Arts"],
];
const BOARD_OPTIONS = [
  ["cbse", "CBSE"],
  ["icse", "ICSE"],
  ["mbse", "MBSE"],
  ["nios", "NIOS"],
  ["other", "Other"],
];

const Students = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [streamFilter, setStreamFilter] = useState("");
  const [boardFilter, setBoardFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [enrolledFilter, setEnrolledFilter] = useState("");
  const [incompleteFilter, setIncompleteFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [noBatchFilter, setNoBatchFilter] = useState("");
  const debounceRef = useRef(null);

  /* course + batch pickers (batch list depends on the chosen course, since a
     batch only ever belongs to one course) */
  const [courses, setCourses] = useState([]);
  const [courseBatches, setCourseBatches] = useState([]);

  /* bulk placement */
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBatch, setBulkBatch] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const fireToast = (m) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    getAcademicCourses().then((c) => setCourses(Array.isArray(c) ? c : []));
  }, []);

  useEffect(() => {
    if (!courseFilter) {
      setCourseBatches([]);
      setBatchFilter("");
      return;
    }
    getCourseBatches(courseFilter).then((b) => setCourseBatches(b || []));
  }, [courseFilter]);

  const fetchStudents = async (currentPage, currentSearch) => {
    setLoading(true);
    try {
      const params = { page: currentPage, page_size: PAGE_SIZE };
      if (currentSearch) params.search = currentSearch;
      if (classFilter) params.current_class = classFilter;
      if (streamFilter) params.stream = streamFilter;
      if (boardFilter) params.board = boardFilter;
      if (activeFilter) params.is_active = activeFilter;
      // "" means the server's default (enrolled students only) — the whole
      // point of that default is that it makes the count meaningful.
      if (enrolledFilter) params.enrolled = enrolledFilter;
      if (incompleteFilter) params.incomplete = incompleteFilter;
      if (courseFilter) params.course = courseFilter;
      if (batchFilter) params.batch = batchFilter;
      if (noBatchFilter) params.no_batch = noBatchFilter;

      const data = await getStudents(params);
      setStudents(data.results || []);
      setTotalCount(data.count || 0);
      setSelected(new Set()); // selection is per result set, never carried over
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents(page, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, classFilter, streamFilter, boardFilter, activeFilter, enrolledFilter,
      incompleteFilter, courseFilter, batchFilter, noBatchFilter]);

  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchStudents(1, val);
    }, 400);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const onFilter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  /* A batch belongs to exactly one course, so bulk placement is only
     unambiguous once a course is chosen — otherwise "assign these students to
     batch X" has no defined answer for someone enrolled in two courses. */
  const bulkReady = Boolean(courseFilter);
  const placementFor = (s) =>
    (s.placements || []).find((p) => p.course_id === courseFilter) || null;

  const selectableRows = bulkReady
    ? students.filter((s) => placementFor(s))
    : [];
  const allSelected =
    selectableRows.length > 0 && selectableRows.every((s) => selected.has(s.id));

  const toggleRow = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(selectableRows.map((s) => s.id)));

  const applyBulk = async () => {
    setErr("");
    const ids = students
      .filter((s) => selected.has(s.id))
      .map((s) => placementFor(s)?.enrollment_id)
      .filter(Boolean);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const res = await bulkAssignBatch(ids, bulkBatch || null);
      const skipped = res.skipped_already_in_batch
        ? `, ${res.skipped_already_in_batch} already there`
        : "";
      fireToast(
        bulkBatch
          ? `Placed ${res.updated} student${res.updated !== 1 ? "s" : ""} in ${res.batch?.name}${skipped}`
          : `Detached ${res.updated} student${res.updated !== 1 ? "s" : ""} to course-wide`
      );
      await fetchStudents(page, search);
    } catch (e) {
      const d = e?.response?.data;
      setErr(
        Array.isArray(d) ? String(d[0])
          : d?.batch ? String(Array.isArray(d.batch) ? d.batch[0] : d.batch)
          : d?.enrollment_ids ? String(Array.isArray(d.enrollment_ids) ? d.enrollment_ids[0] : d.enrollment_ids)
          : d?.detail || "Could not place these students."
      );
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Students</h1>
      <p className="stu-subtitle">
        One row per student — several students can share one account (siblings),
        shown via the account email. Lists students <b>enrolled in a course</b>;
        set <i>Enrolment: all profiles</i> to also see Skill&nbsp;Dev-only and
        staff profiles. Pick a course to place students into batches in bulk.
      </p>

      <div className="users-controls">
        <div className="users-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name, student ID, or account email..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <select value={classFilter} onChange={onFilter(setClassFilter)}>
          <option value="">All Classes</option>
          {CLASS_OPTIONS.map((c) => (
            <option key={c} value={c}>Class {c}</option>
          ))}
        </select>

        <select value={streamFilter} onChange={onFilter(setStreamFilter)}>
          <option value="">All Streams</option>
          {STREAM_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <select value={boardFilter} onChange={onFilter(setBoardFilter)}>
          <option value="">All Boards</option>
          {BOARD_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <select value={activeFilter} onChange={onFilter(setActiveFilter)}>
          <option value="">Status: All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        <select value={enrolledFilter} onChange={onFilter(setEnrolledFilter)}>
          <option value="">Enrolment: enrolled only</option>
          <option value="all">Enrolment: all profiles</option>
          <option value="false">Enrolment: not enrolled</option>
        </select>

        <select value={incompleteFilter} onChange={onFilter(setIncompleteFilter)}>
          <option value="">Profile: All</option>
          <option value="true">Incomplete</option>
          <option value="false">Complete</option>
        </select>
      </div>

      {/* Course/batch row — the axis academy admins actually work along */}
      <div className="users-controls">
        <select
          value={courseFilter}
          onChange={(e) => { setCourseFilter(e.target.value); setBatchFilter(""); setPage(1); }}
        >
          <option value="">All Courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>

        <select
          value={batchFilter}
          onChange={onFilter(setBatchFilter)}
          disabled={!courseFilter}
          title={courseFilter ? "" : "Pick a course first — batches belong to one course"}
        >
          <option value="">{courseFilter ? "All Batches" : "All Batches (pick a course)"}</option>
          {courseBatches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.code}){b.is_full ? " — full" : ""}
            </option>
          ))}
        </select>

        <select value={noBatchFilter} onChange={onFilter(setNoBatchFilter)}>
          <option value="">Placement: All</option>
          <option value="true">Not yet placed in a batch</option>
          <option value="false">Placed in a batch</option>
        </select>
      </div>

      {err && <div className="stu-err">{err}</div>}

      {/* Bulk placement bar — only meaningful scoped to one course */}
      {bulkReady && (
        <div className="stu-bulk-bar">
          <label className="stu-bulk-count">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={selectableRows.length === 0}
            />
            {selected.size > 0
              ? `${selected.size} selected`
              : `Select students (${selectableRows.length} on this page)`}
          </label>
          <select
            className="stu-batch-select"
            value={bulkBatch}
            onChange={(e) => setBulkBatch(e.target.value)}
            disabled={selected.size === 0}
          >
            <option value="">Course-wide (no batch)</option>
            {courseBatches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code}){b.is_full ? " — full" : ""}
              </option>
            ))}
          </select>
          <button
            className="stu-btn stu-btn--primary stu-btn--sm"
            onClick={applyBulk}
            disabled={selected.size === 0 || bulkBusy}
          >
            {bulkBusy ? "Placing..." : "Assign batch"}
          </button>
          {selected.size > 0 && (
            <button
              className="stu-btn stu-btn--sm"
              onClick={() => setSelected(new Set())}
              disabled={bulkBusy}
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="dashboard-card users-table-card">
        {loading ? (
          <div className="dashboard-loading">Loading students...</div>
        ) : students.length === 0 ? (
          <div className="users-empty">No students found.</div>
        ) : (
          <>
            <div className="users-count">
              {totalCount} student{totalCount !== 1 ? "s" : ""} found
            </div>
            <table className="users-table">
              <thead>
                <tr>
                  {bulkReady && <th className="stu-check-col" />}
                  <th>Student</th>
                  <th>Student ID</th>
                  <th>Class</th>
                  <th>Board</th>
                  <th>{courseFilter ? "Batch" : "Batches"}</th>
                  <th>Account</th>
                  <th>Courses</th>
                  <th>Profile</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const placement = bulkReady ? placementFor(s) : null;
                  return (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/students/${s.id}`)}
                    className="users-row"
                  >
                    {bulkReady && (
                      <td
                        className="stu-check-col"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(s.id)}
                          onChange={() => toggleRow(s.id)}
                          disabled={!placement}
                          title={placement ? "" : "Not enrolled in the selected course"}
                        />
                      </td>
                    )}
                    <td>
                      <div className="stu-name">
                        {s.full_name || s.display_name || "—"}
                        {s.relationship === "DEPENDENT" && (
                          <span className="stu-dep-chip">Dependent</span>
                        )}
                      </div>
                    </td>
                    <td>{s.student_id || "—"}</td>
                    <td>
                      {s.current_class ? `Class ${s.current_class}` : "—"}
                      {s.stream && <span className="stu-muted"> · {s.stream}</span>}
                    </td>
                    <td>{s.board ? s.board.toUpperCase() : "—"}</td>
                    <td>
                      {/* With a course chosen, show that course's batch; with
                          no course, show every placement so a multi-course
                          student isn't misrepresented by one of them. */}
                      {(() => {
                        const list = placement
                          ? [placement]
                          : (s.placements || []);
                        if (!list.length) return <span className="stu-muted">—</span>;
                        return (
                          <div className="stu-batch-chips">
                            {list.map((p) => (
                              <span
                                key={p.enrollment_id}
                                className={`stu-batch-chip${p.batch_id ? "" : " stu-batch-chip--none"}`}
                                title={p.course_title}
                              >
                                {p.batch_id ? (p.batch_code || p.batch_name) : "no batch"}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <div className="stu-acct">{s.account?.email}</div>
                      {s.sibling_count > 0 && (
                        <div className="stu-muted">
                          +{s.sibling_count} sibling{s.sibling_count !== 1 ? "s" : ""}
                        </div>
                      )}
                    </td>
                    <td>{s.active_enrollment_count}</td>
                    <td>
                      <StatusBadge color={s.is_complete ? "green" : "yellow"}>
                        {s.is_complete ? "Complete" : "Incomplete"}
                      </StatusBadge>
                    </td>
                    <td>
                      <StatusBadge color={s.is_active ? "green" : "red"}>
                        {s.is_active ? "Active" : "Inactive"}
                      </StatusBadge>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="users-pagination">
          <button
            className="page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            &larr;
          </button>
          <span>Page {page} of {totalPages}</span>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p, idx, arr) => {
              const prev = arr[idx - 1];
              const showEllipsis = prev && p - prev > 1;
              return (
                <span key={p}>
                  {showEllipsis && <span className="page-ellipsis">...</span>}
                  <button
                    className={`page-btn ${p === page ? "active" : ""}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                </span>
              );
            })}
          <button
            className="page-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            &rarr;
          </button>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
};

export default Students;
