/**
 * /content/blocks — the artboard's "Reusable blocks" screen.
 * design_handoff_admin_counsellor, Admin v2 Phase 5.
 *
 * ⚠ THIS NEEDED NO BACKEND, AND THAT IS THE FINDING — not a shortcut.
 * The artboard's BLOCKS entry is a *catalogue of block TYPES* you can put on
 * a page (`B('Banner', 'banner', 'Big heading, a line of text and a button.')`),
 * not a store of saved block instances. Those types already exist: thirteen
 * of them in `blogBlocks/schema.js`, with icons and labels in
 * `blocks/blockMeta.js`. A model would have added a second, competing
 * vocabulary for something the editor already knows.
 *
 * ⚠ IT READS THE REAL SOURCE. `ADDABLE_TYPES` and `BLOCK_META` are the same
 * constants the post editor builds its insert menu from, so this page cannot
 * drift from what the editor actually offers — add a block type and it
 * appears here with no edit. Hard-coding the list would have guaranteed the
 * opposite within one release.
 *
 * `legacy_html` is shown but marked unavailable: it exists in the schema and
 * can reach a post through the importer, but is deliberately absent from
 * ADDABLE_TYPES, so an author must not be told they can insert one.
 */
import { Link } from "react-router-dom";
import { ADDABLE_TYPES, BLOCK_META } from "./blocks/blockMeta";
import "../../css/BlockLibrary.css";

/* Plain-language descriptions, in the artboard's register ("Big heading, a
   line of text and a button"). Keyed by the SCHEMA's type ids so a missing
   entry degrades to the block's own label rather than vanishing. */
const DESCRIPTIONS = {
  hero: "A full-width opener: overline, big title and an optional stat strip.",
  section_header: "A heading that breaks a long page into parts.",
  rich_text: "A heading and paragraphs — the ordinary one.",
  faq_group: "Questions with answers that open and close.",
  divider: "A horizontal rule between sections.",
  callout: "A short highlighted note — a tip, a warning, a aside.",
  table: "Rows and columns, for comparisons and data.",
  feature_grid: "Up to four short cards side by side.",
  key_terms: "A glossary of terms with their meanings.",
  image: "A picture with an optional caption.",
  stat_grid: "Four figures, such as students taught.",
  timeline: "Dated steps in order.",
  legacy_html: "Raw markup kept from an imported page.",
};

/* The artboard groups the palette rather than listing thirteen tiles flat.
   Grouped by what you reach for, not by schema shape. */
const GROUPS = [
  { label: "Openers", types: ["hero", "section_header"] },
  { label: "Text", types: ["rich_text", "callout", "key_terms"] },
  { label: "Lists and data", types: ["feature_grid", "stat_grid", "table", "timeline", "faq_group"] },
  { label: "Media and spacing", types: ["image", "divider"] },
  { label: "Imported only", types: ["legacy_html"] },
];

export default function BlockLibrary() {
  const addable = new Set(ADDABLE_TYPES);

  return (
    <div className="blk">
      <header>
        <h1 className="blk__h1">Blocks</h1>
        <p className="blk__sub">
          The pieces a post or page is built from. Add them in the editor —
          this is the catalogue, so you can see what exists before you start.
        </p>
      </header>

      {GROUPS.map((g) => {
        const types = g.types.filter((t) => BLOCK_META[t]);
        if (!types.length) return null;
        return (
          <section key={g.label} className="blk__group">
            <h2 className="blk__group-title">{g.label}</h2>
            <div className="blk__grid">
              {types.map((t) => {
                const meta = BLOCK_META[t];
                const Icon = meta.icon;
                const usable = addable.has(t);
                return (
                  <article key={t} className={`blk__card${usable ? "" : " blk__card--off"}`}>
                    <span className="blk__icon"><Icon size={18} aria-hidden="true" /></span>
                    <div>
                      <h3 className="blk__name">
                        {meta.label}
                        {!usable && <span className="blk__tag">Imported only</span>}
                      </h3>
                      <p className="blk__desc">{DESCRIPTIONS[t] || meta.label}</p>
                      {/* The schema id, because that is what appears in an
                          API payload and in a bug report. */}
                      <code className="blk__id">{t}</code>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="blk__foot">
        Blocks are added while writing. Open <Link to="/content?tab=blogs">Posts
        and articles</Link> and edit a post to use them.
      </p>
    </div>
  );
}
