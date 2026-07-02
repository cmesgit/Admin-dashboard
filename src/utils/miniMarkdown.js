// src/utils/miniMarkdown.js
//
// A tiny, dependency-free Markdown → HTML renderer for agreement letters.
// It ESCAPES all HTML first, then applies a small, safe subset of formatting:
// headings (#, ##, ###), bold (**), italic (*), numbered + bullet lists, and
// paragraphs. Because the source is escaped before any tags are introduced,
// pasted HTML can't inject markup. Suitable for admin-authored legal text.

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inline = (s) =>
  s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

export function renderMarkdown(src = "") {
  const lines = escapeHtml(src).replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let listType = null; // "ol" | "ul" | null
  let para = [];

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (listType) { html.push(`</${listType}>`); listType = null; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) { flushPara(); closeList(); continue; }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara(); closeList();
      const level = h[1].length;
      html.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }

    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      if (listType !== "ol") { closeList(); html.push("<ol>"); listType = "ol"; }
      html.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (listType !== "ul") { closeList(); html.push("<ul>"); listType = "ul"; }
      html.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    closeList();
    para.push(line);
  }
  flushPara(); closeList();
  return html.join("\n");
}

export default renderMarkdown;
