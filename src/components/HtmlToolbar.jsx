// Small formatting toolbar for the plain-HTML textareas (blog post body,
// FAQ answer — both are raw HTML strings edited by hand, not a rich text
// editor; see the "Plain HTML, not a rich text editor" comment in
// BlogPosts.jsx). Reuses the selectionStart/selectionEnd +
// requestAnimationFrame caret-restore approach from AgreementLetter.jsx's
// `applyFormat`, but wraps HTML tags instead of emitting Markdown.
const ACTIONS = [
  ["bold", "B", "<strong>", "</strong>", "bold text"],
  ["italic", "I", "<em>", "</em>", "italic text"],
  ["h1", "H1", "<h1>", "</h1>", "Heading"],
  ["h2", "H2", "<h2>", "</h2>", "Heading"],
  ["link", "Link", '<a href="https://">', "</a>", "link text"],
];

const HtmlToolbar = ({ textareaRef, value, onChange }) => {
  const applyFormat = (open, close, placeholder) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const sel = value.slice(start, end);
    const mid = `${open}${sel || placeholder}${close}`;
    const next = value.slice(0, start) + mid + value.slice(end);
    const caret = start + mid.length;
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
  };

  return (
    <div className="html-toolbar">
      {ACTIONS.map(([kind, label, open, close, placeholder]) => (
        <button
          key={kind}
          type="button"
          className="html-toolbar-btn"
          title={kind}
          onClick={() => applyFormat(open, close, placeholder)}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

export default HtmlToolbar;
