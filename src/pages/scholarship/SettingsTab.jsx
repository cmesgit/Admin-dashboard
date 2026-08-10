import { useEffect, useState } from "react";
import { getScholarshipSettings, updateScholarshipSettings } from "../../api/admin_scholarship";

const MONTHS = [
  [1, "January"], [2, "February"], [3, "March"], [4, "April"], [5, "May"], [6, "June"],
  [7, "July"], [8, "August"], [9, "September"], [10, "October"], [11, "November"], [12, "December"],
];

export default function SettingsTab({ onAction }) {
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    try { setS(await getScholarshipSettings()); }
    catch { setErr("Failed to load settings."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const field = (k, v) => setS((prev) => ({ ...prev, [k]: v }));
  const num = (k) => (e) => field(k, e.target.value === "" ? "" : Number(e.target.value));
  const bool = (k) => (e) => field(k, e.target.checked);

  const difficultyTotal = (Number(s?.difficulty_easy_pct) || 0) + (Number(s?.difficulty_medium_pct) || 0) + (Number(s?.difficulty_hard_pct) || 0);

  const save = async () => {
    setSaving(true); setErr("");
    try {
      const updated = await updateScholarshipSettings(s);
      setS(updated);
      onAction && onAction("Scholarship settings saved.");
    } catch (e) {
      const data = e?.response?.data;
      setErr(typeof data === "object" ? Object.values(data).flat().join(" ") : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="dashboard-loading">Loading…</div>;
  if (!s) return <div className="dashboard-loading">{err || "No settings."}</div>;

  return (
    <div className="dashboard-card" style={{ padding: 24, maxWidth: 720 }}>
      <label style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <input type="checkbox" checked={s.enabled} onChange={bool("enabled")} />
        <span><strong>Scholarship module enabled</strong> — turning this off blocks new attempts platform-wide.</span>
      </label>

      <h3 style={{ margin: "0 0 12px" }}>Exam shape</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 10 }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Question count</label>
          <input type="number" min={1} value={s.question_count} onChange={num("question_count")} style={{ width: "100%", padding: 8 }} />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Duration (minutes)</label>
          <input type="number" min={1} value={s.duration_minutes} onChange={num("duration_minutes")} style={{ width: "100%", padding: 8 }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 6 }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Easy %</label>
          <input type="number" min={0} max={100} value={s.difficulty_easy_pct} onChange={num("difficulty_easy_pct")} style={{ width: "100%", padding: 8 }} />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Medium %</label>
          <input type="number" min={0} max={100} value={s.difficulty_medium_pct} onChange={num("difficulty_medium_pct")} style={{ width: "100%", padding: 8 }} />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Challenging %</label>
          <input type="number" min={0} max={100} value={s.difficulty_hard_pct} onChange={num("difficulty_hard_pct")} style={{ width: "100%", padding: 8 }} />
        </div>
      </div>
      {difficultyTotal !== 100 && (
        <div style={{ color: "#b45309", fontSize: 12.5, marginBottom: 18 }}>
          Difficulty split must sum to 100 (currently {difficultyTotal}).
        </div>
      )}

      <h3 style={{ margin: "24px 0 12px" }}>Award</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Award valid until — month</label>
          <select value={s.award_valid_until_month} onChange={num("award_valid_until_month")} style={{ width: "100%", padding: 8 }}>
            {MONTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Award valid until — day</label>
          <input type="number" min={1} max={31} value={s.award_valid_until_day} onChange={num("award_valid_until_day")} style={{ width: "100%", padding: 8 }} />
        </div>
      </div>

      <h3 style={{ margin: "24px 0 12px" }}>Identity verification methods</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={s.allow_digilocker} onChange={bool("allow_digilocker")} />
          DigiLocker
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={s.allow_aadhaar_offline} onChange={bool("allow_aadhaar_offline")} />
          Aadhaar (Offline e-KYC) — free, verified against UIDAI's own signature, no vendor needed
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={s.allow_aadhaar_otp} onChange={bool("allow_aadhaar_otp")} />
          Aadhaar OTP — requires a paid licensed reseller, not wired yet; leave off until one is
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={s.allow_manual_review} onChange={bool("allow_manual_review")} />
          Manual document review
        </label>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Active KYC reseller (for DigiLocker / Aadhaar OTP, once wired)</label>
        <input value={s.active_kyc_provider || ""} onChange={(e) => field("active_kyc_provider", e.target.value)}
          placeholder="e.g. setu, digio, surepass" style={{ width: "100%", padding: 8 }} />
      </div>

      <h3 style={{ margin: "24px 0 12px" }}>Anti-cheat</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={s.enable_device_fingerprint} onChange={bool("enable_device_fingerprint")} />
          Device fingerprint capture
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={s.enable_tab_switch_tracking} onChange={bool("enable_tab_switch_tracking")} />
          Tab-switch tracking
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Tab-switch flag threshold</label>
          <input type="number" min={1} value={s.tab_switch_flag_threshold} onChange={num("tab_switch_flag_threshold")} style={{ width: "100%", padding: 8 }} />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Answer-burst threshold (sec)</label>
          <input type="number" min={1} value={s.answer_burst_seconds_threshold} onChange={num("answer_burst_seconds_threshold")} style={{ width: "100%", padding: 8 }} />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Answer-burst count threshold</label>
          <input type="number" min={1} value={s.answer_burst_count_threshold} onChange={num("answer_burst_count_threshold")} style={{ width: "100%", padding: 8 }} />
        </div>
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
        <input type="checkbox" checked={s.auto_review_top_bands} onChange={bool("auto_review_top_bands")} />
        Hold top-band awards for manual review before they become redeemable
      </label>
      {s.auto_review_top_bands && (
        <div style={{ marginBottom: 18, maxWidth: 260 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Minimum discount % to hold</label>
          <input type="number" min={0} max={100} value={s.top_band_review_min_pct} onChange={num("top_band_review_min_pct")} style={{ width: "100%", padding: 8 }} />
        </div>
      )}

      {err && <div style={{ color: "#dc2626", marginBottom: 10 }}>{err}</div>}

      <button onClick={save} disabled={saving || difficultyTotal !== 100}
        style={{ padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}>
        {saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
