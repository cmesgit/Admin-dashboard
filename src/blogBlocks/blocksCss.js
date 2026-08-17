// PLACEMENT: shared/src/blogBlocks/blocksCss.js  (canonical — edit here only)
//
// The one stylesheet for block-authored blog bodies. Transcribed from
// Admin-dashboard/src/pages/content/blogTemplates/customDesignTemplate.html,
// which is the canonical expression of the design already used across the live
// chapter pages — so anything published today stays reproducible.
//
// Exported as a JS template literal rather than a .css file because it is
// injected as a *string* into the reader/preview iframe's srcDoc; there is no
// bundler on the other side of that boundary.
//
// ── Two rules that are load-bearing ──────────────────────────────────────
//
// 1. NO VIEWPORT-HEIGHT UNITS. Not vh, svh, lvh, dvh, vmin or vmax — anywhere,
//    ever. `neutralizeViewportUnits` (BlogDetail.jsx:55-61) rewrites those to
//    px, but it only runs over the *body* markup; this sheet is injected into
//    <head>, downstream of it. Inside an auto-height iframe driven by a
//    ResizeObserver, a vh value is a feedback loop: measure -> grow iframe ->
//    vh grows -> content grows. That bug is not hypothetical — it inflated one
//    hero on class-9/science/chapter-9 to ~9,900px (see that file's comment).
//    The starter template's `.cd-hero { min-height: 78vh }` is therefore a px
//    value here. `vw` IS allowed: iframe width is the real viewport width and
//    does not feed back, so the clamp() type scales below are safe.
//
// 2. EVERY colour goes through `var(--token, fallback)`. The palette arrives
//    separately as JSON (see render.js -> themeStyleText), so a post saved
//    before a token existed must degrade to something readable rather than
//    collapse to transparent/black.

// Height the hero occupies instead of the original 78vh. Chosen to match the
// rendered height of the legacy heroes at the 800px nominal viewport that
// NOMINAL_VIEWPORT_PX already assumes (0.78 * 800 = 624).
const HERO_MIN_H = "624px";

export const BLOG_BLOCKS_CSS = `
/* ── Root & block frame ─────────────────────────────────────────────── */
.cd-root {
  font-family: 'Inter', sans-serif;
  background: var(--paper, #f6f7fb);
  color: var(--ink, #16181d);
}
.cd-root *, .cd-root *::before, .cd-root *::after { box-sizing: border-box; }
.cd-root p, .cd-root h1, .cd-root h2, .cd-root h3, .cd-root div { margin: 0; }

/* Each block is its own full-width strip carrying its own max-width. That is
   what lets a 'full' block bleed edge-to-edge between two 'normal' ones —
   the starter template's single shared .cd-body wrapper could not. */
.cd-blk { padding-inline: 32px; }
.cd-w-normal { max-width: 944px;  margin-inline: auto; }   /* 880 content + gutters */
.cd-w-wide   { max-width: 1204px; margin-inline: auto; }   /* 1140 content + gutters */
.cd-w-full   { max-width: none;   padding-inline: 0; }
.cd-a-center { text-align: center; }
.cd-a-right  { text-align: right; }

/* Default vertical rhythm. Authors override per block via the pt/pb settings,
   which render as an inline style and therefore win over these. */
.cd-blk + .cd-blk { padding-top: 8px; }
.cd-blk--section_header { padding-top: 48px; }
.cd-blk--rich_text      { padding-bottom: 24px; }
.cd-blk--hero           { padding-top: 0; }

@media (max-width: 700px) {
  .cd-blk { padding-inline: 18px; }
  .cd-w-full { padding-inline: 0; }
}

/* ── Hero ───────────────────────────────────────────────────────────── */
.cd-hero {
  background: linear-gradient(135deg, #0b0c1a 0%, #14163a 50%, #1c1f4d 100%);
  min-height: ${HERO_MIN_H};
  display: flex; align-items: flex-end;
  position: relative; overflow: hidden;
  padding: 0 0 56px;
}
.cd-hero::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 6px;
  background: linear-gradient(90deg,
    var(--accent, #4f46e5) 0%, var(--coral, #e0562b) 32%,
    var(--purple, #7c3aed) 60%, var(--rose, #be123c) 82%, var(--gold, #b45309) 100%);
}

/* Decor variants — curated CSS-only replacements for the per-post decorative
   divs the legacy pages hand-wrote (hero-grid, speed-lines, glow-a/b). Those
   were driven entirely by the per-post <style> block this sheet replaces, so
   they are deliberately not round-tripped by the importer. */
.cd-hero-dots, .cd-hero-hex, .cd-hero-grid, .cd-hero-lines {
  position: absolute; inset: 0; pointer-events: none;
}
.cd-hero-dots {
  background-image: radial-gradient(circle, rgba(129,140,248,0.16) 1px, transparent 1px);
  background-size: 28px 28px;
}
.cd-hero-grid {
  background-image:
    linear-gradient(rgba(129,140,248,0.10) 1px, transparent 1px),
    linear-gradient(90deg, rgba(129,140,248,0.10) 1px, transparent 1px);
  background-size: 44px 44px;
}
.cd-hero-hex {
  inset: auto 5% auto auto; top: 50%; transform: translateY(-50%);
  width: clamp(140px, 22vw, 260px); height: clamp(140px, 22vw, 260px);
}
.cd-hero-hex::before, .cd-hero-hex::after {
  content: ''; position: absolute;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
}
.cd-hero-hex::before { inset: 0;   background: rgba(129,140,248,0.07); }
.cd-hero-hex::after  { inset: 26%; background: rgba(129,140,248,0.06); }
.cd-hero-lines span {
  position: absolute; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(129,140,248,0.35), transparent);
}
.cd-hero-lines span:nth-child(1) { top: 32%; }
.cd-hero-lines span:nth-child(2) { top: 54%; }
.cd-hero-lines span:nth-child(3) { top: 71%; }

/* The oversized chapter numeral behind the title. */
.cd-hero-bg-num {
  position: absolute; right: 4%; bottom: -0.18em;
  font-family: 'Montserrat', sans-serif;
  font-size: clamp(180px, 34vw, 420px); font-weight: 900; line-height: 1;
  color: rgba(255,255,255,0.045);
  pointer-events: none; user-select: none;
}

.cd-hero-inner {
  max-width: 900px; width: 100%; margin: 0 auto;
  padding: 0 32px; position: relative; z-index: 1;
}
.cd-overline {
  font-family: 'Poppins', sans-serif;
  font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase;
  color: #a5b4fc; margin-bottom: 22px;
  display: flex; align-items: center; gap: 14px;
}
.cd-overline::before, .cd-overline::after {
  content: ''; flex: 0 0 40px; height: 1px; background: #a5b4fc;
}
.cd-hero-title {
  font-family: 'Montserrat', sans-serif;
  font-size: clamp(36px, 7.5vw, 74px); font-weight: 900;
  color: #fff; line-height: 0.98; letter-spacing: -0.03em; margin-bottom: 30px;
}
.cd-hero-title span { color: #a5b4fc; }
.cd-hero-sub {
  font-family: 'Inter', sans-serif;
  font-size: 16px; line-height: 1.7; color: rgba(255,255,255,0.72);
  max-width: 640px; margin-bottom: 28px;
}

/* Meta-chip row — the alternate to the stat-bar below; the two never
   co-occur in the real corpus, so no shared-parent rule is needed. */
.cd-hero-chips {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  margin-bottom: 28px;
}
.cd-hero-chip {
  font-family: 'Poppins', sans-serif;
  font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.78);
}
.cd-hero-chip-dot {
  width: 4px; height: 4px; border-radius: 50%;
  background: rgba(255,255,255,0.3); flex-shrink: 0;
}

.cd-hero-bar {
  display: flex; flex-wrap: wrap;
  border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;
}
.cd-hero-bar-item {
  flex: 1 1 150px; padding-right: 24px; margin-right: 24px;
  border-right: 1px solid rgba(255,255,255,0.08);
}
.cd-hero-bar-item:last-child { border-right: none; margin-right: 0; }
.cd-bar-label {
  font-family: 'Poppins', sans-serif;
  font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;
  color: rgba(255,255,255,0.32); margin-bottom: 5px;
}
.cd-bar-value {
  font-family: 'Poppins', sans-serif;
  font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.75);
}

@media (max-width: 700px) {
  .cd-hero { min-height: 0; align-items: flex-start; padding: 72px 0 44px; }
  .cd-hero-inner { padding: 0 18px; }
  .cd-hero-title { font-size: clamp(34px, 10vw, 54px); margin-bottom: 22px; }
  .cd-hero-sub { font-size: 14px; margin-bottom: 20px; }
  .cd-hero-chips { gap: 8px; margin-bottom: 20px; }
  .cd-hero-chip { font-size: 12px; }
  .cd-hero-bar-item { flex: 1 1 120px; padding-right: 14px; margin-right: 14px; }
  .cd-bar-label { font-size: 9px; }
  .cd-bar-value { font-size: 13px; }
  .cd-hero-bg-num { font-size: clamp(140px, 46vw, 260px); }
}

/* ── Section header ─────────────────────────────────────────────────── */
.cd-sec-head { display: flex; gap: 18px; align-items: flex-start; margin-bottom: 22px; }
.cd-sec-num {
  font-family: 'Montserrat', sans-serif;
  font-size: 42px; font-weight: 900; line-height: 1;
  color: var(--accent-lt, #e0e7ff);
  flex-shrink: 0; margin-top: -4px;
}
.cd-sec-title-wrap { min-width: 0; }
.cd-sec-badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--accent-lt, #e0e7ff); color: var(--accent2, #3730a3);
  font-family: 'Poppins', sans-serif;
  font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;
  padding: 5px 14px; border-radius: 100px; margin-bottom: 14px;
}
.cd-badge-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent, #4f46e5); flex-shrink: 0;
}
.cd-sec-title {
  font-family: 'Montserrat', sans-serif;
  font-size: clamp(22px, 4vw, 32px); font-weight: 900;
  color: var(--ink, #16181d); letter-spacing: -0.02em; line-height: 1.15;
  margin-bottom: 6px;
}
.cd-sec-title span { color: var(--accent, #4f46e5); }
.cd-sec-rule {
  width: 48px; height: 4px; border-radius: 2px;
  background: linear-gradient(90deg, var(--accent, #4f46e5), var(--purple, #7c3aed));
}

/* ── Body text ──────────────────────────────────────────────────────── */
.cd-text {
  font-family: 'Inter', sans-serif;
  font-size: 15.5px; color: var(--ink2, #2a2d36); line-height: 1.85;
}
.cd-text p { margin-bottom: 16px; }
.cd-text p:last-child { margin-bottom: 0; }
.cd-text strong { color: var(--accent2, #3730a3); font-weight: 600; }
.cd-text a { color: var(--accent, #4f46e5); text-decoration: underline; }
.cd-text ul, .cd-text ol { margin: 0 0 16px; padding-left: 1.4em; }
.cd-text li { margin: 4px 0; }
/* TipTap stores list items as <li><p>text</p></li>; without this the paragraph
   rule above adds a 16px gap under every bullet and lists render loose. */
.cd-text li > p { margin: 0; }
.cd-text li > p + p { margin-top: 8px; }
.cd-text h3 {
  font-family: 'Montserrat', sans-serif;
  font-size: 19px; font-weight: 800; color: var(--ink, #16181d);
  margin: 22px 0 10px;
}
.cd-text code {
  background: var(--paper2, #e9ebf5); border-radius: 4px; padding: 2px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em;
}

/* ── Callouts ───────────────────────────────────────────────────────── */
.cd-callout { border-radius: 4px; padding: 24px 28px; position: relative; overflow: hidden; }
.cd-callout p { margin-bottom: 14px; }
.cd-callout p:last-child { margin-bottom: 0; }

/* 'intro' is the starter template's dark gradient highlight card. */
.cd-callout--intro, .cd-callout--highlight {
  background: linear-gradient(135deg, #0b0c1a, #1c1f4d);
  border-left: 5px solid var(--accent, #4f46e5);
  padding: 34px 40px;
}
.cd-callout--intro p, .cd-callout--highlight p {
  font-family: 'Poppins', sans-serif;
  font-size: 17px; font-weight: 500; color: rgba(255,255,255,0.86); line-height: 1.8;
}
.cd-callout--intro strong, .cd-callout--highlight strong { color: #a5b4fc; }
.cd-callout--intro::after {
  content: '\\2726'; position: absolute; right: 30px; top: 50%;
  transform: translateY(-50%); font-size: 96px; opacity: 0.08; color: #fff;
}

.cd-callout--info, .cd-callout--warning, .cd-callout--success {
  border: 1px solid; border-left-width: 4px;
  font-size: 15px; line-height: 1.75; color: var(--ink2, #2a2d36);
}
.cd-callout--info {
  background: var(--blue-lt, #dbeafe);
  border-color: var(--blue, #1d4ed8); border-left-color: var(--blue, #1d4ed8);
}
.cd-callout--warning {
  background: var(--gold-lt, #fef3c7);
  border-color: var(--gold, #b45309); border-left-color: var(--gold, #b45309);
}
.cd-callout--success {
  background: var(--green-lt, #d7f5e3);
  border-color: var(--green, #167a4a); border-left-color: var(--green, #167a4a);
}

@media (max-width: 700px) {
  .cd-callout--intro, .cd-callout--highlight { padding: 24px 20px; }
  .cd-callout--intro p, .cd-callout--highlight p { font-size: 15px; }
}

/* ── Divider ────────────────────────────────────────────────────────── */
.cd-divider { margin: 48px 0; display: flex; align-items: center; gap: 14px; }
.cd-divider::before, .cd-divider::after {
  content: ''; flex: 1; height: 1px; background: var(--rule, #c7cbe6);
}
.cd-divider--plain::before, .cd-divider--plain::after { flex: 1; }
.cd-divider-mark { width: 20px; height: 20px; background: var(--accent, #4f46e5); flex-shrink: 0; }
.cd-divider-mark--hex { clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%); }
.cd-divider-mark--dot { width: 10px; height: 10px; border-radius: 50%; }

/* ── Feature card grid ──────────────────────────────────────────────── */
.cd-card-grid { display: grid; gap: 14px; }
.cd-cols-2 { grid-template-columns: repeat(2, 1fr); }
.cd-cols-3 { grid-template-columns: repeat(3, 1fr); }
.cd-cols-4 { grid-template-columns: repeat(4, 1fr); }
@media (max-width: 900px) { .cd-cols-4 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 620px) {
  .cd-cols-2, .cd-cols-3, .cd-cols-4 { grid-template-columns: 1fr; }
}
.cd-card {
  border-radius: 10px; overflow: hidden;
  border: 1.5px solid var(--rule, #c7cbe6);
  background: var(--white, #ffffff);
}
.cd-card-hdr { padding: 14px 16px; }
.cd-c1 .cd-card-hdr { background: linear-gradient(135deg, #10122e, var(--accent, #4f46e5)); }
.cd-c2 .cd-card-hdr { background: linear-gradient(135deg, #1a0a00, var(--coral, #e0562b)); }
.cd-c3 .cd-card-hdr { background: linear-gradient(135deg, #06231a, var(--green, #167a4a)); }
.cd-c4 .cd-card-hdr { background: linear-gradient(135deg, #1a0716, var(--purple, #7c3aed)); }
.cd-c1 .cd-card-dot { background: var(--accent, #4f46e5); }
.cd-c2 .cd-card-dot { background: var(--coral, #e0562b); }
.cd-c3 .cd-card-dot { background: var(--green, #167a4a); }
.cd-c4 .cd-card-dot { background: var(--purple, #7c3aed); }
.cd-card-tag {
  font-family: 'Poppins', sans-serif;
  font-size: 10px; font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase;
  color: rgba(255,255,255,0.5); margin-bottom: 3px;
}
.cd-card-name {
  font-family: 'Montserrat', sans-serif;
  font-size: 16px; font-weight: 900; color: #fff;
}
.cd-card-body { padding: 14px 16px; }
.cd-card-row {
  font-family: 'Inter', sans-serif;
  font-size: 12.5px; color: var(--ink2, #2a2d36); line-height: 1.65;
  padding: 5px 0; border-bottom: 1px solid var(--rule, #c7cbe6);
  display: flex; gap: 8px;
}
.cd-card-row:last-child { border-bottom: none; }
.cd-card-row strong { font-weight: 600; color: var(--ink, #16181d); }
.cd-card-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }

/* ── Table ──────────────────────────────────────────────────────────── */
.cd-scroll-hint {
  font-family: 'Poppins', sans-serif;
  font-size: 11px; font-weight: 600; color: var(--muted, #626878); margin-bottom: 8px;
}
.cd-table-wrap {
  overflow-x: auto; -webkit-overflow-scrolling: touch;
  border-radius: 10px; border: 1.5px solid var(--rule, #c7cbe6);
}
.cd-table { width: 100%; border-collapse: collapse; min-width: 520px; }
.cd-table th {
  font-family: 'Poppins', sans-serif;
  font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  padding: 13px 16px; color: #fff; text-align: left; white-space: nowrap;
}
.cd-table td {
  font-family: 'Inter', sans-serif;
  font-size: 13px; color: var(--ink2, #2a2d36); padding: 11px 16px;
  border-top: 1px solid var(--rule, #c7cbe6);
  border-right: 1px solid var(--rule, #c7cbe6);
  line-height: 1.55;
}
.cd-table td:first-child {
  font-family: 'Poppins', sans-serif; font-weight: 700; color: var(--accent2, #3730a3);
}
.cd-table td:last-child { border-right: none; }
.cd-table tr:nth-child(even) td { background: var(--paper2, #e9ebf5); }

/* ── Stat grid ──────────────────────────────────────────────────────── */
.cd-stat-grid { display: grid; gap: 14px; margin: 24px 0; }
.cd-stat-grid.cd-cols-2 { grid-template-columns: repeat(2, 1fr); }
.cd-stat-grid.cd-cols-3 { grid-template-columns: repeat(3, 1fr); }
.cd-stat-grid.cd-cols-4 { grid-template-columns: repeat(4, 1fr); }
.cd-stat-grid.cd-cols-5 { grid-template-columns: repeat(5, 1fr); }
@media (max-width: 900px) {
  .cd-stat-grid.cd-cols-4, .cd-stat-grid.cd-cols-5 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 620px) {
  .cd-stat-grid.cd-cols-2, .cd-stat-grid.cd-cols-3,
  .cd-stat-grid.cd-cols-4, .cd-stat-grid.cd-cols-5 { grid-template-columns: 1fr; }
}
.cd-stat-box {
  background: var(--paper2, #e9ebf5);
  border: 1px solid var(--rule, #c7cbe6);
  border-radius: 10px;
  padding: 18px 16px;
  text-align: center;
}
.cd-stat-num {
  font-family: 'Montserrat', sans-serif;
  font-size: clamp(24px, 4vw, 34px); font-weight: 900;
  color: var(--accent, #4f46e5); line-height: 1.1; margin-bottom: 6px;
}
.cd-stat-label {
  font-family: 'Inter', sans-serif;
  font-size: 12.5px; color: var(--ink2, #2a2d36); line-height: 1.4;
}

/* ── Timeline ───────────────────────────────────────────────────────── */
.cd-timeline { display: flex; flex-direction: column; margin: 24px 0; }
.cd-tl-item {
  display: flex; gap: 18px;
  padding-bottom: 20px;
  position: relative;
}
.cd-tl-item::before {
  /* the connecting vertical line, drawn behind every item except the last */
  content: ''; position: absolute; left: 5px; top: 22px; bottom: 0;
  width: 2px; background: var(--rule, #c7cbe6);
}
.cd-tl-item:last-child::before { display: none; }
.cd-tl-item:last-child { padding-bottom: 0; }
.cd-tl-left {
  flex: 0 0 auto; width: 12px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.cd-tl-dot {
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--accent, #4f46e5); flex-shrink: 0; margin-top: 4px;
}
.cd-tl-year {
  font-family: 'Poppins', sans-serif;
  font-size: 11px; font-weight: 700; color: var(--accent2, #3730a3);
  white-space: nowrap; writing-mode: vertical-rl; transform: rotate(180deg);
}
.cd-tl-content { flex: 1; min-width: 0; padding-top: 1px; }
.cd-tl-name {
  font-family: 'Poppins', sans-serif;
  font-size: 14.5px; font-weight: 700; color: var(--ink, #16181d); margin-bottom: 4px;
}
.cd-tl-desc {
  font-family: 'Inter', sans-serif;
  font-size: 13.5px; color: var(--ink2, #2a2d36); line-height: 1.7;
}
@media (max-width: 620px) {
  /* Vertical year text reads poorly in a narrow column — lay it horizontally
     next to the dot instead of stacked above it. */
  .cd-tl-item { gap: 12px; }
  .cd-tl-left { flex-direction: row; align-items: baseline; width: auto; gap: 8px; }
  .cd-tl-year { writing-mode: horizontal-tb; transform: none; }
  .cd-tl-item::before { left: 5px; top: 26px; }
}

/* ── Key terms ──────────────────────────────────────────────────────── */
.cd-terms-heading {
  font-family: 'Montserrat', sans-serif;
  font-size: 19px; font-weight: 800; color: var(--ink, #16181d); margin-bottom: 14px;
}
.cd-terms { display: grid; gap: 10px; }
.cd-term {
  border-left: 3px solid var(--accent, #4f46e5);
  background: var(--white, #ffffff);
  border-radius: 0 8px 8px 0; padding: 12px 16px;
}
.cd-term-name {
  font-family: 'Poppins', sans-serif;
  font-size: 13.5px; font-weight: 700; color: var(--accent2, #3730a3); margin-bottom: 3px;
}
.cd-term-def {
  font-family: 'Inter', sans-serif;
  font-size: 13.5px; color: var(--ink2, #2a2d36); line-height: 1.7;
}

/* ── Image ──────────────────────────────────────────────────────────── */
.cd-img { max-width: 100%; height: auto; border-radius: 8px; display: block; }
.cd-figure { margin: 0; }
.cd-figure figcaption {
  font-family: 'Inter', sans-serif;
  font-size: 12.5px; color: var(--muted, #626878); text-align: center; margin-top: 8px;
}

/* ── FAQ (native <details>, no JavaScript) ──────────────────────────── */
/* The reader iframe has no allow-scripts, so a JS accordion could not work
   here even if we wanted one — matching how the live pages already do it. */
.cd-faq-label {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--accent-lt, #e0e7ff); color: var(--accent2, #3730a3);
  font-family: 'Poppins', sans-serif;
  font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;
  padding: 5px 14px; border-radius: 100px; margin-bottom: 14px;
}
.cd-faq-heading {
  font-family: 'Montserrat', sans-serif;
  font-size: clamp(24px, 4vw, 34px); font-weight: 900;
  color: var(--ink, #16181d); letter-spacing: -0.02em; margin-bottom: 6px;
}
.cd-faq-rule {
  width: 48px; height: 4px; border-radius: 2px;
  background: linear-gradient(90deg, var(--accent, #4f46e5), var(--purple, #7c3aed));
  margin-bottom: 26px;
}
.cd-faq-item {
  border: 1.5px solid var(--rule, #c7cbe6); border-radius: 8px;
  margin-bottom: 10px; background: var(--white, #ffffff);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.cd-faq-item[open] { border-color: var(--accent, #4f46e5); }
.cd-faq-q {
  list-style: none; cursor: pointer;
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
  padding: 18px 22px;
  font-family: 'Poppins', sans-serif;
  font-size: 14.5px; font-weight: 600; color: var(--ink, #16181d); line-height: 1.5;
}
.cd-faq-q::-webkit-details-marker { display: none; }
.cd-faq-q::after {
  content: '+'; font-size: 22px; font-weight: 400;
  color: var(--accent, #4f46e5); line-height: 1; flex-shrink: 0;
}
.cd-faq-item[open] .cd-faq-q { color: var(--accent, #4f46e5); }
.cd-faq-item[open] .cd-faq-q::after { content: '\\2212'; }
.cd-faq-ans {
  font-family: 'Inter', sans-serif;
  font-size: 14.5px; color: var(--ink2, #2a2d36); line-height: 1.85;
  padding: 0 22px 20px;
}
.cd-faq-ans strong { color: var(--accent2, #3730a3); font-weight: 600; }

@media (max-width: 700px) {
  .cd-faq-q { padding: 16px; }
  .cd-faq-ans { padding: 0 16px 18px; }
}
`;
