// PLACEMENT: Admin-dashboard/src/pages/content/blocks/fields.jsx
//
// Small reusable field primitives for the block inspector, built on this
// app's existing `cm-field`/`cm-hint` classes (BlogEditor.jsx already uses
// them) rather than inventing a parallel input style.
//
// `html`-kind sub-fields (e.g. a FAQ answer) are edited as plain textareas in
// this first pass, not a full RichTextEditor instance per row — FAQ answers
// are typically a sentence or two, and mounting a TipTap editor per list item
// would be needless weight for that. The top-level `rich_text` BLOCK's `html`
// field is the one place a real rich-text toolbar earns its cost; that's
// wired directly in BlockInspector.jsx via <RichTextEditor mode="restricted">.

import { Plus, X } from "lucide-react";

export const TextField = ({ label, value, onChange, placeholder, hint }) => (
  <label className="cm-field">
    <span>{label}</span>
    <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    {hint && <p className="cm-hint">{hint}</p>}
  </label>
);

export const TextAreaField = ({ label, value, onChange, placeholder, rows = 3 }) => (
  <label className="cm-field">
    <span>{label}</span>
    <textarea rows={rows} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  </label>
);

// Generic single-select rendered as a row of toggle buttons — used for every
// enum-kind field (hero.decor, divider.mark) and the block settings panel
// (width/align). `options` is [{value, label}].
export const SegmentedField = ({ label, options, value, onChange }) => (
  <div className="cm-field">
    <span>{label}</span>
    <div className="blk-segmented">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`blk-segmented-btn${value === opt.value ? " active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

// Repeatable row-of-fields editor for list-kind block fields (hero.stats,
// faq_group.items, table.headers). `itemFields` is
// [{key, kind: "text"|"textarea"|"select", placeholder, options}] — `options`
// (as [{value,label}]) is required when kind is "select" (used by
// table.headers' per-column background token). Every row gets a remove
// button; a trailing "Add" button appends a blank entry built from
// `itemFields`' keys.
export const ListField = ({ label, items, onChange, itemFields, addLabel = "Add" }) => {
  const list = items || [];

  const updateRow = (index, key, value) => {
    const next = list.map((row, i) => (i === index ? { ...row, [key]: value } : row));
    onChange(next);
  };
  const removeRow = (index) => onChange(list.filter((_, i) => i !== index));
  const addRow = () => {
    const blank = Object.fromEntries(
      itemFields.map((f) => [f.key, f.kind === "select" ? f.options?.[0]?.value ?? "" : ""])
    );
    onChange([...list, blank]);
  };

  return (
    <div className="cm-field">
      <span>{label}</span>
      <div className="blk-list">
        {list.map((row, index) => (
          <div className="blk-list-row" key={index}>
            <div className="blk-list-row-fields">
              {itemFields.map((f) => {
                if (f.kind === "textarea") {
                  return (
                    <textarea
                      key={f.key}
                      rows={2}
                      value={row[f.key] || ""}
                      onChange={(e) => updateRow(index, f.key, e.target.value)}
                      placeholder={f.placeholder}
                    />
                  );
                }
                if (f.kind === "select") {
                  return (
                    <select key={f.key} value={row[f.key] || ""} onChange={(e) => updateRow(index, f.key, e.target.value)}>
                      {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  );
                }
                return (
                  <input
                    key={f.key}
                    value={row[f.key] || ""}
                    onChange={(e) => updateRow(index, f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                );
              })}
            </div>
            <button
              type="button"
              className="blk-list-row-remove"
              onClick={() => removeRow(index)}
              title="Remove"
              aria-label="Remove"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="cm-inline-toggle" onClick={addRow}>
        <Plus size={13} /> {addLabel}
      </button>
    </div>
  );
};

// Flat array-of-strings editor (feature_grid card `rows`) — each entry is one
// short line, not an object, so ListField's per-row-of-fields shape doesn't
// fit. Rendered as small textareas by default since a card row is a short
// bit of inline HTML (kind: "htmlList" in schema.js), same "plain textarea
// for html-kind sub-fields" call as the rest of this file. Pass
// `singleLine` for a plain-text field that's genuinely one line (e.g. hero
// meta chips) — a multi-row textarea would be the wrong affordance there.
export const StringListField = ({ label, items, onChange, addLabel = "Add line", singleLine = false, placeholder }) => {
  const list = items || [];
  const updateRow = (index, value) => onChange(list.map((v, i) => (i === index ? value : v)));
  const removeRow = (index) => onChange(list.filter((_, i) => i !== index));
  const addRow = () => onChange([...list, ""]);

  return (
    <div className="cm-field">
      {label && <span>{label}</span>}
      <div className="blk-list">
        {list.map((value, index) => (
          <div className="blk-list-row" key={index}>
            <div className="blk-list-row-fields">
              {singleLine ? (
                <input value={value} onChange={(e) => updateRow(index, e.target.value)} placeholder={placeholder} />
              ) : (
                <textarea rows={2} value={value} onChange={(e) => updateRow(index, e.target.value)} placeholder={placeholder} />
              )}
            </div>
            <button type="button" className="blk-list-row-remove" onClick={() => removeRow(index)} title="Remove" aria-label="Remove">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="cm-inline-toggle" onClick={addRow}>
        <Plus size={13} /> {addLabel}
      </button>
    </div>
  );
};
