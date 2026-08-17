// PLACEMENT: Admin-dashboard/src/pages/content/blocks/blockMeta.js
//
// Display metadata (icon, label, canvas-row summary) for block types, kept
// separate from ../../../blogBlocks/schema.js's BLOCK_SPECS — that file is
// shared verbatim with shiksha-frontend and has no business importing
// lucide-react or knowing about admin-only presentation concerns.
//
// ADDABLE_TYPES: every schema.js block type except legacy_html, which is
// deliberately not author-facing — it's the importer's escape hatch for
// markup that couldn't be mapped to a real block (Phase 6), not something
// this editor should let someone create from scratch. A legacy_html block
// can still reach a post via the future importer or direct API use;
// BlockCanvas/BlockInspector fall back to a generic label/notice for any
// type without metadata or a field editor rather than crashing.

import {
  LayoutTemplate, Heading2, Type, HelpCircle, Minus,
  Sparkles, Table2, LayoutGrid, BookOpen, Image as ImageIcon, Code2,
  BarChart3, Milestone,
} from "lucide-react";

export const BLOCK_META = {
  hero: { icon: LayoutTemplate, label: "Hero" },
  section_header: { icon: Heading2, label: "Section header" },
  rich_text: { icon: Type, label: "Text" },
  faq_group: { icon: HelpCircle, label: "FAQ" },
  divider: { icon: Minus, label: "Divider" },
  callout: { icon: Sparkles, label: "Callout" },
  table: { icon: Table2, label: "Table" },
  feature_grid: { icon: LayoutGrid, label: "Card grid" },
  key_terms: { icon: BookOpen, label: "Key terms" },
  image: { icon: ImageIcon, label: "Image" },
  // Added after the Phase 6 coverage spike — real, recurring legacy patterns
  // (stat callouts: 46/114 posts; dated timelines: 24/114), not speculative.
  stat_grid: { icon: BarChart3, label: "Stat grid" },
  timeline: { icon: Milestone, label: "Timeline" },
  // legacy_html has metadata (so a canvas row renders sensibly) but is not
  // in ADDABLE_TYPES — see that constant's comment.
  legacy_html: { icon: Code2, label: "Raw HTML" },
};

export const ADDABLE_TYPES = [
  "hero", "section_header", "rich_text", "faq_group", "divider",
  "callout", "table", "feature_grid", "key_terms", "image",
  "stat_grid", "timeline",
];

const stripTags = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// One-line summary shown in the canvas row, so an author can tell blocks
// apart at a glance without opening each one in the inspector.
export function blockSummary(block) {
  switch (block.t) {
    case "hero":
      return [block.overline, [block.title, block.titleAccent].filter(Boolean).join(" ")]
        .filter(Boolean).join(" — ") || "Empty hero";
    case "section_header":
      return [block.kicker, [block.title, block.titleAccent].filter(Boolean).join(" ")]
        .filter(Boolean).join(" — ") || "Empty section header";
    case "rich_text":
      return stripTags(block.html).slice(0, 90) || "Empty paragraph";
    case "faq_group":
      return block.items?.length ? `${block.items.length} question${block.items.length === 1 ? "" : "s"}` : "No questions yet";
    case "divider":
      return `Divider (${block.mark})`;
    case "callout":
      return stripTags(block.html).slice(0, 90) || `Empty ${block.variant} callout`;
    case "table":
      return block.rows?.length ? `${block.rows.length} row${block.rows.length === 1 ? "" : "s"} × ${block.headers?.length || 0} columns` : "Empty table";
    case "feature_grid":
      return block.cards?.length ? `${block.cards.length} card${block.cards.length === 1 ? "" : "s"} (${block.columns} columns)` : "No cards yet";
    case "key_terms":
      return block.items?.length ? `${block.items.length} term${block.items.length === 1 ? "" : "s"}` : "No terms yet";
    case "image":
      return block.caption || block.alt || (block.src ? "Image" : "No image chosen");
    case "stat_grid":
      return block.items?.length ? `${block.items.length} stat${block.items.length === 1 ? "" : "s"} (${block.columns} columns)` : "No stats yet";
    case "timeline":
      return block.items?.length ? `${block.items.length} event${block.items.length === 1 ? "" : "s"}` : "No events yet";
    default:
      return BLOCK_META[block.t]?.label || block.t;
  }
}
