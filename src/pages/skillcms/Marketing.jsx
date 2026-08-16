import { useEffect, useMemo, useState } from "react";
import { getSkillMarketingBlocks, updateSkillMarketingBlock } from "../../api/admin";
import ImageUploadField from "../../components/ImageUploadField";
import { errText } from "../../utils/errText";
import { buildBody } from "../../utils/buildBody";

const KEY_LABELS = {
  browse_hero: "Browse page hero",
  teach_banner: "“Teach my craft” banner",
  hub: "Hub two-door landing",
};
const KEY_ORDER = ["browse_hero", "teach_banner", "hub"];

/* Each block is edited in place — no create/delete, the key set is fixed. */
function BlockCard({ block, onSaved, notify }) {
  const [form, setForm] = useState({
    heading: block.heading || "",
    subheading: block.subheading || "",
    body: block.body || "",
    cta_label: block.cta_label || "",
    cta_url: block.cta_url || "",
    stat_label: block.stat_label || "",
    is_active: block.is_active,
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const filePreviewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl); }, [filePreviewUrl]);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const dirty =
    form.heading !== (block.heading || "") ||
    form.subheading !== (block.subheading || "") ||
    form.body !== (block.body || "") ||
    form.cta_label !== (block.cta_label || "") ||
    form.cta_url !== (block.cta_url || "") ||
    form.stat_label !== (block.stat_label || "") ||
    form.is_active !== block.is_active ||
    !!file;

  const save = async () => {
    setBusy(true); setError("");
    try {
      const { data, isMultipart } = buildBody(form, file);
      const updated = await updateSkillMarketingBlock(block.key, data, isMultipart);
      onSaved(updated);
      setFile(null);
      notify(`Saved "${KEY_LABELS[block.key] || block.key}"`);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dashboard-card" style={{ padding: 20, marginBottom: 16 }}>
      <div className="cms-toolbar" style={{ padding: 0, marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{KEY_LABELS[block.key] || block.key}</h3>
        <div className="cms-toolbar-spacer" />
        <span className={`mod-badge ${form.is_active ? "pal-green" : "pal-gray"}`}>
          {form.is_active ? "Active" : "Hidden"}
        </span>
      </div>

      <div className="cm-row">
        <label className="cm-field">
          <span>Heading</span>
          <input value={form.heading} onChange={set("heading")} />
        </label>
        <label className="cm-field">
          <span>Subheading</span>
          <input value={form.subheading} onChange={set("subheading")} />
        </label>
      </div>

      <label className="cm-field">
        <span>Body</span>
        <textarea rows={2} value={form.body} onChange={set("body")} />
      </label>

      {block.key === "browse_hero" && (
        <label className="cm-field">
          <span>Directory stat line (next to the live expert count, e.g. "listed across Mizoram")</span>
          <input value={form.stat_label} onChange={set("stat_label")} placeholder="listed across Mizoram" />
        </label>
      )}

      <div className="cm-row">
        <label className="cm-field">
          <span>CTA label</span>
          <input value={form.cta_label} onChange={set("cta_label")} placeholder="e.g. I want to teach my craft" />
        </label>
        <label className="cm-field">
          <span>CTA URL</span>
          <input value={form.cta_url} onChange={set("cta_url")} placeholder="/skill/register" />
        </label>
      </div>

      <label className="cm-field">
        <span>Image (optional)</span>
        <ImageUploadField value={file} onChange={setFile} previewUrl={filePreviewUrl || block.image} previewClassName="cms-image-preview" />
      </label>

      <label className="cm-check">
        <input type="checkbox" checked={form.is_active} onChange={set("is_active")} />
        <span>Active (shown on the public site; falls back to default copy when off)</span>
      </label>

      {error && <div className="cm-form-error">{error}</div>}

      <div className="confirm-actions" style={{ justifyContent: "flex-end" }}>
        <button className="confirm-ok" onClick={save} disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

const Marketing = ({ onAction }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const notify = (msg) => onAction && onAction(msg);

  useEffect(() => {
    getSkillMarketingBlocks().then((d) => {
      const list = Array.isArray(d) ? d : d.results || [];
      list.sort((a, b) => KEY_ORDER.indexOf(a.key) - KEY_ORDER.indexOf(b.key));
      setRows(list);
      setLoading(false);
    });
  }, []);

  const handleSaved = (updated) => {
    setRows((prev) => prev.map((r) => (r.key === updated.key ? updated : r)));
  };

  if (loading) return <div className="dashboard-loading">Loading…</div>;

  return (
    <div>
      <p className="content-subtitle">
        Edit the hero copy, "teach my craft" banner, and Hub landing text shown on the public
        /skill pages. Leave a block inactive to fall back to the built-in default copy.
      </p>
      {rows.map((block) => (
        <BlockCard key={block.key} block={block} onSaved={handleSaved} notify={notify} />
      ))}
    </div>
  );
};

export default Marketing;
