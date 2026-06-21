import { useEffect, useState } from "react";
import {
  getAcademicCourses, getSkillCategories, getSkillExperts, getSkillApplications,
} from "../api/admin";
import StatusBadge from "../components/StatusBadge";
import "../css/Courses.css";

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const rupees = (paise) =>
  paise === null || paise === undefined ? "—" : `₹${(paise / 100).toLocaleString("en-IN")}`;

const TABS = [
  { key: "academy", label: "Academy" },
  { key: "skill", label: "Skill Dev" },
];

/* normalize an academic course payload defensively */
const normCourse = (c) => ({
  id: c.id,
  title: c.title || c.name || "Untitled",
  price: c.price,
  active: c.is_active ?? c.active ?? true,
  enrollments: c.enrollment_count ?? c.enrollments ?? null,
  created_at: c.created_at,
});

const Courses = () => {
  const [tab, setTab] = useState("academy");

  const [academic, setAcademic] = useState([]);
  const [categories, setCategories] = useState([]);
  const [experts, setExperts] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getAcademicCourses(),
      getSkillCategories(),
      getSkillExperts(),
      getSkillApplications(),
    ])
      .then(([ac, cats, exp, apps]) => {
        if (cancelled) return;
        const acList = Array.isArray(ac) ? ac : ac.results || [];
        setAcademic(acList.map(normCourse));
        setCategories(Array.isArray(cats) ? cats : cats.results || []);
        setExperts(Array.isArray(exp) ? exp : exp.results || []);
        setApplications(Array.isArray(apps) ? apps : apps.results || []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

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

      {/* ── ACADEMY ── */}
      {tab === "academy" && (
        <div className="dashboard-card courses-table-card">
          <div className="courses-count">
            {academic.length} academic course{academic.length !== 1 ? "s" : ""}
          </div>
          {loading ? (
            <div className="dashboard-loading">Loading...</div>
          ) : academic.length === 0 ? (
            <div className="dashboard-loading">
              No academic courses returned. (Courses are managed in the courses service;
              once its admin endpoint is live they'll list here.)
            </div>
          ) : (
            <table className="courses-table">
              <thead>
                <tr><th>Title</th><th>Fee</th><th>Enrollments</th><th>Status</th><th>Created</th></tr>
              </thead>
              <tbody>
                {academic.map((c) => (
                  <tr key={c.id}>
                    <td className="courses-title">{c.title}</td>
                    <td>{rupees(c.price)}</td>
                    <td>{c.enrollments ?? "—"}</td>
                    <td>
                      <StatusBadge color={c.active ? "green" : "gray"}>
                        {c.active ? "Active" : "Inactive"}
                      </StatusBadge>
                    </td>
                    <td>{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── SKILL DEV ── */}
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
    </div>
  );
};

export default Courses;
