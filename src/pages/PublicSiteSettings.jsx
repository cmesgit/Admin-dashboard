// src/pages/PublicSiteSettings.jsx
//
// The three GlobalSettings flags that gate PUBLIC, logged-out pages on the
// marketing site. Talks to GET/PATCH /admin/settings/ (backend:
// global_settings.AdminGlobalSettingsView).
//
// WHY A SEPARATE PAGE FROM "Payment Settings"
// ───────────────────────────────────────────
// PaymentSettings edits the same singleton, but its save payload is strictly
// payment + skill pricing, and its nav label says Payment Settings. Hanging a
// public-site rollout gate off that screen hides it where nobody would look
// and makes every payment save carry an unrelated flag.
//
// Until now these three had NO admin UI at all — `public_quiz_hub_enabled`
// and `live_ticker_enabled` were togglable only through Django admin or a
// direct PATCH, which is why they were easy to forget.
//
// WHY THESE THREE AND NOT EVERY FLAG: these are the ones served anonymously
// by /api/public-config/, whose server-side allowlist is the authority. A
// flag that is NOT on that allowlist cannot gate a logged-out page, so it
// does not belong here. Keep this list and PublicConfigView.PUBLIC_FLAGS in
// step — the backend test `test_it_leaks_nothing_beyond_the_allowlist`
// asserts the exact set and will fail loudly if the allowlist grows.
//
// Admin conventions (see repo CLAUDE.md): lucide-react icons, --admin-*
// tokens, no toast library — local state cleared on a timer.

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { getSettings, updateSettings } from "../api/admin";
import { errText } from "../utils/errText";

// Order is deliberate: most consequential first.
const FLAGS = [
  {
    key: "admission_abroad_enabled",
    label: "Admission Abroad directory",
    path: "/admission/abroad",
    help:
      "100 QS-ranked institutions across 51 countries, with tuition and its " +
      "evidence label. While OFF the route shows a short “not open yet” note " +
      "and the 183 kB directory is never downloaded.",
    caution:
      "Ships OFF on purpose. The institution data is cited and dated, but the " +
      "study-abroad guides around it are unfinished and the source names live " +
      "visa rules (Canada PAL/PGWP, Australia’s Genuine Student test, the UK " +
      "Graduate visa) with no date stamp. Turn this on once that content has " +
      "had a human pass.",
  },
  {
    key: "public_quiz_hub_enabled",
    label: "Public Quiz Hub",
    path: "/quiz",
    help:
      "The public practice-quiz pages. While OFF the pages come down and the " +
      "public quiz endpoints return 503. Does not affect the academy quiz " +
      "system, the teacher question bank or the admin review queue.",
  },
  {
    key: "live_ticker_enabled",
    label: "Live ticker",
    path: "—",
    help:
      "Master switch for the CMS ticker across all its slots: navbar strip, " +
      "homepage hero and band, courses rail, footer, student dashboard rail " +
      "and the login/signup screens. The older announcement strip is " +
      "unaffected.",
  },
];

export default function PublicSiteSettings() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    getSettings()
      .then((d) => alive && setS(d))
      .catch((e) => alive && setErr(errText(e)));
    return () => {
      alive = false;
    };
  }, []);

  // Clear the "Saved" line on a timer — this app has no toast library.
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(""), 2500);
    return () => clearTimeout(t);
  }, [msg]);

  // Save ONE flag, not the whole object. A full-object PATCH from this screen
  // would re-send payment fields this page never shows, so a stale read here
  // could quietly overwrite something an admin changed on PaymentSettings.
  const toggle = async (key, value) => {
    setSaving(true);
    setErr("");
    setMsg("");
    const previous = s[key];
    setS((prev) => ({ ...prev, [key]: value })); // optimistic
    try {
      const updated = await updateSettings({ [key]: value });
      setS(updated);
      setMsg(`${value ? "Enabled" : "Disabled"} — live now, no deploy needed.`);
    } catch (e) {
      setS((prev) => ({ ...prev, [key]: previous })); // revert on failure
      setErr(errText(e));
    } finally {
      setSaving(false);
    }
  };

  if (!s) {
    return (
      <div className="dashboard-wrapper">
        <div className="dashboard-loading">{err || "Loading settings..."}</div>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">
        <Globe size={20} style={{ verticalAlign: "-3px", marginRight: 8 }} />
        Public site
      </h1>
      <p style={{ marginTop: -6, marginBottom: 18, opacity: 0.75, maxWidth: 720 }}>
        Rollout switches for pages a logged-out visitor can reach. Changes take
        effect immediately — no deploy, no rebuild.
      </p>

      {msg && <div style={{ color: "#16a34a", marginBottom: 10 }}>{msg}</div>}
      {err && <div style={{ color: "#dc2626", marginBottom: 10 }}>{err}</div>}

      <div className="dashboard-card" style={{ padding: 24, maxWidth: 720 }}>
        {FLAGS.map((f, i) => (
          <div
            key={f.key}
            style={{
              paddingTop: i === 0 ? 0 : 18,
              marginTop: i === 0 ? 0 : 18,
              borderTop: i === 0 ? "none" : "1px solid var(--admin-border)",
            }}
          >
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={Boolean(s[f.key])}
                disabled={saving}
                onChange={(e) => toggle(f.key, e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong>{f.label}</strong>
                {f.path !== "—" && (
                  <code style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>{f.path}</code>
                )}
                <span style={{ display: "block", fontSize: 13, marginTop: 4, opacity: 0.8 }}>
                  {f.help}
                </span>
                {f.caution && (
                  <span
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      marginTop: 8,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "var(--admin-warn-tint)",
                      color: "var(--admin-warn)",
                      border: "1px solid var(--admin-warn-edge)",
                    }}
                  >
                    {f.caution}
                  </span>
                )}
              </span>
            </label>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12.5, opacity: 0.7, marginTop: 14, maxWidth: 720 }}>
        These three are served anonymously by <code>/api/public-config/</code>.
        Anything not on that endpoint’s allowlist cannot gate a logged-out page.
      </p>
    </div>
  );
}
