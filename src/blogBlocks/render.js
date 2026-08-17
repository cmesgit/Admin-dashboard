// PLACEMENT: shared/src/blogBlocks/render.js  (canonical — edit here only)
//
// blocks + theme  →  the HTML string stored in BlogPost.body_html.
//
// This is the ONLY renderer. The admin editor uses it for live preview and
// again on save (the saved body_html is literally this function's output), and
// the public reader consumes that stored output. There is deliberately no
// parallel Python implementation: two renderers in two languages drift, and
// this repo already carries one hand-synced-duplicate bug (the twin copies of
// blogBodyStyles.js). The cost of that choice is that stored body_html goes
// stale when the STRUCTURE changes; the blog list's bulk "Re-render" action
// exists for exactly that. Pure style changes need no re-render, because the
// markup below only emits class names — all appearance lives in blocksCss.js.
//
// Output shape:
//   <div class="cd-root">
//     <section class="cd-blk cd-blk--hero cd-w-full">…</section>
//     <section class="cd-blk cd-blk--rich_text cd-w-normal">…</section>
//   </div>
//
// Every block is its own full-width section carrying its own max-width, rather
// than everything sharing one `.cd-body` wrapper as customDesignTemplate.html
// does. That is what makes per-block width/background settings possible — a
// `full` block can bleed edge-to-edge between two `normal` ones.
//
// SAFETY: plain-text fields are escaped here. Fields named `html` hold inline
// markup from the restricted TipTap editor and are passed through — the server
// still runs clean_html() over the finished string on save (block-authored
// posts set trusted_html=false), so this is not the last line of defence.

import { normalizeBlocks, normalizeTheme, THEME_TOKENS } from "./schema.js";

/* ────────────────────────────── Primitives ────────────────────────────── */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Escape a plain-text field for use in element content or an attribute. */
export function esc(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/[&<>"']/g, (c) => ESC[c]);
}

/** Pass through inline markup from the restricted editor. Named so call sites
 *  read as a deliberate decision rather than a missing escape. */
const inline = (v) => (typeof v === "string" ? v : "");

const cls = (...parts) => parts.filter(Boolean).join(" ");

/** Emit ` attr="…"` only when there is something to emit. */
const attr = (name, v) => (v ? ` ${name}="${esc(v)}"` : "");

/* ───────────────────────────── Block wrapper ──────────────────────────── */

function wrapperStyle(s) {
  const out = [];
  if (Number.isFinite(s.pt)) out.push(`padding-top:${s.pt}px`);
  if (Number.isFinite(s.pb)) out.push(`padding-bottom:${s.pb}px`);
  // Backgrounds resolve to a theme token, never a raw hex, so retinting the
  // post retints the block too.
  if (s.bg && THEME_TOKENS.includes(s.bg)) out.push(`background:var(--${s.bg})`);
  return out.join(";");
}

function wrap(block, innerHtml) {
  const s = block.s;
  const style = wrapperStyle(s);
  const className = cls(
    "cd-blk",
    `cd-blk--${block.t}`,
    `cd-w-${s.width}`,
    s.align !== "left" && `cd-a-${s.align}`,
  );
  return `<section class="${className}"${attr("style", style)}>${innerHtml}</section>`;
}

/* ─────────────────────────── Per-block renderers ──────────────────────── */

// A title may carry one accented fragment — the `<span>` the live pages use to
// colour part of a heading (customDesignTemplate.html:157, :176).
function titleHtml(title, accent) {
  const head = esc(title);
  const tail = accent ? `${title ? " " : ""}<span>${esc(accent)}</span>` : "";
  return `${head}${tail}`;
}

const renderers = {
  hero(b) {
    const decor =
      b.decor === "none"
        ? ""
        : b.decor === "lines"
          ? `<div class="cd-hero-lines"><span></span><span></span><span></span></div>`
          : `<div class="cd-hero-${esc(b.decor)}"></div>`;

    const bgNum = b.bgNum ? `<div class="cd-hero-bg-num">${esc(b.bgNum)}</div>` : "";
    const overline = b.overline ? `<div class="cd-overline">${esc(b.overline)}</div>` : "";
    const subtitle = b.subtitle ? `<p class="cd-hero-sub">${esc(b.subtitle)}</p>` : "";

    const stats = b.stats.length
      ? `<div class="cd-hero-bar">${b.stats
          .map(
            (it) =>
              `<div class="cd-hero-bar-item">` +
              `<div class="cd-bar-label">${esc(it.label)}</div>` +
              `<div class="cd-bar-value">${esc(it.value)}</div>` +
              `</div>`,
          )
          .join("")}</div>`
      : "";

    // Chips are plain short labels (an emoji + a couple of words), not
    // inline-formatted content, so — unlike feature_grid's htmlList rows —
    // they are escaped here rather than passed through via inline().
    const chips = b.chips.length
      ? `<div class="cd-hero-chips">${b.chips
          .map((c, i) => (i > 0 ? `<span class="cd-hero-chip-dot"></span>` : "") + `<span class="cd-hero-chip">${esc(c)}</span>`)
          .join("")}</div>`
      : "";

    return (
      `<div class="cd-hero">${decor}${bgNum}` +
      `<div class="cd-hero-inner">${overline}` +
      `<h1 class="cd-hero-title">${titleHtml(b.title, b.titleAccent)}</h1>` +
      `${subtitle}${chips}${stats}</div></div>`
    );
  },

  section_header(b) {
    const num = b.num ? `<div class="cd-sec-num">${esc(b.num)}</div>` : "";
    const kicker = b.kicker
      ? `<div class="cd-sec-badge"><div class="cd-badge-dot"></div>${esc(b.kicker)}</div>`
      : "";
    return (
      `<div class="cd-sec-head">${num}<div class="cd-sec-title-wrap">${kicker}` +
      `<h2 class="cd-sec-title">${titleHtml(b.title, b.titleAccent)}</h2>` +
      `<div class="cd-sec-rule"></div></div></div>`
    );
  },

  rich_text: (b) => `<div class="cd-text">${inline(b.html)}</div>`,

  callout: (b) => `<div class="cd-callout cd-callout--${esc(b.variant)}">${inline(b.html)}</div>`,

  faq_group(b) {
    const chip = b.chipLabel
      ? `<div class="cd-faq-label"><div class="cd-badge-dot"></div>${esc(b.chipLabel)}</div>`
      : "";
    const heading = b.heading
      ? `<h2 class="cd-faq-heading">${esc(b.heading)}</h2><div class="cd-faq-rule"></div>`
      : "";
    // Native <details> — the live pages use no JavaScript for this, and the
    // reader iframe has no `allow-scripts`, so a JS accordion could not work.
    const items = b.items
      .map(
        (it) =>
          `<details class="cd-faq-item" data-faq>` +
          `<summary class="cd-faq-q">${esc(it.q)}</summary>` +
          `<div class="cd-faq-ans">${inline(it.a)}</div>` +
          `</details>`,
      )
      .join("");
    return `${chip}${heading}${items}`;
  },

  table(b) {
    if (!b.headers.length && !b.rows.length) return "";
    const width = b.headers.length;
    const head = b.headers.length
      ? `<thead><tr>${b.headers
          .map((h) => `<th style="background:var(--${esc(h.bg)})">${esc(h.text)}</th>`)
          .join("")}</tr></thead>`
      : "";
    // Reconcile every row to the header count so an uneven paste can't produce
    // a ragged table.
    const body = b.rows.length
      ? `<tbody>${b.rows
          .map((row) => {
            const cells = width ? Array.from({ length: width }, (_, i) => row[i] ?? "") : row;
            return `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`;
          })
          .join("")}</tbody>`
      : "";
    const hint = b.scrollHint
      ? `<div class="cd-scroll-hint">← Swipe to see the full table →</div>`
      : "";
    return `${hint}<div class="cd-table-wrap"><table class="cd-table">${head}${body}</table></div>`;
  },

  feature_grid(b) {
    if (!b.cards.length) return "";
    const cards = b.cards
      .map(
        (c) =>
          `<div class="cd-card cd-c${c.color}">` +
          `<div class="cd-card-hdr">` +
          (c.tag ? `<div class="cd-card-tag">${esc(c.tag)}</div>` : "") +
          `<div class="cd-card-name">${esc(c.name)}</div></div>` +
          `<div class="cd-card-body">${c.rows
            .map(
              (r) =>
                `<div class="cd-card-row"><div class="cd-card-dot"></div><span>${inline(r)}</span></div>`,
            )
            .join("")}</div></div>`,
      )
      .join("");
    return `<div class="cd-card-grid cd-cols-${b.columns}">${cards}</div>`;
  },

  stat_grid(b) {
    if (!b.items.length) return "";
    const items = b.items
      .map(
        (it) =>
          `<div class="cd-stat-box">` +
          `<div class="cd-stat-num">${esc(it.value)}</div>` +
          `<div class="cd-stat-label">${esc(it.label)}</div>` +
          `</div>`,
      )
      .join("");
    return `<div class="cd-stat-grid cd-cols-${b.columns}">${items}</div>`;
  },

  timeline(b) {
    if (!b.items.length) return "";
    const items = b.items
      .map(
        (it) =>
          `<div class="cd-tl-item">` +
          `<div class="cd-tl-left"><div class="cd-tl-dot"></div><div class="cd-tl-year">${esc(it.year)}</div></div>` +
          `<div class="cd-tl-content"><div class="cd-tl-name">${esc(it.name)}</div>` +
          `<div class="cd-tl-desc">${inline(it.desc)}</div></div>` +
          `</div>`,
      )
      .join("");
    return `<div class="cd-timeline">${items}</div>`;
  },

  key_terms(b) {
    if (!b.items.length) return "";
    const heading = b.heading ? `<h3 class="cd-terms-heading">${esc(b.heading)}</h3>` : "";
    const items = b.items
      .map(
        (it) =>
          `<div class="cd-term"><div class="cd-term-name">${esc(it.term)}</div>` +
          `<div class="cd-term-def">${inline(it.def)}</div></div>`,
      )
      .join("");
    return `${heading}<div class="cd-terms">${items}</div>`;
  },

  image(b) {
    if (!b.src) return "";
    // loading="lazy" is in the sanitizer's img allowlist (sanitize.py:44).
    const img = `<img class="cd-img" src="${esc(b.src)}"${attr("alt", b.alt)} loading="lazy">`;
    return b.caption
      ? `<figure class="cd-figure">${img}<figcaption>${esc(b.caption)}</figcaption></figure>`
      : img;
  },

  divider: (b) =>
    b.mark === "none"
      ? `<div class="cd-divider cd-divider--plain"></div>`
      : `<div class="cd-divider"><div class="cd-divider-mark cd-divider-mark--${esc(b.mark)}"></div></div>`,

  legacy_html: (b) => inline(b.html),
};

/* ──────────────────────────────── Entry ───────────────────────────────── */

/**
 * Render a block tree to the HTML string stored in `body_html`.
 *
 * The theme is NOT emitted here. `body_theme` travels as JSON and is injected
 * as a <style> block into the preview/reader iframe srcDoc by the host page —
 * the sanitizer strips <style> tags outright (sanitize.py has no "style" in
 * ALLOWED_TAGS), so a theme baked into this string would silently vanish on
 * save. Keeping colour out of the markup is also what lets a re-theme apply
 * without re-rendering a single post.
 */
export function renderBlocks(blocks) {
  return normalizeBlocks(blocks)
    .map((b) => {
      const inner = renderers[b.t]?.(b) ?? "";
      return inner ? wrap(b, inner) : "";
    })
    .filter(Boolean)
    .join("\n");
}

/** Wrap rendered blocks in the root element the stylesheet scopes to. */
export function renderDocument(blocks) {
  return `<div class="cd-root">\n${renderBlocks(blocks)}\n</div>`;
}

/**
 * Build the `<style>` text that carries a post's palette into the iframe.
 * Host pages (BlogDetail.jsx and the admin preview) concatenate this with the
 * shared stylesheet when assembling srcDoc. Values are hex-validated by
 * normalizeTheme(), so this cannot inject anything beyond a colour.
 */
export function themeStyleText(theme) {
  const t = normalizeTheme(theme);
  const decls = THEME_TOKENS.map((name) => `  --${name}: ${t[name]};`).join("\n");
  return `:root {\n${decls}\n}`;
}

/* ───────────────────────── Viewport-unit neutralizer ──────────────────── */
//
// Originally local to shiksha-frontend/src/components/BlogDetail.jsx; moved
// here so BOTH the public reader and the admin preview share one
// implementation. It applies to LEGACY (non-block) chapter HTML — 114 of the
// 115 imported posts contain at least one `vh` value in their own hand-
// written <style> block — not to block-authored posts, since blocksCss.js is
// vh-free by construction (see that file's header) and enforced by
// selftest.js. It is still exported from here, not deleted, because the
// public reader needs it regardless of which path (blocks or legacy html) a
// given post takes.
//
// Nominal viewport height (px) that `vh` units in legacy chapter CSS are
// rewritten against. 800 ≈ a normal desktop viewport, which is what these
// chapters were hand-designed in.
export const NOMINAL_VIEWPORT_PX = 800;

// Inside an auto-height iframe, `vh` resolves against the IFRAME's height,
// which the host page sets FROM the content's measured height:
//
//   measure content -> grow iframe -> 100vh grows -> content grows -> ...
//
// On class-9/science/chapter-9 that inflated a single hero to ~9,900px and
// left the iframe ~5,700px shorter than its own content (the tail was
// unreachable behind `scrolling="no"`, and the oversized empty hero read as
// a huge blank band). Rewriting `vh` to a fixed px equivalent breaks the
// dependency entirely: content height becomes a pure function of the HTML,
// so one measurement is stable and correct.
//
// Scoped to <style> blocks and inline style attributes — a compatibility
// shim for imported legacy markup, not a general CSS transform. `vmin`/
// `vmax`/`svh`/`dvh`/`lvh` are covered too (same iframe-relative problem);
// `vw` is left alone because iframe width IS the real viewport width and
// does not feed back.
const VIEWPORT_UNIT_RE = /(-?\d*\.?\d+)(svh|lvh|dvh|vh|vmin|vmax)\b/gi;

export const neutralizeViewportUnits = (markup) =>
  (markup || "").replace(/<style\b[^>]*>[\s\S]*?<\/style>|style="[^"]*"/gi, (block) =>
    block.replace(VIEWPORT_UNIT_RE, (_m, num) =>
      `${((parseFloat(num) / 100) * NOMINAL_VIEWPORT_PX).toFixed(2).replace(/\.?0+$/, "")}px`
    )
  );
