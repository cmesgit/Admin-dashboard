import { useEffect, useMemo, useState } from "react";
import {
  Star, BookOpen, FlaskConical, Calculator, Compass, Activity, Target,
  Landmark, Shield, Medal, School,
} from "lucide-react";
import {
  getContentShowcase, createContentShowcase, updateContentShowcase, deleteContentShowcase,
  getAcademicCourses, getBoards,
} from "../../api/admin";
import ConfirmModal from "../../components/ConfirmModal";
import ImageUploadField from "../../components/ImageUploadField";
import FeaturedCardPreview from "./preview/FeaturedCardPreview";
import PlacementBadge from "./preview/PlacementBadge";
import { errText } from "../../utils/errText";
import { buildBody } from "../../utils/buildBody";

// Keys must match shiksha-frontend's homeData.js COURSE_TABS ids. "all" is
// deliberately excluded — it's a reserved sentinel meaning "no filter applied"
// (see FeaturedCourses.jsx), not a real category a card can be tagged with.
const CATEGORY_CHOICES = [
  ["boards", "Boards"],
  ["class8-12", "Class 8–12"],
  ["competitive", "Competitive"],
];

// Keys must match shiksha-frontend's FeaturedCourses.jsx CAT_ICON_PATHS —
// the public site renders its own SVGs, keyed the same way, for these values.
const ICON_CHOICES = [
  ["book", "Book"], ["flask", "Flask"], ["calc", "Calculator"],
  ["compass", "Compass"], ["pulse", "Pulse"], ["target", "Target"],
  ["bank", "Bank"], ["shield", "Shield"], ["medal", "Medal"],
  ["institution", "Institution"],
];
const ICON_CMP = {
  book: BookOpen, flask: FlaskConical, calc: Calculator, compass: Compass,
  pulse: Activity, target: Target, bank: Landmark, shield: Shield,
  medal: Medal, institution: School,
};

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
    // Drop any stray/legacy value (old free-text typos, or the "all" sentinel)
    // that doesn't match a real category — the checkbox group below can only
    // ever write back known ids, so this also self-heals older rows on save.
    categories: (initial?.categories || []).filter((c) => CATEGORY_CHOICES.some(([id]) => id === c)),
    gradient_css: initial?.gradient_css || "rgba(79,109,245,0.15), rgba(109,140,255,0.05)",
    image_url: initial?.image_url || "",
    icon: initial?.icon || "book",
    link_path: initial?.link_path || "/courses",
    order: initial?.order ?? 0,
    is_active: initial?.is_active ?? true,
    course: initial?.course || "",
    board: initial?.board || "",
  });
  const [linkStateText, setLinkStateText] = useState(
    JSON.stringify(initial?.link_state && Object.keys(initial.link_state).length ? initial.link_state : {}, null, 2)
  );
  const [linkStateInvalid, setLinkStateInvalid] = useState(false);
  const [file, setFile] = useState(null);
  const [courseOptions, setCourseOptions] = useState(
    initial?.course && initial?.course_title ? [{ id: initial.course, title: initial.course_title }] : []
  );
  const [boardOptions, setBoardOptions] = useState(
    initial?.board && initial?.board_name ? [{ id: initial.board, name: initial.board_name }] : []
  );

  // Instant local preview for a newly-picked-but-not-yet-uploaded image
  // (ImageUploadField only shows the filename, not a rendered preview).
  const filePreviewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl); }, [filePreviewUrl]);

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
    getBoards().then((rows) => {
      const list = Array.isArray(rows) ? rows : [];
      setBoardOptions((prev) => {
        const known = new Map(list.map((b) => [b.id, b]));
        prev.forEach((b) => { if (!known.has(b.id)) known.set(b.id, b); });
        return Array.from(known.values());
      });
    });
  }, []);

  const linkedToCourse = !!form.course;
  // Wider than linkedToCourse: title/price_label/image are derived once
  // EITHER a course or a board is linked, not just a course.
  const derivedFromLink = !!form.course || !!form.board;

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  // ── Live preview: prefer real data already fetched for the course/board
  // dropdowns over the placeholder text, when this card is linked. ──
  const selectedCourseObj = form.course
    ? courseOptions.find((c) => String(c.id) === String(form.course))
    : null;
  const selectedBoardObj = form.board
    ? boardOptions.find((b) => String(b.id) === String(form.board))
    : null;
  const previewTitle = selectedCourseObj?.title || selectedBoardObj?.name || form.title;
  // Only a linked course carries a real price client-side (Board has none) —
  // fall back to the manual price_label, same as toShowcaseCard() does.
  const previewPriceLabel = selectedCourseObj
    ? String(Math.round((selectedCourseObj.price || 0) / 100))
    : form.price_label;
  const previewIsComingSoon = !previewPriceLabel && !!form.tutor_name;
  const previewThumbnailUrl = filePreviewUrl || initial?.image || form.image_url || null;

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
      board: form.board || null,
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
      <div className="cm-form-card cm-form-card--wide cm-form-card--with-preview" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === "edit" ? "Edit Showcase Card" : "New Showcase Card"}</h3>

        <div className="cm-form-split">
        <div className="cm-form-main">

        <div className="cm-row">
          <label className="cm-field">
            <span>Title{derivedFromLink ? " (derived — read-only while linked)" : ""}</span>
            <input value={form.title} disabled={derivedFromLink} onChange={set("title")} placeholder="e.g. CBSE Class 10" autoFocus />
          </label>
          <label className="cm-field">
            <span>Level label</span>
            <input value={form.level_label} onChange={set("level_label")} placeholder="e.g. Foundation" />
          </label>
        </div>
        {derivedFromLink && <p className="cms-derived-note">Derived from linked course/board.</p>}

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
            <span>Price label{derivedFromLink ? " (derived — read-only while linked)" : " (optional)"}</span>
            <input value={form.price_label} disabled={derivedFromLink} onChange={set("price_label")} placeholder="e.g. 1,500" />
          </label>
          <label className="cm-field">
            <span>Tutor name (optional)</span>
            <input value={form.tutor_name} onChange={set("tutor_name")} />
          </label>
        </div>

        <div className="cm-field">
          <span>Categories</span>
          <div className="cm-checkbox-group">
            {CATEGORY_CHOICES.map(([id, label]) => (
              <label className="cm-check cm-check--inline" key={id}>
                <input
                  type="checkbox"
                  checked={form.categories.includes(id)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      categories: e.target.checked
                        ? [...f.categories, id]
                        : f.categories.filter((c) => c !== id),
                    }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="cm-row">
          <label className="cm-field">
            <span>Link to a real course (optional)</span>
            <select value={form.course} onChange={set("course")}>
              <option value="">— Not linked (use manual link below) —</option>
              {courseOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.title}{c.status && c.status !== "PUBLISHED" ? ` (${c.status})` : ""}</option>
              ))}
            </select>
          </label>
          <label className="cm-field">
            <span>Link to a board (optional)</span>
            <select value={form.board} onChange={set("board")}>
              <option value="">— Not linked —</option>
              {boardOptions.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="cm-hint">
          When linked to a course, this card opens straight into that course and the link path/state
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

        <div className="cm-row">
          <label className="cm-field">
            <span>Image{derivedFromLink ? " (derived — read-only while linked)" : " (optional upload)"}</span>
            <ImageUploadField
              value={file}
              onChange={setFile}
              previewUrl={initial?.image}
              previewClassName="cms-image-preview"
              disabled={derivedFromLink}
            />
          </label>
          <label className="cm-field">
            <span>Image URL{derivedFromLink ? " (derived — read-only while linked)" : " (fallback if no upload)"}</span>
            <input value={form.image_url} disabled={derivedFromLink} onChange={set("image_url")} placeholder="https://…" />
          </label>
        </div>
        {derivedFromLink && <p className="cms-derived-note">Derived from linked course/board.</p>}

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

        </div>

        <aside className="cms-preview-panel">
          <span className="cms-preview-panel-label">Live preview</span>
          <PlacementBadge items={[{ label: "Homepage", sublabel: "Featured Grid" }]} />
          <FeaturedCardPreview
            title={previewTitle}
            priceLabel={previewIsComingSoon ? null : previewPriceLabel}
            thumbnailUrl={previewThumbnailUrl}
            ribbon={form.ribbon}
            stars={form.stars}
            reviewCount={form.review_count}
            tutorName={form.tutor_name}
            isComingSoon={previewIsComingSoon}
          />
          {form.board && !form.course && (
            <p className="cms-derived-note">
              Price shown is a placeholder — the real card derives its price server-side from the linked board's courses.
            </p>
          )}
        </aside>

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
