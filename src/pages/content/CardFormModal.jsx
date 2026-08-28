// The card create/edit form, lifted verbatim out of the old Showcase screen.
//
// design_handoff_content_studio. CourseCards was the browse-and-triage view and
// linked back to the legacy Content panel tab for anything real, which left two
// card screens and a dead-end link. The form is 300 lines of genuinely useful
// editor — image upload, live preview, course linking, placement — so it was
// MOVED here rather than reimplemented, and CourseCards now owns it.
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen, FlaskConical, Calculator, Compass, Activity, Target,
  Landmark, Shield, Medal, School,
} from "lucide-react";
import { getAcademicCourses, getBoards } from "../../api/admin";
import ImageUploadField from "../../components/ImageUploadField";
import FeaturedCardPreview from "./preview/FeaturedCardPreview";
import PlacementBadge from "./preview/PlacementBadge";
// ⚠ The cm-* classes this form is built from live here. The old Showcase
// screen got this stylesheet from ContentPanel, its parent; CourseCards does
// not, so without this the whole form renders unstyled and inline instead of
// as a card. Imported by the component that needs it, not by a parent, so it
// cannot be lost again by a move.
// ⚠ BOTH sheets, and in this order. Content.css's own header says the base
// cm-form-card / cm-field / cm-row rules live in Courses.css; Content.css only
// adds the --with-preview and --split modifiers on top. The old Showcase
// screen happened to get Courses.css from another route's chunk, so the form
// looked styled by accident. Imported explicitly here so it does not depend on
// what else the app happens to have loaded.
import "../../css/Courses.css";
import "../../css/Content.css";

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

/* NOTE: a <Stars> helper and "Stars"/"Review count" number inputs lived here.
   They wrote ShowcaseCourse.stars / .review_count, which the public homepage
   rendered as a star rating and a "(214)" review count — but nothing ever
   aggregated them from real reviews, because the platform has no course-review
   model. Editors were effectively typing in social proof. Removed here and in
   the backend (content migration 0017). */

/* ───────────────────────── Create/Edit modal ───────────────────────── */
// Course and board catalogs, fetched once per page load rather than on every
// modal open. Editing five cards in a row used to cost ten requests for lists
// that do not change while you are doing it. Module-level, so it dies with the
// tab — a stale catalog for the length of one session is the right trade for
// pickers whose options are managed on a different screen entirely.
let catalogPromise = null;

const loadCatalogs = () => {
  if (!catalogPromise) {
    catalogPromise = Promise.all([getAcademicCourses(), getBoards()])
      .then(([courses, boards]) => ({
        courses: Array.isArray(courses) ? courses : [],
        boards: Array.isArray(boards) ? boards : [],
      }))
      // Never cache a failure — the next open should retry rather than show an
      // empty picker for the rest of the session.
      .catch((e) => { catalogPromise = null; throw e; });
  }
  return catalogPromise;
};

export default function CardFormModal({ mode, initial, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    title: initial?.title || "",
    level_label: initial?.level_label || "",
    ribbon: initial?.ribbon || "",
    fact_line: initial?.fact_line || "",
    price_label: initial?.price_label || "",
    tutor_name: initial?.tutor_name || "",
    is_explore_card: initial?.is_explore_card ?? false,
    use_own_details: initial?.use_own_details ?? false,
    // null = follow the linked course. "" is the empty <select> value.
    coming_soon_override: initial?.coming_soon_override ?? null,
    // Drop any stray/legacy value (old free-text typos, or the "all" sentinel)
    // that doesn't match a real category — the checkbox group below can only
    // ever write back known ids, so this also self-heals older rows on save.
    categories: (initial?.categories || []).filter((c) => CATEGORY_CHOICES.some(([id]) => id === c)),
    gradient_css: initial?.gradient_css || "rgba(79,109,245,0.15), rgba(109,140,255,0.05)",
    image_url: initial?.image_url || "",
    icon: initial?.icon || "book",
    link_path: initial?.link_path || "/courses",
    order: initial?.order ?? 0,
    status: initial?.status ?? "published",
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
    let cancelled = false;
    loadCatalogs().then(({ courses, boards }) => {
      if (cancelled) return;
      // Merge rather than replace: keep the currently-linked row visible even
      // if the admin list is scoped or paginated differently than expected.
      const merge = (list, prev) => {
        const known = new Map(list.map((x) => [x.id, x]));
        prev.forEach((x) => { if (!known.has(x.id)) known.set(x.id, x); });
        return Array.from(known.values());
      };
      setCourseOptions((prev) => merge(courses, prev));
      setBoardOptions((prev) => merge(boards, prev));
    }).catch(() => { /* the picker degrades to whatever is already linked */ });
    return () => { cancelled = true; };
  }, []);

  const linkedToCourse = !!form.course;
  // Wider than linkedToCourse: title/price_label/image are derived once
  // EITHER a course or a board is linked, not just a course …
  const isLinked = !!form.course || !!form.board;
  // … unless this card has opted out, which un-greys those three fields
  // without unlinking (the link still drives the destination and the
  // Coming Soon default).
  const derivedFromLink = isLinked && !form.use_own_details;

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
      fact_line: form.fact_line.trim(),
      price_label: form.price_label.trim(),
      tutor_name: form.tutor_name.trim(),
      is_explore_card: linkedToCourse ? false : form.is_explore_card,
      use_own_details: form.use_own_details,
      // "" from the <select> means "follow the course" -> null, not false.
      coming_soon_override: form.coming_soon_override === "" ? null
        : form.coming_soon_override,
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
      status: form.status,
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

        {/* Escape hatches for a linked card. Only shown when a link exists,
            because with nothing linked the card's own fields already win. */}
        {isLinked && (
          <>
            <label className="cm-check">
              <input
                type="checkbox"
                checked={form.use_own_details}
                onChange={set("use_own_details")}
              />
              <span>Write my own title, price and picture</span>
            </label>
            <p className="cms-derived-note">
              Off, this card copies the linked course or board and updates
              automatically when it changes. On, the three fields above become
              yours to type — check what they already say before turning it on,
              since most cards still hold text from before they were linked.
            </p>

            <label className="cm-field">
              <span>“Coming Soon” badge</span>
              <select
                value={form.coming_soon_override === null ? "" : String(form.coming_soon_override)}
                onChange={(e) => setForm((f) => ({
                  ...f,
                  coming_soon_override: e.target.value === "" ? null
                    : e.target.value === "true",
                }))}
              >
                <option value="">Follow the linked course</option>
                <option value="true">Always show it</option>
                <option value="false">Never show it</option>
              </select>
            </label>
          </>
        )}
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
            <input
              type="checkbox"
              checked={form.status === "published"}
              onChange={(e) => setForm((f) => ({
                ...f, status: e.target.checked ? "published" : "draft",
              }))}
            />
            <span>Showing on the site</span>
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
