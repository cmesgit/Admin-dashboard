import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import UnsavedChangesDialog from "../../components/UnsavedChangesDialog";
// Course-card editing for Content Studio. Stored advanced values stay in the
// payload even while their controls are collapsed.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, FlaskConical, Calculator, Compass, Activity, Target,
  Landmark, Shield, Medal, School,
} from "lucide-react";
import { fetchAllPages, getAcademicCourses, getBoards } from "../../api/admin";
import { getShowcaseCategories } from "../../api/admin_content_studio";
import ImageUploadField from "../../components/ImageUploadField";
import { courseCardPreview, validateCourseCard } from "../../utils/courseCardEditor";
// Course cards is a lazy route: load its backdrop and action styles here so
// opening the form never depends on visiting another modal screen first.
import "../../css/ConfirmModal.css";
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
import "../../css/CourseCardEditor.css";

// FALLBACK ONLY. The real list is content.ShowcaseCategory, fetched below —
// this used to be the third of three hardcoded copies (with the model's
// CATEGORY_CHOICES and shiksha-frontend's COURSE_TABS), which is why adding a
// tab took a three-repo deploy. Kept so the checkbox group is never empty if
// the request fails; matches what migration content/0028 seeds.
//
// "all" is absent deliberately — a reserved sentinel meaning "no filter
// applied", which the public grid renders itself and the model refuses as a
// slug.
const FALLBACK_CATEGORIES = [
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
    catalogPromise = Promise.all([fetchAllPages(getAcademicCourses), getBoards()])
      .then(([courses, boards]) => {
        if (courses.__failed || boards.__failed) throw new Error("Catalog unavailable");
        return {
        courses: Array.isArray(courses) ? courses : [],
        boards: Array.isArray(boards) ? boards : [],
      }; })
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
    // Kept VERBATIM — deliberately not filtered here any more.
    //
    // This used to prune against the hardcoded list above. Now that categories
    // are CMS rows, that constant is only a fallback and can be missing tabs an
    // admin has since added, so filtering against it would silently DROP valid
    // tags the moment someone opened a card and saved it. The prune still
    // happens (see the effect below) but against the real fetched list, which
    // is the only thing that can tell a legacy typo from a new tab.
    categories: initial?.categories || [],
    // Matches ShowcaseCourse.gradient_css's model default. It used to be a
    // near-transparent BLUE pair, so a card created here looked nothing like
    // one created through the API or Django admin, and at 0.15/0.05 alpha it
    // was barely visible at all.
    gradient_css: initial?.gradient_css || "rgba(15,157,107,0.72),rgba(11,91,62,0.88)",
    image_url: initial?.image_url || "",
    icon: initial?.icon || "book",
    link_path: initial?.link_path || "/courses",
    order: initial?.order ?? 0,
    status: initial?.status ?? "draft",
    course: initial?.course || "",
    board: initial?.board || "",
  });

  // The filter tabs, from the CMS. Seeded with the fallback so the checkbox
  // group is never empty on first paint or if the request fails.
  const [categoryChoices, setCategoryChoices] = useState(FALLBACK_CATEGORIES);

  useEffect(() => {
    let cancelled = false;
    getShowcaseCategories()
      .then((rows) => {
        if (cancelled || !rows.length) return;
        // Inactive tabs are still offered here on purpose: a card can legitimately
        // stay tagged with a tab that is currently hidden from the public grid,
        // and the label says so rather than the tag vanishing from the form.
        setCategoryChoices(
          rows.map((r) => [r.slug, r.is_active ? r.label : `${r.label} (hidden)`])
        );
        // Now — and only now — prune tags that match no real tab. Against the
        // fetched list this removes genuine legacy typos and the old "all"
        // sentinel, without touching a tab an admin added after this bundle
        // was built.
        const known = new Set(rows.map((r) => r.slug));
        setForm((f) => {
          const kept = f.categories.filter((c) => known.has(c));
          return kept.length === f.categories.length ? f : { ...f, categories: kept };
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const [linkStateText, setLinkStateText] = useState(
    JSON.stringify(initial?.link_state && Object.keys(initial.link_state).length ? initial.link_state : {}, null, 2)
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const dialogRef = useRef(null);
  const returnFocus = useRef(document.activeElement);
  useEffect(() => {
    if (Object.keys(fieldErrors).length) dialogRef.current?.querySelector('[aria-invalid="true"]:not(:disabled)')?.focus();
  }, [fieldErrors]);
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
    setCatalogError(false);
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
    }).catch(() => { if (!cancelled) setCatalogError(true); });
    return () => { cancelled = true; };
  }, [catalogRetry]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('select')?.focus();
    return () => { document.body.style.overflow = previous; returnFocus.current?.focus?.(); };
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
  const preview = courseCardPreview(form, selectedCourseObj, selectedBoardObj, filePreviewUrl, initial?.image);
  const PreviewIcon = ICON_CMP[form.icon] || BookOpen;
  const destinationName = selectedCourseObj?.title || selectedBoardObj?.name || form.link_path || "/courses";

  const initialSnapshot = useRef(JSON.stringify(form));
  const initialLinkText = useRef(linkStateText);
  const dirty = JSON.stringify(form) !== initialSnapshot.current || linkStateText !== initialLinkText.current || file !== null;
  const guard = useUnsavedChangesGuard(dirty, { busy, onSave: () => submit(false) });
  const cancel = () => guard.requestAction(onCancel);

  const submit = (close = true) => {
    if (busy) return false;
    const { errors, linkState: link_state } = validateCourseCard({ ...form, title: derivedFromLink ? preview.title : form.title }, linkStateText);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      const advancedError = ['gradient_css', 'order', 'link_state'].some((key) => errors[key]);
      if (advancedError) setAdvancedOpen(true);
      return false;
    }
    const payload = {
      title: form.title.trim() || preview.title.trim(),
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
    return onSubmit(payload, file, close);
  };

  const field = (key, label, placeholder, maxLength, disabled = false, displayedValue) => (
    <label className="cm-field">
      <span>{label}</span>
      <input id={`card-${key}`} value={displayedValue ?? form[key]} disabled={disabled}
        onChange={set(key)} placeholder={placeholder} maxLength={maxLength}
        aria-invalid={!!fieldErrors[key]} aria-describedby={fieldErrors[key] ? `card-error-${key}` : undefined} />
      {fieldErrors[key] && <small id={`card-error-${key}`} className="card-editor__error">{fieldErrors[key]}</small>}
    </label>
  );

  const keyDown = (event) => {
    if (guard.pendingNav) return;
    if (event.key === 'Escape') { event.stopPropagation(); cancel(); }
    if (event.key === 'Tab') {
      const controls = Array.from(dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')).filter((el) => el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };

  return (
    <>
      <UnsavedChangesDialog guard={guard} />
      <div className="confirm-overlay card-editor-overlay" onClick={busy ? undefined : cancel}>
        <section ref={dialogRef} className="cm-form-card card-editor" role="dialog" aria-modal="true"
          aria-labelledby="card-editor-title" aria-describedby="card-editor-intro" onKeyDown={keyDown} onClick={(e) => e.stopPropagation()}>
          <header className="card-editor__header">
            <h2 id="card-editor-title">{mode === 'edit' ? 'Edit course card' : 'New course card'}</h2>
            <p id="card-editor-intro">Choose where it opens, add the details, then check the preview.</p>
          </header>
          <div className="card-editor__body">
            <div className="card-editor__fields">
              <fieldset className="card-editor__section" disabled={busy}>
                <legend>1. Where the card opens</legend>
                {catalogError && <p role="alert" className="card-editor__error">Couldn’t load courses and boards. Existing links are kept. <button type="button" onClick={() => setCatalogRetry((n) => n + 1)}>Try again</button></p>}
                <label className="cm-field"><span>Course (optional)</span>
                  <select value={form.course} onChange={set('course')} autoFocus>
                    <option value="">No course — choose a board or page</option>
                    {courseOptions.map((c) => <option key={c.id} value={c.id}>{c.title}{c.status && c.status !== 'PUBLISHED' ? ` (${({ DRAFT: 'Draft', COMING_SOON: 'Coming soon', ARCHIVED: 'Archived' })[c.status] || 'Unavailable'})` : ''}</option>)}
                  </select>
                </label>
                <label className="cm-field"><span>Board (optional)</span>
                  <select value={form.board} onChange={set('board')} disabled={linkedToCourse}>
                    <option value="">No board</option>
                    {boardOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>
                <p className="cm-hint">{linkedToCourse ? 'Opens the selected course. A board selection is ignored while a course is linked.' : form.board ? 'Opens the selected board in the course catalogue.' : 'Opens the courses page. You can change the page in advanced settings.'}</p>
                {isLinked && <label className="cm-check"><input type="checkbox" checked={form.use_own_details} onChange={set('use_own_details')} /><span>Use my own title, price and picture</span></label>}
                {isLinked && <p className="cm-hint">{derivedFromLink ? 'Title and price follow the linked course or board. Its picture is used when available.' : 'Your custom details are used. The destination stays linked.'}</p>}
              </fieldset>

              <fieldset className="card-editor__section" disabled={busy}>
                <legend>2. What visitors see</legend>
                <p className="cm-hint">Title, short label and course summary are required.</p>
                {field('title', 'Card title', 'e.g. CBSE Class 10', 120, derivedFromLink, derivedFromLink ? preview.title : undefined)}
                {field('level_label', 'Short label', 'e.g. Foundation', 40)}
                {field('fact_line', 'Course summary', 'e.g. 1 Year · Online · Full access', 80)}
                {field('price_label', 'Price (optional)', 'e.g. Free or 1,500', 20, derivedFromLink, derivedFromLink ? preview.price : undefined)}
                {field('ribbon', 'Corner badge (optional)', 'e.g. New', 20)}
                <label className="cm-field"><span>Picture (optional)</span>
                  <ImageUploadField value={file} onChange={setFile} previewUrl={initial?.image} previewClassName="cms-image-preview" disabled={derivedFromLink} />
                </label>
                {derivedFromLink && <p className="cm-hint">To choose a different picture, turn on “Use my own title, price and picture”.</p>}
                <div className="cm-field"><span>Homepage filter tabs</span><p className="cm-hint">Leave all unchecked to show this card only under “All”.</p><div className="cm-checkbox-group">
                  {categoryChoices.map(([id, label]) => <label className="cm-check cm-check--inline" key={id}><input type="checkbox" checked={form.categories.includes(id)} onChange={(e) => setForm((f) => ({ ...f, categories: e.target.checked ? [...f.categories, id] : f.categories.filter((c) => c !== id) }))} /><span>{label}</span></label>)}
                </div></div>
                <label className="cm-field"><span>Coming soon badge</span><select value={form.coming_soon_override === null ? '' : String(form.coming_soon_override)} onChange={(e) => setForm((f) => ({ ...f, coming_soon_override: e.target.value === '' ? null : e.target.value === 'true' }))}>
                  <option value="">{isLinked ? 'Follow the linked course or board' : 'Off'}</option><option value="true">Show “Coming Soon”</option><option value="false">Hide “Coming Soon”</option>
                </select></label>
              </fieldset>

              <details className="card-editor__advanced" open={advancedOpen} onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}>
                <summary>Advanced settings <small>Background, icon and custom destination</small></summary>
                <fieldset className="card-editor__section" disabled={busy}>
                  <p className="cm-hint">These settings are optional. Existing values are kept when you save.</p>
                  <label className="cm-check"><input type="checkbox" checked={form.is_explore_card} disabled={linkedToCourse} onChange={set('is_explore_card')} /><span>Show an “Explore Programs” button</span></label>
                  {field('gradient_css', 'Background colour stops', 'rgba(15,157,107,0.72),rgba(11,91,62,0.88)', 160)}
                  <button type="button" className="confirm-cancel" onClick={() => setForm((f) => ({ ...f, gradient_css: 'rgba(15,157,107,0.72),rgba(11,91,62,0.88)' }))}>Restore default background</button>
                  {field('image_url', 'Picture URL (used if no upload)', 'https://…', undefined, derivedFromLink)}
                  <label className="cm-field"><span>Icon (used if there is no picture)</span><select value={form.icon} onChange={set('icon')}>{ICON_CHOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                  {field('link_path', 'Custom page path', '/courses', 200, isLinked)}
                  <label className="cm-field"><span>Custom navigation settings (JSON object)</span><textarea id="card-link_state" rows={4} disabled={isLinked} value={linkStateText} onChange={(e) => setLinkStateText(e.target.value)} aria-invalid={!!fieldErrors.link_state} aria-describedby={fieldErrors.link_state ? 'card-error-link_state' : undefined} /></label>
                  {fieldErrors.link_state && <p id="card-error-link_state" className="card-editor__error">{fieldErrors.link_state}</p>}
                  <p className="cm-hint">Use {'{}'} unless a developer supplied specific settings. Linked cards use their course or board destination.</p>
                  {field('tutor_name', 'Legacy tutor name (not shown on the homepage)', '', 80)}
                  <label className="cm-field"><span>Display order</span><input id="card-order" type="number" min="0" max="32767" step="1" value={form.order} onChange={set('order')} aria-invalid={!!fieldErrors.order} /></label>
                  {fieldErrors.order && <p className="card-editor__error">{fieldErrors.order}</p>}
                  <p className="cm-hint">You can also drag cards into order in the card list.</p>
                </fieldset>
              </details>

              <fieldset className="card-editor__section" disabled={busy}>
                <legend>3. Visibility</legend>
                <label className="cm-field"><span>Who can see this card?</span><select value={form.status} onChange={set('status')}>
                  <option value="draft">Hidden from visitors (draft)</option><option value="published">Showing on the homepage</option><option value="review">In review (hidden)</option><option value="archived">Archived (hidden)</option>
                </select></label>
                <p className="cm-hint">{form.status === 'published' ? 'Saving makes these changes live immediately.' : 'Save it hidden, then show it when it’s ready.'}</p>
              </fieldset>
            </div>

            <aside className="card-editor__preview" aria-label="Course card preview">
              <h3>Card preview</h3><p className="cm-hint">Homepage · Featured courses. Layout and enrolment actions adapt to the visitor.</p>
              <article className="card-editor__sample">
                <div className="card-editor__art" style={{ background: preview.image ? `url('${preview.image}') center/cover` : `linear-gradient(135deg,${form.gradient_css})` }}>
                  {!preview.image && <PreviewIcon size={38} aria-hidden="true" />}
                  {form.ribbon && <span className="card-editor__ribbon">{form.ribbon}</span>}
                  {form.level_label && <span className="card-editor__level">{form.level_label}</span>}
                </div>
                <div className="card-editor__sample-body"><h3>{preview.title || 'Your course title'}</h3><p>{form.fact_line || 'Your course summary'}</p>
                  <div className="card-editor__sample-footer">{preview.soon ? <strong>Coming Soon</strong> : <strong>{preview.price && (/^(Free|₹)/i.test(preview.price) ? preview.price : `₹${preview.price} /month`)}</strong>}{form.is_explore_card && !linkedToCourse ? <span>Explore Programs</span> : !preview.soon && <span>Enroll now</span>}</div>
                </div>
              </article>
              <p className="cm-hint"><strong>Opens:</strong> {destinationName}</p>
              <p className="cm-hint"><strong>Visibility:</strong> {form.status === 'published' ? 'Showing after save' : 'Hidden from visitors'}</p>
            </aside>
          </div>
          <footer className="card-editor__footer">
            {Object.keys(fieldErrors).length > 0 && <p role="alert" className="card-editor__error">Check the highlighted fields. Your changes are still here.</p>}
            {error && <p role="alert" className="card-editor__error">{error}</p>}
            <div className="confirm-actions"><button type="button" className="confirm-cancel" onClick={cancel} disabled={busy}>Cancel</button><button type="button" className="confirm-ok" onClick={() => submit()} disabled={busy}>{busy ? 'Saving…' : form.status === 'published' ? 'Save and show on homepage' : 'Save hidden card'}</button></div>
          </footer>
        </section>
      </div>
    </>
  );
}
