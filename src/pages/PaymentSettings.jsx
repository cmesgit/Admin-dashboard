// src/pages/PaymentSettings.jsx  (NEW)
//
// Admin page to switch the platform payment mode (free / manual_upi / razorpay)
// and set UPI + Razorpay credentials. Talks to GET/PATCH /admin/settings/
// (backend: global_settings.AdminGlobalSettingsView).
//
// Matches the existing admin page style (dashboard-wrapper / dashboard-card).
// The razorpay secret is write-only on the backend: the GET returns
// razorpay_secret_set (bool), never the value, so we show "configured" and let
// the admin overwrite it via a blank-able field.

import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "../api/admin";

const MODES = [
  { value: "free",       label: "Free (no payment)" },
  { value: "manual_upi", label: "Manual UPI + admin approval" },
  { value: "razorpay",   label: "Razorpay gateway" },
];

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

      {/* Live status banner */}
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
        {/* Free-trial master switch */}
        <label style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}>
          <input
            type="checkbox"
            checked={s.free_trial_enabled}
            onChange={(e) => field("free_trial_enabled", e.target.checked)}
          />
          <span>
            <strong>Free-trial master switch</strong> — while ON, everything is free
            regardless of the mode below. Turn OFF to start charging.
          </span>
        </label>

        {/* Mode */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Payment mode</label>
          <select
            value={s.payment_mode}
            onChange={(e) => field("payment_mode", e.target.value)}
            style={{ width: "100%", padding: 8 }}
          >
            {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        {/* Manual UPI fields */}
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
