import { mockCourses } from "../data/mockData";
import "../css/Courses.css";

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const Courses = () => {
  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Course Management</h1>

      <div className="dashboard-card courses-table-card">
        <div className="courses-count">{mockCourses.length} courses</div>
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
            {mockCourses.map((c) => (
              <tr key={c.id}>
                <td className="courses-title">{c.title}</td>
                <td className="courses-desc">{c.description}</td>
                <td>{c.enrollment_count}</td>
                <td>{formatDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Courses;
