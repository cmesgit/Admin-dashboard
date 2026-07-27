import { useEffect, useState } from "react";
import { Star, BookOpen, FlaskConical, Calculator } from "lucide-react";
import {
  getContentShowcase, createContentShowcase, updateContentShowcase, deleteContentShowcase,
  getAcademicCourses,
} from "../../api/admin";
import ConfirmModal from "../../components/ConfirmModal";
import TagChipInput from "../../components/TagChipInput";
import { errText } from "../../utils/errText";

const ICON_CHOICES = [["book", "Book"], ["flask", "Flask"], ["calc", "Calculator"]];
const ICON_CMP = { book: BookOpen, flask: FlaskConical, calc: Calculator };

function Stars({ n }) {
  const count = Math.max(0, Math.min(5, n || 0));
  return (
    <span className="cms-card-stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={13} fill={i < count ? "currentColor" : "none"} className={i < count ? "" : "empty"} />
      ))}
    </span>
  );
}

/* ───────────────────────── Create/Edit modal ───────────────────────── */
function ShowcaseFormModal({ mode, initial, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    title: initial?.title || "",
    level_label: initial?.level_label || "",
    ribbon: initial?.ribbon || "",
    stars: initial?.stars ?? 5,
    review_count: initial?.review_count ?? 0,
    fact_line: initial?.fact_line || "",
    price_label: initial?.price_label || "",
    tutor_name: initial?.tutor_name || "",
    is_explore_card: initial?.is_explore_card ?? false,
    categories: initial?.categories || [],
    gradient_css: initial?.gradient_css || "rgba(79,109,245,0.15), rgba(109,140,255,0.05)",
    image_url: initial?.image_url || "",
    icon: initial?.icon || "book",
    link_path: initial?.link_path || "/courses",
    order: initial?.order ?? 0,
    is_active: initial?.is_active ?? true,
    course: initial?.course || "",
  });
  const [linkStateText, setLinkStateText] = useState(
    JSON.stringify(initial?.link_state && Object.keys(initial.link_state).length ? initial.link_state : {}, null, 2)
  );
  const [linkStateInvalid, setLinkStateInvalid] = useState(false);
  const [file, setFile] = useState(null);
  const [courseOptions, setCourseOptions] = useState(
    initial?.course && initial?.course_title ? [{ id: initial.course, title: initial.course_title }] : []
  );

  useEffect(() => {
    getAcademicCourses().then((rows) => {
      const list = Array.isArray(rows) ? rows : [];
      setCourseOptions((prev) => {
        const known = new Map(list.map((c) => [c.id, c]));
        // keep the currently-linked course visible even if the admin list call
        // is scoped/paginated differently than expected
        prev.forEach((c) => { if (!known.has(c.id)) known.set(c.id, c); });
        return Array.from(known.values());
      });
    });
  }, []);

  const linkedToCourse = !!form.course;

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = () => {
    let link_state;
    try {
      link_state = linkStateText.trim() ? JSON.parse(linkStateText) : {};
      setLinkStateInvalid(false);
    } catch {
      setLinkStateInvalid(true);
      return;
    }
    const payload = {
      title: form.title.trim(),
      level_label: form.level_label.trim(),
      ribbon: form.ribbon.trim(),
      stars: Math.max(0, Math.min(5, parseInt(form.stars, 10) || 0)),
      review_count: parseInt(form.review_count, 10) || 0,
      fact_line: form.fact_line.trim(),
      price_label: form.price_label.trim(),
      tutor_name: form.tutor_name.trim(),
      is_explore_card: linkedToCourse ? false : form.is_explore_card,
      categories: form.categories,
      gradient_css: form.gradient_css.trim(),
      image_url: form.image_url.trim(),
      icon: form.icon,
      course: form.course || null,
      // Ignored server-side when `course` is set (derived instead), but still
      // sent so unlinking a card leaves them at whatever the admin last typed.
      link_path: form.link_path.trim() || "/courses",
      link_state,
      order: parseInt(form.order, 10) || 0,
      is_active: form.is_active,
    };
    onSubmit(payload, file);
  };

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card cm-form-card--wide" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === "edit" ? "Edit Showcase Card" : "New Showcase Card"}</h3>

        <div className="cm-row">
          <label className="cm-field">
            <span>Title</span>
            <input value={form.title} onChange={set("title")} placeholder="e.g. CBSE Class 10" autoFocus />
          </label>
          <label className="cm-field">
            <span>Level label</span>
            <input value={form.level_label} onChange={set("level_label")} placeholder="e.g. Foundation" />
          </label>
        </div>

        <div className="cm-row">
          <label className="cm-field">
            <span>Ribbon (optional)</span>
            <input value={form.ribbon} onChange={set("ribbon")} placeholder="e.g. Bestseller" />
          </label>
          <label className="cm-field">
            <span>Stars (max 5)</span>
            <input type="number" min="0" max="5" value={form.stars} onChange={set("stars")} />
          </label>
          <label className="cm-field">
            <span>Review count</span>
            <input type="number" min="0" value={form.review_count} onChange={set("review_count")} />
          </label>
        </div>

        <label className="cm-field">
          <span>Fact line</span>
          <input value={form.fact_line} onChange={set("fact_line")} placeholder="e.g. 1 Year · Online · Full access" />
        </label>

        <div className="cm-row">
          <label className="cm-field">
            <span>Price label (optional)</span>
            <input value={form.price_label} onChange={set("price_label")} placeholder="e.g. 1,500" />
          </label>
          <label className="cm-field">
            <span>Tutor name (optional)</span>
            <input value={form.tutor_name} onChange={set("tutor_name")} />
          </label>
        </div>

        <label className="cm-field">
          <span>Categories</span>
          <TagChipInput
            value={form.categories}
            onChange={(v) => setForm((f) => ({ ...f, categories: v }))}
            placeholder="Type a category, press Enter…"
          />
        </label>

        <label className="cm-field">
          <span>Link to a real course (optional)</span>
          <select value={form.course} onChange={set("course")}>
            <option value="">— Not linked (use manual link below) —</option>
            {courseOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.title}{c.status && c.status !== "PUBLISHED" ? ` (${c.status})` : ""}</option>
            ))}
          </select>
        </label>
        <p className="cm-hint">
          When linked, this card opens straight into that course and the link path/state
          below are derived automatically — you can leave them alone.
        </p>

        <label className="cm-check">
          <input type="checkbox" checked={form.is_explore_card} disabled={linkedToCourse} onChange={set("is_explore_card")} />
          <span>Explore card (the catch-all "browse everything" tile)</span>
        </label>

        <label className="cm-field">
          <span>Gradient CSS (two rgba color stops)</span>
          <input value={form.gradient_css} onChange={set("gradient_css")} placeholder="rgba(79,109,245,0.15), rgba(109,140,255,0.05)" />
        </label>

        {mode === "edit" && initial?.image && (
          <img src={initial.image} alt="" className="cms-image-preview" />
        )}
        <div className="cm-row">
          <label className="cm-field">
            <span>Image (optional upload)</span>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file && <small className="cm-file-name">{file.name}</small>}
          </label>
          <label className="cm-field">
            <span>Image URL (fallback if no upload)</span>
            <input value={form.image_url} onChange={set("image_url")} placeholder="https://…" />
          </label>
        </div>

        <div className="cm-row">
          <label className="cm-field">
            <span>Icon</span>
            <select value={form.icon} onChange={set("icon")}>
              {ICON_CHOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="cm-field">
            <span>Link path{linkedToCourse ? " (derived — ignored while linked)" : ""}</span>
            <input value={form.link_path} disabled={linkedToCourse} onChange={set("link_path")} placeholder="/courses" />
          </label>
        </div>

        <label className="cm-field">
          <span>Link state (JSON object){linkedToCourse ? " (derived — ignored while linked)" : ""}</span>
          <textarea
            className={`cms-json-textarea${linkStateInvalid ? " invalid" : ""}`}
            rows={4}
            disabled={linkedToCourse}
            value={linkStateText}
            onChange={(e) => { setLinkStateText(e.target.value); setLinkStateInvalid(false); }}
            placeholder='{"selectedBoardGroup":"central","selectedBoard":"cbse"}'
          />
        </label>
        {linkStateInvalid && <div className="cm-form-error">Link state must be valid JSON.</div>}
        <p className="cm-hint">Passed as router state when the card is clicked. Leave as {"{}"} if not needed.</p>

        <div className="cm-row">
          <label className="cm-field">
            <span>Order</span>
            <input type="number" value={form.order} onChange={set("order")} />
          </label>
          <label className="cm-check" style={{ marginTop: 26 }}>
            <input type="checkbox" checked={form.is_active} onChange={set("is_active")} />
            <span>Active</span>
          </label>
        </div>

        {error && <div className="cm-form-error">{error}</div>}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="confirm-ok" onClick={submit} disabled={busy || !form.title.trim()}>
            {busy ? "Saving…" : mode === "edit" ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Build either a FormData (when a new image was picked) or a plain object. */
const buildBody = (payload, file) => {
  if (!file) return { data: payload, isMultipart: false };
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v) || (typeof v === "object")) fd.append(k, JSON.stringify(v));
    else fd.append(k, v);
  });
  fd.append("image", file);
  return { data: fd, isMultipart: true };
};

const Showcase = ({ onAction }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const notify = (msg) => onAction && onAction(msg);

  const load = async () => {
    setLoading(true);
    const d = await getContentShowcase();
    setRows(Array.isArray(d) ? d : d.results || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (payload, file) => {
    setBusy(true); setFormError("");
    try {
      const { data, isMultipart } = buildBody(payload, file);
      if (modal.mode === "edit") {
        const updated = await updateContentShowcase(modal.initial.id, data, isMultipart);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        notify(`Updated "${updated.title}"`);
      } else {
        const created = await createContentShowcase(data, isMultipart);
        setRows((prev) => [...prev, created]);
        notify(`Created "${created.title}"`);
      }
      setModal(null);
    } catch (e) {
      setFormError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await deleteContentShowcase(confirm.item.id);
      setRows((prev) => prev.filter((r) => r.id !== confirm.item.id));
      notify(`Deleted "${confirm.item.title}"`);
      setConfirm(null);
    } catch (e) {
      setConfirm((c) => ({ ...c, error: errText(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="cms-toolbar">
        <div className="courses-count" style={{ padding: 0 }}>{rows.length} card{rows.length !== 1 ? "s" : ""}</div>
        <div className="cms-toolbar-spacer" />
        <button className="cm-add-btn" onClick={() => { setFormError(""); setModal({ mode: "create", initial: {} }); }}>
          + New Card
        </button>
      </div>

      {loading ? (
        <div className="dashboard-loading">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="dashboard-card">
          <div className="dashboard-loading">No showcase cards yet. Add one to populate the homepage "Featured courses" grid.</div>
        </div>
      ) : (
        <div className="cms-card-grid">
          {rows.map((c) => {
            const Icon = ICON_CMP[c.icon] || BookOpen;
            return (
              <div className="cms-card" key={c.id}>
                <div
                  className="cms-card-thumb"
                  style={!c.image && c.gradient_css ? { background: `linear-gradient(135deg, ${c.gradient_css})` } : undefined}
                >
                  {c.image ? <img src={c.image} alt="" /> : (c.image_url ? <img src={c.image_url} alt="" /> : <Icon size={34} className="cms-card-thumb-icon" />)}
                  {c.ribbon && <span className="cms-card-ribbon">{c.ribbon}</span>}
                  <span className={`mod-badge ${c.is_active ? "pal-green" : "pal-gray"} cms-card-status`}>
                    {c.is_active ? "Active" : "Hidden"}
                  </span>
                </div>
                <div className="cms-card-body">
                  <div className="cms-card-title">{c.title}</div>
                  <div className="cms-card-sub">{c.level_label}{c.tutor_name ? ` · ${c.tutor_name}` : ""}</div>
                  <div className="cms-card-meta">
                    <Stars n={c.stars} />
                    <span>({c.review_count ?? 0})</span>
                  </div>
                  <div className="cms-card-sub">{c.fact_line}</div>
                  {c.price_label && <div className="cms-card-sub"><strong>₹{c.price_label}</strong></div>}
                  {c.course_title && <div className="cms-card-sub">Linked: {c.course_title}</div>}
                  {(c.categories || []).length > 0 && (
                    <div className="cms-card-chips">
                      {c.categories.map((cat) => <span className="cms-card-chip" key={cat}>{cat}</span>)}
                    </div>
                  )}
                </div>
                <div className="cms-card-footer">
                  <button className="mod-btn ghost small" onClick={() => { setFormError(""); setModal({ mode: "edit", initial: c }); }}>Edit</button>
                  <button className="mod-btn danger small" onClick={() => setConfirm({ item: c })}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <ShowcaseFormModal
          mode={modal.mode}
          initial={modal.initial}
          busy={busy}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={() => setModal(null)}
        />
      )}

      {confirm && (
        <ConfirmModal
          title="Delete Showcase Card"
          message={`Delete "${confirm.item.title}"? It will disappear from the homepage grid immediately.`}
          extra={confirm.error ? <div className="cm-form-error">{confirm.error}</div> : null}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default Showcase;
