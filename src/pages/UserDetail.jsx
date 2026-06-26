import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getUser, updateUser, getUserSkillProfile, resendVerification } from "../api/admin";
import { HOME_URL } from "../config/urls";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";
import "../css/UserDetail.css";

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [skill, setSkill] = useState(null);
  const [resendMsg, setResendMsg] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    setLoading(true);
    getUser(id)
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    getUserSkillProfile(id).then(setSkill).catch(() => setSkill(null));
  }, [id]);

  const doResend = async () => {
    if (!user?.email) return;
    setResending(true); setResendMsg("");
    try {
      await resendVerification(user.email);
      setResendMsg("✓ Verification email sent.");
    } catch (e) {
      setResendMsg(e?.response?.data?.detail || e?.response?.data?.email || "Could not send.");
    } finally {
      setResending(false);
    }
  };

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
            {!user.is_verified && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, paddingTop: 10, borderTop: "1px solid #eef0f3" }}>
                <div style={{ flex: 1, fontSize: 13, color: "#6b7280" }}>
                  Email not verified — resend the verification link.
                </div>
                <button className="ud-toggle-btn" onClick={doResend} disabled={resending}>
                  {resending ? "Sending…" : "Resend verification"}
                </button>
              </div>
            )}
            {resendMsg && (
              <div style={{ marginTop: 8, fontSize: 13, color: resendMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>
                {resendMsg}
              </div>
            )}
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

          {/* Skill Dev — expert status */}
          <div className="dashboard-card">
            <h3>Skill Dev</h3>
            {skill?.is_expert && skill.expert ? (
              <div>
                <div className="ud-field">
                  <label>Expert</label>
                  <span>
                    {skill.expert.name}{" "}
                    {skill.expert.featured
                      ? <StatusBadge color="purple">Featured</StatusBadge>
                      : skill.expert.advertised
                        ? <StatusBadge color="green">Advertised</StatusBadge>
                        : skill.expert.listed
                          ? <StatusBadge color="gray">Listed</StatusBadge>
                          : <StatusBadge color="red">Unlisted</StatusBadge>}
                  </span>
                </div>
                <div className="ud-field"><label>Rating</label><span>{skill.expert.rating ? Number(skill.expert.rating).toFixed(1) : "—"}</span></div>
                <div className="ud-field"><label>Sessions</label><span>{skill.expert.sessions ?? 0}</span></div>
                <div className="ud-field"><label>Reach</label><span>{(skill.expert.reach ?? 0).toLocaleString("en-IN")}</span></div>
                <a href={`${HOME_URL}/experts/${skill.expert.id}`} target="_blank" rel="noreferrer"
                  style={{ fontWeight: 600 }}>View public profile →</a>
              </div>
            ) : (
              <p className="ud-empty">Not a Skill-Dev expert.</p>
            )}
          </div>

          {/* Skill sessions (as learner) */}
          <div className="dashboard-card">
            <h3>Skill sessions</h3>
            {skill?.learner_sessions?.length ? (
              <table className="ud-enroll-table">
                <thead>
                  <tr><th>Expert</th><th>Status</th><th>Booked</th></tr>
                </thead>
                <tbody>
                  {skill.learner_sessions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.expert}</td>
                      <td>
                        <StatusBadge color={
                          s.status === "completed" ? "green"
                          : s.status === "confirmed" ? "blue"
                          : s.status === "cancelled" ? "red" : "gray"}>
                          {s.status === "requested" ? "pending" : s.status}
                        </StatusBadge>
                      </td>
                      <td>{formatDate(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="ud-empty">No skill sessions booked.</p>
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
