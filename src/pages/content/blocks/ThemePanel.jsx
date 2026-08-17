// PLACEMENT: Admin-dashboard/src/pages/content/blocks/ThemePanel.jsx
//
// Whole-post palette editor for a block-authored post — shown in
// BlogEditor.jsx's sidebar (blocks mode only), not per-block: `body_theme`
// applies to every block in the post via CSS custom properties (see
// render.js's themeStyleText()), so it belongs at the post level, same as
// the cover image or SEO fields.
//
// Two ways to set it, both writing a FULL 24-token object (never a partial
// override) so "which preset is active" stays a simple equality check and
// there's no ambiguity about what's inherited vs authored:
//   1. Click a preset swatch — see themePresets.js for the palette list.
//   2. Expand "Customize colors" and hand-edit any of the 24 tokens with
//      native <input type="color"> pickers, grouped by TOKEN_GROUPS.

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { normalizeTheme } from "../../../blogBlocks/schema";
import { THEME_PRESETS, TOKEN_GROUPS, matchingPresetKey } from "./themePresets";

// Native color inputs require a plain 6-digit #rrggbb — expand a 3-digit
// shorthand defensively so a hand-typed or legacy-imported value never makes
// the picker silently show black.
const toSixDigitHex = (hex) => {
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return "#" + [...hex.slice(1)].map((c) => c + c).join("");
  }
  return hex;
};

const ThemePanel = ({ theme, onChange }) => {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const resolved = normalizeTheme(theme);
  const activePreset = matchingPresetKey(resolved);

  const applyPreset = (preset) => onChange({ ...preset.theme });
  const setToken = (token, hex) => onChange({ ...resolved, [token]: hex });

  return (
    <>
      <div className="blk-theme-presets">
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={`blk-theme-preset${activePreset === preset.key ? " active" : ""}`}
            onClick={() => applyPreset(preset)}
            title={preset.label}
          >
            <span className="blk-theme-swatch" style={{ background: preset.swatch }} />
            {preset.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="blog-editor-card-head blk-theme-customize-toggle"
        onClick={() => setCustomizeOpen((v) => !v)}
        aria-expanded={customizeOpen}
      >
        <span className="blog-editor-card-head-label">Customize colors</span>
        {customizeOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {customizeOpen && (
        <div className="blk-theme-groups">
          {TOKEN_GROUPS.map((group) => (
            <div className="blk-theme-group" key={group.label}>
              <h5>{group.label}</h5>
              <div className="blk-theme-swatch-grid">
                {group.tokens.map((token) => (
                  <label className="blk-theme-swatch-field" key={token} title={token}>
                    <input
                      type="color"
                      value={toSixDigitHex(resolved[token])}
                      onChange={(e) => setToken(token, e.target.value)}
                    />
                    <span>{token}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default ThemePanel;
