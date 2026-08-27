// PLACEMENT: src/pages/CounselorApprovals.jsx   (NEW FILE — admin app)
//
// Counsellor application queue — mirrors Approvals.jsx (teacher approvals) in
// style. It used to also cite SkillApprovals.jsx; that screen was retired
// because the Skill track doesn't gate on admin review.
//   GET  /counseling/admin/applications/?status=
//   POST /counseling/admin/applications/<id>/action/  {action, note}
//     action: approve | reject | suspend | relist
// Approve grants the COUNSELOR role server-side (_grant_counselor_role) —
// nothing else needed here for that to take effect.

import { useEffect, useState } from "react";
import { actOnCounselorApplication, getCounselorApplications } from "../api/admin_counseling";

const TABS = [
  ["pending", "Pending"], ["approved", "Approved"],
  ["rejected", "Rejected"], ["suspended", "Suspended"],
];

const STATUS_STYLE = {
  pending:   { color: "#b45309", background: "#fef3c7" },
  approved:  { color: "#047857", background: "#d1fae5" },
  rejected:  { color: "#b91c1c", background: "#fee2e2" },
  suspended: { color: "#b91c1c", background: "#fee2e2" },
};

const ACTIONS_FOR = {
  pending:   [["approve", "Approve"], ["reject", "Reject"]],
  approved:  [["suspend", "Suspend"]],
  rejected:  [["approve", "Approve"]],
  suspended: [["relist", "Relist"]],
};

const CounselorApprovals = ({ embedded = false }) => {
  const [tab, setTab] = useState("pending");
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0 });
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);   // {row, action}
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = async (status) => {
    setLoading(true);
    try {
      const d = await getCounselorApplications(status);
      setRows(d.results || []);
      setStats(d.stats || { pending: 0, approved: 0 });
    } catch { setErr("Failed to load applications."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(tab); }, [tab]);

  const openAction = (row, action) => { setActive({ row, action }); setNote(""); setErr(""); setMsg(""); };

  const submit = async () => {
    setSaving(true); setErr(""); setMsg("");
    try {
      await actOnCounselorApplication(active.row.id, active.action, note);
      setMsg(`Application ${active.action}d.`);
      setActive(null);
      await load(tab);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Action failed.");
    } finally { setSaving(false); }
  };

  return (
    <div className={embedded ? "" : "dashboard-wrapper"}>
      {!embedded && <h1 className="dashboard-title">Counsellor Approvals</h1>}

      <div className="dashboard-stats-row" style={{ display: "flex", gap: 14, marginBottom: 16 }}>
        <StatCard label="Pending review" value={stats.pending} color="#b45309" />
        <StatCard label="Approved & listed" value={stats.approved} color="#047857" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              padding: "7px 16px", borderRadius: 100, cursor: "pointer", fontSize: 13, fontWeight: 600,
              border: tab === k ? "1.5px solid #4f6df5" : "1.5px solid #e5e7eb",
              background: tab === k ? "#eef1ff" : "#fff", color: tab === k ? "#4f6df5" : "#555",
            }}>
            {label}
          </button>
        ))}
      </div>

      {msg && <div style={{ color: "#16a34a", marginBottom: 10, fontWeight: 600 }}>{msg}</div>}
      {err && !active && <div style={{ color: "#dc2626", marginBottom: 10, fontWeight: 600 }}>{err}</div>}

      <div className={embedded ? "" : "dashboard-card payments-table-card"}>
        <div className="payments-count">{rows.length} application{rows.length !== 1 ? "s" : ""}</div>
        {loading ? (
          <div className="dashboard-loading">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No {tab} applications.</div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th>Counsellor</th><th>Email</th><th>Specializations</th>
                <th>Experience</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.display_name}</td>
                  <td>{r.email}</td>
                  <td>{(r.specializations || []).map((s) => s.name).join(", ") || "—"}</td>
                  <td>{r.years_experience || "—"}</td>
                  <td>
                    <span style={{
                      ...STATUS_STYLE[r.status], padding: "3px 10px", borderRadius: 100,
                      fontSize: 11.5, fontWeight: 700, textTransform: "capitalize",
                    }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    {(ACTIONS_FOR[r.status] || []).map(([action, label]) => (
                      <button key={action} onClick={() => openAction(r, action)}
                        style={{ padding: "6px 12px", cursor: "pointer" }}>
                        {label}
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail / action modal */}
      {active && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
        }} onClick={() => setActive(null)}>
          <div className="dashboard-card" style={{ width: 480, padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, textTransform: "capitalize" }}>{active.action} — {active.row.display_name}</h2>
            <p style={{ color: "#666", marginTop: -8 }}>{active.row.email}</p>

            {active.row.bio && (
              <>
                <label style={{ display: "block", fontWeight: 600, margin: "12px 0 4px" }}>Bio</label>
                <p style={{ margin: 0, fontSize: 13.5, color: "#334155", whiteSpace: "pre-wrap" }}>{active.row.bio}</p>
              </>
            )}
            {active.row.qualifications && (
              <>
                <label style={{ display: "block", fontWeight: 600, margin: "12px 0 4px" }}>Qualifications</label>
                <p style={{ margin: 0, fontSize: 13.5, color: "#334155" }}>{active.row.qualifications}</p>
              </>
            )}
            {active.row.approach && (
              <>
                <label style={{ display: "block", fontWeight: 600, margin: "12px 0 4px" }}>Approach</label>
                <p style={{ margin: 0, fontSize: 13.5, color: "#334155", whiteSpace: "pre-wrap" }}>{active.row.approach}</p>
              </>
            )}
            <label style={{ display: "block", fontWeight: 600, margin: "12px 0 4px" }}>Languages</label>
            <p style={{ margin: 0, fontSize: 13.5, color: "#334155" }}>{active.row.languages || "—"}</p>

            <label style={{ display: "block", fontWeight: 600, margin: "14px 0 6px" }}>
              Note {active.action === "reject" ? "(shown to the applicant)" : "(internal, optional)"}
            </label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)}
              rows={3} style={{ width: "100%", padding: 8, boxSizing: "border-box" }} />

            {active.action === "approve" && (
              <p style={{ fontSize: 12, color: "#047857", marginTop: 8 }}>
                Approving grants the Counsellor role, lists them in the directory,
                and notifies them by bell and email.
              </p>
            )}
            {active.action === "suspend" && (
              <p style={{ fontSize: 12, color: "#b91c1c", marginTop: 8 }}>
                Suspending hides them from the directory and blocks their
                counsellor console immediately. Existing appointments are unaffected.
              </p>
            )}

            {err && <div style={{ color: "#dc2626", margin: "10px 0" }}>{err}</div>}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={submit} disabled={saving}
                style={{ padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}>
                {saving ? "Submitting..." : `Confirm ${active.action}`}
              </button>
              <button onClick={() => setActive(null)} style={{ padding: "10px 18px", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, color }) => (
  <div className="dashboard-card" style={{ flex: 1, padding: "14px 18px" }}>
    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{label}</div>
  </div>
);

export default CounselorApprovals;
