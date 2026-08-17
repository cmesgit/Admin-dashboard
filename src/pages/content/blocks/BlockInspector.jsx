// PLACEMENT: Admin-dashboard/src/pages/content/blocks/BlockInspector.jsx
//
// Right-hand panel: field editors for the selected block's content, plus the
// common per-block settings (padding/width/align/background) every block
// type shares — the "control padding and layout by hand" surface from the
// project plan, expressed as a form instead of typed CSS.
//
// Field editors for every addable block type (see blockMeta.js's
// ADDABLE_TYPES) plus the shared settings panel every block gets. Only
// legacy_html has no editor here by design — it's the importer's passthrough
// escape hatch (Phase 6), never authored from scratch. A block of any type
// still missing an editor shows a plain notice instead of crashing.

import { useState } from "react";
import { Plus, X } from "lucide-react";
import RichTextEditor from "../../../components/RichTextEditor";
import MediaLibraryModal from "../../../components/MediaLibraryModal";
import { TextField, SegmentedField, ListField, StringListField } from "./fields";
import { WIDTHS, ALIGNS, SPACE_SCALE, THEME_TOKENS } from "../../../blogBlocks/schema";
import { BLOCK_META } from "./blockMeta";

const WIDTH_OPTIONS = WIDTHS.map((w) => ({ value: w, label: w[0].toUpperCase() + w.slice(1) }));
const ALIGN_OPTIONS = ALIGNS.map((a) => ({ value: a, label: a[0].toUpperCase() + a.slice(1) }));
const PADDING_OPTIONS = [
  { value: "", label: "Default" },
  ...SPACE_SCALE.map((n) => ({ value: String(n), label: `${n}px` })),
];
const BG_OPTIONS = [{ value: "", label: "None" }, ...THEME_TOKENS.map((t) => ({ value: t, label: t }))];

const DECOR_OPTIONS = [
  { value: "dots", label: "Dots" },
  { value: "hex", label: "Hex" },
  { value: "grid", label: "Grid" },
  { value: "lines", label: "Lines" },
  { value: "none", label: "None" },
];
const DIVIDER_MARK_OPTIONS = [
  { value: "hex", label: "Hex mark" },
  { value: "dot", label: "Dot" },
  { value: "none", label: "Plain line" },
];
const CALLOUT_VARIANT_OPTIONS = [
  { value: "intro", label: "Intro" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "success", label: "Success" },
  { value: "highlight", label: "Highlight" },
];
// Table header backgrounds are always a real token — unlike the block
// settings panel's own background picker, "None" isn't a meaningful choice
// for a header cell, so this is a separate list from BG_OPTIONS above.
const TABLE_HEADER_BG_OPTIONS = THEME_TOKENS.map((t) => ({ value: t, label: t }));
const GRID_COLUMN_OPTIONS = [2, 3, 4].map((n) => ({ value: String(n), label: String(n) }));
const STAT_COLUMN_OPTIONS = [2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));
const CARD_COLOR_OPTIONS = [1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }));

function HeroFields({ block, patch }) {
  return (
    <>
      <TextField label="Overline" value={block.overline} onChange={(v) => patch({ overline: v })}
        placeholder="Class 9 · Science · Chapter 8" />
      <div className="cm-row">
        <TextField label="Title" value={block.title} onChange={(v) => patch({ title: v })} placeholder="Motion" />
        <TextField label="Accented fragment" value={block.titleAccent} onChange={(v) => patch({ titleAccent: v })}
          placeholder="in Physics" hint="Rendered in the accent color" />
      </div>
      <TextField label="Subtitle (optional)" value={block.subtitle} onChange={(v) => patch({ subtitle: v })}
        placeholder="A one-sentence summary shown under the title" />
      <TextField label="Background number" value={block.bgNum} onChange={(v) => patch({ bgNum: v })}
        placeholder="8" hint="Large faint chapter number behind the title — leave blank to omit" />
      <SegmentedField label="Decoration" options={DECOR_OPTIONS} value={block.decor} onChange={(v) => patch({ decor: v })} />
      <ListField
        label="Stat strip"
        items={block.stats}
        onChange={(v) => patch({ stats: v })}
        itemFields={[
          { key: "label", kind: "text", placeholder: "Subject" },
          { key: "value", kind: "text", placeholder: "Science — Physics" },
        ]}
        addLabel="Add stat"
      />
      <StringListField
        label="Meta chips (alternative to the stat strip above)"
        items={block.chips}
        onChange={(v) => patch({ chips: v })}
        addLabel="Add chip"
        singleLine
        placeholder="🏭 Geography"
      />
    </>
  );
}

function SectionHeaderFields({ block, patch }) {
  return (
    <>
      <div className="cm-row">
        <TextField label="Number" value={block.num} onChange={(v) => patch({ num: v })} placeholder="1" />
        <TextField label="Kicker" value={block.kicker} onChange={(v) => patch({ kicker: v })} placeholder="Basic Idea" />
      </div>
      <div className="cm-row">
        <TextField label="Title" value={block.title} onChange={(v) => patch({ title: v })} placeholder="Motion &" />
        <TextField label="Accented fragment" value={block.titleAccent} onChange={(v) => patch({ titleAccent: v })}
          placeholder="Reference Frame" />
      </div>
    </>
  );
}

function RichTextFields({ block, patch }) {
  return (
    <label className="cm-field">
      <span>Text</span>
      <RichTextEditor mode="restricted" value={block.html} onChange={(html) => patch({ html })}
        placeholder="Write a paragraph…" />
    </label>
  );
}

function FaqGroupFields({ block, patch }) {
  return (
    <>
      <div className="cm-row">
        <TextField label="Chip label" value={block.chipLabel} onChange={(v) => patch({ chipLabel: v })} placeholder="FAQ" />
        <TextField label="Heading" value={block.heading} onChange={(v) => patch({ heading: v })}
          placeholder="Frequently Asked Questions" />
      </div>
      <ListField
        label="Questions"
        items={block.items}
        onChange={(v) => patch({ items: v })}
        itemFields={[
          { key: "q", kind: "text", placeholder: "What is motion?" },
          { key: "a", kind: "textarea", placeholder: "Change in position of a body with respect to a reference point." },
        ]}
        addLabel="Add question"
      />
    </>
  );
}

function DividerFields({ block, patch }) {
  return (
    <SegmentedField label="Mark" options={DIVIDER_MARK_OPTIONS} value={block.mark} onChange={(v) => patch({ mark: v })} />
  );
}

function CalloutFields({ block, patch }) {
  return (
    <>
      <SegmentedField label="Variant" options={CALLOUT_VARIANT_OPTIONS} value={block.variant} onChange={(v) => patch({ variant: v })} />
      <label className="cm-field">
        <span>Text</span>
        <RichTextEditor mode="restricted" value={block.html} onChange={(html) => patch({ html })}
          placeholder="Write the callout content…" />
      </label>
    </>
  );
}

function TableFields({ block, patch }) {
  const headers = block.headers || [];
  const rows = block.rows || [];
  const colCount = headers.length;

  const updateCell = (rowIndex, colIndex, value) => {
    const next = rows.map((row, r) => {
      if (r !== rowIndex) return row;
      const padded = Array.from({ length: colCount }, (_, c) => row[c] ?? "");
      padded[colIndex] = value;
      return padded;
    });
    patch({ rows: next });
  };
  const addRow = () => patch({ rows: [...rows, Array(colCount).fill("")] });
  const removeRow = (index) => patch({ rows: rows.filter((_, i) => i !== index) });

  return (
    <>
      <label className="cm-check">
        <input type="checkbox" checked={!!block.scrollHint} onChange={(e) => patch({ scrollHint: e.target.checked })} />
        <span>Show "swipe to see more" hint on mobile</span>
      </label>
      <ListField
        label="Columns"
        items={headers}
        onChange={(v) => patch({ headers: v })}
        itemFields={[
          { key: "text", kind: "text", placeholder: "Column heading" },
          { key: "bg", kind: "select", options: TABLE_HEADER_BG_OPTIONS },
        ]}
        addLabel="Add column"
      />
      <div className="cm-field">
        <span>Rows</span>
        {colCount === 0 ? (
          <p className="cm-hint">Add at least one column above before adding rows.</p>
        ) : (
          <>
            <div className="blk-list">
              {rows.map((row, r) => (
                <div className="blk-list-row" key={r}>
                  <div className="blk-list-row-fields blk-table-row-fields">
                    {Array.from({ length: colCount }, (_, c) => (
                      <input
                        key={c}
                        value={row[c] || ""}
                        onChange={(e) => updateCell(r, c, e.target.value)}
                        placeholder={headers[c]?.text || `Column ${c + 1}`}
                      />
                    ))}
                  </div>
                  <button type="button" className="blk-list-row-remove" onClick={() => removeRow(r)} title="Remove row" aria-label="Remove row">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="cm-inline-toggle" onClick={addRow}>
              <Plus size={13} /> Add row
            </button>
          </>
        )}
      </div>
    </>
  );
}

function FeatureGridFields({ block, patch }) {
  const cards = block.cards || [];
  const updateCard = (index, fields) => patch({ cards: cards.map((c, i) => (i === index ? { ...c, ...fields } : c)) });
  const removeCard = (index) => patch({ cards: cards.filter((_, i) => i !== index) });
  const addCard = () => patch({ cards: [...cards, { tag: "", name: "", color: 1, rows: [] }] });

  return (
    <>
      <SegmentedField label="Columns" options={GRID_COLUMN_OPTIONS} value={String(block.columns)}
        onChange={(v) => patch({ columns: Number(v) })} />
      <div className="cm-field">
        <span>Cards</span>
        <div className="blk-list">
          {cards.map((card, index) => (
            <div className="blk-card-editor" key={index}>
              <div className="blk-card-editor-head">
                <span>Card {index + 1}</span>
                <button type="button" className="blk-list-row-remove" onClick={() => removeCard(index)} title="Remove card" aria-label="Remove card">
                  <X size={14} />
                </button>
              </div>
              <div className="cm-row">
                <input value={card.tag} placeholder="Tag · Label" onChange={(e) => updateCard(index, { tag: e.target.value })} />
                <input value={card.name} placeholder="Point A" onChange={(e) => updateCard(index, { name: e.target.value })} />
              </div>
              <SegmentedField label="Color" options={CARD_COLOR_OPTIONS} value={String(card.color)}
                onChange={(v) => updateCard(index, { color: Number(v) })} />
              <StringListField items={card.rows} onChange={(v) => updateCard(index, { rows: v })} addLabel="Add detail line" />
            </div>
          ))}
        </div>
        <button type="button" className="cm-inline-toggle" onClick={addCard}>
          <Plus size={13} /> Add card
        </button>
      </div>
    </>
  );
}

function StatGridFields({ block, patch }) {
  return (
    <>
      <SegmentedField label="Columns" options={STAT_COLUMN_OPTIONS} value={String(block.columns)}
        onChange={(v) => patch({ columns: Number(v) })} />
      <ListField
        label="Stats"
        items={block.items}
        onChange={(v) => patch({ items: v })}
        itemFields={[
          { key: "value", kind: "text", placeholder: "7%" },
          { key: "label", kind: "textarea", placeholder: "Annual growth rate of manufacturing sector over last decade" },
        ]}
        addLabel="Add stat"
      />
    </>
  );
}

function TimelineFields({ block, patch }) {
  return (
    <ListField
      label="Events"
      items={block.items}
      onChange={(v) => patch({ items: v })}
      itemFields={[
        { key: "year", kind: "text", placeholder: "1975" },
        { key: "name", kind: "text", placeholder: "Public Distribution System expanded" },
        { key: "desc", kind: "textarea", placeholder: "Strengthened to cover more poor households across the country." },
      ]}
      addLabel="Add event"
    />
  );
}

function KeyTermsFields({ block, patch }) {
  return (
    <>
      <TextField label="Heading (optional)" value={block.heading} onChange={(v) => patch({ heading: v })}
        placeholder="Key terms in this chapter" />
      <ListField
        label="Terms"
        items={block.items}
        onChange={(v) => patch({ items: v })}
        itemFields={[
          { key: "term", kind: "text", placeholder: "Uniform motion" },
          { key: "def", kind: "textarea", placeholder: "Equal distances covered in equal intervals of time." },
        ]}
        addLabel="Add term"
      />
    </>
  );
}

function ImageFields({ block, patch }) {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <>
      <div className="cm-field">
        <span>Image</span>
        {block.src ? (
          <div className="blk-image-preview">
            <img src={block.src} alt={block.alt || ""} />
            <button type="button" className="mod-btn ghost small" onClick={() => setModalOpen(true)}>Replace</button>
          </div>
        ) : (
          <button type="button" className="mod-btn ghost small" onClick={() => setModalOpen(true)}>Choose image</button>
        )}
      </div>
      <TextField label="Alt text" value={block.alt} onChange={(v) => patch({ alt: v })}
        placeholder="Describe the image for accessibility" />
      <TextField label="Caption (optional)" value={block.caption} onChange={(v) => patch({ caption: v })} />
      {modalOpen && (
        <MediaLibraryModal
          onInsert={(imageObject, altText) => {
            patch({ src: imageObject.file, alt: altText || block.alt || "" });
            setModalOpen(false);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

const FIELD_EDITORS = {
  hero: HeroFields,
  section_header: SectionHeaderFields,
  rich_text: RichTextFields,
  faq_group: FaqGroupFields,
  divider: DividerFields,
  callout: CalloutFields,
  table: TableFields,
  feature_grid: FeatureGridFields,
  key_terms: KeyTermsFields,
  image: ImageFields,
  stat_grid: StatGridFields,
  timeline: TimelineFields,
};

const BlockInspector = ({ block, onChange, onSettingsChange }) => {
  if (!block) {
    return (
      <div className="blk-inspector blk-inspector-empty">
        <p className="cm-hint">Select a block to edit it, or add one from the canvas.</p>
      </div>
    );
  }

  const patch = (fields) => onChange(block.id, fields);
  const patchSettings = (fields) => onSettingsChange(block.id, fields);
  const FieldEditor = FIELD_EDITORS[block.t];
  const meta = BLOCK_META[block.t];

  return (
    <div className="blk-inspector">
      <h4 className="blk-inspector-title">
        {meta?.icon && <meta.icon size={14} />} {meta?.label || block.t}
      </h4>

      {FieldEditor ? (
        <FieldEditor block={block} patch={patch} />
      ) : (
        <p className="cm-hint">
          This block type doesn't have a field editor in this build yet — it will still render correctly on the public page.
        </p>
      )}

      <div className="blk-inspector-settings">
        <h5>Layout</h5>
        <SegmentedField label="Width" options={WIDTH_OPTIONS} value={block.s.width} onChange={(v) => patchSettings({ width: v })} />
        <SegmentedField label="Align" options={ALIGN_OPTIONS} value={block.s.align} onChange={(v) => patchSettings({ align: v })} />
        <div className="cm-row">
          <SegmentedField
            label="Padding top"
            options={PADDING_OPTIONS}
            value={block.s.pt === null || block.s.pt === undefined ? "" : String(block.s.pt)}
            onChange={(v) => patchSettings({ pt: v === "" ? null : Number(v) })}
          />
          <SegmentedField
            label="Padding bottom"
            options={PADDING_OPTIONS}
            value={block.s.pb === null || block.s.pb === undefined ? "" : String(block.s.pb)}
            onChange={(v) => patchSettings({ pb: v === "" ? null : Number(v) })}
          />
        </div>
        <SegmentedField
          label="Background"
          options={BG_OPTIONS}
          value={block.s.bg || ""}
          onChange={(v) => patchSettings({ bg: v || null })}
        />
      </div>
    </div>
  );
};

export default BlockInspector;
