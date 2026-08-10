import { useEffect, useState } from "react";
import { ClipboardList, CheckCircle2, Flag, Award, Lock, Unlock, PackageCheck, ShieldCheck } from "lucide-react";
import { getScholarshipStats } from "../../api/admin_scholarship";

const cardDefs = [
  { key: "total_sessions", label: "Exam sessions", icon: ClipboardList, color: "#4f6df5" },
  { key: "submitted_sessions", label: "Submitted", icon: CheckCircle2, color: "#2f9d42" },
  { key: "flagged_for_review_open", label: "Flagged, open", icon: Flag, color: "#dc2626" },
  { key: "pending_verifications", label: "Pending verifications", icon: ShieldCheck, color: "#e67e22" },
  { key: "awards_total", label: "Awards, total", icon: Award, color: "#9b59b6" },
  { key: "awards_locked", label: "Awards, locked", icon: Lock, color: "#64748b" },
  { key: "awards_active", label: "Awards, active", icon: Unlock, color: "#1abc9c" },
  { key: "awards_redeemed", label: "Awards, redeemed", icon: PackageCheck, color: "#16a34a" },
];

export default function StatsTab({ goToTab }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getScholarshipStats().then(setStats).catch(() => setStats(null)).finally(() => setLoading(false));
  }, []);

  const attention = stats ? [
    { label: "Flagged sessions awaiting review", n: stats.flagged_for_review_open, to: "sessions" },
    { label: "Guardian verifications pending", n: stats.pending_verifications, to: "verifications" },
  ] : [];

  return (
    <div>
      {loading ? (
        <div className="dashboard-loading">Loading stats…</div>
      ) : !stats ? (
        <div className="dashboard-loading">Couldn't load stats.</div>
      ) : (
        <>
          <div className="dashboard-cards">
            {cardDefs.map(({ key, label, icon: Icon, color }) => (
              <div key={key} className="dashboard-card">
                <div className="stat-icon" style={{ backgroundColor: `${color}15` }}>
                  <Icon size={28} color={color} />
                </div>
                <p className="stat-value">{(stats[key] ?? 0).toLocaleString("en-IN")}</p>
                <p className="stat-label">{label}</p>
              </div>
            ))}
          </div>

          <div className="dashboard-cards" style={{ marginTop: 32, gridTemplateColumns: "1fr 1fr" }}>
            <div className="dashboard-card empty" style={{ alignItems: "stretch", textAlign: "left" }}>
              <h3 style={{ marginTop: 0 }}>Needs attention</h3>
              {attention.every((a) => !a.n) ? (
                <p>All clear — nothing waiting for review.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  {attention.map((a) => (
                    <button
                      key={a.to}
                      onClick={() => goToTab(a.to)}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "9px 12px", borderRadius: 8, textDecoration: "none", border: "none", cursor: "pointer",
                        background: a.n > 0 ? "#fff7ed" : "#f8fafc",
                        borderColor: a.n > 0 ? "#fed7aa" : "#eef0f3", color: "#1f2937", font: "inherit",
                        width: "100%", textAlign: "left",
                      }}
                    >
                      <span>{a.label}</span>
                      <span style={{ fontWeight: 800, color: a.n > 0 ? "#b45309" : "#9ca3af" }}>{a.n}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="dashboard-card empty" style={{ alignItems: "stretch", textAlign: "left" }}>
              <h3 style={{ marginTop: 0 }}>Award band distribution</h3>
              {!stats.band_distribution?.length ? (
                <p>No awards issued yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {stats.band_distribution.map((b) => (
                    <div key={b.discount_pct} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                      <span>{b.discount_pct}% scholarship</span>
                      <b>{b.count}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
