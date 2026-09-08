// Teachers — directory of teaching staff across Academy + Skill tracks.
// Search + track/board/class filters → teacher cards; click opens a detail drawer.
// Data: /courses/admin/teacher-directory/ + /courses/admin/teachers/<id>/
//
// Cards and the drawer key on the COURSE, not the subject name. A subject name
// alone identifies nothing here: prod carries "Class 10" under both CBSE and
// MBSE (same for Class 8, 9, 11 Arts/Commerce/Science, 12 Arts/Commerce/Science),
// and 33 of 93 live subject names span more than one course — "Mathematics"
// spans twelve. So every subject is shown under its course, with that course's
// board, class level, category and publish status attached.
import { useEffect, useMemo, useState } from "react";
import {
  Search, X, Clock, Star, Radio, Layers, GraduationCap, AlertTriangle,
} from "lucide-react";
import { getTeacherDirectory, getTeacherDetail } from "../api/admin";
import TrackChips from "../components/TrackChips";
import "../css/NewScreens.css";

const TRACKS = [
  { key: "", label: "All tracks" },
  { key: "academy", label: "Academy" },
  { key: "skill", label: "Skill Dev" },
];

const initials = (name = "") =>
  name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase() || "?";

const rupees = (paise) => `₹${((paise || 0) / 100).toLocaleString("en-IN")}`;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// The badge that tells the CBSE "Class 10" apart from the MBSE one. Coaching
// courses have no board at all, so they say so rather than showing a blank.
const boardLabel = (g) => g.board || (g.kind === "COACHING" ? "Exam" : "No board");

// Only PUBLISHED courses are visible to students; a teacher staffed on a DRAFT
// or ARCHIVED course is looking after something nobody can see.
const STATUS_LABEL = {
  DRAFT: "Draft", ARCHIVED: "Archived", COMING_SOON: "Coming soon",
};

// "course-wide + 2026-27" — 171 of 172 staffed subjects carry both a
// course-wide and a batch row, so the two are merged into one line.
const coverage = (s) =>
  [s.course_wide ? "Course-wide" : null, ...(s.batches || [])].filter(Boolean).join(" + ") || "—";

const CourseGroup = ({ group, dense = false }) => (
  <div className={`ns-cg${dense ? " dense" : ""}`}>
    <div className="ns-cg-head">
      <span className="ns-board-badge">{boardLabel(group)}</span>
      <span className="ns-cg-title">{group.course_title}</span>
      {group.status !== "PUBLISHED" && (
        <span className="ns-cg-status">
          <AlertTriangle size={11} /> {STATUS_LABEL[group.status] || group.status}
        </span>
      )}
      <span className="ns-cg-count">{plural(group.subject_count, "subject", "subjects")}</span>
    </div>
    {!dense && (
      <>
        <div className="ns-cg-meta">
          {group.class_level != null && <span>Class {group.class_level}</span>}
          {group.stream && <span>{group.stream}</span>}
          {(group.categories || []).map((c) => (
            <span key={c} className="ns-cg-cat">{c}</span>
          ))}
        </div>
        <div className="ns-cg-subjects">
          {group.subjects.map((s) => (
            <div key={s.subject_id} className="ns-cg-subject">
              <span className="ns-cg-subject-name">{s.name}</span>
              <span className="ns-muted">
                {coverage(s)} · {s.roles.join(", ").toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      </>
    )}
  </div>
);

const TeacherDrawer = ({ userId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTeacherDetail(userId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  const courses = data?.courses || [];

  return (
    <div className="ns-drawer-overlay" onClick={onClose}>
      <div className="ns-drawer" onClick={(e) => e.stopPropagation()}>
        <button className="ns-drawer-x" onClick={onClose}><X size={18} /></button>
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : !data ? (
          <div className="dashboard-loading">Could not load teacher.</div>
        ) : (
          <>
            <div className="ns-drawer-head">
              <div className="ns-avatar lg">{initials(data.name)}</div>
              <div>
                <h2>{data.name}</h2>
                <div className="ns-muted">{data.email}</div>
                <TrackChips tracks={data.tracks} />
              </div>
            </div>

            <div className="ns-drawer-stats">
              <div><span>Weekly hours</span><b>{data.weekly_hours ?? 0}h</b></div>
              <div><span>Rating</span><b>{data.rating != null ? `★ ${data.rating}` : "—"}</b></div>
              <div><span>Class range</span><b>{data.class_range || "—"}</b></div>
              <div><span>Since</span><b>{data.since ? new Date(data.since).getFullYear() : "—"}</b></div>
            </div>

            {data.skill && (
              <div className="ns-drawer-section">
                <h3>Skill Development</h3>
                <div className="ns-kv"><span>Sessions</span><b>{data.skill.sessions_count}</b></div>
                <div className="ns-kv"><span>Earnings</span><b className="ns-teal">{rupees(data.skill.earnings)}</b></div>
                {data.skill.categories?.length > 0 && (
                  <div className="ns-tag-row">
                    {data.skill.categories.map((c) => <span key={c} className="ns-tag">{c}</span>)}
                  </div>
                )}
              </div>
            )}

            <div className="ns-drawer-section">
              <h3>
                Teaching
                {courses.length > 0 && (
                  <span className="ns-muted">
                    {" "}— {plural(data.course_count, "course", "courses")} ·{" "}
                    {plural(data.subject_count, "subject", "subjects")}
                  </span>
                )}
              </h3>
              {courses.length
                ? courses.map((g) => <CourseGroup key={g.course_id} group={g} />)
                : <p className="ns-muted">No active assignments.</p>}
            </div>

            <div className="ns-drawer-section">
              <h3>Recent activity</h3>
              {data.recent_activity?.length ? data.recent_activity.map((r, i) => (
                <div key={i} className="ns-feed-row">
                  <Radio size={14} className="ns-feed-icon live" />
                  <span className="ns-feed-text">{r.text}</span>
                  <span className="ns-muted">{r.when ? new Date(r.when).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}</span>
                </div>
              )) : <p className="ns-muted">No recent activity.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const TeacherCard = ({ t, onOpen }) => {
  const courses = t.courses || [];
  const shown = courses.slice(0, 3);
  const hidden = courses.length - shown.length;

  return (
    <button className="ns-teacher-card" onClick={onOpen}>
      <div className="ns-teacher-top">
        <div className="ns-avatar">{initials(t.name)}</div>
        <div className="ns-teacher-id">
          <div className="ns-teacher-name">{t.name}</div>
          <div className="ns-muted ns-ellipsis">{t.email}</div>
        </div>
      </div>

      <div className="ns-teacher-scope">
        <span><GraduationCap size={13} /> {t.class_range ? `Class ${t.class_range}` : "No class level"}</span>
        <span><Layers size={13} /> {plural(t.course_count || 0, "course", "courses")} · {plural(t.subject_count || 0, "subject", "subjects")}</span>
      </div>

      {courses.length ? (
        <div className="ns-teacher-courses">
          {shown.map((g) => <CourseGroup key={g.course_id} group={g} dense />)}
          {hidden > 0 && (
            <div className="ns-cg-more">+{plural(hidden, "more course", "more courses")}</div>
          )}
        </div>
      ) : (
        <div className="ns-teacher-courses empty">No subjects assigned</div>
      )}

      <TrackChips tracks={t.tracks} />
      <div className="ns-teacher-meta">
        <span><Clock size={13} /> {t.weekly_hours ?? 0}h/wk</span>
        <span><Star size={13} /> {t.rating != null ? t.rating : "—"}</span>
      </div>
    </button>
  );
};

const Teachers = () => {
  const [rows, setRows] = useState([]);
  const [options, setOptions] = useState({ boards: [], class_levels: [] });
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [track, setTrack] = useState("");
  const [board, setBoard] = useState("");
  const [level, setLevel] = useState("");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      getTeacherDirectory({
        ...(q ? { q } : {}),
        ...(track ? { track } : {}),
        ...(board ? { board } : {}),
        ...(level ? { class_level: level } : {}),
      })
        .then((d) => {
          // safe() swallows a failed request into an empty list — without this
          // an outage renders as "there are no teachers".
          setFailed(Boolean(d.__failed));
          setRows(d.data || []);
          if (d.filters) setOptions(d.filters);
        })
        .catch(() => { setFailed(true); setRows([]); })
        .finally(() => setLoading(false));
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, track, board, level]);

  const filtered = useMemo(
    () => Boolean(q || track || board || level),
    [q, track, board, level],
  );

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Teachers</h1>

      <div className="ns-controls">
        <div className="ns-search">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teachers…" />
        </div>
        <div className="ns-chips">
          {TRACKS.map((t) => (
            <button key={t.key} className={`ns-chip${track === t.key ? " active" : ""}`} onClick={() => setTrack(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {(options.boards.length > 0 || options.class_levels.length > 0) && (
        <div className="ns-controls ns-facets">
          <div className="ns-chips">
            <span className="ns-facet-label">Board</span>
            <button className={`ns-chip sm${board === "" ? " active" : ""}`} onClick={() => setBoard("")}>All</button>
            {options.boards.map((b) => (
              <button key={b.slug} className={`ns-chip sm${board === b.slug ? " active" : ""}`} onClick={() => setBoard(b.slug)}>
                {b.name}
              </button>
            ))}
          </div>
          <div className="ns-chips">
            <span className="ns-facet-label">Class</span>
            <button className={`ns-chip sm${level === "" ? " active" : ""}`} onClick={() => setLevel("")}>All</button>
            {options.class_levels.map((l) => (
              <button key={l} className={`ns-chip sm${level === String(l) ? " active" : ""}`} onClick={() => setLevel(String(l))}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="dashboard-loading">Loading…</div>
      ) : failed ? (
        <div className="dashboard-card ns-empty">
          Could not load the teacher directory. This is a failed request, not an empty list — retry in a moment.
        </div>
      ) : rows.length === 0 ? (
        <div className="dashboard-card ns-empty">
          {filtered ? "No teachers match these filters." : "No teachers found."}
        </div>
      ) : (
        <div className="ns-teacher-grid">
          {rows.map((t) => (
            <TeacherCard key={t.user_id} t={t} onOpen={() => setOpenId(t.user_id)} />
          ))}
        </div>
      )}

      {openId && <TeacherDrawer userId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
};

export default Teachers;
