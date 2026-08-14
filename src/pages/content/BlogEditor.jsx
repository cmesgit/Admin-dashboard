import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Code2, Pencil, Sparkles, Send, Undo2, ExternalLink,
  ChevronDown, ChevronRight, Maximize2, Minimize2, Layers, Link2,
  Image as ImageIcon, FileText as ExcerptIcon, Tag, CalendarClock, List, Search, Info,
} from "lucide-react";
import customDesignTemplate from "./blogTemplates/customDesignTemplate.html?raw";
import {
  getContentBlog, createContentBlog, updateContentBlog,
  publishContentBlog, unpublishContentBlog,
} from "../../api/admin";
import ConfirmModal from "../../components/ConfirmModal";
import TagChipInput from "../../components/TagChipInput";
import ImageUploadField from "../../components/ImageUploadField";
import HtmlToolbar from "../../components/HtmlToolbar";
import RichTextEditor from "../../components/RichTextEditor";
import BlogCardPreview from "./preview/BlogCardPreview";
import BlogBodyPreview from "./preview/BlogBodyPreview";
import PlacementBadge from "./preview/PlacementBadge";
import SeoPreview from "./preview/SeoPreview";
import { errText } from "../../utils/errText";
import { formatDate } from "../../utils/formatDate";
import { buildBody } from "../../utils/buildBody";
import { isoToLocalInput, localInputToIso } from "../../utils/datetimeLocal";
import { deriveBlogSlug } from "../../utils/blogSlug";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { HOME_URL } from "../../config/urls";
import "../../css/Moderator.css";
import "../../css/Courses.css";
import "../../css/Content.css";
import "../../css/BlogEditor.css";

const CLASS_LEVELS = ["8", "9", "10", "11", "12", "general"];
const SUBJECTS = [
  "science", "mathematics", "history", "geography", "economics",
  "civics", "political-science", "english", "general",
];
const STATUS_PAL = { draft: "pal-gray", scheduled: "pal-blue", published: "pal-green", archived: "pal-gray" };
const SEO_TITLE_MAX = 70;
const SEO_DESC_MAX = 170;

// Fields the server autosave endpoint is allowed to touch — everything a
// draft author would type while writing, and nothing that changes what's
// publicly live (status, publish_at) or requires multipart (cover). Also
// used as the whitelist for "what counts as saved" bookkeeping after an
// autosave succeeds (see AUTOSAVE section below).
const AUTOSAVE_FIELDS = [
  "title", "slug", "class_level", "subject", "chapter_number", "excerpt",
  "body_html", "trusted_html", "tags", "is_featured", "seo_title", "seo_description",
];

const emptyForm = () => ({
  title: "", slug: "", class_level: "general", subject: "general",
  chapter_number: "", excerpt: "", body_html: "", trusted_html: false,
  tags: [], is_featured: false, seo_title: "", seo_description: "", publish_at: "",
});

const formFromServer = (data) => ({
  title: data.title || "",
  slug: data.slug || "",
  class_level: data.class_level || "general",
  subject: data.subject || "general",
  chapter_number: data.chapter_number ?? "",
  excerpt: data.excerpt || "",
  body_html: data.body_html || "",
  trusted_html: data.trusted_html ?? false,
  tags: data.tags || [],
  is_featured: data.is_featured ?? false,
  seo_title: data.seo_title || "",
  seo_description: data.seo_description || "",
  publish_at: isoToLocalInput(data.publish_at),
});

const pick = (obj, keys) => keys.reduce((acc, k) => ({ ...acc, [k]: obj[k] }), {});

// The exact payload shape the API expects. `full` also includes publish_at
// (manual Save only — autosave must never touch it, see AUTOSAVE_FIELDS).
const toApiFields = (f) => ({
  title: f.title.trim(),
  slug: f.slug.trim(),
  class_level: f.class_level,
  subject: f.subject,
  chapter_number: f.chapter_number === "" ? null : parseInt(f.chapter_number, 10),
  excerpt: f.excerpt,
  body_html: f.body_html,
  trusted_html: f.trusted_html,
  tags: f.tags,
  is_featured: f.is_featured,
  seo_title: f.seo_title,
  seo_description: f.seo_description,
});

// Matches the backend's `max(1, round(wordcount/200))` computed over
// tag-stripped text (content/models.py BlogPost.save) — kept in sync by hand
// so the "N words · ~M min read" line under the editor doesn't flicker to a
// different number the instant a save round-trips.
const wordsAndReadingMinutes = (html) => {
  const text = (html || "").replace(/<[^>]*>/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return { words, minutes: Math.max(1, Math.round(words / 200)) };
};

const formatRelativeTime = (ts) => {
  if (!ts) return "";
  const seconds = Math.round((Date.now() - ts) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const draftKey = (id) => `blogEditorDraft:${id ?? "new"}`;

// Sidebar collapse preference — a single app-wide localStorage object keyed
// by card name, NOT scoped per-post. This is a UI layout preference (like a
// sidebar width), not post data, so every post an author opens shares it.
const CARD_COLLAPSE_KEY = "blogEditorCardCollapse";
// Only applied when creating a brand-new post — the cards an author rarely
// touches start out of the way so the writing surface reads bigger. Editing
// an existing post always starts fully expanded (see the `collapsed` init
// below) so previously-filled-in fields are never hidden without being asked.
const DEFAULT_COLLAPSED_NEW = { scheduling: true, seo: true, listing: true };
const loadStoredCollapse = () => {
  try {
    const raw = localStorage.getItem(CARD_COLLAPSE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// Small clickable card header used by every collapsible sidebar section —
// pulled out here rather than duplicated eight times below.
const CardHead = ({ icon: Icon, label, cardKey, collapsed, onToggle }) => (
  <button type="button" className="blog-editor-card-head" onClick={() => onToggle(cardKey)}>
    <span className="blog-editor-card-head-label"><Icon size={14} /> {label}</span>
    {collapsed[cardKey] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
  </button>
);

const BlogEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState("");
  const [post, setPost] = useState(null); // last-known full server object (edit mode only)
  const [status, setStatus] = useState("draft"); // controlled solely by Publish/Unpublish, never by Save
  const [form, setForm] = useState(emptyForm());
  const [file, setFile] = useState(null);
  const [rawMode, setRawMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Focus mode is a momentary writing preference, not a durable setting —
  // it always resets to off on load rather than persisting like the card
  // collapse state below.
  const [focusMode, setFocusMode] = useState(false);

  // Edit mode always starts fully expanded (never hide fields the author
  // already filled in without asking); create mode uses whatever this
  // browser last left collapsed, falling back to DEFAULT_COLLAPSED_NEW.
  const [collapsed, setCollapsed] = useState(() => (
    id ? {} : { ...DEFAULT_COLLAPSED_NEW, ...loadStoredCollapse() }
  ));
  const toggleCard = (key) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(CARD_COLLAPSE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const [busy, setBusy] = useState(false); // manual save in flight
  const [saveError, setSaveError] = useState("");
  const [publishBusy, setPublishBusy] = useState(false);

  const [autosaveState, setAutosaveState] = useState("idle"); // idle|saving|saved|error
  const [autosaveError, setAutosaveError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState(null); // manual-save timestamp
  const [lastAutosaveAt, setLastAutosaveAt] = useState(null);

  const [recoveredDraft, setRecoveredDraft] = useState(null); // { savedAt, form } | null

  const bodyRef = useRef(null);
  const formRef = useRef(form);
  const lastSavedRef = useRef(emptyForm()); // per-field "known persisted" snapshot
  const skipNextLoadRef = useRef(null);
  const recoveryCheckedRef = useRef(false);
  const autosavingRef = useRef(false);

  // `lastSavedRef` is mutated imperatively (on load / manual save / autosave
  // success) so the debounce timers below always read the latest value
  // without re-subscribing. But that means a plain `useMemo` keyed on `form`
  // alone can't tell when the ref's target changed — after an autosave
  // succeeds, `isDirty`/`autosaveScopeDirty` would keep returning their
  // stale pre-save answer (still "dirty") since `form` itself didn't change,
  // which would wrongly keep nagging "Unsaved changes" and would make
  // useUnsavedChangesGuard prompt on navigation right after a clean
  // autosave. Bumping this counter every time lastSavedRef is reassigned
  // forces those memos to recompute.
  const [savedVersion, setSavedVersion] = useState(0);
  const markSaved = (nextForm) => {
    lastSavedRef.current = nextForm;
    setSavedVersion((v) => v + 1);
  };

  useEffect(() => { formRef.current = form; }, [form]);

  /* ───────────────────────── Load (edit mode) ───────────────────────── */
  useEffect(() => {
    let cancelled = false;
    recoveryCheckedRef.current = false;

    const finishRecoveryCheck = (serverUpdatedAt) => {
      try {
        const raw = localStorage.getItem(draftKey(id));
        if (raw) {
          const parsed = JSON.parse(raw);
          const isNewer = !serverUpdatedAt || new Date(parsed.savedAt) > new Date(serverUpdatedAt);
          if (parsed?.form && isNewer) setRecoveredDraft(parsed);
        }
      } catch {
        /* localStorage can throw in private-mode/quota-exceeded — a missed
           recovery banner is a much smaller problem than a crashed editor */
      }
      recoveryCheckedRef.current = true;
    };

    if (id && skipNextLoadRef.current === String(id)) {
      // We just created this row ourselves (see handleSave) and already
      // have authoritative data in state — skip the redundant GET.
      skipNextLoadRef.current = null;
      recoveryCheckedRef.current = true;
      setLoading(false);
      return () => { cancelled = true; };
    }

    if (!id) {
      setPost(null);
      setStatus("draft");
      const f = emptyForm();
      setForm(f);
      markSaved(f);
      setFile(null);
      setLoading(false);
      finishRecoveryCheck(null);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setLoadError("");
    getContentBlog(id)
      .then((data) => {
        if (cancelled) return;
        setPost(data);
        setStatus(data.status || "draft");
        const f = formFromServer(data);
        setForm(f);
        markSaved(f);
        setFile(null);
        finishRecoveryCheck(data.updated_at);
      })
      .catch((e) => { if (!cancelled) setLoadError(errText(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  const filePreviewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl); }, [filePreviewUrl]);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  /* ───────────────────────── Dirty tracking ───────────────────────── */
  // "Dirty" = current form differs from the last state we know is actually
  // persisted server-side (lastSavedRef), which autosave keeps partially in
  // sync (see AUTOSAVE_FIELDS) — or a cover file is picked but not yet saved.
  // `savedVersion` isn't read inside either function below — it's a
  // deliberate extra dependency, the only thing that changes when
  // lastSavedRef.current is mutated in place (see markSaved above), so the
  // linter can't see why it's here but removing it un-fixes the stale-memo
  // bug these two derive from.
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(lastSavedRef.current) || file !== null,
    [form, file, savedVersion]
  );
  const autosaveScopeDirty = useMemo(
    () => JSON.stringify(pick(form, AUTOSAVE_FIELDS)) !== JSON.stringify(pick(lastSavedRef.current, AUTOSAVE_FIELDS)),
    [form, savedVersion]
  );

  const { pendingNav, guardedNavigate, confirmLeave, cancelLeave } = useUnsavedChangesGuard(isDirty);

  /* ─────────────────────────────────────────────────────────────────────
     AUTOSAVE — server-side, drafts/scheduled only, never for published.

     WHY published posts are excluded: BlogPost is a single-row, single-
     body model — there's no separate draft/live copy, so an autosave to a
     published post is instantly the public page. Worse, every write to a
     blog post calls bump_content_version() on the backend, which busts the
     public content cache site-wide. Autosaving a live post every few
     keystrokes would mean strangers see half-typed sentences and the admin
     is repeatedly invalidating the whole site's cache. Drafts/scheduled
     posts have neither problem, so autosave is safe (and useful) there.
     ───────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (loading || !id) return; // create mode never autosaves (would create surprise rows)
    if (!(status === "draft" || status === "scheduled")) return;
    if (!autosaveScopeDirty) return;

    const timer = setTimeout(async () => {
      if (busy || autosavingRef.current) return; // never overlap manual save or another autosave
      const snapshot = formRef.current;
      const payload = toApiFields(snapshot); // JSON only — no cover, no status, no publish_at
      autosavingRef.current = true;
      setAutosaveState("saving");
      try {
        const saved = await updateContentBlog(id, payload, false);
        // Merge only read-only computed fields; never touch `form`, so any
        // typing that happened while this request was in flight survives.
        setPost((prev) => (prev ? { ...prev, ...saved } : saved));
        markSaved({ ...lastSavedRef.current, ...pick(snapshot, AUTOSAVE_FIELDS) });
        setLastAutosaveAt(Date.now());
        setAutosaveState("saved");
        setAutosaveError("");
      } catch (e) {
        setAutosaveState("error");
        setAutosaveError(errText(e));
      } finally {
        autosavingRef.current = false;
      }
    }, 5000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, loading, id, status, busy]);

  /* ── localStorage backup — always on, regardless of mode/status ── */
  useEffect(() => {
    if (!recoveryCheckedRef.current) return; // don't clobber a not-yet-shown recovery banner
    const key = draftKey(id);
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), form }));
      } catch {
        /* quota / private mode — silently skip, server autosave (if any) still covers drafts */
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [form, id]);

  const clearLocalDraft = () => {
    try { localStorage.removeItem(draftKey(id)); } catch { /* ignore */ }
  };

  const restoreDraft = () => {
    if (!recoveredDraft?.form) return;
    setForm(recoveredDraft.form);
    setRecoveredDraft(null);
  };
  const discardDraft = () => {
    clearLocalDraft();
    setRecoveredDraft(null);
  };

  /* ───────────────────────── Manual save ───────────────────────── */
  const handleSave = async () => {
    if (busy || !form.title.trim()) return;
    setBusy(true);
    setSaveError("");
    try {
      // `publish_at` has no DB default of null — it's `default=timezone.now`
      // at the model level, not nullable — so sending an explicit `null` for
      // an unset schedule 400s ("This field may not be null"). Omitting the
      // key entirely on create lets the backend default apply; omitting it
      // on update leaves whatever's already stored untouched (a PATCH never
      // touches keys it doesn't receive), which is the only sane behavior
      // for "the scheduling field was left blank" — there's no supported
      // way to explicitly clear an already-set publish_at back to "none".
      const payload = toApiFields(form);
      if (form.publish_at) payload.publish_at = localInputToIso(form.publish_at);
      const { data, isMultipart } = buildBody(payload, file, "cover");
      const savedId = id;
      const saved = savedId
        ? await updateContentBlog(savedId, data, isMultipart)
        : await createContentBlog(data, isMultipart);

      clearLocalDraft();
      setPost(saved);
      setStatus(saved.status || "draft");
      const f2 = formFromServer(saved);
      setForm(f2);
      markSaved(f2);
      setFile(null);
      setLastSavedAt(Date.now());

      if (!savedId) {
        skipNextLoadRef.current = String(saved.id);
        navigate(`/content/blogs/${saved.id}`, { replace: true });
      }
    } catch (e) {
      setSaveError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  /* ⌘S / Ctrl+S */
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, file, busy, id]);

  const togglePublish = async () => {
    if (!id || publishBusy) return;
    setPublishBusy(true);
    try {
      const updated = status === "published" ? await unpublishContentBlog(id) : await publishContentBlog(id);
      setPost((prev) => ({ ...prev, ...updated }));
      setStatus(updated.status || (status === "published" ? "draft" : "published"));
    } catch (e) {
      setSaveError(errText(e));
    } finally {
      setPublishBusy(false);
    }
  };

  const goBack = () => guardedNavigate(navigate, "/content?tab=blogs");

  /* ───────────────────────── SEO helpers ───────────────────────── */
  const fillSeoFromContent = () => {
    setForm((f) => ({
      ...f,
      seo_title: f.seo_title || f.title.slice(0, SEO_TITLE_MAX),
      seo_description: f.seo_description || f.excerpt.slice(0, SEO_DESC_MAX),
    }));
  };

  /* ───────────────────────── Table of contents ───────────────────────── */
  // Read-only extraction over already-trusted-by-this-session content (this
  // is the same body the author is currently editing, not third-party HTML),
  // so a detached-DOM parse is fine here even though it'd be wrong for
  // sanitizing untrusted input. Headings are indexed in document order across
  // h1/h2/h3 combined — the click handler below re-queries the live RTE DOM
  // with the same combined selector and jumps by that same index, since
  // there's no id to key on inside TipTap's generated markup.
  const tocHeadings = useMemo(() => {
    const html = form.body_html || "";
    if (!html.trim()) return [];
    const scratch = document.createElement("div");
    scratch.innerHTML = html;
    return Array.from(scratch.querySelectorAll("h1, h2, h3"))
      .map((el, index) => ({ index, level: el.tagName.toLowerCase(), text: el.textContent.trim() }))
      .filter((h) => h.text);
  }, [form.body_html]);

  const jumpToHeading = (heading) => {
    // Raw-HTML-source mode has no contenteditable heading to scroll to —
    // the textarea has no per-heading DOM nodes — so clicks are a no-op there.
    if (rawMode || showPreview) return;
    const root = document.querySelector(".blog-editor-main .rte-content");
    const target = root && root.querySelectorAll("h1, h2, h3")[heading.index];
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const derivedSlug = form.slug.trim() || deriveBlogSlug(form);
  const publicUrl = derivedSlug ? `${HOME_URL}/blogs/${derivedSlug}` : `${HOME_URL}/blogs/…`;
  const { words, minutes } = wordsAndReadingMinutes(form.body_html);

  const previewCoverUrl = filePreviewUrl || post?.cover || null;
  const previewPublishedLabel = status === "published"
    ? `Published${post?.updated_at ? ` · ${formatDate(post.updated_at)}` : ""}`
    : form.publish_at
      ? `Scheduled for ${formatDate(localInputToIso(form.publish_at))}`
      : "Not yet published";
  const placementItems = [
    { label: "/blogs", sublabel: "list" },
    form.slug.trim()
      ? { label: `/blogs/${form.slug.trim()}`, sublabel: "detail page" }
      : { label: "/blogs/<slug>", sublabel: "(slug auto-generated on save)" },
  ];

  /* ───────────────────────── Save-state indicator ───────────────────────── */
  let saveIndicator = null;
  if (busy) saveIndicator = "Saving…";
  else if (autosaveState === "saving") saveIndicator = "Saving…";
  else if (isDirty) saveIndicator = "Unsaved changes";
  else if (lastSavedAt || lastAutosaveAt) {
    const ts = Math.max(lastSavedAt || 0, lastAutosaveAt || 0);
    saveIndicator = `Saved · ${formatRelativeTime(ts)}`;
  }

  if (loading) {
    return (
      <div className="dashboard-wrapper">
        <div className="dashboard-loading">Loading…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="dashboard-wrapper">
        <button className="ud-back blog-editor-back" onClick={() => navigate("/content?tab=blogs")}>
          <ArrowLeft size={16} /> Back to Blog Posts
        </button>
        <div className="cm-form-error">{loadError}</div>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper blog-editor">
      <div className="blog-editor-actionbar">
        <div className="blog-editor-actionbar-row">
          <button className="blog-editor-back" onClick={goBack} disabled={busy}>
            <ArrowLeft size={16} />
          </button>
          <div className="blog-editor-title-block">
            <span className="blog-editor-title-text">{form.title.trim() || "New Blog Post"}</span>
            <span className={`mod-badge ${STATUS_PAL[status] || "pal-gray"}`}>{status}</span>
          </div>
          <span className="blog-editor-save-state">
            {status === "published" && !saveIndicator ? "Autosave off (live post)" : saveIndicator}
          </span>
          <div className="blog-editor-actionbar-spacer" />
          <button
            className="mod-btn ghost small"
            onClick={() => setFocusMode((v) => !v)}
            title={focusMode ? "Exit focus mode" : "Hide the sidebar and widen the writing column"}
          >
            {focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {focusMode ? "Exit focus" : "Focus"}
          </button>
          <button className="mod-btn ghost small" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? "Edit" : "Preview"}
          </button>
          {status === "published" && form.slug && (
            <a
              className="mod-btn ghost small"
              href={`${HOME_URL}/blogs/${form.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={13} /> View live
            </a>
          )}
          {id && (
            status === "published" ? (
              <button className="mod-btn warn small" onClick={togglePublish} disabled={publishBusy}>
                <Undo2 size={13} /> Unpublish
              </button>
            ) : (
              <button className="mod-btn success small" onClick={togglePublish} disabled={publishBusy}>
                <Send size={13} /> Publish
              </button>
            )
          )}
          <button className="confirm-ok" onClick={handleSave} disabled={busy || !form.title.trim()}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
        {status === "published" && (
          <p className="blog-editor-live-notice">
            This post is live — changes aren't published until you press Save.
          </p>
        )}
        {autosaveState === "error" && (
          <p className="blog-editor-autosave-error">Autosave failed — your changes are still here, press Save. ({autosaveError})</p>
        )}
        {recoveredDraft && (
          <div className="blog-editor-recover-banner">
            <span>Unsaved changes from {formatRelativeTime(recoveredDraft.savedAt)} were recovered.</span>
            <button className="mod-btn ghost small" onClick={restoreDraft}>Restore</button>
            <button className="mod-btn ghost small" onClick={discardDraft}>Discard</button>
          </div>
        )}
      </div>

      {saveError && <div className="cm-form-error">{saveError}</div>}

      <div className={`blog-editor-body${focusMode ? " focus-mode" : ""}`}>
        <div className="blog-editor-main">
          {showPreview ? (
            <BlogBodyPreview html={form.body_html} />
          ) : (
            <>
              <input
                className="blog-editor-title-input"
                value={form.title}
                onChange={set("title")}
                placeholder="Post title"
                autoFocus={!id}
              />

              {tocHeadings.length > 0 && (
                <div className="blog-editor-toc">
                  <div className="blog-editor-toc-label"><List size={13} /> Jump to</div>
                  <div className="blog-editor-toc-list">
                    {tocHeadings.map((h) => (
                      <button
                        type="button"
                        key={h.index}
                        className={`blog-editor-toc-item lvl-${h.level}`}
                        onClick={() => jumpToHeading(h)}
                        title={rawMode ? "Switch to rich text to jump to this heading" : "Scroll to this heading"}
                      >
                        {h.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label className="cm-field">
                <div className="cm-field-label-row">
                  <span>Body</span>
                  <button
                    type="button"
                    className="cm-inline-toggle"
                    onClick={() => setRawMode((v) => !v)}
                    title={rawMode ? "Back to rich text editor" : "Edit raw HTML source"}
                  >
                    {rawMode ? <Pencil size={13} /> : <Code2 size={13} />}
                    {rawMode ? "Rich text" : "HTML source"}
                  </button>
                </div>
                {rawMode ? (
                  <>
                    <div className="cm-field-label-row">
                      <button
                        type="button"
                        className="cm-inline-toggle"
                        title="Replace the body with a self-contained, hand-designed starter template (like the legacy chapter pages) — includes its own <style> block, so this also turns on 'Skip HTML sanitization' below"
                        onClick={() => {
                          if (form.body_html.trim() && !window.confirm("This replaces the current body content with the custom-design template. Continue?")) return;
                          setForm((f) => ({ ...f, body_html: customDesignTemplate, trusted_html: true }));
                        }}
                      >
                        <Sparkles size={13} />
                        Load custom-design template
                      </button>
                    </div>
                    <HtmlToolbar textareaRef={bodyRef} value={form.body_html} onChange={(v) => setForm((f) => ({ ...f, body_html: v }))} />
                    <textarea ref={bodyRef} rows={16} value={form.body_html} onChange={set("body_html")} placeholder="<p>Post body as plain HTML…</p>" />
                  </>
                ) : (
                  <RichTextEditor
                    mode="full"
                    value={form.body_html}
                    onChange={(html) => setForm((f) => ({ ...f, body_html: html }))}
                    placeholder="Write the post body…"
                    tall
                  />
                )}
              </label>
              <p className="cm-hint blog-editor-wordcount">{words} words · ~{minutes} min read</p>

              <label className="cm-check">
                <input type="checkbox" checked={form.trusted_html} onChange={set("trusted_html")} />
                <span>Skip HTML sanitization (only for trusted imported content)</span>
              </label>
            </>
          )}
        </div>

        {!focusMode && !showPreview && (
        <aside className="blog-editor-sidebar">
          {/* Not collapsible: it's a 5-line static readonly grid already —
              hiding it behind a click would save no room and costs a click
              for info an author usually wants at a glance. */}
          {id && post && (
            <div className="blog-editor-card">
              <h4><Info size={14} /> Details</h4>
              <div className="cms-readonly-grid">
                <div><span>Author</span><b>{post.author_name || "—"}</b></div>
                <div><span>Reading time</span><b>{post.reading_minutes ? `${post.reading_minutes} min` : "—"}</b></div>
                <div><span>Views</span><b>{post.view_count ?? 0}</b></div>
                <div><span>Created</span><b>{formatDate(post.created_at)}</b></div>
                <div><span>Updated</span><b>{formatDate(post.updated_at)}</b></div>
              </div>
            </div>
          )}

          <div className="blog-editor-card">
            <CardHead icon={Layers} label="Taxonomy" cardKey="taxonomy" collapsed={collapsed} onToggle={toggleCard} />
            {!collapsed.taxonomy && (
              <>
                <div className="cm-row">
                  <label className="cm-field">
                    <span>Class level</span>
                    <select value={form.class_level} onChange={set("class_level")}>
                      {CLASS_LEVELS.map((v) => <option key={v} value={v}>{v === "general" ? "General" : `Class ${v}`}</option>)}
                    </select>
                  </label>
                  <label className="cm-field">
                    <span>Subject</span>
                    <select value={form.subject} onChange={set("subject")}>
                      {SUBJECTS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                </div>
                <label className="cm-field">
                  <span>Chapter # (optional)</span>
                  <input type="number" min="1" value={form.chapter_number} onChange={set("chapter_number")} />
                </label>
              </>
            )}
          </div>

          <div className="blog-editor-card">
            <CardHead icon={Link2} label="Slug" cardKey="slug" collapsed={collapsed} onToggle={toggleCard} />
            {!collapsed.slug && (
              <>
                <label className="cm-field">
                  <span>Slug (optional)</span>
                  <input value={form.slug} onChange={set("slug")} placeholder="Leave blank to auto-generate" />
                </label>
                {!form.slug.trim() && (
                  <p className="cm-hint blog-editor-derived-slug">Auto-generated on save: <code>{derivedSlug || "post"}</code></p>
                )}
                <p className="blog-editor-public-url">{publicUrl}</p>
                {id && <p className="cm-hint">The slug won't change if you rename this post later.</p>}
              </>
            )}
          </div>

          <div className="blog-editor-card">
            <CardHead icon={ImageIcon} label="Cover image" cardKey="cover" collapsed={collapsed} onToggle={toggleCard} />
            {!collapsed.cover && (
              <>
                <ImageUploadField value={file} onChange={setFile} previewUrl={post?.cover} previewClassName="cms-image-preview" />
                <p className="cm-hint">Cover changes are saved by pressing Save — they aren't autosaved.</p>
              </>
            )}
          </div>

          <div className="blog-editor-card">
            <CardHead icon={ExcerptIcon} label="Excerpt" cardKey="excerpt" collapsed={collapsed} onToggle={toggleCard} />
            {!collapsed.excerpt && (
              <textarea rows={3} value={form.excerpt} onChange={set("excerpt")} placeholder="Short summary shown in listings" />
            )}
          </div>

          <div className="blog-editor-card">
            <CardHead icon={Tag} label="Tags" cardKey="tags" collapsed={collapsed} onToggle={toggleCard} />
            {!collapsed.tags && (
              <>
                <TagChipInput value={form.tags} onChange={(v) => setForm((f) => ({ ...f, tags: v }))} placeholder="Type a tag, press Enter…" />
                <label className="cm-check" style={{ marginTop: 10 }}>
                  <input type="checkbox" checked={form.is_featured} onChange={set("is_featured")} />
                  <span>Feature this post</span>
                </label>
              </>
            )}
          </div>

          <div className="blog-editor-card">
            <CardHead icon={CalendarClock} label="Scheduling" cardKey="scheduling" collapsed={collapsed} onToggle={toggleCard} />
            {!collapsed.scheduling && (
              <>
                <label className="cm-field">
                  <span>Publish at</span>
                  <input type="datetime-local" value={form.publish_at} onChange={set("publish_at")} />
                </label>
                <p className="cm-hint">This sets the scheduled time only — actual publish state is controlled by the Publish / Unpublish action, not this field.</p>
              </>
            )}
          </div>

          <div className="blog-editor-card">
            <CardHead icon={List} label="Listing preview" cardKey="listing" collapsed={collapsed} onToggle={toggleCard} />
            {!collapsed.listing && (
              <>
                <PlacementBadge items={placementItems} />
                <BlogCardPreview
                  title={form.title}
                  excerpt={form.excerpt}
                  coverUrl={previewCoverUrl}
                  tags={form.tags}
                  publishedLabel={previewPublishedLabel}
                />
              </>
            )}
          </div>

          <div className="blog-editor-card">
            <CardHead icon={Search} label="SEO" cardKey="seo" collapsed={collapsed} onToggle={toggleCard} />
            {!collapsed.seo && (
              <>
                <button type="button" className="cm-inline-toggle" onClick={fillSeoFromContent}>
                  Use title &amp; excerpt
                </button>
                <label className="cm-field">
                  <div className="cm-field-label-row">
                    <span>SEO title</span>
                    <span className={`blog-editor-counter${form.seo_title.length >= SEO_TITLE_MAX ? " over" : form.seo_title.length >= SEO_TITLE_MAX * 0.9 ? " near" : ""}`}>
                      {form.seo_title.length}/{SEO_TITLE_MAX}
                    </span>
                  </div>
                  <input value={form.seo_title} maxLength={SEO_TITLE_MAX} onChange={set("seo_title")} placeholder="Backfilled from title if left blank" />
                </label>
                <label className="cm-field">
                  <div className="cm-field-label-row">
                    <span>SEO description</span>
                    <span className={`blog-editor-counter${form.seo_description.length >= SEO_DESC_MAX ? " over" : form.seo_description.length >= SEO_DESC_MAX * 0.9 ? " near" : ""}`}>
                      {form.seo_description.length}/{SEO_DESC_MAX}
                    </span>
                  </div>
                  <textarea rows={2} value={form.seo_description} maxLength={SEO_DESC_MAX} onChange={set("seo_description")} />
                </label>
                <SeoPreview
                  title={form.title}
                  excerpt={form.excerpt}
                  seoTitle={form.seo_title}
                  seoDescription={form.seo_description}
                  slug={form.slug.trim() || derivedSlug}
                />
              </>
            )}
          </div>
        </aside>
        )}
      </div>

      {pendingNav && (
        <ConfirmModal
          title="Discard unsaved changes?"
          message="You have unsaved changes on this post. Leave without saving?"
          onConfirm={confirmLeave}
          onCancel={cancelLeave}
        />
      )}
    </div>
  );
};

export default BlogEditor;
