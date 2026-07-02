// src/pages/SkillExperts.jsx
//
// Admin roster of Skill-Dev experts who've joined the program (incl. suspended).
//   GET  /skill/admin/experts/                 → roster (with subscription + suspend state)
//   GET  /skill/admin/experts/<id>/            → detail for the profile modal
//   POST /skill/admin/experts/<id>/suspend/    → { action: suspend | unsuspend }
//
// Suspend = delist from the marketplace + block new bookings + pause the ad
// subscription (all three). Suspended experts remain here so they can be lifted.

import { useEffect, useMemo, useState } from "react";
import { getAdminExperts, getAdminExpert, suspendExpert } from "../api/admin";
import { HOME_URL } from "../config/urls";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";
import "../css/Approvals.css"; // reuse .ap-modal / .ap-detail-grid

const pill = (color) => ({
  fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 100,
  background: `${color}22`, color,
});

function ExpertModal({ id, onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    getAdminExpert(id).then(setData).catch(() => setErr("Failed to load."));
  }, [id]);
  return (
    <div className="ap-modal-overlay" onClick={onClose}>
      <div className="ap-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        {err ? <div style={{ color: "#dc2626" }}>{err}</div> : !data ? (
          <div>Loading…</div>
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>{data.name}</h2>
            <div style={{ color: "#6b7280", marginTop: -6 }}>{data.email} · {data.category || "—"}</div>
            {data.is_suspended && <div style={{ marginTop: 8 }}><StatusBadge color="red">Suspended</StatusBadge></div>}
            <div className="ap-detail-grid">
              <div><span>Headline</span><b>{data.headline || "—"}</b></div>
              <div><span>Rating</span><b>{data.rating ? Number(data.rating).toFixed(1) : "—"}</b></div>
              <div><span>Sessions</span><b>{data.sessions ?? 0}</b></div>
              <div><span>Reach</span><b>{(data.reach ?? 0).toLocaleString("en-IN")}</b></div>
              <div><span>Listed</span><b>{data.is_listed ? "Yes" : "No"}</b></div>
              <div><span>Advertised</span><b>{data.is_featured ? "Yes" : "No"}</b></div>
              <div><span>Subscription</span><b style={{ textTransform: "capitalize" }}>{data.subscription?.status || "none"}{data.subscription?.active ? " · active" : ""}</b></div>
              <div><span>Skills</span><b>{(data.skill_tags || []).join(", ") || "—"}</b></div>
            </div>
            {data.bio && <><h4 style={{ margin: "16px 0 6px" }}>Bio</h4><p style={{ color: "#374151", margin: 0 }}>{data.bio}</p></>}
            <div style={{ marginTop: 18 }}>
              <a href={`${HOME_URL}/experts/${data.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                View public profile →
              </a>
            </div>
          </>
        )}
        <div style={{ marginTop: 20, textAlign: "right" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", cursor: "pointer" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

const SkillExperts = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | advertised | suspended
  const [detailId, setDetailId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState("");

  const load = () => {
    setLoading(true);
    getAdminExperts()
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const view = useMemo(() => {
    let list = rows;
    if (filter === "advertised") list = list.filter((e) => e.is_featured);
    if (filter === "suspended")  list = list.filter((e) => e.is_suspended);
    const n = q.trim().toLowerCase();
    if (n) list = list.filter((e) => [e.name, e.email, e.category, e.headline].filter(Boolean).join(" ").toLowerCase().includes(n));
    return list;
  }, [rows, q, filter]);

  const doSuspend = (e, action) => {
    const verb = action === "suspend" ? "Suspend" : "Reinstate";
    setConfirm({
      title: `${verb} ${e.name}?`,
      message: action === "suspend"
        ? `This delists ${e.name} from the marketplace, blocks new bookings, and pauses their ad subscription.`
        : `This re-lists ${e.name} (if their profile is complete). They can be advertised again after re-subscribing.`,
      onConfirm: async () => {
        setBusyId(e.id); setMsg(""); setConfirm(null);
        try {
          await suspendExpert(e.id, action);
          setMsg(`${e.name} ${action === "suspend" ? "suspended" : "reinstated"}.`);
          load();
        } catch {
          setMsg("Action failed.");
        } finally { setBusyId(null); }
      },
    });
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Skill Experts</h1>
      {msg && <div style={{ color: "#16a34a", margin: "0 0 12px" }}>{msg}</div>}

      <div className="dashboard-card payments-table-card">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or subject…"
            style={{ flex: 1, minWidth: 220, padding: "8px 12px", border: "1px solid #d7dbe0", borderRadius: 8 }} />
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid #d7dbe0", borderRadius: 8 }}>
            <option value="all">All experts</option>
            <option value="advertised">Advertised</option>
            <option value="suspended">Suspended</option>
          </select>
          <span className="payments-count">{view.length} of {rows.length}</span>
        </div>

        {loading ? (
          <div className="dashboard-loading">Loading...</div>
        ) : view.length === 0 ? (
          <div className="dashboard-loading">No experts found.</div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr><th>Expert</th><th>Category</th><th>Rating</th><th>Sessions</th><th>Subscription</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {view.map((e) => (
                <tr key={e.id} style={e.is_suspended ? { background: "#fef2f2" } : undefined}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{e.email}</div>
                  </td>
                  <td>{e.category || "—"}</td>
                  <td>{e.rating ? Number(e.rating).toFixed(1) : "—"}</td>
                  <td>{e.sessions ?? 0}</td>
                  <td style={{ textTransform: "capitalize" }}>
                    {e.subscription?.status || "none"}
                    {e.subscription?.active ? <span style={{ color: "#16a34a" }}> · active</span> : null}
                  </td>
                  <td>
                    {e.is_suspended
                      ? <span style={pill("#dc2626")}>Suspended</span>
                      : e.is_featured
                        ? <span style={pill("#7c3aed")}>Advertised</span>
                        : e.is_listed
                          ? <span style={pill("#16a34a")}>Listed</span>
                          : <span style={pill("#9ca3af")}>Unlisted</span>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => setDetailId(e.id)} style={{ padding: "6px 12px", cursor: "pointer", marginRight: 6 }}>View</button>
                    {e.is_suspended ? (
                      <button onClick={() => doSuspend(e, "unsuspend")} disabled={busyId === e.id}
                        style={{ padding: "6px 12px", cursor: "pointer", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600 }}>
                        {busyId === e.id ? "…" : "Reinstate"}
                      </button>
                    ) : (
                      <button onClick={() => doSuspend(e, "suspend")} disabled={busyId === e.id}
                        style={{ padding: "6px 12px", cursor: "pointer", background: "#fff", color: "#dc2626", border: "1px solid #dc2626", borderRadius: 6, fontWeight: 600 }}>
                        {busyId === e.id ? "…" : "Suspend"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detailId && <ExpertModal id={detailId} onClose={() => setDetailId(null)} />}
      {confirm && (
        <ConfirmModal title={confirm.title} message={confirm.message}
          onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
};

export default SkillExperts;
