// PLACEMENT: Admin-dashboard/src/pages/content/blocks/ImportPreview.jsx
//
// Side-by-side before/after for the legacy HTML -> blocks importer
// (../../../blogBlocks/importer.js). This is the entire safety net for that
// conversion: it never writes to the post on its own — BlogEditor.jsx only
// commits `proposal.blocks`/`proposal.theme` into `form` when the author
// explicitly clicks "Use these blocks" here. Reuses BlogBodyPreview exactly
// as-is (both its html path and its blocks path, already built for the
// regular editor preview) so "before" and "after" render through the
// identical code path a reader would actually see.

import BlogBodyPreview from "../preview/BlogBodyPreview";

const ImportPreview = ({ html, proposal, onUse, onDiscard }) => {
  const { blocks, theme, report } = proposal;
  const pct = Math.round(report.coverage * 100);

  return (
    <div className="blk-import-preview">
      <div className="blk-import-summary">
        <div>
          <strong>{pct}%</strong> of this post converted into editable blocks
          {" "}({report.totalBlocks - report.legacyBlocks} of {report.totalBlocks} blocks).
        </div>
        <p className="cm-hint">
          The remaining {report.legacyBlocks} section{report.legacyBlocks === 1 ? "" : "s"} use one-off
          designs this build doesn't recognize — they're preserved as raw-HTML blocks, not lost, and you
          can still reorder or remove them. Nothing is saved until you click "Use these blocks" below and
          then Save.
        </p>
      </div>

      <div className="blk-import-columns">
        <div className="blk-import-column">
          <h5>Before (current)</h5>
          <div className="blk-import-frame-wrap">
            <BlogBodyPreview html={html} />
          </div>
        </div>
        <div className="blk-import-column">
          <h5>After (proposed blocks)</h5>
          <div className="blk-import-frame-wrap">
            <BlogBodyPreview blocks={blocks} theme={theme} />
          </div>
        </div>
      </div>

      <div className="blk-import-actions">
        <button type="button" className="mod-btn ghost small" onClick={onDiscard}>Discard</button>
        <button type="button" className="confirm-ok" onClick={onUse}>Use these blocks</button>
      </div>
    </div>
  );
};

export default ImportPreview;
