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
  let para = []; // [{ text, hardBreak }]

  const flushPara = () => {
    if (para.length) {
      const joined = para
        .map((p, i) => (i === 0 ? inline(p.text) : (para[i - 1].hardBreak ? "<br>" : " ") + inline(p.text)))
        .join("");
      html.push(`<p>${joined}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (listType) { html.push(`</${listType}>`); listType = null; }
  };

  for (const raw of lines) {
    // A blank line only ends the CURRENT PARAGRAPH, not the current list —
    // numbered clauses separated by blank lines (a normal, expected way to
    // author a legal letter) used to each open a fresh <ol> and restart the
    // browser's counter at 1, so every clause after the first rendered as
    // "1." A list only actually closes when a heading/paragraph/different
    // list type interrupts it below.
    if (!raw.trim()) { flushPara(); continue; }

    // Two-or-more trailing spaces = an explicit hard line break (the GFM
    // convention), checked before trimEnd() below discards them — otherwise
    // every single-newline in the source collapsed into one run-on sentence
    // with no way for an admin to force a break (e.g. an address block).
    const hardBreak = /[ \t]{2,}$/.test(raw);
    const line = raw.trimEnd();

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara(); closeList();
      const level = h[1].length;
      html.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }

    const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      if (listType !== "ol") { closeList(); html.push(`<ol start="${ol[1]}">`); listType = "ol"; }
      html.push(`<li>${inline(ol[2])}</li>`);
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
    para.push({ text: line, hardBreak });
  }
  flushPara(); closeList();
  return html.join("\n");
}

export default renderMarkdown;
