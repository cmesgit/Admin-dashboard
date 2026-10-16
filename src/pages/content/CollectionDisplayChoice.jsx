import { useState } from "react";
import { updateHomeDisplaySettings } from "../../api/admin";
import { errText } from "../../utils/errText";
import DisplayChoice from "./DisplayChoice";

export default function CollectionDisplayChoice({ blockId, collection, label, mode, onUpdated, onNotify, busy }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const change = async (next) => {
    setSaving(true); setError("");
    try {
      const row = await updateHomeDisplaySettings(blockId, { [collection]: next });
      onUpdated?.({ [collection]: row.display_settings[collection] });
      onNotify("Display choice saved. This change is live now.");
    } catch (err) { setError(errText(err)); }
    finally { setSaving(false); }
  };
  return <>
    <DisplayChoice label={label} value={mode} onChange={change} disabled={!blockId || saving || busy} />
    <p className="cs-field__hint">These collection changes apply immediately. Custom can be empty; removing the last item won’t restore defaults.</p>
    {error && <p className="cs-error" role="alert">{error}</p>}
  </>;
}
