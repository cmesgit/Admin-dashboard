// PLACEMENT: shared/src/blogBlocks/importer.js  (canonical — edit here only)
//
// Legacy body_html -> block tree, best-effort. BROWSER-ONLY (uses DOMParser),
// unlike every other file in this directory — it only ever runs inside
// Admin-dashboard's "Convert to blocks" flow, never at build time or in the
// selftest.js Node script, so there's no need to keep it Node-testable.
//
// This is explicitly NOT a lossless round-trip. Its job is to recognize the
// ~12 recurring structural patterns the coverage spike found (see the block
// editor project's plan doc) and produce real, editable blocks for them,
// while guaranteeing nothing is silently dropped: anything unrecognized
// becomes a `legacy_html` passthrough block holding that node's original
// markup verbatim. The caller ALWAYS shows a before/after preview and a
// confidence score before writing anything — see BlogEditor.jsx's
// "Convert to blocks" flow. Nothing here writes to a post; it only returns
// a proposed { blocks, theme, report }.
//
// ── Structural model ──────────────────────────────────────────────────
// Legacy posts nest content inside a few "wrapper" containers that carry no
// meaning of their own (root/body/sec) — walking into them and flattening
// their children onto the same sequence is what lets a single generic walker
// handle both real corpus conventions seen in practice:
//   Pattern A (science): <div class="X-sec"><div class="X-sec-head">…
//                         </div><p>…</p><div class="X-whatever">…</div></div>
//   Pattern B (history):  <div class="X-sec-head">…</div><p>…</p>
//                         <div class="X-whatever">…</div>   (siblings, no wrapper)
// Both reduce to the same flat sequence once "sec" is treated as a
// transparent wrapper rather than something requiring special-case nesting.

import { createBlock } from "./schema.js";

// "faq-list" is a common wrapper AROUND the run of .faq-item <details>
// elements (found via a real fragment, not assumed) — without treating it
// as transparent, the whole FAQ section falls through to legacy_html
// verbatim instead of becoming an editable faq_group.
const WRAPPER_SUFFIXES = new Set(["root", "body", "wrap", "sec", "faq-list", "faq-items"]);
const TEXT_LIKE_SUFFIXES = new Set(["text", "body-text", "lead", "intro-text"]);
const FAQ_HEADING_SUFFIXES = new Set(["faq-label", "faq-header", "faq-title", "faq-heading", "faq-rule", "badge-dot"]);

const PREFIX_RE = /^([a-z][a-z0-9]{1,7})-/;
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/* ─────────────────────────── Theme extraction ─────────────────────────── */

function extractTheme(rawHtml, themeTokens) {
  const styleMatch = rawHtml.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i);
  if (!styleMatch) return {};
  const rootMatch = styleMatch[1].match(/:root\s*{([^}]*)}/i);
  if (!rootMatch) return {};

  const theme = {};
  const varRe = /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/gi;
  let m;
  while ((m = varRe.exec(rootMatch[1]))) {
    const [, name, value] = m;
    if (themeTokens.includes(name) && HEX_RE.test(value)) {
      theme[name] = value;
    }
  }
  return theme;
}

/* ─────────────────────────── Prefix detection ─────────────────────────── */

// Same heuristic as the Phase 6 coverage spike script (coverage_spike.py):
// sample only the first ~24 classed elements (the hero/intro region), not
// the whole document — a large repeated section (12 FAQ items) would
// otherwise outvote the real one-time per-post namespace.
function detectPrefix(root) {
  const counts = new Map();
  let sampled = 0;
  const walker = root.querySelectorAll("[class]");
  for (const el of walker) {
    for (const cls of el.classList) {
      const m = PREFIX_RE.exec(cls);
      if (m) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
    }
    sampled += 1;
    if (sampled >= 24) break;
  }
  let best = null, bestCount = 0;
  for (const [prefix, count] of counts) {
    if (count > bestCount) { best = prefix; bestCount = count; }
  }
  return best;
}

function canonicalSuffixes(el, prefix) {
  const cls = el.getAttribute("class") || "";
  return cls.split(/\s+/).filter(Boolean).map((c) =>
    prefix && c.startsWith(prefix + "-") ? c.slice(prefix.length + 1) : c
  );
}

function suffixSet(el, prefix) {
  return new Set(canonicalSuffixes(el, prefix));
}

function findBySuffix(el, prefix, suffix) {
  for (const child of el.querySelectorAll("*")) {
    if (suffixSet(child, prefix).has(suffix)) return child;
  }
  return null;
}

function textOf(el) {
  return (el?.textContent || "").trim();
}

/* ───────────────────────── Per-pattern extractors ─────────────────────── */

function extractHero(el, prefix) {
  // "hero-tag" is a real alternate name for the same overline element —
  // 19 of 114 legacy posts use it instead of "overline" (the same cluster
  // that uses hero-sub/hero-meta rather than the stat-bar).
  const overline = textOf(findBySuffix(el, prefix, "overline")) || textOf(findBySuffix(el, prefix, "hero-tag"));
  const titleEl = findBySuffix(el, prefix, "hero-title");
  let title = "", titleAccent = "";
  if (titleEl) {
    const span = titleEl.querySelector("span");
    titleAccent = textOf(span);
    // Title text is everything in the h1 EXCEPT the accent span — walk child
    // nodes rather than textContent, which would include the span's text too.
    title = Array.from(titleEl.childNodes)
      .filter((n) => !(n.nodeType === 1 && n.tagName === "SPAN"))
      .map((n) => n.textContent)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const subtitle = textOf(findBySuffix(el, prefix, "hero-sub"));
  const bgNum = textOf(findBySuffix(el, prefix, "hero-bg-num"));

  const stats = [];
  const barItems = el.querySelectorAll("*");
  for (const child of barItems) {
    if (suffixSet(child, prefix).has("hero-bar-item")) {
      stats.push({
        label: textOf(findBySuffix(child, prefix, "bar-label")),
        value: textOf(findBySuffix(child, prefix, "bar-value")),
      });
    }
  }

  const chips = [];
  for (const child of el.querySelectorAll("*")) {
    if (suffixSet(child, prefix).has("meta-chip")) chips.push(textOf(child));
  }

  let decor = "none";
  for (const child of el.querySelectorAll("*")) {
    const suf = suffixSet(child, prefix);
    if (suf.has("hero-dots")) { decor = "dots"; break; }
    if (suf.has("hero-hex")) { decor = "hex"; break; }
    if (suf.has("hero-grid")) { decor = "grid"; break; }
  }

  return createBlock("hero", { overline, title, titleAccent, subtitle, bgNum, decor, stats, chips });
}

function extractSectionHeader(el, prefix) {
  const num = textOf(findBySuffix(el, prefix, "sec-num"));
  const kicker = textOf(findBySuffix(el, prefix, "sec-kicker"));
  const titleEl = findBySuffix(el, prefix, "sec-title") || el.querySelector("h2, h3");
  let title = "", titleAccent = "";
  if (titleEl) {
    const span = titleEl.querySelector("span");
    titleAccent = textOf(span);
    title = Array.from(titleEl.childNodes)
      .filter((n) => !(n.nodeType === 1 && n.tagName === "SPAN"))
      .map((n) => n.textContent)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return createBlock("section_header", { num, kicker, title, titleAccent });
}

function extractFaqGroup(items, precedingLabel, precedingHeading) {
  const faqItems = items.map((details) => {
    const summary = details.querySelector("summary");
    const ans = Array.from(details.children).find((c) => c !== summary);
    return { q: textOf(summary), a: ans ? ans.innerHTML : "" };
  });
  return createBlock("faq_group", {
    chipLabel: precedingLabel || "FAQ",
    heading: precedingHeading || "Frequently Asked Questions",
    items: faqItems,
  });
}

function extractTable(el) {
  const table = el.tagName === "TABLE" ? el : el.querySelector("table");
  if (!table) return null;
  const headers = Array.from(table.querySelectorAll("thead th")).map((th) => ({
    text: textOf(th),
    bg: "accent",
  }));
  const rows = Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
    Array.from(tr.querySelectorAll("td")).map((td) => textOf(td))
  );
  return createBlock("table", { scrollHint: true, headers, rows });
}

function extractCompareAsTable(el, prefix) {
  const headCells = [];
  for (const child of el.querySelectorAll("*")) {
    if (suffixSet(child, prefix).has("compare-head-cell")) headCells.push(textOf(child));
  }
  const rows = [];
  for (const rowEl of el.querySelectorAll("*")) {
    if (!suffixSet(rowEl, prefix).has("compare-row")) continue;
    const cells = [];
    for (const cell of rowEl.children) {
      if (suffixSet(cell, prefix).has("compare-cell")) cells.push(textOf(cell));
    }
    rows.push(cells);
  }
  return createBlock("table", {
    scrollHint: true,
    headers: headCells.map((text) => ({ text, bg: "accent" })),
    rows,
  });
}

function extractFeatureGrid(el, prefix) {
  const cards = [];
  for (const child of el.children) {
    if (!suffixSet(child, prefix).has("card")) continue;
    const colorMatch = [...child.classList].find((c) => /^c[1-4]$/.test(c));
    const rows = [];
    for (const rowEl of child.querySelectorAll("*")) {
      if (suffixSet(rowEl, prefix).has("card-row")) {
        const span = rowEl.querySelector("span");
        rows.push(span ? span.innerHTML : textOf(rowEl));
      }
    }
    cards.push({
      tag: textOf(findBySuffix(child, prefix, "card-tag")),
      name: textOf(findBySuffix(child, prefix, "card-name")),
      color: colorMatch ? Number(colorMatch[1]) : 1,
      rows,
    });
  }
  return createBlock("feature_grid", { columns: Math.min(4, Math.max(2, cards.length || 3)), cards });
}

function extractStatGrid(el, prefix) {
  const items = [];
  for (const child of el.children) {
    if (!suffixSet(child, prefix).has("stat-box")) continue;
    items.push({
      value: textOf(findBySuffix(child, prefix, "stat-num")),
      label: textOf(findBySuffix(child, prefix, "stat-label")),
    });
  }
  return createBlock("stat_grid", { columns: Math.min(5, Math.max(2, items.length || 4)), items });
}

function extractTimeline(el, prefix) {
  const items = [];
  for (const child of el.children) {
    if (!suffixSet(child, prefix).has("tl-item")) continue;
    const descEl = findBySuffix(child, prefix, "tl-desc");
    items.push({
      year: textOf(findBySuffix(child, prefix, "tl-year")),
      name: textOf(findBySuffix(child, prefix, "tl-name")),
      desc: descEl ? descEl.innerHTML : "",
    });
  }
  return createBlock("timeline", { items });
}

/* ──────────────────────────────── Walker ──────────────────────────────── */

function walkSequence(children, prefix, out) {
  let textBuffer = [];
  const flushText = () => {
    if (textBuffer.length) {
      out.push(createBlock("rich_text", { html: textBuffer.join("") }));
      textBuffer = [];
    }
  };

  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    if (el.nodeType !== 1) continue; // skip text/comment nodes at this level
    const suf = suffixSet(el, prefix);
    const tag = el.tagName;

    // "blog-root" is a real, generic (NOT per-post-prefixed) outer wrapper
    // used by 18 of 114 legacy posts around the per-post-prefixed hero/body
    // — checked against the RAW class list, since it never starts with the
    // detected prefix and so never appears in the prefix-stripped `suf` set.
    const isGenericWrapper = el.classList.contains("blog-root");

    if (isGenericWrapper || [...suf].some((s) => WRAPPER_SUFFIXES.has(s))) {
      flushText();
      walkSequence(Array.from(el.children), prefix, out);
      continue;
    }
    if (suf.has("hero")) { flushText(); out.push(extractHero(el, prefix)); continue; }
    if (suf.has("sec-head")) { flushText(); out.push(extractSectionHeader(el, prefix)); continue; }
    if (suf.has("intro")) {
      flushText();
      out.push(createBlock("callout", { variant: "intro", html: el.innerHTML }));
      continue;
    }
    if (suf.has("divider")) { flushText(); out.push(createBlock("divider", { mark: "hex" })); continue; }
    // A real <table> wins regardless of its wrapper's class name — the
    // corpus uses at least two different wrapper suffixes for the exact
    // same real <table> ("table-wrap" and "compare-wrap"), so matching on
    // "does this contain a real table" is more robust than enumerating
    // every wrapper name. `suf.has("compare")` (checked after, div-only
    // comparison grids with no real <table>) is a genuinely different shape.
    if (tag === "TABLE" || el.querySelector("table")) {
      flushText();
      const block = extractTable(el);
      out.push(block || createBlock("legacy_html", { html: el.outerHTML }));
      continue;
    }
    if (suf.has("compare")) { flushText(); out.push(extractCompareAsTable(el, prefix)); continue; }
    if (suf.has("card-grid")) { flushText(); out.push(extractFeatureGrid(el, prefix)); continue; }
    if (suf.has("stats-row")) { flushText(); out.push(extractStatGrid(el, prefix)); continue; }
    if (suf.has("timeline")) { flushText(); out.push(extractTimeline(el, prefix)); continue; }

    if (suf.has("faq-item") || tag === "DETAILS") {
      flushText();
      // Consume the whole consecutive run of faq-items...
      const run = [el];
      let j = i + 1;
      while (j < children.length && children[j].nodeType === 1 &&
             (suffixSet(children[j], prefix).has("faq-item") || children[j].tagName === "DETAILS")) {
        run.push(children[j]);
        j += 1;
      }
      // ...and look BACKWARD from `out` for a heading this walker already
      // flushed as legacy_html (a faq-label/-header/-title sibling emitted
      // just before this run) so it isn't duplicated as raw HTML AND
      // consumed as the group's heading.
      let chipLabel = "", heading = "";
      let k = out.length - 1;
      while (k >= 0 && out[k].t === "legacy_html") {
        const prevSuf = out[k]._sourceSuffix;
        if (prevSuf && FAQ_HEADING_SUFFIXES.has(prevSuf)) {
          const text = out[k]._sourceText || "";
          if (prevSuf === "faq-label" || prevSuf === "faq-header") chipLabel = text || chipLabel;
          if (prevSuf === "faq-title" || prevSuf === "faq-heading") heading = text || heading;
          out.splice(k, 1);
          k -= 1;
          continue;
        }
        break;
      }
      out.push(extractFaqGroup(run, chipLabel, heading));
      i = j - 1;
      continue;
    }

    if (tag === "P" || [...suf].some((s) => TEXT_LIKE_SUFFIXES.has(s))) {
      textBuffer.push(el.innerHTML);
      continue;
    }

    // Unmatched — preserve verbatim. Tag with the suffix/text so a
    // following faq-item run can reclaim a heading it needs (see above)
    // without a second, more complex lookahead pass.
    flushText();
    const primarySuffix = [...suf][0];
    const legacy = createBlock("legacy_html", { html: el.outerHTML });
    if (primarySuffix && FAQ_HEADING_SUFFIXES.has(primarySuffix)) {
      legacy._sourceSuffix = primarySuffix;
      legacy._sourceText = textOf(el);
    }
    out.push(legacy);
  }
  flushText();
}

/* ──────────────────────────────── Entry ───────────────────────────────── */

/**
 * Convert a legacy post's raw `body_html` (with its own <style> block intact)
 * into a proposed block tree + theme. Never mutates anything — the caller
 * decides whether to adopt the result.
 */
export function importLegacyHtml(rawHtml, themeTokens) {
  const theme = extractTheme(rawHtml, themeTokens);
  const bodyHtml = rawHtml.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").trim();

  const doc = new DOMParser().parseFromString(`<div id="__root__">${bodyHtml}</div>`, "text/html");
  const root = doc.getElementById("__root__");
  const prefix = detectPrefix(root);

  const blocks = [];
  walkSequence(Array.from(root.children), prefix, blocks);
  // Strip the internal bookkeeping fields before returning — they're an
  // implementation detail of the FAQ-heading lookback, not part of the
  // block schema.
  for (const b of blocks) {
    delete b._sourceSuffix;
    delete b._sourceText;
  }

  const totalBytes = new Blob([bodyHtml]).size;
  const legacyBytes = blocks
    .filter((b) => b.t === "legacy_html")
    .reduce((sum, b) => sum + new Blob([b.html]).size, 0);
  const coverage = totalBytes ? 1 - legacyBytes / totalBytes : 1;

  return {
    blocks,
    theme,
    report: {
      prefix,
      totalBlocks: blocks.length,
      legacyBlocks: blocks.filter((b) => b.t === "legacy_html").length,
      coverage: Math.max(0, Math.min(1, coverage)),
    },
  };
}
