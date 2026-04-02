import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getUser, updateUser } from "../api/admin";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";
import "../css/UserDetail.css";

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    setLoading(true);
    getUser(id)
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleToggle = (field) => {
    const newVal = !user[field];
    const label = field === "is_active" ? "active" : "verified";
    setConfirm({
      title: `${newVal ? "Enable" : "Disable"} ${label}?`,
      message: `Are you sure you want to mark this user as ${newVal ? label : `not ${label}`}?`,
      onConfirm: async () => {
        const updated = await updateUser(id, { [field]: newVal });
        setUser(updated);
        setConfirm(null);
      },
    });
  };

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  if (loading) {
    return (
      <div className="dashboard-wrapper">
        <div className="dashboard-loading">Loading user...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="dashboard-wrapper">
        <div className="dashboard-loading">User not found.</div>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      <button className="ud-back" onClick={() => navigate("/users")}>
        <ArrowLeft size={18} /> Back to Users
      </button>

      <div className="ud-grid">
        {/* Profile Card */}
        <div className="dashboard-card ud-profile">
          <h3>Profile</h3>
          <div className="ud-field">
            <label>Email</label>
            <span>{user.email}</span>
          </div>
          <div className="ud-field">
            <label>Username</label>
            <span>{user.username}</span>
          </div>
          <div className="ud-field">
            <label>Full Name</label>
            <span>{user.profile?.full_name || "—"}</span>
          </div>
          <div className="ud-field">
            <label>Phone</label>
            <span>{user.profile?.phone || "—"}</span>
          </div>
          <div className="ud-field">
            <label>Student ID</label>
            <span>{user.profile?.student_id || "—"}</span>
          </div>
          <div className="ud-field">
            <label>Joined</label>
            <span>{formatDate(user.date_joined)}</span>
          </div>
          <div className="ud-field">
            <label>Last Login</label>
            <span>{formatDate(user.last_login)}</span>
          </div>
          <div className="ud-field">
            <label>Roles</label>
            <span>
              {user.roles?.length
                ? user.roles.map((r) => (
                    <StatusBadge key={r} color="gray">{r}</StatusBadge>
                  ))
                : "None"}
            </span>
          </div>
        </div>

        {/* Actions Card */}
        <div className="ud-actions-col">
          <div className="dashboard-card">
            <h3>Account Status</h3>
            <div className="ud-toggle-row">
              <div>
                <strong>Active</strong>
                <p>Controls whether user can log in</p>
              </div>
              <StatusBadge color={user.is_active ? "green" : "red"}>
                {user.is_active ? "Active" : "Inactive"}
              </StatusBadge>
              <button
                className="ud-toggle-btn"
                onClick={() => handleToggle("is_active")}
              >
                {user.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>
            <div className="ud-toggle-row">
              <div>
                <strong>Email Verified</strong>
                <p>Whether the user's email is verified</p>
              </div>
              <StatusBadge color={user.is_verified ? "green" : "red"}>
                {user.is_verified ? "Verified" : "Unverified"}
              </StatusBadge>
              <button
                className="ud-toggle-btn"
                onClick={() => handleToggle("is_verified")}
              >
                {user.is_verified ? "Unverify" : "Verify"}
              </button>
            </div>
          </div>

          {/* Enrollments */}
          <div className="dashboard-card">
            <h3>Enrollments</h3>
            {user.enrollments?.length ? (
              <table className="ud-enroll-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Batch</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {user.enrollments.map((e) => (
                    <tr key={e.id}>
                      <td>{e.course_title}</td>
                      <td>{e.batch_code || "—"}</td>
                      <td>
                        <StatusBadge color={e.status === "ACTIVE" ? "green" : "red"}>
                          {e.status}
                        </StatusBadge>
                      </td>
                      <td>{formatDate(e.enrolled_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="ud-empty">No enrollments.</p>
            )}
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
    </div>
  );
};

export default UserDetail;
