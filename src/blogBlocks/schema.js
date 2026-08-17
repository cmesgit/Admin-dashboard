// PLACEMENT: shared/src/blogBlocks/schema.js  (canonical — edit here only)
//
// The block-tree contract for CMS blog bodies. This is the single source of
// truth for what a block IS; the renderer (render.js), the editor
// (Admin-dashboard), and the backend validator (content/blocks.py) all follow
// it. Changing a block's stored shape after posts exist means migrating stored
// JSON, so prefer ADDING an optional field over repurposing an existing one.
//
// ── Why these particular blocks ──────────────────────────────────────────
// They are not invented. They are the vocabulary already used across the 115
// live chapter pages, whose canonical expression is the 259-line starter at
// Admin-dashboard/src/pages/content/blogTemplates/customDesignTemplate.html.
// Every block below maps 1:1 onto a `cd-*` component in that file, so any
// design already published stays expressible. When adding a block, add the
// matching `cd-*` rules to blocksCss.js in the same change.
//
// ── Storage convention ───────────────────────────────────────────────────
// Block shape is `{ id, t, ...props, s }`, mirroring the `{"t": "<type>"}`
// convention already established by GuideSection.blocks
// (shiksha-backend/counseling/guide_models.py:160). As there, the backend
// validates on WRITE only and stays permissive on READ, so an app build that
// predates a new block type renders the rest of the post instead of failing.
//
// Text fields hold PLAIN text and are escaped at render time. The exception is
// any field named `html`, which holds inline-formatted markup from the
// restricted TipTap editor. Do NOT run the HTML sanitizer over plain-text
// fields — that is what corrupted `&` into `&amp;` in the counseling guides
// (see the load-bearing comment at counseling/guide_models.py:169-180).

/* ─────────────────────────── Theme tokens ─────────────────────────────── */

// The 24 CSS custom properties every live chapter varies, taken verbatim from
// customDesignTemplate.html's :root. `body_theme` is a map of these names to
// hex strings. It is JSON — it never passes through the HTML sanitizer, and is
// injected into the preview/reader iframe srcDoc as a <style> block by the
// host page. That is the whole reason per-post <style> and `trusted_html`
// become unnecessary for block-authored posts.
export const THEME_TOKENS = [
  // Neutrals / surfaces
  "ink", "ink2", "muted", "paper", "paper2", "rule", "white",
  // Primary accent triad — the one an author retints most often
  "accent", "accent2", "accent-lt",
  // Secondary palette, each paired with a light variant for chips/fills
  "coral", "coral-lt",
  "gold", "gold-lt",
  "purple", "purple-lt",
  "blue", "blue-lt",
  "rose", "rose-lt",
  "green", "green-lt",
  "red", "red-lt",
];

// Indigo default, matching customDesignTemplate.html:20-45 exactly so an
// author who picks no theme gets the starter's look rather than an unstyled
// page. Subject presets (Phase 5) are additional entries of this same shape.
export const DEFAULT_THEME = {
  "ink": "#16181d",
  "ink2": "#2a2d36",
  "muted": "#626878",
  "paper": "#f6f7fb",
  "paper2": "#e9ebf5",
  "rule": "#c7cbe6",
  "white": "#ffffff",
  "accent": "#4f46e5",
  "accent2": "#3730a3",
  "accent-lt": "#e0e7ff",
  "coral": "#e0562b",
  "coral-lt": "#fde7df",
  "gold": "#b45309",
  "gold-lt": "#fef3c7",
  "purple": "#7c3aed",
  "purple-lt": "#ede9fe",
  "blue": "#1d4ed8",
  "blue-lt": "#dbeafe",
  "rose": "#be123c",
  "rose-lt": "#ffe4e6",
  "green": "#167a4a",
  "green-lt": "#d7f5e3",
  "red": "#b91c1c",
  "red-lt": "#fee2e2",
};

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Keep only known tokens holding real hex colours, then fill gaps from the
 *  default. Unknown keys are dropped rather than rejected so a post authored
 *  by a newer build degrades instead of erroring. */
export function normalizeTheme(theme) {
  const out = { ...DEFAULT_THEME };
  if (theme && typeof theme === "object") {
    for (const token of THEME_TOKENS) {
      const v = theme[token];
      if (typeof v === "string" && HEX_RE.test(v.trim())) out[token] = v.trim();
    }
  }
  return out;
}

/* ─────────────────────── Per-block layout settings ────────────────────── */

// Every block carries `s` (settings) — this is the "control padding and layout
// by hand" surface, expressed as a form instead of as CSS the author types.
// Values are kept as tokens, not raw pixels, so the rendered markup stays
// theme-driven and responsive; `pt`/`pb` are the one place a raw number is
// allowed, because per-section vertical rhythm is exactly what authors tune.

export const WIDTHS = ["normal", "wide", "full"];   // 880px / 1140px / edge-to-edge
export const ALIGNS = ["left", "center", "right"];
export const SPACE_SCALE = [0, 8, 16, 24, 32, 48, 64, 96];

export const DEFAULT_SETTINGS = {
  width: "normal",
  align: "left",
  pt: null,      // null = use the block's own default rhythm from the stylesheet
  pb: null,
  bg: null,      // null = transparent; otherwise a THEME_TOKENS name
};

function normalizeSettings(s, spec) {
  // A block type may shift its own baseline (e.g. hero is full-bleed) via
  // `defaultSettings`; an author's explicit choice still wins over both.
  const out = { ...DEFAULT_SETTINGS, ...(spec?.defaultSettings || {}) };
  if (!s || typeof s !== "object") return out;
  if (WIDTHS.includes(s.width)) out.width = s.width;
  if (ALIGNS.includes(s.align)) out.align = s.align;
  if (Number.isFinite(s.pt)) out.pt = clampSpace(s.pt);
  if (Number.isFinite(s.pb)) out.pb = clampSpace(s.pb);
  if (typeof s.bg === "string" && THEME_TOKENS.includes(s.bg)) out.bg = s.bg;
  return out;
}

const clampSpace = (n) => Math.max(0, Math.min(200, Math.round(n)));

/* ────────────────────────────── Block types ───────────────────────────── */

// Each entry declares the block's stored fields and their defaults. `fields`
// drives both the editor's settings panel and the write-time validator, so a
// new block needs no parallel edit in either place.
//
// kind: "text"  plain text, escaped at render
//       "html"  inline markup from restricted TipTap, sanitized at render
//       "enum"  one of `options`
//       "bool" | "int"
//       "list"  repeating group described by `item`
export const BLOCK_SPECS = {
  // The full-bleed chapter opener: overline, big title with an accented
  // fragment, an optional oversized background number, and the 4-up stat
  // strip. `decor` selects the ambient background treatment — the corpus uses
  // dots/hex/grid/speed-lines, which are pure CSS in blocksCss.js rather than
  // the per-post decorative divs the legacy pages hand-wrote.
  hero: {
    label: "Hero",
    // The chapter opener is edge-to-edge in every live post; boxing it into the
    // default 880px column would be wrong every single time.
    defaultSettings: { width: "full" },
    fields: {
      overline: { kind: "text", default: "" },
      title: { kind: "text", default: "" },
      titleAccent: { kind: "text", default: "" },
      // Added after the Phase 6 coverage spike found 19 of 114 legacy posts
      // use a subtitle paragraph under the H1 (their `hero-sub` class) with
      // no equivalent field here — a real, cheap gap, not speculative.
      subtitle: { kind: "text", default: "" },
      bgNum: { kind: "text", default: "" },
      decor: { kind: "enum", options: ["dots", "hex", "grid", "lines", "none"], default: "dots" },
      stats: {
        kind: "list",
        default: [],
        item: { label: { kind: "text", default: "" }, value: { kind: "text", default: "" } },
      },
      // Alternate to `stats`: a row of short pill labels with dot separators
      // (e.g. "🏭 Geography · 📖 Revision Notes · ❓ 15 FAQs Included")
      // instead of the label/value stat-bar. Added after the coverage spike
      // found 18 of 114 legacy posts use this instead of the stat-bar — the
      // two never co-occur in the same post, so both fields simply render
      // when populated rather than needing an either/or mode switch.
      chips: { kind: "htmlList", default: [] },
    },
  },

  // Numbered section opener: badge/kicker + title with an accented fragment +
  // the short gradient rule. `num` is optional because ~5 of 22 sampled posts
  // use the badge without a number.
  section_header: {
    label: "Section header",
    fields: {
      num: { kind: "text", default: "" },
      kicker: { kind: "text", default: "" },
      title: { kind: "text", default: "" },
      titleAccent: { kind: "text", default: "" },
    },
  },

  // Body copy. The only block whose content is authored in TipTap, restricted
  // to inline formatting + links + lists — it cannot introduce structure,
  // which is what the other blocks are for.
  rich_text: {
    label: "Text",
    fields: { html: { kind: "html", default: "" } },
  },

  // The dark gradient intro card and its lighter info/warn/success siblings.
  callout: {
    label: "Callout",
    fields: {
      variant: {
        kind: "enum",
        options: ["intro", "info", "warning", "success", "highlight"],
        default: "intro",
      },
      html: { kind: "html", default: "" },
    },
  },

  // Native <details> accordion — no JavaScript, exactly as the live pages do
  // it. Every sampled chapter ships 12 items, so the editor offers bulk paste.
  faq_group: {
    label: "FAQ",
    fields: {
      chipLabel: { kind: "text", default: "FAQ" },
      heading: { kind: "text", default: "Frequently Asked Questions" },
      items: {
        kind: "list",
        default: [],
        item: { q: { kind: "text", default: "" }, a: { kind: "html", default: "" } },
      },
    },
  },

  // Comparison table. Per-header background is a theme token name, replacing
  // the inline `style="background:#3730a3"` the starter template tells authors
  // to hand-edit (customDesignTemplate.html:220-223).
  table: {
    label: "Table",
    fields: {
      scrollHint: { kind: "bool", default: true },
      headers: {
        kind: "list",
        default: [],
        item: {
          text: { kind: "text", default: "" },
          bg: { kind: "enum", options: THEME_TOKENS, default: "accent" },
        },
      },
      // Rows are a plain string matrix; cell count is reconciled against
      // `headers` at render time so an uneven paste cannot break the layout.
      rows: { kind: "matrix", default: [] },
    },
  },

  // The 2-4 up card grid with dark gradient headers and dotted body rows.
  feature_grid: {
    label: "Card grid",
    fields: {
      columns: { kind: "int", default: 3, min: 2, max: 4 },
      cards: {
        kind: "list",
        default: [],
        item: {
          tag: { kind: "text", default: "" },
          name: { kind: "text", default: "" },
          color: { kind: "int", default: 1, min: 1, max: 4 },
          rows: { kind: "htmlList", default: [] },
        },
      },
    },
  },

  // Big-number-plus-caption stat callouts (e.g. "7% — Annual growth rate…").
  // Added after the Phase 6 coverage spike — 46 of 114 legacy posts
  // (40%, mostly outside science) use this exact pattern, distinct from both
  // hero's compact stat-bar (dark, inline strip inside the hero) and
  // feature_grid's cards (tag+name+detail-list, not a bare number).
  stat_grid: {
    label: "Stat grid",
    fields: {
      columns: { kind: "int", default: 4, min: 2, max: 5 },
      items: {
        kind: "list",
        default: [],
        item: { value: { kind: "text", default: "" }, label: { kind: "text", default: "" } },
      },
    },
  },

  // Vertical dated-events list (year + name + description per entry). Added
  // after the Phase 6 coverage spike — 24 of 114 legacy posts use this exact
  // year/dot/content shape, mostly in economics/history chapters walking
  // through a sequence of policies or events.
  timeline: {
    label: "Timeline",
    fields: {
      items: {
        kind: "list",
        default: [],
        item: {
          year: { kind: "text", default: "" },
          name: { kind: "text", default: "" },
          desc: { kind: "html", default: "" },
        },
      },
    },
  },

  // Definition chips — the `*-fn-tag` / key-term pattern that appears in the
  // science chapters.
  key_terms: {
    label: "Key terms",
    fields: {
      heading: { kind: "text", default: "" },
      items: {
        kind: "list",
        default: [],
        item: { term: { kind: "text", default: "" }, def: { kind: "html", default: "" } },
      },
    },
  },

  image: {
    label: "Image",
    fields: {
      src: { kind: "text", default: "" },
      alt: { kind: "text", default: "" },
      caption: { kind: "text", default: "" },
    },
  },

  divider: {
    label: "Divider",
    fields: {
      mark: { kind: "enum", options: ["hex", "dot", "none"], default: "hex" },
    },
  },

  // Escape hatch and migration target. Holds markup the block importer could
  // not confidently map (per-post decorative divs, one-off components), so an
  // imported legacy post is never lossy. Rendered verbatim after sanitization.
  // A post containing one of these still needs `trusted_html` if its markup
  // relies on a <style> block.
  legacy_html: {
    label: "Raw HTML",
    fields: { html: { kind: "html", default: "" } },
  },
};

// Mirrored in shiksha-backend/content/blocks.py — keep the two in step.
export const KNOWN_BLOCK_TYPES = Object.keys(BLOCK_SPECS);

/* ───────────────────────────── Construction ───────────────────────────── */

let idCounter = 0;
/** Block ids only need to be unique within one post — they are React keys and
 *  drag handles, never anything persistent or cross-referenced. */
export function newBlockId() {
  idCounter += 1;
  return `b${Date.now().toString(36)}${idCounter.toString(36)}`;
}

function defaultsFor(spec) {
  const out = {};
  for (const [name, f] of Object.entries(spec.fields)) {
    out[name] = Array.isArray(f.default) ? [...f.default] : f.default;
  }
  return out;
}

/** Create a block of `type` with every field at its default.
 *  `props.s` is merged over DEFAULT_SETTINGS rather than replacing it, so a
 *  caller can set one setting without having to restate the rest. */
export function createBlock(type, props = {}) {
  const spec = BLOCK_SPECS[type];
  if (!spec) throw new Error(`Unknown block type: ${type}`);
  const { s, ...fields } = props;
  return {
    id: newBlockId(),
    t: type,
    ...defaultsFor(spec),
    ...fields,
    s: { ...DEFAULT_SETTINGS, ...(spec.defaultSettings || {}), ...(s || {}) },
  };
}

/* ───────────────────────────── Normalization ──────────────────────────── */

/** Coerce one stored block into a fully-populated, render-safe shape.
 *  Returns null for a block whose type this build does not know — callers drop
 *  those, which is the deliberate permissive-on-read behaviour. */
export function normalizeBlock(raw) {
  if (!raw || typeof raw !== "object") return null;
  const spec = BLOCK_SPECS[raw.t];
  if (!spec) return null;

  const out = { id: typeof raw.id === "string" && raw.id ? raw.id : newBlockId(), t: raw.t };

  for (const [name, f] of Object.entries(spec.fields)) {
    out[name] = normalizeField(raw[name], f);
  }
  out.s = normalizeSettings(raw.s, spec);
  return out;
}

function normalizeField(value, f) {
  switch (f.kind) {
    case "text":
    case "html":
      return typeof value === "string" ? value : f.default;

    case "bool":
      return typeof value === "boolean" ? value : f.default;

    case "int": {
      if (!Number.isFinite(value)) return f.default;
      const n = Math.round(value);
      return Math.max(f.min ?? -Infinity, Math.min(f.max ?? Infinity, n));
    }

    case "enum":
      return f.options.includes(value) ? value : f.default;

    case "htmlList":
      return Array.isArray(value) ? value.filter((s) => typeof s === "string") : [...f.default];

    case "matrix":
      return Array.isArray(value)
        ? value
            .filter(Array.isArray)
            .map((row) => row.map((c) => (typeof c === "string" ? c : "")))
        : [...f.default];

    case "list": {
      if (!Array.isArray(value)) return [...f.default];
      return value.map((entry) => {
        const item = {};
        for (const [k, sub] of Object.entries(f.item)) {
          item[k] = normalizeField(entry?.[k], sub);
        }
        return item;
      });
    }

    default:
      return f.default;
  }
}

/** Normalize a whole stored tree, dropping unknown block types. */
export function normalizeBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map(normalizeBlock).filter(Boolean);
}

/** True when a post should render from blocks rather than legacy body_html. */
export function hasBlocks(blocks) {
  return Array.isArray(blocks) && blocks.length > 0;
}
