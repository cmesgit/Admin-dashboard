// src/pages/SkillCourses.jsx  (NEW)
//
// Admin review of submitted Skill-Dev courses.
//   GET  /skill/admin/courses/?status=submitted   → queue
//   POST /skill/admin/courses/<id>/review/         → { action: approve|reject, reason? }
//
// Approving flips the course to live in the marketplace; rejecting stores a reason.

import { useEffect, useState } from "react";
import { getSkillCourses, reviewSkillCourse } from "../api/admin";

const formatRupees = (paise) => (paise ? `₹${(paise / 100).toLocaleString("en-IN")}` : "Free");

const SkillCourses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("submitted");
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true); setErr("");
    try { setCourses(await getSkillCourses({ status })); }
    catch { setErr("Failed to load courses."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [status]);

  const act = async (course, action) => {
    let reason = "";
    if (action === "reject") {
      reason = window.prompt("Reason for rejection (shown to the teacher):", "") || "";
    }
    setBusyId(course.id); setErr(""); setMsg("");
    try {
      await reviewSkillCourse(course.id, action, reason);
      setMsg(`"${course.title}" ${action}d.`);
      await load();
    } catch (e) {
      const d = e?.response?.data;
      setErr(typeof d === "object" ? Object.values(d).flat().join(" ") : "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Skill Courses</h1>

      <div className="payments-controls" style={{ marginBottom: 16 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="submitted">Submitted (pending review)</option>
          <option value="approved">Approved / live</option>
          <option value="rejected">Rejected</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {msg && <div style={{ color: "#16a34a", marginBottom: 10 }}>{msg}</div>}
      {err && <div style={{ color: "#dc2626", marginBottom: 10 }}>{err}</div>}

      <div className="dashboard-card payments-table-card">
        <div className="payments-count">{courses.length} course{courses.length !== 1 ? "s" : ""}</div>
        {loading ? (
          <div className="dashboard-loading">Loading...</div>
        ) : courses.length === 0 ? (
          <div className="dashboard-loading">No courses with status "{status}".</div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th>Title</th><th>Teacher</th><th>Level</th>
                <th>Price</th><th>Sections</th><th>Lectures</th><th></th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.title}</div>
                    {c.subtitle && <div style={{ color: "#888", fontSize: 13 }}>{c.subtitle}</div>}
                  </td>
                  <td>{c.teacher_name}</td>
                  <td style={{ textTransform: "capitalize" }}>{c.level}</td>
                  <td>{formatRupees(c.price)}</td>
                  <td>{c.section_count}</td>
                  <td>{c.lecture_count}</td>
                  <td>
                    {status === "submitted" ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => act(c, "approve")} disabled={busyId === c.id}
                          style={{ padding: "6px 12px", cursor: "pointer", color: "#16a34a" }}>
                          Approve
                        </button>
                        <button onClick={() => act(c, "reject")} disabled={busyId === c.id}
                          style={{ padding: "6px 12px", cursor: "pointer", color: "#dc2626" }}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: "#888", textTransform: "capitalize" }}>{c.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SkillCourses;
