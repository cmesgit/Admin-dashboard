// Single source of truth for the new blog-post BODY styling ruleset —
// NOT copied from the real site (unlike preview.css's card styles); this
// is a NEW element-vocabulary stylesheet written alongside the TipTap
// rich-text editor, since the old approach let each post carry its own
// <style> block, which the sanitizer silently stripped on save
// (backend/content/sanitize.py has no `style` in ALLOWED_TAGS) — new
// posts get styled by tag, not by author-authored CSS, so there's
// nothing left to strip.
//
// This exact ruleset is duplicated by hand into
// shiksha-frontend/src/css/BlogDetail.css under the same `.blog-body`
// class — keep the two in sync if either changes; there is no
// shared/sync.mjs entry for this file pair.
//
// Legacy chapters (114 of them, imported with trusted_html=True) style
// themselves via more-specific classes elsewhere in BlogDetail.css
// (.info-box, .content-block, etc.), which win over these bare-tag
// rules, so this is purely additive for them — nothing here overrides
// existing legacy styling. A legacy-style post can also carry its own
// full <style> block (trusted_html content) — DOMPurify's default
// config deliberately keeps <style> tags, so that escape hatch works
// unchanged; this ruleset only fills in the common case where an author
// didn't write custom CSS at all.
export const BLOG_BODY_PREVIEW_CSS = `
.blog-body { color: #1f2937; font-size: 1rem; line-height: 1.7; }
.blog-body h1 { font-size: 1.9rem; margin: 28px 0 14px; font-weight: 800; }
.blog-body h2 { font-size: 1.5rem; margin: 26px 0 12px; font-weight: 800; }
.blog-body h3 { font-size: 1.2rem; margin: 22px 0 10px; font-weight: 700; }
.blog-body p { margin: 0 0 16px; }
.blog-body ul, .blog-body ol { margin: 0 0 16px; padding-left: 1.4em; }
.blog-body li { margin: 4px 0; }
/* Keep in sync with shiksha-frontend/src/css/blogBodyStyles.js — TipTap stores
   list items as <li><p>text</p></li>, and without this the generic
   ".blog-body p" bottom margin makes every bullet render loose. */
.blog-body li > p { margin: 0; }
.blog-body li > p + p { margin-top: 8px; }
.blog-body a { color: #0F9D6B; text-decoration: underline; }
.blog-body strong { font-weight: 700; }
.blog-body blockquote { border-left: 3px solid #d1d5db; margin: 20px 0; padding: 4px 0 4px 16px; color: #4b5563; font-style: italic; }
.blog-body pre { background: #f3f4f6; border-radius: 8px; padding: 14px 16px; overflow-x: auto; margin: 0 0 16px; }
.blog-body code { background: #f3f4f6; border-radius: 4px; padding: 2px 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.blog-body pre code { background: none; padding: 0; }
.blog-body img { max-width: 100%; border-radius: 8px; margin: 12px 0; }
.blog-body figure { margin: 20px 0; }
.blog-body figcaption { font-size: 0.85rem; color: #6b7280; text-align: center; margin-top: 6px; }
/* Divider — a short centered colored bar rather than a full-width gray line
   (a simplified take on the legacy chapters' centered divider mark). */
.blog-body hr { border: none; height: 4px; width: 48px; margin: 28px auto; border-radius: 2px; background: linear-gradient(90deg, #0d7c6e, #2dd4bf); }
/* Table polish — rounded outer corners (overflow-clipped, with a box-shadow
   ring standing in for the outer border since there's no wrapper div),
   alternating row background, and a solid brand-green header row. */
.blog-body table { border-collapse: collapse; width: 100%; margin: 16px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 0 0 1px #d1d5db; }
.blog-body td, .blog-body th { border: 1px solid #d1d5db; padding: 8px 10px; }
.blog-body tr:nth-child(even) td { background: #f8fafc; }
.blog-body th { background: #0F9D6B; color: #fff; font-weight: 700; border-color: #0d8a5d; }
/* Callout / info box block (added alongside the RichTextEditor toolbar's
   Info button) — same 3-variant palette as Admin-dashboard's
   src/css/Content.css .rte-content .callout-* rules, itself reused
   verbatim from Moderator.css's .mod-btn.info/.warn/.success so this
   doesn't grow a second info/warning/success color scheme. Mirrored into
   shiksha-frontend/src/css/blogBodyStyles.js — keep both in sync by hand,
   same as every other rule in this file. */
.blog-body .callout { margin: 16px 0; padding: 12px 16px; border-radius: 6px; border: 1px solid; border-left-width: 4px; }
.blog-body .callout > p:last-child { margin-bottom: 0; }
.blog-body .callout-info    { background: #eff6ff; border-color: #bfdbfe; border-left-color: #1d4ed8; }
.blog-body .callout-warning { background: #fff8e8; border-color: #ecd080; border-left-color: #7a4c00; }
.blog-body .callout-success { background: #e4f3e8; border-color: #b8d8bc; border-left-color: #125027; }
/* Collapsible section block — plain native <details> marker (no custom
   ::marker) for the same cross-browser-safety reason as the editor copy. */
.blog-body details { margin: 20px 0; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 16px; }
.blog-body details summary { cursor: pointer; font-weight: 700; }
.blog-body details[open] summary { margin-bottom: 10px; }
.blog-body details p { margin: 0; }
/* Highlight callout — bigger/bolder dark-gradient intro/pull-quote variant
   (4th CALLOUT_VARIANTS entry in RichTextEditor.jsx). Deep indigo/navy
   gradient + off-white text + a light indigo accent left border; overrides
   the base .callout padding so it reads as a lead paragraph. Mirrored into
   shiksha-frontend/src/css/blogBodyStyles.js — keep both in sync. */
.blog-body .callout-highlight { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); border: 1px solid #312e81; border-left: 4px solid #818cf8; color: #eef2ff; padding: 18px 22px; font-size: 1.05rem; }
.blog-body .callout-highlight strong { color: #fff; }
.blog-body .callout-highlight a { color: #c7d2fe; }
/* Section header — pill badge + bold title + short colored underline bar (the
   sectionHeader TipTap node). Palette matches the legacy chapters' teal accent
   (--accent #0d7c6e / --accent2 #09635a / --accent-lt #ccf5ee). */
.blog-body .section-header { margin: 32px 0 20px; }
.blog-body .section-header-badge { display: inline-block; background: #ccf5ee; color: #09635a; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; padding: 5px 14px; border-radius: 100px; margin-bottom: 10px; }
.blog-body .section-header h2 { margin: 0; font-size: 1.6rem; font-weight: 800; line-height: 1.2; position: relative; padding-bottom: 12px; }
.blog-body .section-header h2::after { content: ""; position: absolute; left: 0; bottom: 0; width: 48px; height: 4px; border-radius: 2px; background: linear-gradient(90deg, #0d7c6e, #2dd4bf); }
/* Feature grid — responsive 2-4 column colored-card grid (the featureGrid /
   featureCard nodes). Each card gets a colored top stripe cycling 1-4; the
   first paragraph is the bold colored title, the rest are smaller body lines. */
.blog-body .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0; }
.blog-body .feature-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; border-top: 4px solid #0d7c6e; padding: 16px 18px; }
.blog-body .feature-card.color-1 { border-top-color: #0d7c6e; }
.blog-body .feature-card.color-2 { border-top-color: #e05a2b; }
.blog-body .feature-card.color-3 { border-top-color: #6d28d9; }
.blog-body .feature-card.color-4 { border-top-color: #b45309; }
.blog-body .feature-card > p { font-size: 0.92rem; color: #4b5563; margin: 0 0 8px; }
.blog-body .feature-card > p:first-child { font-size: 1.05rem; font-weight: 700; color: #0f1c1a; margin: 0 0 8px; }
.blog-body .feature-card.color-1 > p:first-child { color: #09635a; }
.blog-body .feature-card.color-2 > p:first-child { color: #c2410c; }
.blog-body .feature-card.color-3 > p:first-child { color: #6d28d9; }
.blog-body .feature-card.color-4 > p:first-child { color: #b45309; }
.blog-body .feature-card > p:last-child { margin-bottom: 0; }
/* First (and so far only) @media rule in this ruleset — collapse the feature
   grid to one column on narrow screens. */
@media (max-width: 620px) {
  .blog-body .feature-grid { grid-template-columns: 1fr; }
}
`;
