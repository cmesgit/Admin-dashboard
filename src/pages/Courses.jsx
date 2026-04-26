import { useEffect, useState } from "react";
import { getCourses } from "../api/admin";
import "../css/Courses.css";

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCourses()
      .then((data) => setCourses(Array.isArray(data) ? data : data.results || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Course Management</h1>

      <div className="dashboard-card courses-table-card">
        <div className="courses-count">
          {courses.length} course{courses.length !== 1 ? "s" : ""}
        </div>
        {loading ? (
          <div className="dashboard-loading">Loading...</div>
        ) : courses.length === 0 ? (
          <div className="dashboard-loading">No courses found.</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Description</th>
                <th>Enrollments</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id}>
                  <td className="courses-title">{c.title}</td>
                  <td className="courses-desc">{c.description}</td>
                  <td>{c.enrollment_count}</td>
                  <td>{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Courses;
