import { useId } from "react";
export default function DisplayChoice({ label, value, onChange, required = false, disabled = false }) {
  const id = useId();
  return <div className="cs-field cs-display-choice">
    <label className="cs-field__label" htmlFor={id}>{label} display</label>
      <select id={id} className="cs-input cs-input--block" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="default">Use default</option>
        <option value="custom">Custom</option>
        {!required && <option value="hidden">Hidden</option>}
      </select>
    <p className="cs-field__hint">{value === "default" ? "Uses the built-in content. Your custom content is kept." : value === "hidden" ? "Nothing is shown here. Your custom content is kept." : "Shows exactly your content. Empty optional text stays empty."}</p>
  </div>;
}
