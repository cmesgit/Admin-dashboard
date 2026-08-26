// Plain-language field primitives for the page editor.
// design_handoff_content_studio Phase 5.
//
// The renaming IS the feature. Every label here says what the thing does on
// the page, not what the database column is called: "Small label above the
// heading", never "Eyebrow". A writer should never have to know that
// `cta_primary_href` exists, or that a URL is a thing they could get wrong.
//
// Each primitive takes (value, onChange, hint) and renders label → control →
// hint. Nothing here knows about drafts or autosave; the editor owns that.
import { Image as ImageIcon, Link2 } from "lucide-react";

/** Wraps any control with its plain-language label and explanatory hint. */
export const Field = ({ label, hint, htmlFor, children, extra }) => (
  <div className="cs-field">
    <div className="cs-field__labelrow">
      <label className="cs-field__label" htmlFor={htmlFor}>{label}</label>
      {extra}
    </div>
    {children}
    {hint && <p className="cs-field__hint">{hint}</p>}
  </div>
);

export const TextField = ({ id, label, hint, value, onChange, placeholder }) => (
  <Field label={label} hint={hint} htmlFor={id}>
    <input
      id={id}
      className="cs-input cs-input--block"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  </Field>
);

export const LongTextField = ({ id, label, hint, value, onChange }) => (
  <Field label={label} hint={hint} htmlFor={id}>
    <textarea
      id={id}
      className="cs-input cs-input--block cs-textarea"
      rows={4}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  </Field>
);

const GOOD_MIN = 12;
const GOOD_MAX = 70;

/** A heading, with a live read on whether it will sit well on the page.
 *
 * Deliberately not a character counter: "62/70" makes someone optimise a
 * number. "Good length" tells them they can stop thinking about it. */
export const HeadingField = ({ id, label, hint, value, onChange }) => {
  const len = (value || "").trim().length;
  let state = "empty";
  let text = "Needed";
  if (len > 0 && len < GOOD_MIN) { state = "warn"; text = "Very short"; }
  else if (len > GOOD_MAX) { state = "warn"; text = "Quite long"; }
  else if (len >= GOOD_MIN) { state = "ok"; text = "Good length"; }

  return (
    <Field
      label={label}
      hint={hint}
      htmlFor={id}
      extra={<span className={`cs-length cs-length--${state}`}>{text}</span>}
    >
      <input
        id={id}
        className="cs-input cs-input--block"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
};

/** A button: its words, and where it goes.
 *
 * The destination is a dropdown of real pages, never a URL box. A hand-typed
 * href is how a homepage button ends up pointing at a 404, and the person
 * typing it has no way to know. */
export const ButtonField = ({
  idPrefix, label, hint, textValue, hrefValue, onText, onHref, targets,
}) => {
  const known = (targets || []).some((g) =>
    g.options.some((o) => o.value === hrefValue),
  );
  return (
    <div className="cs-subcard">
      <p className="cs-subcard__title">{label}</p>
      {hint && <p className="cs-field__hint cs-field__hint--tight">{hint}</p>}
      <div className="cs-button-row">
        <Field label="What the button says" htmlFor={`${idPrefix}-text`}>
          <input
            id={`${idPrefix}-text`}
            className="cs-input cs-input--block"
            value={textValue ?? ""}
            placeholder="e.g. Browse courses"
            onChange={(e) => onText(e.target.value)}
          />
        </Field>
        <Field label="Where it goes" htmlFor={`${idPrefix}-href`}>
          <div className="cs-select-wrap">
            <Link2 size={14} aria-hidden="true" />
            <select
              id={`${idPrefix}-href`}
              className="cs-select"
              value={hrefValue ?? ""}
              onChange={(e) => onHref(e.target.value)}
            >
              <option value="">Nowhere yet</option>
              {(targets || []).map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              ))}
              {/* An href set before this dropdown existed would otherwise
                  vanish from the UI while still being live on the page. */}
              {hrefValue && !known && (
                <option value={hrefValue}>{hrefValue} (typed in earlier)</option>
              )}
            </select>
          </div>
        </Field>
      </div>
      {textValue && !hrefValue && (
        <p className="cs-field__warn">
          This button has words but nowhere to go — it won’t do anything when
          someone clicks it.
        </p>
      )}
    </div>
  );
};

/** The section's picture, chosen from the library rather than re-uploaded. */
export const PictureField = ({ label, hint, url, name, onChoose, onClear }) => (
  <Field label={label} hint={hint}>
    <div className="cs-picture-row">
      <div className="cs-picture-row__thumb">
        {url ? <img src={url} alt="" /> : <ImageIcon size={18} aria-hidden="true" />}
      </div>
      <div className="cs-picture-row__text">
        <span className="cs-picture-row__name">{name || "No picture chosen"}</span>
        <span className="cs-field__hint cs-field__hint--tight">
          {url ? "Shown at the top of this section." : "This section has no picture."}
        </span>
      </div>
      <button type="button" className="cs-btn-ghost" onClick={onChoose}>
        Choose from library
      </button>
      {url && (
        <button type="button" className="cs-btn-ghost" onClick={onClear}>
          Remove
        </button>
      )}
    </div>
  </Field>
);

/** Visibility, with the consequence spelled out rather than a bare toggle. */
export const VisibilitySwitch = ({ status, onChange }) => {
  const showing = status === "published";
  return (
    <div className="cs-subcard">
      <div className="cs-switch-row">
        <button
          type="button"
          role="switch"
          aria-checked={showing}
          className={`cs-switch${showing ? " is-on" : ""}`}
          onClick={() => onChange(showing ? "draft" : "published")}
        >
          <span className="cs-switch__knob" />
        </button>
        <div>
          <p className="cs-subcard__title">
            {showing ? "Showing on the site" : "Hidden from visitors"}
          </p>
          <p className="cs-field__hint cs-field__hint--tight">
            {showing
              ? "Anyone visiting the home page can see this section."
              : "Nobody can see this section. Your changes are still saved."}
          </p>
        </div>
      </div>
    </div>
  );
};
