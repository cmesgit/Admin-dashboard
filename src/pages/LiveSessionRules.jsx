// src/pages/LiveSessionRules.jsx
//
// Admin screen 11 (design_handoff_live_sessions/design-reference/Live
// Sessions.dc.html, data-screen-label="11"). Edits the 16 `live_*` fields on
// the same GlobalSettings singleton Payment Settings edits — see
// src/api/admin_live_rules.js for why there's no separate backend resource.
//
// Follows pages/PaymentSettings.jsx's conventions: dashboard-card shells,
// stat-value/stat-label stat row, success/warning banner pattern, and the
// same load/saving/error state handling. One deliberate difference: screen
// 11's own mockup puts the Save button in the page header (next to the
// title), not at the bottom of the form card the way PaymentSettings.jsx
// does — followed the screen's explicit layout for that one placement
// decision since it's the more specific spec for this exact screen.
import { useEffect, useState } from "react";
import { getLiveRules, updateLiveRules, getLiveSessionStats } from "../api/admin_live_rules";
import { errText } from "../utils/errText";
import "../css/NewScreens.css";

const HOST_POLICIES = [
  { value: "anyone", label: "Any signed-in user" },
  { value: "teachers_and_enrolled", label: "Teachers and enrolled learners" },
  { value: "teachers_only", label: "Teachers only" },
];

const LiveSessionRules = () => {
  const [s, setS] = useState(null);
  const [stats, setStats] = useState(null); // null = not loaded (or endpoint unavailable) — renders "—"
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    try { setS(await getLiveRules()); }
    catch { setErr("Failed to load live session rules."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    // getLiveSessionStats() never throws — it resolves to null on 404 (the
    // stats endpoint isn't built yet) or any other failure, so this can't
    // block the rest of the page.
    getLiveSessionStats().then(setStats);
  }, []);

  const field = (k, v) => setS((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true); setMsg(""); setErr("");
    const payload = {
      live_free_minutes_per_join: s.live_free_minutes_per_join,
      live_max_participants: s.live_max_participants,
      live_max_session_minutes: s.live_max_session_minutes,
      live_daily_minutes_per_user: s.live_daily_minutes_per_user,
      live_host_extensions_allowed: s.live_host_extensions_allowed,
      live_host_extension_minutes: s.live_host_extension_minutes,
      live_max_upload_mb: s.live_max_upload_mb,
      live_max_files_per_session: s.live_max_files_per_session,
      live_file_retention_days: s.live_file_retention_days,
      live_recording_enabled: s.live_recording_enabled,
      live_remote_access_enabled: s.live_remote_access_enabled,
      live_chat_enabled: s.live_chat_enabled,
      live_screenshare_enabled: s.live_screenshare_enabled,
      live_show_first_visit_tour: s.live_show_first_visit_tour,
      live_host_policy: s.live_host_policy,
      live_launch_free_mode: s.live_launch_free_mode,
    };
    try {
      const updated = await updateLiveRules(payload);
      setS(updated);
      setMsg("Saved.");
    } catch (e) {
      setErr(errText(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="dashboard-wrapper"><div className="dashboard-loading">Loading...</div></div>;
  if (!s) return <div className="dashboard-wrapper"><div className="dashboard-loading">{err || "No settings."}</div></div>;

  return (
    <div className="dashboard-wrapper">
      <div className="ns-head-row">
        <h1 className="dashboard-title" style={{ marginBottom: 0 }}>Live Session Rules</h1>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "9px 18px", fontWeight: 600, cursor: "pointer",
            background: "var(--admin-primary)", color: "#fff", border: "none", borderRadius: 8,
          }}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      {msg && <div style={{ color: "#16a34a", marginBottom: 14, fontWeight: 600 }}>{msg}</div>}
      {err && <div style={{ color: "#dc2626", marginBottom: 14, fontWeight: 600 }}>{err}</div>}

      {/* Free-launch banner — copy is exactly as specified in 03-FRONTEND.md,
          driven by live_launch_free_mode. Same banner shape (dot + colored
          panel) as PaymentSettings.jsx's trial-status banners. */}
      <div style={{
        background: s.live_launch_free_mode ? "#ecf8ee" : "#fff8f0",
        border: `1px solid ${s.live_launch_free_mode ? "#bfe6c8" : "#f3d9bd"}`,
        color: s.live_launch_free_mode ? "#1f7a37" : "#92400e",
        borderRadius: 10, padding: "12px 16px", marginBottom: 20,
        fontSize: 13.5, fontWeight: 600, display: "flex", gap: 12, alignItems: "center",
      }}>
        <span aria-hidden style={{ fontSize: 16 }}>●</span>
        <span style={{ flex: 1 }}>
          {s.live_launch_free_mode
            ? "Free-launch mode is on — nobody is time-capped, whatever the values below say."
            : "Charging is live — the limits below are enforced for every non-enrolled joiner."}
        </span>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
          <input
            type="checkbox"
            checked={s.live_launch_free_mode}
            onChange={(e) => field("live_launch_free_mode", e.target.checked)}
          />
          Free-launch mode
        </label>
      </div>

      {/* Stat cards. The stats endpoint (rooms live now / participants today /
          files pending expiry / remote-assist sessions) doesn't exist on the
          backend yet — see admin_live_rules.js. Render "—" rather than
          fabricate numbers or block the page. */}
      <div className="dashboard-cards" style={{ marginBottom: 8 }}>
        <div className="dashboard-card">
          <p className="stat-value">{stats ? stats.rooms_live_now : "—"}</p>
          <p className="stat-label">Rooms live now</p>
        </div>
        <div className="dashboard-card">
          <p className="stat-value">{stats ? stats.participants_today : "—"}</p>
          <p className="stat-label">Participants today</p>
        </div>
        <div className="dashboard-card">
          <p className="stat-value">{stats ? stats.files_pending_expiry : "—"}</p>
          <p className="stat-label">Files pending expiry</p>
        </div>
        <div className="dashboard-card">
          <p className="stat-value">{stats ? stats.remote_assist_sessions : "—"}</p>
          <p className="stat-label">Remote-assist sessions</p>
        </div>
      </div>
      {stats === null && (
        <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 20px" }}>
          Live stats aren't wired up on the backend yet — showing placeholders.
        </p>
      )}

      <div className="ns-two-col">
        {/* Time & capacity */}
        <div className="dashboard-card" style={{ padding: 24, textAlign: "left" }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Time &amp; capacity</h3>
          <p style={{ margin: "6px 0 18px", fontSize: 12.5, color: "#6b7280" }}>
            Applies to every LiveKit room: /live instant meetings, course classes and group sessions.
          </p>
          <div className="ns-field-grid">
            <div className="ns-field">
              <label>Free minutes per join</label>
              <input
                type="number" min="0"
                value={s.live_free_minutes_per_join}
                onChange={(e) => field("live_free_minutes_per_join", Number(e.target.value))}
              />
              <span className="ns-field-help">Non-enrolled joiners only. Hosts are never capped.</span>
            </div>
            <div className="ns-field">
              <label>Max participants per room</label>
              <input
                type="number" min="1"
                value={s.live_max_participants}
                onChange={(e) => field("live_max_participants", Number(e.target.value))}
              />
              <span className="ns-field-help">Enforced when the join token is issued.</span>
            </div>
            <div className="ns-field">
              <label>Max session duration (min)</label>
              <input
                type="number" min="1"
                value={s.live_max_session_minutes}
                onChange={(e) => field("live_max_session_minutes", Number(e.target.value))}
              />
              <span className="ns-field-help">Ceiling for host extensions.</span>
            </div>
            <div className="ns-field">
              <label>Daily minutes per user</label>
              <input
                type="number" min="0"
                value={s.live_daily_minutes_per_user}
                onChange={(e) => field("live_daily_minutes_per_user", Number(e.target.value))}
              />
              <span className="ns-field-help">0 disables the daily budget.</span>
            </div>
          </div>

          <div className="ns-field-grid" style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #eef1f2" }}>
            <div className="ns-field">
              <label>Host extensions allowed per session</label>
              <input
                type="number" min="0"
                value={s.live_host_extensions_allowed}
                onChange={(e) => field("live_host_extensions_allowed", Number(e.target.value))}
              />
            </div>
            <div className="ns-field">
              <label>Minutes per extension</label>
              <input
                type="number" min="0"
                value={s.live_host_extension_minutes}
                onChange={(e) => field("live_host_extension_minutes", Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Files & features */}
        <div className="dashboard-card" style={{ padding: 24, textAlign: "left" }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Files &amp; features</h3>
          <p style={{ margin: "6px 0 18px", fontSize: 12.5, color: "#6b7280" }}>
            Feature switches are platform-wide. A host can tighten them per room but never loosen them.
          </p>
          <div className="ns-field-grid" style={{ marginBottom: 16 }}>
            <div className="ns-field">
              <label>Max upload size (MB)</label>
              <input
                type="number" min="1"
                value={s.live_max_upload_mb}
                onChange={(e) => field("live_max_upload_mb", Number(e.target.value))}
              />
            </div>
            <div className="ns-field">
              <label>Files per session</label>
              <input
                type="number" min="1"
                value={s.live_max_files_per_session}
                onChange={(e) => field("live_max_files_per_session", Number(e.target.value))}
              />
            </div>
            <div className="ns-field">
              <label>Retention after session (days)</label>
              <input
                type="number" min="0"
                value={s.live_file_retention_days}
                onChange={(e) => field("live_file_retention_days", Number(e.target.value))}
              />
            </div>
            <div className="ns-field">
              <label>Who may host</label>
              <select
                value={s.live_host_policy}
                onChange={(e) => field("live_host_policy", e.target.value)}
              >
                {HOST_POLICIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="ns-toggle-list">
            <label className="ns-toggle-item">
              <input
                type="checkbox"
                checked={s.live_remote_access_enabled}
                onChange={(e) => field("live_remote_access_enabled", e.target.checked)}
              />
              <span><b>Remote access</b> — teachers may drive a student's shared screen after the student approves.</span>
            </label>
            <label className="ns-toggle-item">
              <input
                type="checkbox"
                checked={s.live_recording_enabled}
                onChange={(e) => field("live_recording_enabled", e.target.checked)}
              />
              <span><b>Recording</b> — store room recordings. Off until storage is signed off.</span>
            </label>
            <label className="ns-toggle-item">
              <input
                type="checkbox"
                checked={s.live_chat_enabled}
                onChange={(e) => field("live_chat_enabled", e.target.checked)}
              />
              <span><b>Chat</b> available to participants.</span>
            </label>
            <label className="ns-toggle-item">
              <input
                type="checkbox"
                checked={s.live_screenshare_enabled}
                onChange={(e) => field("live_screenshare_enabled", e.target.checked)}
              />
              <span><b>Screen sharing</b> available to participants.</span>
            </label>
            <label className="ns-toggle-item">
              <input
                type="checkbox"
                checked={s.live_show_first_visit_tour}
                onChange={(e) => field("live_show_first_visit_tour", e.target.checked)}
              />
              <span><b>Show the first-visit tour</b> to every new participant.</span>
            </label>
          </div>

          <div className="ns-note-box">
            Changes take effect on the next room join. Sessions already live keep the limits
            they started with, and every edit is written to Moderator Activity.
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveSessionRules;
