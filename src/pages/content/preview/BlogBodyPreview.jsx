import { useMemo } from "react";
import DOMPurify from "dompurify";
import { BLOG_BODY_PREVIEW_CSS } from "./blogBodyStyles";
import { BLOG_BLOCKS_CSS } from "../../../blogBlocks/blocksCss";
import { renderDocument, themeStyleText, neutralizeViewportUnits } from "../../../blogBlocks/render";
import "./preview.css";

// Body preview for the rich-text editor — renders exactly what the public
// site will show (BLOG_BODY_PREVIEW_CSS is the same ruleset duplicated by
// hand into shiksha-frontend/src/css/BlogDetail.css under `.blog-body`).
// This is what makes "what you see is what publishes" true for authors,
// which the old plain-textarea editor never gave them.
//
// Rendered inside a sandboxed <iframe>, not a plain div: an author can
// paste a full hand-designed page (trusted_html content, e.g. a legacy-
// style chapter with its own <style> block) and DOMPurify's default
// config deliberately keeps <style> tags — exactly what makes that
// escape hatch work in production. A plain div would let that same
// <style> block leak into the Admin dashboard's own document and break
// its layout (e.g. a pasted `* { margin: 0; padding: 0; }` reset). The
// iframe's srcDoc is a fully separate document, so nothing escapes it,
// and `sandbox=""` blocks any script execution as a second layer on top
// of DOMPurify.
//
// `blocks`/`theme` are optional — when a block-authored post is being
// edited (BlogEditor's block mode, landing later), pass them and this
// preview renders through the exact same shared renderer as the public
// site instead of the legacy `html` path.
const BlogBodyPreview = ({ html, blocks, theme }) => {
  const hasBlocks = Array.isArray(blocks) && blocks.length > 0;

  const srcDoc = useMemo(() => {
    // FORCE_BODY is required: DOMPurify's fragment-mode parser silently
    // drops a leading <style> tag unless told to force-parse the input as
    // body content — without it a pasted style block never survives
    // sanitize() to reach the iframe at all. See shiksha-frontend's
    // BlogDetail.jsx for the same fix applied to the live public render.
    //
    // neutralizeViewportUnits also runs here now (previously missing): this
    // iframe has a fixed CSS height rather than auto-sizing, so a stray `vh`
    // never caused the runaway feedback loop BlogDetail.jsx guards against —
    // but it did mean any legacy post using `vh` (114 of 115) previewed at a
    // different size than it actually renders on the live page, silently
    // breaking the "what you see is what publishes" promise this component
    // exists for.
    const raw = hasBlocks ? renderDocument(blocks) : (html || "");
    const clean = neutralizeViewportUnits(DOMPurify.sanitize(raw, { FORCE_BODY: true }));

    if (hasBlocks) {
      return `<!doctype html><html><head><meta charset="utf-8">` +
        `<style>body{margin:0;padding:16px 18px;}\n${themeStyleText(theme)}\n${BLOG_BLOCKS_CSS}</style></head>` +
        `<body>${clean}</body></html>`;
    }

    return `<!doctype html><html><head><meta charset="utf-8">` +
      `<style>body{margin:0;padding:16px 18px;font-family:system-ui,-apple-system,sans-serif;}` +
      `${BLOG_BODY_PREVIEW_CSS}</style></head>` +
      `<body><div class="blog-body">${clean}</div></body></html>`;
  }, [html, blocks, theme, hasBlocks]);

  return (
    <div className="cms-preview">
      <iframe
        className="blog-body-preview-frame"
        title="Blog body preview"
        srcDoc={srcDoc}
        sandbox=""
      />
    </div>
  );
};

export default BlogBodyPreview;
