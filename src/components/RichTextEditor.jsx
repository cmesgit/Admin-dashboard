// WYSIWYG body editor (TipTap) — replaces the raw-HTML textarea approach
// (see HtmlToolbar.jsx) for surfaces where authors shouldn't need to write
// or understand HTML. Storage format is unchanged: `onChange` still hands
// back an HTML string, so this is a drop-in replacement for any
// `<textarea value={form.body_html} onChange={...}>` field — no backend
// or data-model migration involved.
//
// `mode="restricted"` (used for homepage body fields, which feed a fixed
// React layout) strips headings/images/tables/blocks down to inline
// formatting only, so a homepage author literally cannot break the layout.
// `mode="full"` (blog posts, which get free-form rendering) keeps
// everything the sanitizer allowlist (backend/content/sanitize.py) permits.
//
// Every feature below that isn't plain inline formatting (link popover
// aside, since links are allowed in both modes) is gated behind `isFull` —
// restricted mode must stay exactly as constrained as it was before this
// file grew a table/image/align toolbar.
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List,
  ListOrdered, Link2, Link2Off, Image as ImageIcon, Table as TableIcon,
  Heading1, Heading2, Heading3, Quote, Code, Minus, Undo2, Redo2,
  AlignLeft, AlignCenter, AlignRight, ArrowUpToLine, ArrowDownToLine,
  ArrowLeftToLine, ArrowRightToLine, Rows, Columns, TableProperties,
  TableCellsMerge, TableCellsSplit, Trash2, Loader2, Info, ListCollapse,
} from "lucide-react";
import { uploadContentEditorImage } from "../api/admin";

const ToolbarButton = ({ active, disabled, onClick, title, children }) => (
  <button
    type="button"
    className={`rte-btn${active ? " active" : ""}`}
    disabled={disabled}
    title={title}
    onMouseDown={(e) => e.preventDefault()} // keep editor selection on click
    onClick={onClick}
  >
    {children}
  </button>
);

// Accepts a raw string typed/pasted into the link popover and turns it into
// something the backend sanitizer (nh3, allowed URL schemes: http, https,
// mailto, tel) will actually keep. Bare domains ("example.com") are assumed
// to be https so authors don't have to think about it; relative paths and
// in-page anchors are left untouched since they carry no scheme at all.
// Anything with an explicit scheme outside the allowlist (`javascript:`,
// `data:`, `file:`, ...) is rejected outright rather than silently passed
// through to be stripped later, since a silently-stripped href reads to the
// author as "my link disappeared" with no clue why.
const SAFE_SCHEME_RE = /^(https?:|mailto:|tel:)/i;
const ANY_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const normalizeLinkUrl = (raw) => {
  const trimmed = raw.trim();
  if (!trimmed) return { value: "", error: null };
  if (SAFE_SCHEME_RE.test(trimmed)) return { value: trimmed, error: null };
  if (/^[/#]/.test(trimmed)) return { value: trimmed, error: null };
  if (ANY_SCHEME_RE.test(trimmed)) {
    return { value: null, error: "Only http(s), mailto, tel, or relative links are allowed." };
  }
  return { value: `https://${trimmed}`, error: null };
};

// Callout and collapsible-section blocks each need a real TipTap schema
// Node — NOT just a raw HTML string handed to insertContent. StarterKit's
// schema has no node for a bare `div`/`details`/`summary`; ProseMirror's
// HTML parser treats an element with no matching parseRule as transparent,
// silently dropping the wrapper tag (and its class!) while still parsing
// and keeping any recognized child content (a `<p>`). That was verified
// directly against this app's real chapter content: 114 of 115 imported
// legacy posts already contain hand-authored `<details><summary>` FAQ
// accordions (see backend/content/sanitize.py's own allowlist comment), and
// loading one of them into this editor without these Node definitions
// silently strips every `<details>`/`<summary>` tag on load — an admin who
// then hits Save would permanently delete that chapter's FAQ sections. The
// two Node definitions below give `div.callout`/`details`/`summary` a real
// place in the schema, so both round-trip on load AND stay well-formed when
// inserted fresh via the toolbar.
const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      // Stored only as the class (callout-info/-warning/-success), never as
      // a separate `variant="…"` DOM attribute — nh3's allowlist for `div`
      // is just the global set (class/id/style/title/role), so a bare
      // `variant` attribute would be silently stripped server-side anyway.
      variant: {
        default: "info",
        parseHTML: (element) => {
          const cls = element.getAttribute("class") || "";
          if (cls.includes("callout-warning")) return "warning";
          if (cls.includes("callout-success")) return "success";
          return "info";
        },
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div.callout" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: `callout callout-${node.attrs.variant}` }),
      0,
    ];
  },
});

// A `<summary>` is single-line/heading-like content, not a full block — kept
// as its own node (rather than folding its text into `details`' attrs) so
// it stays a normal editable text region with the same typing/selection
// behavior as any other node.
const DetailsSummary = Node.create({
  name: "detailsSummary",
  content: "inline*",
  marks: "",
  defining: true,
  parseHTML() {
    return [{ tag: "summary" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["summary", HTMLAttributes, 0];
  },
});

// `content: "detailsSummary block+"` mirrors real `<details>` markup exactly
// — a `<summary>` followed by one or more sibling block elements, not a
// summary wrapping a nested body. `detailsSummary` isn't in the `block`
// group, so the schema itself prevents it from being inserted anywhere
// other than as the first child of a `details` node.
const Details = Node.create({
  name: "details",
  group: "block",
  content: "detailsSummary block+",
  defining: true,
  parseHTML() {
    return [{ tag: "details" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["details", HTMLAttributes, 0];
  },
});

const CALLOUT_VARIANTS = [
  { key: "info", label: "Info" },
  { key: "warning", label: "Warning" },
  { key: "success", label: "Success" },
];

// One TipTap image node occupies exactly 1 position in the document, so
// inserting a run of pasted/dropped images in order just means walking the
// position forward by 1 after each successful insert — no need to re-query
// the doc between images.
const IMAGE_NODE_SIZE = 1;

const RichTextEditor = ({
  value,
  onChange,
  mode = "full",
  placeholder,
  tall = false,
  showStats = false,
  onStats,
}) => {
  const fileInputRef = useRef(null);
  const isFull = mode === "full";

  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState(null);
  const linkInputRef = useRef(null);

  // Variant-picker popover for the callout block — mirrors the link
  // popover's open/close plumbing above rather than inventing a second
  // pattern for "toolbar button reveals a small floating panel".
  const [calloutPopoverOpen, setCalloutPopoverOpen] = useState(false);

  // `state`: "idle" | "uploading" | "error". Surfaced next to the toolbar
  // instead of `window.alert`, and used to disable the insert-image button
  // so a second upload can't stack on top of one still in flight.
  const [imageStatus, setImageStatus] = useState({ state: "idle", message: "" });

  const [stats, setStats] = useState({ words: 0, characters: 0 });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: isFull ? { levels: [1, 2, 3] } : false,
        codeBlock: isFull,
        blockquote: isFull,
        horizontalRule: isFull,
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder: placeholder || "Start writing…" }),
      ...(isFull
        ? [
            TiptapImage.configure({ inline: false }),
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
            // Emits `style="text-align: …"` on the heading/paragraph node —
            // `style` is on the sanitizer's global-attribute allowlist and
            // `text-align` is one of ammonia's default allowed CSS
            // properties, so this survives both the nh3 pass server-side
            // and the DOMPurify pass on the public frontend intact.
            TextAlign.configure({ types: ["heading", "paragraph"] }),
            Callout,
            Details,
            DetailsSummary,
          ]
        : []),
    ],
    content: value || "",
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
      if (onStats || showStats) {
        const text = ed.state.doc.textContent;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const next = { words, characters: text.length };
        setStats(next);
        onStats?.(next);
      }
    },
    editorProps: {
      attributes: { class: `rte-content${tall ? " rte-content--tall" : ""}` },
      // Link's `openOnClick: false` (below) only stops TipTap's own Link
      // plugin from calling `window.open` — it does not preventDefault the
      // underlying click, so without this an author clicking existing link
      // text to edit around it gets bounced off the page. `handleClick` is
      // ProseMirror's own click-dispatch prop (run from the same
      // mouseup-driven path Link's plugin itself uses), which is the
      // documented interception point for this — a plain DOM
      // `addEventListener("click", ...)` on the editor root does not
      // reliably preempt the browser's native anchor navigation here.
      handleClick: (_view, _pos, event) => {
        if (event.target.closest?.("a")) {
          event.preventDefault();
          return true;
        }
        return false;
      },
      // Image paste/drop is a full-mode-only feature — the Image extension
      // isn't even registered in restricted mode, so calling setImage/
      // insertContentAt with an "image" node there would throw. Returning
      // `false` for anything we don't handle lets ProseMirror fall through
      // to its default paste/drop handling (plain text, pasted HTML, etc.)
      // untouched.
      handlePaste: (view, event) => {
        if (!isFull) return false;
        const files = Array.from(event.clipboardData?.files || []).filter((f) =>
          f.type.startsWith("image/")
        );
        if (files.length === 0) return false;
        event.preventDefault();
        insertImagesSequentially(files, view.state.selection.from);
        return true;
      },
      handleDrop: (view, event) => {
        if (!isFull) return false;
        const files = Array.from(event.dataTransfer?.files || []).filter((f) =>
          f.type.startsWith("image/")
        );
        if (files.length === 0) return false;
        event.preventDefault();
        // Use the drop coordinates, not the current selection — the user
        // dropped the image at a specific spot in the document, which may
        // be nowhere near wherever the cursor last was.
        const target = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (!target) return false;
        insertImagesSequentially(files, target.pos);
        return true;
      },
    },
  });

  // Keep the editor in sync when `value` changes from outside (e.g. the
  // modal opening with `initial.body_html`, or a mode switch) — but not on
  // every keystroke, since that would fight the user's own cursor.
  useEffect(() => {
    if (!editor) return;
    const incoming = value || "";
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [editor, value]);

  // Focus the URL field the moment the popover opens, so Enter-to-apply
  // works without an extra click.
  useEffect(() => {
    if (linkPopoverOpen) linkInputRef.current?.focus();
  }, [linkPopoverOpen]);

  if (!editor) return null;

  // Shared by the toolbar file-picker, clipboard paste, and drag-and-drop —
  // uploads are done sequentially (not Promise.all) so multiple pasted
  // images land in the same order they were pasted, and so a single failure
  // doesn't take the others down with it (each is inserted independently on
  // success; a failed one just never gets an <img> node, no broken tags
  // left behind).
  const insertImagesSequentially = async (files, atPos) => {
    if (!isFull || atPos == null) return;
    setImageStatus({
      state: "uploading",
      message: files.length > 1 ? "Uploading images…" : "Uploading image…",
    });
    let pos = atPos;
    let failures = 0;
    for (const file of files) {
      try {
        const uploaded = await uploadContentEditorImage(file);
        editor
          .chain()
          .insertContentAt(pos, { type: "image", attrs: { src: uploaded.file, alt: "" } })
          .run();
        pos += IMAGE_NODE_SIZE;
      } catch {
        failures += 1;
      }
    }
    editor.chain().focus().setTextSelection(pos).run();
    setImageStatus(
      failures > 0
        ? { state: "error", message: "Image upload failed. Please try again." }
        : { state: "idle", message: "" }
    );
  };

  const openLinkPopover = () => {
    const prev = editor.getAttributes("link").href || "";
    setLinkUrl(prev);
    setLinkError(null);
    setLinkPopoverOpen(true);
  };

  const closeLinkPopover = () => {
    setLinkPopoverOpen(false);
    setLinkError(null);
    editor.commands.focus();
  };

  const applyLink = () => {
    const { value: normalized, error } = normalizeLinkUrl(linkUrl);
    if (error) {
      setLinkError(error);
      return;
    }
    if (!normalized) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
    }
    setLinkPopoverOpen(false);
    setLinkError(null);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkPopoverOpen(false);
    setLinkError(null);
  };

  // Wraps the current selection's plain text (or a placeholder, if nothing
  // is selected) in a callout node. Built as JSON content (a ProseMirror
  // node/text tree), not an HTML string — a JSON text node's `text` field is
  // a literal string with no markup-reparsing step, so no HTML-escaping is
  // needed here the way it would be for a spliced-together HTML string.
  // `insertContentAt({ from, to })` both reads and replaces the selection in
  // one step, so a real selection is consumed rather than left duplicated
  // after the callout lands.
  const insertCallout = (variant) => {
    const { from, to, empty } = editor.state.selection;
    const text = empty ? "" : editor.state.doc.textBetween(from, to, " ");
    editor
      .chain()
      .focus()
      .insertContentAt({ from, to }, {
        type: "callout",
        attrs: { variant },
        content: [{
          type: "paragraph",
          content: text ? [{ type: "text", text }] : [{ type: "text", text: "Add your note here." }],
        }],
      })
      .run();
    setCalloutPopoverOpen(false);
  };

  // Collapsible section — always inserted with placeholder copy in both
  // slots (unlike the callout above, there's no single "the selection goes
  // here" spot since a details block has two independently-editable text
  // areas), so the author overwrites summary/body text after insertion.
  const insertDetails = () => {
    editor
      .chain()
      .focus()
      .insertContent({
        type: "details",
        content: [
          { type: "detailsSummary", content: [{ type: "text", text: "Section title" }] },
          { type: "paragraph", content: [{ type: "text", text: "Section content…" }] },
        ],
      })
      .run();
  };

  const pickImage = () => fileInputRef.current?.click();

  const onImageChosen = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    insertImagesSequentially([file], editor.state.selection.from);
  };

  const inTable = isFull && editor.isActive("table");
  const uploading = imageStatus.state === "uploading";

  return (
    <div className="rte">
      <div className="rte-toolbar">
        <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolbarButton>
        <ToolbarButton title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></ToolbarButton>
        {isFull && (
          <ToolbarButton title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></ToolbarButton>
        )}
        <span className="rte-sep" />
        <ToolbarButton title="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></ToolbarButton>
        <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolbarButton>
        <span className="rte-sep" />
        <div className="rte-link-group">
          <ToolbarButton title="Link" active={editor.isActive("link")} onClick={openLinkPopover}><Link2 size={15} /></ToolbarButton>
          {editor.isActive("link") && (
            <ToolbarButton title="Remove link" onClick={removeLink}><Link2Off size={15} /></ToolbarButton>
          )}
          {linkPopoverOpen && (
            <div className="rte-link-popover">
              <input
                ref={linkInputRef}
                type="text"
                className="rte-link-input"
                value={linkUrl}
                placeholder="https://example.com"
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  if (linkError) setLinkError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    closeLinkPopover();
                  }
                }}
              />
              <div className="rte-link-popover-actions">
                <button
                  type="button"
                  className="rte-link-apply"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={applyLink}
                >
                  Apply
                </button>
                {editor.isActive("link") && (
                  <button
                    type="button"
                    className="rte-link-remove"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={removeLink}
                  >
                    Remove
                  </button>
                )}
              </div>
              {linkError && <div className="rte-link-error">{linkError}</div>}
            </div>
          )}
        </div>
        {isFull && (
          <>
            <span className="rte-sep" />
            <ToolbarButton title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={15} /></ToolbarButton>
            <ToolbarButton title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></ToolbarButton>
            <ToolbarButton title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={15} /></ToolbarButton>
            <span className="rte-sep" />
            <ToolbarButton title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft size={15} /></ToolbarButton>
            <ToolbarButton title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter size={15} /></ToolbarButton>
            <ToolbarButton title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight size={15} /></ToolbarButton>
            <span className="rte-sep" />
            <ToolbarButton title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></ToolbarButton>
            <ToolbarButton title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code size={15} /></ToolbarButton>
            <ToolbarButton title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={15} /></ToolbarButton>
            <span className="rte-sep" />
            <ToolbarButton title="Insert image" disabled={uploading} onClick={pickImage}><ImageIcon size={15} /></ToolbarButton>
            <ToolbarButton title="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={15} /></ToolbarButton>
            {uploading && (
              <span className="rte-upload-status rte-upload-status--busy">
                <Loader2 size={13} className="rte-spin" /> {imageStatus.message}
              </span>
            )}
            {imageStatus.state === "error" && (
              <span className="rte-upload-status rte-upload-status--error">{imageStatus.message}</span>
            )}
            <span className="rte-sep" />
            <div className="rte-callout-group">
              <ToolbarButton title="Insert callout" onClick={() => setCalloutPopoverOpen((o) => !o)}>
                <Info size={15} />
              </ToolbarButton>
              {calloutPopoverOpen && (
                <div className="rte-callout-popover">
                  {CALLOUT_VARIANTS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      className={`rte-callout-option rte-callout-option--${key}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertCallout(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ToolbarButton title="Insert collapsible section" onClick={insertDetails}>
              <ListCollapse size={15} />
            </ToolbarButton>
          </>
        )}
        <span className="rte-sep" />
        <ToolbarButton title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></ToolbarButton>
        <ToolbarButton title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></ToolbarButton>
      </div>

      {/* Table editing controls — only meaningful (and only rendered) while
          the cursor is inside a table, since every command here operates
          on "the table containing the current selection". `editor.can()`
          gates each button individually so e.g. "delete column" disables
          itself on a table that's down to one column instead of silently
          no-op'ing or throwing. */}
      {inTable && (
        <div className="rte-table-toolbar">
          <ToolbarButton title="Add row above" disabled={!editor.can().addRowBefore()} onClick={() => editor.chain().focus().addRowBefore().run()}><ArrowUpToLine size={14} /></ToolbarButton>
          <ToolbarButton title="Add row below" disabled={!editor.can().addRowAfter()} onClick={() => editor.chain().focus().addRowAfter().run()}><ArrowDownToLine size={14} /></ToolbarButton>
          <ToolbarButton title="Delete row" disabled={!editor.can().deleteRow()} onClick={() => editor.chain().focus().deleteRow().run()}><Rows size={14} /></ToolbarButton>
          <span className="rte-sep" />
          <ToolbarButton title="Add column left" disabled={!editor.can().addColumnBefore()} onClick={() => editor.chain().focus().addColumnBefore().run()}><ArrowLeftToLine size={14} /></ToolbarButton>
          <ToolbarButton title="Add column right" disabled={!editor.can().addColumnAfter()} onClick={() => editor.chain().focus().addColumnAfter().run()}><ArrowRightToLine size={14} /></ToolbarButton>
          <ToolbarButton title="Delete column" disabled={!editor.can().deleteColumn()} onClick={() => editor.chain().focus().deleteColumn().run()}><Columns size={14} /></ToolbarButton>
          <span className="rte-sep" />
          <ToolbarButton title="Toggle header row" disabled={!editor.can().toggleHeaderRow()} onClick={() => editor.chain().focus().toggleHeaderRow().run()}><TableProperties size={14} /></ToolbarButton>
          <ToolbarButton title="Merge cells" disabled={!editor.can().mergeCells()} onClick={() => editor.chain().focus().mergeCells().run()}><TableCellsMerge size={14} /></ToolbarButton>
          <ToolbarButton title="Split cell" disabled={!editor.can().splitCell()} onClick={() => editor.chain().focus().splitCell().run()}><TableCellsSplit size={14} /></ToolbarButton>
          <span className="rte-sep" />
          <ToolbarButton title="Delete table" disabled={!editor.can().deleteTable()} onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 size={14} /></ToolbarButton>
        </div>
      )}

      <EditorContent editor={editor} />

      {showStats && (
        <div className="rte-stats">
          {stats.words} {stats.words === 1 ? "word" : "words"} · {stats.characters}{" "}
          {stats.characters === 1 ? "character" : "characters"}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onImageChosen}
      />
    </div>
  );
};

export default RichTextEditor;
