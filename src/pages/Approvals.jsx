import { useEffect, useMemo, useState } from "react";
import { getApprovals, actOnApproval, getUsers } from "../api/admin";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";
import SkillApprovals from "./SkillApprovals";
import "../css/Approvals.css";

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const TABS = [
  { key: "faculty", label: "Faculty" },
  { key: "teacher", label: "Teacher" },
  { key: "student", label: "Student" },
];

/* ── Faculty applicant detail modal (documents + unique ID) ── */
function FacultyDetail({ item, onClose, onApprove, onReject }) {
  const docs = item.documents || {};
  const docRows = [
    ["Signed agreement", docs.signed_agreement],
    ["ID proof (front)", docs.id_proof_front],
    ["ID proof (back)", docs.id_proof_back],
    ["Qualification certificate", docs.qualification_certificate],
  ];
  return (
    <div className="ap-modal-overlay" onClick={onClose}>
      <div className="ap-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <h2 style={{ marginTop: 0 }}>{item.user_name}</h2>
        <div style={{ color: "#6b7280", marginTop: -6 }}>{item.user_email}</div>

        <div className="ap-detail-grid">
          <div><span>Track</span><b>{item.track_label || "Faculty"}</b></div>
          <div><span>Highest degree</span><b>{item.highest_degree || "—"}</b></div>
          <div><span>Field of study</span><b>{item.field_of_study || "—"}</b></div>
          <div><span>Year completed</span><b>{item.year_of_completion || "—"}</b></div>
          <div><span>Subjects</span><b>{item.subjects || "—"}</b></div>
          <div><span>Experience</span><b>{item.experience_range || "—"}</b></div>
          <div><span>Unique ID number</span><b>{item.id_number || "—"}</b></div>
          <div><span>Applied</span><b>{formatDate(item.requested_at)}</b></div>
        </div>

        <h4 style={{ margin: "18px 0 8px" }}>Documents</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {docRows.map(([label, url]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                     padding: "8px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #eef0f3" }}>
              <span>{label}</span>
              {url
                ? <a href={url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>View</a>
                : <span style={{ color: "#9ca3af", fontSize: 13 }}>Not uploaded</span>}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button className="approve-btn" onClick={() => onApprove(item)}>Approve</button>
          <button className="reject-btn" onClick={() => onReject(item)}>Reject</button>
          <button onClick={onClose} style={{ marginLeft: "auto", padding: "8px 16px", cursor: "pointer" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ── Faculty approvals tab ── */
function FacultyTab({ search }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);   // item pending rejection
  const [reason, setReason] = useState("");

  const load = () => {
    setLoading(true);
    getApprovals()
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const view = useMemo(() => {
    const n = search.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((r) => `${r.user_name} ${r.user_email}`.toLowerCase().includes(n));
  }, [rows, search]);

  const act = (item, action) => {
    if (action === "reject") {
      setDetail(null);
      setReason("");
      setRejectFor(item);
      return;
    }
    setConfirm({
      title: "Approve faculty applicant?",
      message: `Approve the faculty application from ${item.user_name}?`,
      onConfirm: async () => {
        try {
          await actOnApproval(item.id, "approve");
          setRows((prev) => prev.filter((a) => a.id !== item.id));
          setDetail(null);
        } finally { setConfirm(null); }
      },
    });
  };

  const submitReject = async () => {
    if (!rejectFor) return;
    const id = rejectFor.id;
    try {
      await actOnApproval(id, "reject", reason.trim());
      setRows((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setRejectFor(null);
      setReason("");
    }
  };

  if (loading) return <div className="approvals-empty">Loading...</div>;
  if (view.length === 0) return <div className="approvals-empty">No pending faculty applications.</div>;

  return (
    <>
      <table className="approvals-table">
        <thead>
          <tr><th>Applicant</th><th>Subjects</th><th>Experience</th><th>Applied</th><th>Documents</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {view.map((a) => {
            const d = a.documents || {};
            const docCount = [d.signed_agreement, d.id_proof_front, d.qualification_certificate].filter(Boolean).length;
            return (
              <tr key={a.id}>
                <td className="approvals-name">
                  {a.user_name}
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{a.user_email}</div>
                </td>
                <td>{a.subjects || "—"}</td>
                <td>{a.experience_range || "—"}</td>
                <td>{formatDate(a.requested_at)}</td>
                <td>
                  {d.signed_agreement
                    ? <a href={d.signed_agreement} target="_blank" rel="noreferrer">Agreement</a>
                    : <span style={{ color: "#9ca3af" }}>—</span>}
                  <span style={{ color: "#9ca3af", fontSize: 12 }}> · {docCount} docs</span>
                </td>
                <td className="approvals-actions">
                  <button onClick={() => setDetail(a)} style={{ padding: "6px 12px", cursor: "pointer" }}>View</button>
                  <button className="approve-btn" onClick={() => act(a, "approve")}>Approve</button>
                  <button className="reject-btn" onClick={() => act(a, "reject")}>Reject</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {detail && (
        <FacultyDetail
          item={detail}
          onClose={() => setDetail(null)}
          onApprove={(it) => act(it, "approve")}
          onReject={(it) => act(it, "reject")}
        />
      )}
      {confirm && (
        <ConfirmModal title={confirm.title} message={confirm.message}
          onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />
      )}

      {rejectFor && (
        <div className="ap-modal-overlay" onClick={() => setRejectFor(null)}>
          <div className="ap-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h2 style={{ marginTop: 0 }}>Reject {rejectFor.user_name}?</h2>
            <p style={{ color: "#6b7280", marginTop: -6 }}>
              The applicant will see this reason and can re-apply.
            </p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
              placeholder="Reason for rejection (shared with the applicant)…"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #d7dbe0", borderRadius: 8, fontFamily: "inherit", resize: "vertical" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => setRejectFor(null)} style={{ padding: "8px 16px", cursor: "pointer" }}>Cancel</button>
              <button className="reject-btn" onClick={submitReject}>Reject application</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Student tab (read-only — students self-enroll free, no approval) ── */
function StudentTab({ search }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getUsers({ role: "STUDENT", search: search || undefined })
      .then((d) => setRows(Array.isArray(d) ? d : d?.results || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [search]);

  if (loading) return <div className="approvals-empty">Loading...</div>;
  if (rows.length === 0) return <div className="approvals-empty">No students found.</div>;

  return (
    <>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
        Students self-enroll for free — no approval needed. This list is read-only.
      </div>
      <table className="approvals-table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Joined</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td className="approvals-name">{u.profile?.full_name || "—"}</td>
              <td>{u.email}</td>
              <td>{formatDate(u.date_joined)}</td>
              <td><StatusBadge color={u.is_active ? "green" : "red"}>{u.is_active ? "Active" : "Inactive"}</StatusBadge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

const Approvals = () => {
  const [tab, setTab] = useState("faculty");
  const [search, setSearch] = useState("");

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Approvals</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setSearch(""); setTab(t.key); }}
            style={{
              padding: "8px 18px", borderRadius: 100, cursor: "pointer", fontWeight: 600, fontSize: 14,
              border: tab === t.key ? "2px solid #4f6df5" : "1px solid #d7dbe0",
              background: tab === t.key ? "#4f6df515" : "#fff",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="dashboard-card approvals-table-card">
        {tab !== "teacher" && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "student" ? "Search by name or email…" : "Search by name or email…"}
            style={{ width: "100%", maxWidth: 360, padding: "8px 12px", border: "1px solid #d7dbe0", borderRadius: 8, marginBottom: 14 }}
          />
        )}
        {tab === "faculty" && <FacultyTab search={search} />}
        {tab === "teacher" && <SkillApprovals embedded />}
        {tab === "student" && <StudentTab search={search} />}
      </div>
    </div>
  );
};

export default Approvals;
