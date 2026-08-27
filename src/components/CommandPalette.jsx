// ⌘K search across every content type (design_handoff_content_studio Phase 2).
//
// Opened from the sidebar button under the brand, or ⌘K / Ctrl-K anywhere.
// Escape closes; ArrowUp/ArrowDown move; Enter navigates.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, HelpCircle, Image as ImageIcon, Layout, Search, Tag,
} from "lucide-react";
import { searchContent } from "../api/admin_content_studio";
import "../css/ContentStudio.css";

const KIND_ICON = {
  post: FileText,
  answer: HelpCircle,
  page: Layout,
  label: Tag,
  picture: ImageIcon,
};

const CommandPalette = ({ open, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // Reset on every open so the palette never reopens showing a stale query.
  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setFailed(false);
      setCursor(0);
      // Focus after paint, or the input isn't in the DOM yet.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced search. The AbortController matters: without it a slow early
  // response can land after a later one and overwrite newer results.
  useEffect(() => {
    if (!open) return undefined;
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    const timer = setTimeout(() => {
      searchContent(term, { signal: controller.signal })
        .then((data) => {
          setResults(data.results || []);
          setCursor(0);
        })
        .catch((err) => {
          // An abort is expected on every keystroke; a real failure is not.
          // Leaving `results` empty rendered "Nothing matches" — telling the
          // editor the content doesn't exist when the search never ran.
          if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED"
              || err?.name === "AbortError") return;
          setResults([]);
          setFailed(true);
        })
        .finally(() => setLoading(false));
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, open]);

  const go = useCallback((item) => {
    if (!item) return;
    onClose();
    navigate(item.url);
  }, [navigate, onClose]);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[cursor]);
    }
  };

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  const term = q.trim();

  return (
    <div
      className="cs-palette-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="cs-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search all content"
      >
        <div className="cs-palette__head">
          <Search size={18} className="cs-palette__head-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            className="cs-palette__input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search posts, pages, answers, labels and pictures"
            aria-label="Search all content"
          />
          <button className="cs-palette__esc" onClick={onClose} aria-label="Close search">
            ESC
          </button>
        </div>

        <div className="cs-palette__body" ref={listRef}>
          {term.length < 2 && (
            <p className="cs-palette__hint">
              Type at least two letters to search everything at once.
            </p>
          )}
          {term.length >= 2 && loading && results.length === 0 && (
            <p className="cs-palette__hint">Searching…</p>
          )}
          {term.length >= 2 && !loading && failed && (
            <p className="cs-palette__hint">
              Search isn’t responding right now. Nothing was searched — try again
              in a moment.
            </p>
          )}
          {term.length >= 2 && !loading && !failed && results.length === 0 && (
            <p className="cs-palette__hint">
              Nothing matches “{term}”.
            </p>
          )}
          {results.map((r, i) => {
            const Icon = KIND_ICON[r.kind] || FileText;
            return (
              <button
                key={`${r.kind}-${r.url}-${i}`}
                type="button"
                data-index={i}
                className={`cs-palette__row${i === cursor ? " is-active" : ""}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(r)}
              >
                <span className={`cs-palette__tile cs-kind-${r.kind}`}>
                  <Icon size={15} aria-hidden="true" />
                </span>
                <span className="cs-palette__text">
                  <span className="cs-palette__title">{r.title}</span>
                  <span className="cs-palette__where">{r.where}</span>
                </span>
                <span className="cs-palette__kind">{r.kind_label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
