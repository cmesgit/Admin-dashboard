// Write or edit a current affair, inside the Studio.
//
// Its own file rather than a fourth modal inside QuestionsAndNotices, which is
// already 620 lines with three — same split as CardFormModal/CourseCards.
//
// The fields are the legacy Current Affairs tab's, renamed to what they
// actually are on the page. Two things carried over deliberately:
//
//  * `publish_at` is OMITTED when blank, never sent as null. CurrentAffair
//    .publish_at is DateTimeField(default=timezone.now) with no null=True, so
//    DRF builds it allow_null=False and an explicit null 400s with "This field
//    may not be null." Every create that didn't manually pick a date used to
//    fail on exactly this.
//  * the write-up stays a plain HTML textarea, as it was on the legacy tab.
//    RichTextEditor was tried here (lazily, to keep @tiptap's ~145KB gzip
//    chunk off this route) and throws on mount inside this modal — the props
//    are the same ones BlogEditor passes, so the fault is internal to the
//    editor, most likely useEditor under StrictMode. Not worth blocking the
//    screen on: a textarea is exactly what this field had before, so this is
//    parity, not a regression. Revisit as its own change.
import { useState } from "react";
import TagChipInput from "../../components/TagChipInput";
import { isoToLocalInput, localInputToIso } from "../../utils/datetimeLocal";

// Mirrors CurrentAffair.CATEGORY_CHOICES. Left as the stored keys with a
// readable label beside them, rather than inventing new ones — these show up
// as filters on the public site.
const TOPICS = [
  ["national", "National"],
  ["international", "International"],
  ["economy", "Economy"],
  ["polity", "Polity"],
  ["science-tech", "Science & technology"],
  ["environment", "Environment"],
  ["sports", "Sport"],
  ["awards", "Awards"],
  ["misc", "Something else"],
];

const AffairFormModal = ({ initial, busy, error, onSubmit, onCancel }) => {
  const [form, setForm] = useState({
    title: initial?.title || "",
    slug: initial?.slug || "",
    affair_date: initial?.affair_date || new Date().toISOString().slice(0, 10),
    category: initial?.category || "national",
    summary: initial?.summary || "",
    body_html: initial?.body_html || "",
    source_name: initial?.source_name || "",
    source_url: initial?.source_url || "",
    tags: initial?.tags || [],
    publish_at: isoToLocalInput(initial?.publish_at),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () => {
    if (!form.title.trim()) return onSubmit(null, "Give it a headline first.");
    onSubmit({
      title: form.title.trim(),
      slug: form.slug.trim(),
      affair_date: form.affair_date,
      category: form.category,
      summary: form.summary,
      body_html: form.body_html,
      source_name: form.source_name.trim(),
      source_url: form.source_url.trim(),
      tags: form.tags,
      ...(form.publish_at ? { publish_at: localInputToIso(form.publish_at) } : {}),
    });
  };

  return (
    <div
      className="cs-palette-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="cs-confirm cs-confirm--wide" role="dialog" aria-modal="true">
        <h2 className="cs-card__title">
          {initial?.id ? "Edit this current affair" : "Write a current affair"}
        </h2>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="af-title">Headline</label>
          <input
            id="af-title" className="cs-input cs-input--block" autoFocus
            value={form.title} onChange={set("title")}
            placeholder="e.g. India signs new trade agreement"
          />
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="af-summary">
            Short summary
          </label>
          <textarea
            id="af-summary" className="cs-input cs-input--block" rows={3}
            value={form.summary} onChange={set("summary")}
            placeholder="One or two sentences. This is what shows in the list."
          />
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="af-body">
            Full write-up
          </label>
          <textarea
            id="af-body" className="cs-input cs-input--block" rows={10}
            value={form.body_html} onChange={set("body_html")}
            placeholder="<p>The whole piece…</p>"
          />
          <p className="cs-field__hint">
            Plain HTML, not a rich editor — paragraphs need &lt;p&gt; tags.
          </p>
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="af-date">
            Date it happened
          </label>
          <input
            id="af-date" className="cs-input" type="date"
            value={form.affair_date} onChange={set("affair_date")}
          />
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="af-topic">Topic</label>
          <select
            id="af-topic" className="cs-input"
            value={form.category} onChange={set("category")}
          >
            {TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="af-src">
            Where it came from
          </label>
          <input
            id="af-src" className="cs-input cs-input--block"
            value={form.source_name} onChange={set("source_name")}
            placeholder="e.g. The Hindu"
          />
          <input
            className="cs-input cs-input--block"
            value={form.source_url} onChange={set("source_url")}
            placeholder="https://… (optional)"
          />
          <p className="cs-field__hint">Credited under the piece.</p>
        </div>

        <div className="cs-field">
          <span className="cs-field__label">Labels</span>
          <TagChipInput
            value={form.tags}
            onChange={(tags) => setForm((f) => ({ ...f, tags }))}
          />
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="af-when">Go live at</label>
          <input
            id="af-when" className="cs-input" type="datetime-local"
            value={form.publish_at} onChange={set("publish_at")}
          />
          <p className="cs-field__hint">
            Leave blank to go live as soon as you publish it.
          </p>
        </div>

        <div className="cs-field">
          <label className="cs-field__label" htmlFor="af-slug">
            Web address
          </label>
          <input
            id="af-slug" className="cs-input cs-input--block"
            value={form.slug} onChange={set("slug")}
            placeholder="Leave blank and we'll make one from the headline"
          />
        </div>

        {error && <p className="cs-error" role="alert">{error}</p>}

        <div className="cs-confirm__actions">
          <button
            type="button" className="cs-btn-ghost"
            onClick={onCancel} disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button" className="cs-btn-primary"
            onClick={submit} disabled={busy}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AffairFormModal;
