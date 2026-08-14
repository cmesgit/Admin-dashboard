import { useRef, useState } from "react";
import { X } from "lucide-react";

// Comma-or-Enter-to-add multi-value text input, shared by every plain
// string-list field in the Content (CMS) section: Blog Posts' `tags`,
// Current Affairs' `tags`, and Showcase Courses' `categories`. Behaves like
// a normal text input from the outside — `value` is a plain string array,
// `onChange` receives the next array.
//
// `suggestions` (optional string array — every distinct tag name already in
// use, e.g. from getContentTags()) drives a small filtered dropdown so an
// author reuses an existing tag instead of accidentally minting a
// near-duplicate ("Exam" vs "exams"). Purely additive: with no `suggestions`
// prop this behaves exactly as before (free-text only).
const TagChipInput = ({ value, onChange, placeholder, suggestions }) => {
  const [draft, setDraft] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);
  const tags = Array.isArray(value) ? value : [];

  const commit = (explicitValue) => {
    const v = (explicitValue ?? draft).trim().replace(/,+$/, "");
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft("");
    setSuggestOpen(false);
  };

  const matches = (Array.isArray(suggestions) ? suggestions : [])
    .filter((s) => s && !tags.includes(s))
    .filter((s) => draft.trim() && s.toLowerCase().includes(draft.trim().toLowerCase()))
    .slice(0, 8);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown" && suggestOpen && matches.length > 0) {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % matches.length);
    } else if (e.key === "ArrowUp" && suggestOpen && matches.length > 0) {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(suggestOpen && matches[highlighted] ? matches[highlighted] : undefined);
    } else if (e.key === "Escape" && suggestOpen) {
      setSuggestOpen(false);
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const remove = (i) => onChange(tags.filter((_, idx) => idx !== i));

  return (
    <div className="tag-chip-input" onClick={() => inputRef.current?.focus()}>
      {tags.map((t, i) => (
        <span className="tag-chip" key={`${t}-${i}`}>
          {t}
          <button
            type="button"
            className="tag-chip-remove"
            onClick={(e) => { e.stopPropagation(); remove(i); }}
            aria-label={`Remove ${t}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <div className="tag-suggest-anchor">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setHighlighted(0); setSuggestOpen(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setSuggestOpen(true)}
          onBlur={() => { commit(); setSuggestOpen(false); }}
          placeholder={tags.length === 0 ? placeholder : ""}
        />
        {suggestOpen && matches.length > 0 && (
          <div className="tag-suggest-popover">
            {matches.map((s, i) => (
              <button
                type="button"
                key={s}
                className={`tag-suggest-option${i === highlighted ? " active" : ""}`}
                // mousedown (not click) fires before the input's onBlur, so the
                // chip commits from the click itself rather than losing the
                // draft to the blur handler first.
                onMouseDown={(e) => { e.preventDefault(); commit(s); }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagChipInput;
