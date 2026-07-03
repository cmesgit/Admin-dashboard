// src/pages/PaymentSettings.jsx  (REPLACE THE WHOLE FILE)
//
// Admin page to switch the platform payment mode. Talks to GET/PATCH
// /admin/settings/ (backend: global_settings.AdminGlobalSettingsView).
//
// FREE-LAUNCH BEHAVIOUR
// ─────────────────────
// The platform is free right now. `manual_upi` and `razorpay` are placeholders
// for a later payments launch, so:
//   • a persistent banner states the platform is in free launch mode,
//   • the paid modes render disabled with a "coming soon" tag,
//   • the free-trial switch cannot be turned off while a paid mode is selected
//     (the backend serializer enforces the same rule, so this is belt+braces).
// Credentials can still be pre-filled by temporarily selecting a paid mode?
// No — the mode select is locked to the modes that are live. When a paid mode
// ships, add it to LIVE_MODES here and flip PAID_MODES_LIVE in
// global_settings/serializers.py.

import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "../api/admin";

const MODES = [
  { value: "free",       label: "Free (no payment)",           live: true  },
  { value: "manual_upi", label: "Manual UPI + admin approval", live: false },
  { value: "razorpay",   label: "Razorpay gateway",            live: false },
];
const LIVE_MODES = MODES.filter((m) => m.live).map((m) => m.value);

const PaymentSettings = () => {
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [secretInput, setSecretInput] = useState(""); // blank = leave unchanged

  const load = async () => {
    setLoading(true);
    try { setS(await getSettings()); }
    catch { setErr("Failed to load settings."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const field = (k, v) => setS((prev) => ({ ...prev, [k]: v }));

  const paidModeSelected = s && !LIVE_MODES.includes(s.payment_mode);

  const save = async () => {
    setSaving(true); setMsg(""); setErr("");
    const payload = {
      payment_mode: s.payment_mode,
      free_trial_enabled: s.free_trial_enabled,
      upi_id: s.upi_id || "",
      upi_payee_name: s.upi_payee_name || "",
      razorpay_key_id: s.razorpay_key_id || "",
      platform_email: s.platform_email || "",
    };
    // Only send the secret if the admin typed a new one.
    if (secretInput.trim()) payload.razorpay_key_secret = secretInput.trim();

    try {
      const updated = await updateSettings(payload);
      setS(updated);
      setSecretInput("");
      setMsg("Saved. Effective mode: " + updated.effective_mode + ".");
    } catch (e) {
      const data = e?.response?.data;
      setErr(typeof data === "object" ? Object.values(data).flat().join(" ") : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="dashboard-wrapper"><div className="dashboard-loading">Loading...</div></div>;
  if (!s) return <div className="dashboard-wrapper"><div className="dashboard-loading">{err || "No settings."}</div></div>;

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Payment Settings</h1>

      {/* Free-launch banner */}
      <div style={{
        background: "#ecf8ee", border: "1px solid #bfe6c8", color: "#1f7a37",
        borderRadius: 10, padding: "12px 16px", marginBottom: 20,
        fontSize: 13.5, fontWeight: 600, display: "flex", gap: 8, alignItems: "center",
      }}>
        <span aria-hidden style={{ fontSize: 16 }}>●</span>
        Platform is in free launch mode — nothing is charged anywhere.
        Paid modes below are placeholders and will unlock when payments launch.
      </div>

      {/* Live status */}
      <div className="dashboard-cards" style={{ marginBottom: 24 }}>
        <div className="dashboard-card">
          <p className="stat-value" style={{ textTransform: "capitalize" }}>
            {s.effective_mode?.replace("_", " ")}
          </p>
          <p className="stat-label">Currently in force</p>
        </div>
        <div className="dashboard-card">
          <p className="stat-value">{s.free_trial_enabled ? "ON" : "OFF"}</p>
          <p className="stat-label">Free-trial master switch</p>
        </div>
      </div>

      <div className="dashboard-card" style={{ padding: 24, maxWidth: 620 }}>
        {/* Free-trial master switch — locked ON while a paid mode is selected */}
        <label style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={s.free_trial_enabled}
            disabled={paidModeSelected}
            onChange={(e) => field("free_trial_enabled", e.target.checked)}
          />
          <span>
            <strong>Free-trial master switch</strong> — while ON, everything is free
            regardless of the mode below. Turn OFF to start charging.
          </span>
        </label>
        {paidModeSelected && (
          <div style={{ fontSize: 12, color: "#b45309", margin: "0 0 14px 26px" }}>
            Locked ON: the selected mode isn’t available yet.
          </div>
        )}
        <div style={{ height: 12 }} />

        {/* Mode */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Payment mode</label>
          <select
            value={s.payment_mode}
            onChange={(e) => field("payment_mode", e.target.value)}
            style={{ width: "100%", padding: 8 }}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value} disabled={!m.live}>
                {m.label}{m.live ? "" : " — coming soon"}
              </option>
            ))}
          </select>
        </div>

        {/* Manual UPI fields (visible only if that mode is somehow selected) */}
        {s.payment_mode === "manual_upi" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>UPI ID (VPA)</label>
            <input className="sm-input" style={{ width: "100%", padding: 8, marginBottom: 10 }}
              value={s.upi_id || ""} placeholder="shiksha@okaxis"
              onChange={(e) => field("upi_id", e.target.value)} />
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Payee name</label>
            <input className="sm-input" style={{ width: "100%", padding: 8 }}
              value={s.upi_payee_name || ""}
              onChange={(e) => field("upi_payee_name", e.target.value)} />
          </div>
        )}

        {/* Razorpay fields */}
        {s.payment_mode === "razorpay" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Razorpay Key ID</label>
            <input className="sm-input" style={{ width: "100%", padding: 8, marginBottom: 10 }}
              value={s.razorpay_key_id || ""}
              onChange={(e) => field("razorpay_key_id", e.target.value)} />
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Razorpay Key Secret {s.razorpay_secret_set && <em>(configured — leave blank to keep)</em>}
            </label>
            <input className="sm-input" type="password" style={{ width: "100%", padding: 8 }}
              value={secretInput} placeholder={s.razorpay_secret_set ? "••••••••" : "enter secret"}
              onChange={(e) => setSecretInput(e.target.value)} />
          </div>
        )}

        {/* Contact email */}
        <div style={{ margin: "12px 0 18px" }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Platform contact email</label>
          <input className="sm-input" style={{ width: "100%", padding: 8 }}
            value={s.platform_email || ""}
            onChange={(e) => field("platform_email", e.target.value)} />
        </div>

        {msg && <div style={{ color: "#16a34a", marginBottom: 10 }}>{msg}</div>}
        {err && <div style={{ color: "#dc2626", marginBottom: 10 }}>{err}</div>}

        <button onClick={save} disabled={saving}
          style={{ padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}>
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </div>
  );
};

export default PaymentSettings;
