// Academy content, from the admin side.
//
// Two things were missing and this screen is both of them.
//
// SEEING IT. There was no admin view of what students are actually given.
// Material, assignments, quizzes and recordings live in four apps behind four
// teacher-only endpoints, so the only way to answer "what does Class 10 Physics
// have?" was to ask a teacher. The rows here are the same rows, in the same
// shape, as the teacher's own My Resources list — the same endpoint's admin
// sibling, deliberately not a second implementation, because a second copy of
// the status derivation is how one screen ends up calling a quiz live and the
// other calling it a draft.
//
// ADDING IT. An admin could create nothing: assignments have no admin API at
// all, material upload was gated on the teacher-context claim, and Django's own
// /admin/ skips the file validators, the batch guard and the student
// notification. The Add button fills that in — filing the content under a real
// teacher, which is the only kind of ownership the rest of the platform can
// read.
//
// Quizzes and recordings are listed but NOT creatable here; the empty-state
// copy says so rather than offering a button that cannot work. See
// dashboard/admin_academy.py for why each one is out.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleAlert, FileText, Filter, Mic, Paperclip, Plus, RotateCw, Search,
  UserRound,
} from "lucide-react";
import {
  getAcademyOptions, getAcademyResources,
} from "../../api/admin_academy_content";
import Toast from "../../components/Toast";
import NewAcademyContentDialog from "./NewAcademyContentDialog";
import "../../css/ContentStudio.css";
// .mod-toast lives only in Moderator.css, and every route is a lazy chunk with
// its own CSS — without this import the toast renders unstyled on a hard
// refresh of this URL.
import "../../css/Moderator.css";
import "../../css/AcademyContent.css";

const PAGE = 50;

const TYPES = [
  { key: "material", label: "Material", icon: Paperclip },
  { key: "assignment", label: "Assignments", icon: FileText },
  { key: "quiz", label: "Quizzes", icon: FileText },
  { key: "recording", label: "Recordings", icon: Mic },
];

// The four words the endpoint normalises every model's publication state into.
// The chip says what a STUDENT experiences, not what the column holds.
const STATUS_TONE = {
  live: "cs-tone-ok",
  draft: "cs-tone-muted",
  processing: "cs-tone-warn",
  error: "cs-tone-warn",
};
const STATUS_LABEL = {
  live: "Live",
  draft: "Draft",
  processing: "Processing",
  error: "Failed",
};

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

// Per-type second line. Each model carries different facts and showing the
// union as blank columns reads as missing data.
const metaLine = (row) => {
  const bits = [];
  if (row.chapter_name) bits.push(row.chapter_name);
  bits.push(row.batch_name || "every batch");
  const m = row.meta || {};
  if (row.type === "material" && m.file_count != null) {
    bits.push(`${m.file_count} file${m.file_count === 1 ? "" : "s"}`);
  }
  if (row.type === "assignment") {
    if (m.due_date) bits.push(`due ${fmtDate(m.due_date)}`);
    if (m.submission_count != null) {
      bits.push(`${m.submission_count} submitted`);
    }
  }
  if (row.type === "quiz" && m.question_count != null) {
    bits.push(`${m.question_count} question${m.question_count === 1 ? "" : "s"}`);
  }
  if (row.type === "recording" && m.duration_seconds) {
    bits.push(`${Math.round(m.duration_seconds / 60)} min`);
  }
  return bits.filter(Boolean).join(" · ");
};

const AcademyContent = () => {
  // `data === null` IS the loading state — there is no separate `loading` flag.
  //
  // Two reasons. A refetch keeps the rows it already has on screen instead of
  // replacing them with "Loading…" for 100ms, which is what makes a filter
  // change flicker. And, more importantly, nothing here early-returns for a
  // load: the Studio screens do, which unmounts an open create dialog and
  // remounts a blank one at step 1 (they had to add `load({quiet: true})` to
  // work around it). With no such flag there is nothing to work around.
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [courses, setCourses] = useState([]);
  const [tree, setTree] = useState(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [type, setType] = useState("material");
  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [status, setStatus] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  // Guards against an out-of-order response overwriting a newer one: typing in
  // the search box fires several requests and the slow one must not win.
  const requestRef = useRef(0);

  const say = useCallback((m) => {
    clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    const ticket = ++requestRef.current;
    const res = await getAcademyResources({
      type,
      limit: PAGE,
      offset,
      ...(courseId ? { course_id: courseId } : {}),
      ...(subjectId ? { subject_id: subjectId } : {}),
      ...(status ? { status } : {}),
      ...(teacherId ? { teacher_id: teacherId } : {}),
      ...(search ? { q: search } : {}),
    });
    if (ticket !== requestRef.current) return;
    // safe() turns a failed request into an empty payload and flags it. Reading
    // that flag is the difference between "an outage" and "there is nothing
    // here", which is how a dead backend once got reported as empty content.
    //
    // Deliberately not "could not reach the server": __failed covers a 403
    // too, which is what a signed-in non-staff user gets here (the sidebar
    // does no per-permission gating), and blaming the network for that sends
    // whoever reads it looking in the wrong place.
    setError(res.__failed ? "The list could not be loaded, so nothing here is current." : "");
    setData(res);
  }, [type, offset, courseId, subjectId, status, teacherId, search]);

  // The disable below is a false positive, not a waiver: nothing in `load`
  // runs before its `await` except a ref bump, so every setState in it lands
  // in a continuation, after this effect has committed. There is no
  // synchronous update to cascade. The rule inlines the call and finds the
  // setStates without accounting for the suspension point.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const opts = await getAcademyOptions();
        if (alive) setCourses(opts.courses || []);
      } catch {
        // The filter selects degrade to "All courses"; the list itself does
        // not depend on them, so this must not blank the screen.
        if (alive) setCourses([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Subjects and staffing for the chosen course, so the subject and teacher
  // filters are real rather than free text.
  useEffect(() => {
    let alive = true;
    (async () => {
      // The "no course" reset happens in here too, not in the effect body: a
      // synchronous setState during an effect's commit cascades a second
      // render, which is what react-hooks/set-state-in-effect objects to.
      if (!courseId) { if (alive) setTree(null); return; }
      try {
        const t = await getAcademyOptions(courseId);
        if (alive) setTree(t);
      } catch {
        if (alive) setTree(null);
      }
    })();
    return () => { alive = false; };
  }, [courseId]);

  // Any filter change invalidates the page window — otherwise switching type
  // while on page 3 shows an empty list that looks like "no content".
  const applyFilter = (fn) => (value) => { fn(value); setOffset(0); };

  const teachers = useMemo(() => {
    const seen = new Map();
    (tree?.subjects || []).forEach((s) =>
      (s.teachers || []).forEach((t) => seen.set(t.id, t)));
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tree]);

  const rows = data?.results || [];
  const totals = data?.totals || {};
  const count = data?.count || 0;

  return (
    <div className="dashboard-wrapper">
      <div className="cs-grouphead">
        <h1 className="dashboard-title">Academy content</h1>
        <button
          type="button"
          className="cs-btn-primary cs-btn-primary--sm"
          onClick={() => setCreating(true)}
        >
          <Plus size={13} aria-hidden="true" /> Add content
        </button>
      </div>
      <p className="cs-home__sub">
        Everything students are given, across every course — the same list each
        teacher sees for their own subjects. New material and assignments are
        filed under a teacher who actually teaches the subject, so they show up
        on that teacher’s screens and they can edit them.
      </p>

      {error && <p className="cs-error">{error}</p>}

      <div className="cs-pilltabs">
        {TYPES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`cs-pill${type === key ? " is-on" : ""}`}
            onClick={() => applyFilter(setType)(key)}
          >
            <Icon size={12} aria-hidden="true" />
            {label}
            <span className="cs-pill__count">{totals[key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="acc-filters">
        <span className="acc-filters__icon"><Filter size={13} aria-hidden="true" /></span>
        <select
          className="cs-input cs-select--inline"
          value={courseId}
          onChange={(e) => {
            applyFilter(setCourseId)(e.target.value);
            // A subject or teacher from the previous course would filter
            // everything away and read as "this course has nothing".
            setSubjectId("");
            setTeacherId("");
          }}
          aria-label="Course"
        >
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>

        <select
          className="cs-input cs-select--inline"
          value={subjectId}
          onChange={(e) => applyFilter(setSubjectId)(e.target.value)}
          disabled={!tree}
          aria-label="Subject"
        >
          <option value="">{tree ? "All subjects" : "All subjects"}</option>
          {(tree?.subjects || []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          className="cs-input cs-select--inline"
          value={teacherId}
          onChange={(e) => applyFilter(setTeacherId)(e.target.value)}
          disabled={!tree}
          aria-label="Teacher"
        >
          <option value="">Anyone’s</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select
          className="cs-input cs-select--inline"
          value={status}
          onChange={(e) => applyFilter(setStatus)(e.target.value)}
          aria-label="Status"
        >
          <option value="">Any status</option>
          <option value="live">Live to students</option>
          <option value="draft">Draft</option>
          <option value="processing">Processing</option>
          <option value="error">Failed</option>
        </select>

        <span className="acc-search">
          <Search size={13} aria-hidden="true" />
          <input
            className="cs-input"
            value={q}
            placeholder="Search titles…"
            onChange={(e) => applyFilter(setQ)(e.target.value)}
          />
        </span>

        <button
          type="button"
          className="cs-btn-ghost cs-btn-primary--sm"
          onClick={() => load()}
          aria-label="Refresh"
        >
          <RotateCw size={13} aria-hidden="true" />
        </button>
      </div>

      <section className="cs-card cs-card--flush">
        <div className="cs-grouphead">
          <span>
            {count} {count === 1 ? "item" : "items"}
            {data?.truncated ? " (capped — narrow the filters)" : ""}
          </span>
          {count > PAGE && (
            <span className="cs-grouphead__count">
              {offset + 1}–{Math.min(offset + PAGE, count)}
            </span>
          )}
        </div>

        {data === null && <p className="cs-muted acc-pad">Loading…</p>}

        {data !== null && rows.length === 0 && (
          <div className="cs-empty">
            <CircleAlert size={20} aria-hidden="true" />
            <p>
              {/* Order matters. safe() turns a failed request into an empty
                  payload, so without the `error` branch first this asserts
                  "no material anywhere yet" about content it never managed to
                  ask for — which is exactly how a dead backend once got
                  reported as empty content. */}
              {error
                ? "The list could not be loaded, so this is not what is there."
                : search || courseId || subjectId || teacherId || status
                  ? "Nothing matches those filters."
                  : `No ${TYPES.find((t) => t.key === type)?.label.toLowerCase()} anywhere yet.`}
            </p>
            {!error && (type === "material" || type === "assignment") && (
              <button
                type="button"
                className="cs-btn-primary cs-btn-primary--sm"
                onClick={() => setCreating(true)}
              >
                <Plus size={13} aria-hidden="true" /> Add the first one
              </button>
            )}
            {type === "quiz" && (
              <p className="cs-field__hint">
                Quizzes are built by teachers, question by question. Review the
                ones they submit under Academy Quizzes.
              </p>
            )}
            {type === "recording" && (
              <p className="cs-field__hint">
                Recordings come from live classes automatically — there is
                nothing to upload by hand.
              </p>
            )}
          </div>
        )}

        {rows.map((row) => (
          <div key={`${row.type}-${row.id}`} className="cs-qrow">
            <div className="cs-qrow__text">
              <span className="cs-qrow__title">{row.title}</span>
              <span className="cs-qrow__body">
                {row.course_title} · {row.subject_name}
                {metaLine(row) ? ` · ${metaLine(row)}` : ""}
              </span>
            </div>
            <span className="acc-owner">
              <UserRound size={11} aria-hidden="true" />
              {row.owner_name || "Unknown"}
            </span>
            <span className="acc-when">{fmtDate(row.created_at)}</span>
            <span className={`cs-chip ${STATUS_TONE[row.status] || "cs-tone-muted"}`}>
              {STATUS_LABEL[row.status] || row.status}
            </span>
          </div>
        ))}

        {count > PAGE && (
          <div className="acc-pager">
            <button
              type="button"
              className="cs-btn-ghost cs-btn-primary--sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
            >
              Previous
            </button>
            <button
              type="button"
              className="cs-btn-ghost cs-btn-primary--sm"
              disabled={offset + PAGE >= count}
              onClick={() => setOffset((o) => o + PAGE)}
            >
              Next
            </button>
          </div>
        )}
      </section>

      {creating && (
        <NewAcademyContentDialog
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            say(`${created.title} filed under ${created.teacherName}.`);
            // Refreshed underneath the dialog, which stays on its own
            // confirmation screen — by the time it closes the row is there.
            //
            // Only ONE of these two paths does the refetch. Changing `type`
            // re-runs the [load] effect with the new value; calling load()
            // as well would fire a second request against the OLD type,
            // which the ticket guard then throws away.
            setOffset(0);
            if (created.type === type) load();
            else setType(created.type);
          }}
        />
      )}
      <Toast message={toast} />
    </div>
  );
};

export default AcademyContent;
