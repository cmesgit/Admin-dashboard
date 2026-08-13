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
import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List,
  ListOrdered, Link2, Link2Off, Image as ImageIcon, Table as TableIcon,
  Heading1, Heading2, Heading3, Quote, Code, Minus, Undo2, Redo2,
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

const RichTextEditor = ({ value, onChange, mode = "full", placeholder }) => {
  const fileInputRef = useRef(null);
  const isFull = mode === "full";

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
          ]
        : []),
    ],
    content: value || "",
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      attributes: { class: "rte-content" },
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

  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes("link").href || "";
    const url = window.prompt("Link URL (leave blank to remove)", prev);
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const pickImage = () => fileInputRef.current?.click();

  const onImageChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const uploaded = await uploadContentEditorImage(file);
      editor.chain().focus().setImage({ src: uploaded.file, alt: "" }).run();
    } catch {
      window.alert("Image upload failed. Please try again.");
    }
  };

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
        <ToolbarButton title="Link" active={editor.isActive("link")} onClick={setLink}><Link2 size={15} /></ToolbarButton>
        {editor.isActive("link") && (
          <ToolbarButton title="Remove link" onClick={() => editor.chain().focus().unsetLink().run()}><Link2Off size={15} /></ToolbarButton>
        )}
        {isFull && (
          <>
            <span className="rte-sep" />
            <ToolbarButton title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={15} /></ToolbarButton>
            <ToolbarButton title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></ToolbarButton>
            <ToolbarButton title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={15} /></ToolbarButton>
            <span className="rte-sep" />
            <ToolbarButton title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></ToolbarButton>
            <ToolbarButton title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code size={15} /></ToolbarButton>
            <ToolbarButton title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={15} /></ToolbarButton>
            <span className="rte-sep" />
            <ToolbarButton title="Insert image" onClick={pickImage}><ImageIcon size={15} /></ToolbarButton>
            <ToolbarButton title="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={15} /></ToolbarButton>
          </>
        )}
        <span className="rte-sep" />
        <ToolbarButton title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></ToolbarButton>
        <ToolbarButton title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></ToolbarButton>
      </div>
      <EditorContent editor={editor} />
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
