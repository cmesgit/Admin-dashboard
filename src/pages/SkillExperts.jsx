// src/pages/SkillExperts.jsx  (NEW)
//
// Admin directory of approved Skill-Dev experts (the "skill-dev list").
//   GET /skill/teachers/   → ExpertCardSerializer rows
//
// Read-only roster: who is live in the marketplace, their category, rating,
// session count, rate, advertising/featured state, reach, and location mode —
// with a link to the public profile. The screening *queue* lives under Skill
// Approvals; this is the post-approval roster.

import { useEffect, useMemo, useState } from "react";
import { getSkillExperts } from "../api/admin";
import { HOME_URL } from "../config/urls";

const SkillExperts = () => {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState("");
  const [filter, setFilter]   = useState("all"); // all | advertised | offline

  useEffect(() => {
    setLoading(true);
    getSkillExperts()
      .then((r) => setRows(Array.isArray(r) ? r : r?.results || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const view = useMemo(() => {
    let list = rows;
    if (filter === "advertised") list = list.filter((e) => e.advertised || e.featured);
    if (filter === "offline")    list = list.filter((e) => e.offline);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((e) =>
        [e.name, e.title, e.cat, e.class_location, ...(e.skills || [])]
          .filter(Boolean).join(" ").toLowerCase().includes(needle));
    }
    return list;
  }, [rows, q, filter]);

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Skill Experts</h1>

      <div className="dashboard-card payments-table-card">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, skill, category, location…"
            style={{ flex: 1, minWidth: 220, padding: "8px 12px", border: "1px solid #d7dbe0", borderRadius: 8 }}
          />
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid #d7dbe0", borderRadius: 8 }}>
            <option value="all">All experts</option>
            <option value="advertised">Advertised / featured</option>
            <option value="offline">Offers offline</option>
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
              <tr>
                <th>Expert</th><th>Category</th><th>Rating</th>
                <th>Sessions</th><th>Rate</th><th>Mode</th>
                <th>Reach</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {view.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{e.title || "—"}</div>
                  </td>
                  <td>{e.cat || "—"}</td>
                  <td>{e.rating ? Number(e.rating).toFixed(1) : "—"}</td>
                  <td>{e.sessions ?? 0}</td>
                  <td>{e.rate ? `₹${e.rate}` : "Free"}</td>
                  <td style={{ textTransform: "capitalize" }}>
                    {e.offline ? (e.class_mode || "offline") : "online"}
                    {e.class_location ? <div style={{ fontSize: 11, color: "#6b7280" }}>{e.class_location}</div> : null}
                  </td>
                  <td>{(e.reach ?? 0).toLocaleString("en-IN")}</td>
                  <td>
                    {e.featured
                      ? <span style={pill("#7c3aed")}>Featured</span>
                      : e.advertised
                        ? <span style={pill("#16a34a")}>Advertised</span>
                        : <span style={pill("#9ca3af")}>Listed</span>}
                  </td>
                  <td>
                    <a href={`${HOME_URL}/experts/${e.id}`} target="_blank" rel="noreferrer"
                      style={{ padding: "6px 12px", whiteSpace: "nowrap" }}>
                      View profile
                    </a>
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

const pill = (color) => ({
  fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 100,
  background: `${color}22`, color,
});

export default SkillExperts;
