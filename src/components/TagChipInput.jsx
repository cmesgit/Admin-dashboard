import { useRef, useState } from "react";
import { X } from "lucide-react";

// Comma-or-Enter-to-add multi-value text input, shared by every plain
// string-list field in the Content (CMS) section: Blog Posts' `tags`,
// Current Affairs' `tags`, and Showcase Courses' `categories`. Behaves like
// a normal text input from the outside — `value` is a plain string array,
// `onChange` receives the next array.
const TagChipInput = ({ value, onChange, placeholder }) => {
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  const tags = Array.isArray(value) ? value : [];

  const commit = () => {
    const v = draft.trim().replace(/,+$/, "");
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
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
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={tags.length === 0 ? placeholder : ""}
      />
    </div>
  );
};

export default TagChipInput;
