// src/pages/SkillApprovals.jsx  (NEW)
//
// Admin page for the Skill-Dev guest-expert screening pipeline.
//   GET  /skill/admin/interview-queue/            → applications to review
//   POST /skill/admin/interviews/<appId>/evaluation/  → submit decision
//
// Submitting an "approve" evaluation auto-creates the listed ExpertProfile
// (backend _approve_expert), so the expert appears in the marketplace.
//
// Matches the existing admin style (dashboard-wrapper / dashboard-card / tables).

import { useEffect, useState } from "react";
import { getSkillApplications, submitEvaluation } from "../api/admin";

const DECISIONS = [
  { value: "approve", label: "Approve" },
  { value: "hold",    label: "Hold" },
  { value: "reject",  label: "Reject" },
];
const TIERS = [
  { value: "",         label: "— tier —" },
  { value: "standard", label: "Standard" },
  { value: "senior",   label: "Senior" },
  { value: "expert",   label: "Expert" },
];

const SkillApprovals = () => {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);   // application being evaluated
  const [decision, setDecision] = useState("approve");
  const [tier, setTier] = useState("standard");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    try { setApps(await getSkillApplications()); }
    catch { setErr("Failed to load applications."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openEval = (app) => {
    setActive(app); setDecision("approve"); setTier("standard");
    setFeedback(""); setMsg(""); setErr("");
  };

  const submit = async () => {
    setSaving(true); setMsg(""); setErr("");
    try {
      await submitEvaluation(active.id, {
        decision,
        tier: decision === "approve" ? tier : "",
        feedback,
        scores: {},  // rubric scores optional; backend accepts empty dict
      });
      setMsg(`Application ${decision}d.`);
      setActive(null);
      await load();
    } catch (e) {
      const d = e?.response?.data;
      setErr(typeof d === "object" ? Object.values(d).flat().join(" ") : "Submit failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Skill Expert Approvals</h1>

      <div className="dashboard-card payments-table-card">
        <div className="payments-count">{apps.length} application{apps.length !== 1 ? "s" : ""}</div>
        {loading ? (
          <div className="dashboard-loading">Loading...</div>
        ) : apps.length === 0 ? (
          <div className="dashboard-loading">No applications in the queue.</div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th>Candidate</th><th>Skill</th><th>Category</th>
                <th>Experience</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.skill}</td>
                  <td>{a.cat}</td>
                  <td>{a.exp}</td>
                  <td style={{ textTransform: "capitalize" }}>{a.status}</td>
                  <td>
                    <button onClick={() => openEval(a)}
                      style={{ padding: "6px 12px", cursor: "pointer" }}>
                      Evaluate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Evaluation modal */}
      {active && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
        }} onClick={() => setActive(null)}>
          <div className="dashboard-card" style={{ width: 460, padding: 24 }}
               onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Evaluate — {active.name}</h2>
            <p style={{ color: "#666", marginTop: -8 }}>{active.skill} · {active.cat}</p>

            <label style={{ display: "block", fontWeight: 600, margin: "12px 0 6px" }}>Decision</label>
            <select value={decision} onChange={(e) => setDecision(e.target.value)}
              style={{ width: "100%", padding: 8 }}>
              {DECISIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>

            {decision === "approve" && (
              <>
                <label style={{ display: "block", fontWeight: 600, margin: "12px 0 6px" }}>Tier</label>
                <select value={tier} onChange={(e) => setTier(e.target.value)}
                  style={{ width: "100%", padding: 8 }}>
                  {TIERS.filter((t) => t.value).map((t) =>
                    <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </>
            )}

            <label style={{ display: "block", fontWeight: 600, margin: "12px 0 6px" }}>Feedback</label>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)}
              rows={3} style={{ width: "100%", padding: 8 }} />

            {err && <div style={{ color: "#dc2626", margin: "10px 0" }}>{err}</div>}
            {msg && <div style={{ color: "#16a34a", margin: "10px 0" }}>{msg}</div>}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={submit} disabled={saving}
                style={{ padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}>
                {saving ? "Submitting..." : "Submit evaluation"}
              </button>
              <button onClick={() => setActive(null)}
                style={{ padding: "10px 18px", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillApprovals;
