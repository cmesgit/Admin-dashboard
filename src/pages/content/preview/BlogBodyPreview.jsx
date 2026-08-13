import { useMemo } from "react";
import DOMPurify from "dompurify";
import { BLOG_BODY_PREVIEW_CSS } from "./blogBodyStyles";
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
const BlogBodyPreview = ({ html }) => {
  const srcDoc = useMemo(() => {
    // FORCE_BODY is required: DOMPurify's fragment-mode parser silently
    // drops a leading <style> tag unless told to force-parse the input as
    // body content — without it a pasted style block never survives
    // sanitize() to reach the iframe at all. See shiksha-frontend's
    // BlogDetail.jsx for the same fix applied to the live public render.
    const clean = DOMPurify.sanitize(html || "", { FORCE_BODY: true });
    return `<!doctype html><html><head><meta charset="utf-8">` +
      `<style>body{margin:0;padding:16px 18px;font-family:system-ui,-apple-system,sans-serif;}` +
      `${BLOG_BODY_PREVIEW_CSS}</style></head>` +
      `<body><div class="blog-body">${clean}</div></body></html>`;
  }, [html]);

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
