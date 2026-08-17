// PLACEMENT: Admin-dashboard/src/pages/content/blocks/BlockCanvas.jsx
//
// The block list: select/reorder/duplicate/delete, plus the "Add block"
// menu. Reordering is up/down buttons rather than drag-and-drop — no new
// dependency, and just as usable for a vertical list of typically 6-15
// blocks. Selecting a row hands off to BlockInspector for editing.

import { useState } from "react";
import { Plus, Copy, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { ADDABLE_TYPES, BLOCK_META, blockSummary } from "./blockMeta";

const AddBlockMenu = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="blk-add-menu">
      <button type="button" className="mod-btn ghost small" onClick={() => setOpen((v) => !v)}>
        <Plus size={13} /> Add block
      </button>
      {open && (
        <div className="blk-add-menu-list" onMouseLeave={() => setOpen(false)}>
          {ADDABLE_TYPES.map((type) => {
            const meta = BLOCK_META[type];
            return (
              <button
                key={type}
                type="button"
                className="blk-add-menu-item"
                onClick={() => { onAdd(type); setOpen(false); }}
              >
                {meta?.icon && <meta.icon size={14} />} {meta?.label || type}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const BlockRow = ({ block, index, count, selected, onSelect, onMove, onDuplicate, onRemove }) => {
  const meta = BLOCK_META[block.t];
  return (
    <div
      className={`blk-row${selected ? " selected" : ""}`}
      data-block-id={block.id}
      onClick={() => onSelect(block.id)}
    >
      <span className="blk-row-icon">{meta?.icon && <meta.icon size={15} />}</span>
      <div className="blk-row-main">
        <span className="blk-row-type">{meta?.label || block.t}</span>
        <span className="blk-row-summary">{blockSummary(block)}</span>
      </div>
      <div className="blk-row-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" disabled={index === 0} onClick={() => onMove(block.id, -1)} title="Move up" aria-label="Move up">
          <ChevronUp size={14} />
        </button>
        <button type="button" disabled={index === count - 1} onClick={() => onMove(block.id, 1)} title="Move down" aria-label="Move down">
          <ChevronDown size={14} />
        </button>
        <button type="button" onClick={() => onDuplicate(block.id)} title="Duplicate" aria-label="Duplicate">
          <Copy size={14} />
        </button>
        <button type="button" className="blk-row-remove" onClick={() => onRemove(block.id)} title="Delete" aria-label="Delete">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

const BlockCanvas = ({ blocks, selectedId, onSelect, onAdd, onMove, onDuplicate, onRemove }) => (
  <div className="blk-canvas">
    {blocks.length === 0 && (
      <p className="cm-hint blk-canvas-empty">No blocks yet — add one to start building this chapter.</p>
    )}
    {blocks.map((block, index) => (
      <BlockRow
        key={block.id}
        block={block}
        index={index}
        count={blocks.length}
        selected={block.id === selectedId}
        onSelect={onSelect}
        onMove={onMove}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
      />
    ))}
    <AddBlockMenu onAdd={onAdd} />
  </div>
);

export default BlockCanvas;
