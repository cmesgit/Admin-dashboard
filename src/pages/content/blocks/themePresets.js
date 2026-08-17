// PLACEMENT: Admin-dashboard/src/pages/content/blocks/themePresets.js
//
// Admin-only authoring aid — NOT synced to shared/, unlike schema.js/render.js/
// blocksCss.js. A preset is just a starting point for `body_theme`: clicking
// one writes a full 24-token object, and every token stays individually
// editable afterward via ThemePanel's custom color pickers. The public
// reader has no concept of "presets" at all — it only ever sees the
// resolved token values schema.js's normalizeTheme() already handles.
//
// Simplification, deliberate: only the 9 "surface + primary accent" tokens
// (ink/ink2/muted/paper/paper2/rule/accent/accent2/accent-lt) vary per
// preset. The 14 secondary-hue tokens (coral/gold/purple/blue/rose/green/red,
// each with a `-lt` pair) and `white` stay constant across every preset,
// acting as a shared utility palette — exactly how feature_grid's 4 card
// colors and table header backgrounds already reference them regardless of
// subject. This mirrors customDesignTemplate.html's own instructions
// ("retint the whole page — accent = your primary brand colour") without
// asking an author to hand-tune 24 swatches just to pick a subject color.

import { DEFAULT_THEME } from "../../../blogBlocks/schema";

const UTILITY_HUES = {
  white: DEFAULT_THEME.white,
  coral: DEFAULT_THEME.coral, "coral-lt": DEFAULT_THEME["coral-lt"],
  gold: DEFAULT_THEME.gold, "gold-lt": DEFAULT_THEME["gold-lt"],
  purple: DEFAULT_THEME.purple, "purple-lt": DEFAULT_THEME["purple-lt"],
  blue: DEFAULT_THEME.blue, "blue-lt": DEFAULT_THEME["blue-lt"],
  rose: DEFAULT_THEME.rose, "rose-lt": DEFAULT_THEME["rose-lt"],
  green: DEFAULT_THEME.green, "green-lt": DEFAULT_THEME["green-lt"],
  red: DEFAULT_THEME.red, "red-lt": DEFAULT_THEME["red-lt"],
};

const surfaces = (s) => ({ ...UTILITY_HUES, ...s });

export const THEME_PRESETS = [
  { key: "indigo", label: "Default", swatch: DEFAULT_THEME.accent, theme: { ...DEFAULT_THEME } },
  {
    key: "physics", label: "Physics Blue", swatch: "#0f6ea8",
    theme: surfaces({
      ink: "#09131f", ink2: "#17293d", muted: "#4d637d",
      paper: "#f1f7fb", paper2: "#e0eff8", rule: "#a7cde2",
      accent: "#0f6ea8", accent2: "#084e7d", "accent-lt": "#d8efff",
    }),
  },
  {
    key: "biology", label: "Biology Green", swatch: "#1e7a3d",
    theme: surfaces({
      ink: "#0d1f0d", ink2: "#1a2e1a", muted: "#4d7a4d",
      paper: "#f2faf0", paper2: "#dff5da", rule: "#a8d9a0",
      accent: "#1e7a3d", accent2: "#145c2c", "accent-lt": "#d7f5df",
    }),
  },
  {
    key: "history", label: "History Terracotta", swatch: "#a8442e",
    theme: surfaces({
      ink: "#1f0d0c", ink2: "#33201d", muted: "#7d5a52",
      paper: "#faf3f0", paper2: "#f2e0d8", rule: "#e0c2b8",
      accent: "#a8442e", accent2: "#7d2e1c", "accent-lt": "#fbe0d8",
    }),
  },
  {
    key: "geography", label: "Geography Teal", swatch: "#0d7d70",
    theme: surfaces({
      ink: "#0a1f1c", ink2: "#173330", muted: "#4d7a73",
      paper: "#f0faf8", paper2: "#daf2ee", rule: "#a0d9d0",
      accent: "#0d7d70", accent2: "#0a5c52", "accent-lt": "#d0f5ef",
    }),
  },
  {
    key: "economics", label: "Economics Gold", swatch: "#a17a1f",
    theme: surfaces({
      ink: "#1f1808", ink2: "#332813", muted: "#7d6a42",
      paper: "#faf6ec", paper2: "#f2e8d0", rule: "#e0d0a0",
      accent: "#a17a1f", accent2: "#7d5c14", "accent-lt": "#fbf0d0",
    }),
  },
];

// Groups the 24 tokens for the "Customize" section — matches THEME_TOKENS'
// own order/membership in schema.js exactly (checked by selftest.js).
export const TOKEN_GROUPS = [
  { label: "Surfaces", tokens: ["ink", "ink2", "muted", "paper", "paper2", "rule", "white"] },
  { label: "Primary accent", tokens: ["accent", "accent2", "accent-lt"] },
  {
    label: "Secondary colors",
    tokens: [
      "coral", "coral-lt", "gold", "gold-lt", "purple", "purple-lt",
      "blue", "blue-lt", "rose", "rose-lt", "green", "green-lt", "red", "red-lt",
    ],
  },
];

/** Which preset (if any) exactly matches the given theme — used to highlight
 *  the active preset button. Returns null once any token has been hand-edited
 *  away from every known preset (including after a manual edit that happens
 *  to not match "Default" either). */
export function matchingPresetKey(theme) {
  for (const preset of THEME_PRESETS) {
    const keys = Object.keys(preset.theme);
    if (keys.every((k) => (theme?.[k] || "").toLowerCase() === preset.theme[k].toLowerCase())) {
      return preset.key;
    }
  }
  return null;
}
