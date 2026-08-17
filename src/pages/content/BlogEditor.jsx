import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Code2, Pencil, Sparkles, Send, Undo2, ExternalLink,
  ChevronDown, ChevronRight, Maximize2, Minimize2, Layers, Link2,
  Image as ImageIcon, FileText as ExcerptIcon, Tag, CalendarClock, List, Search, Info,
  Monitor, Tablet, Smartphone, Languages, Blocks, Palette,
} from "lucide-react";
import customDesignTemplate from "./blogTemplates/customDesignTemplate.html?raw";
import {
  getContentBlog, getContentBlogs, createContentBlog, updateContentBlog, getContentTags,
  duplicateTranslationContentBlog,
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
import BlockCanvas from "./blocks/BlockCanvas";
import BlockInspector from "./blocks/BlockInspector";
import ThemePanel from "./blocks/ThemePanel";
import ImportPreview from "./blocks/ImportPreview";
import { createBlock, newBlockId, THEME_TOKENS } from "../../blogBlocks/schema";
import { renderDocument } from "../../blogBlocks/render";
import { importLegacyHtml } from "../../blogBlocks/importer";
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
import "../../css/BlockEditor.css";

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
  "body_html", "body_blocks", "body_theme", "trusted_html",
  "tags", "is_featured", "seo_title", "seo_description",
];

const emptyForm = () => ({
  title: "", slug: "", class_level: "general", subject: "general",
  chapter_number: "", excerpt: "", body_html: "", body_blocks: [], body_theme: {},
  trusted_html: false,
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
  body_blocks: data.body_blocks || [],
  body_theme: data.body_theme || {},
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
//
// `bodyMode` decides which body is authoritative for THIS save:
//   - "blocks": body_blocks/body_theme are sent as authored, body_html is
//     COMPUTED here via the same shared renderer the live preview uses (see
//     shared/src/blogBlocks/render.js's header for why body_html is only a
//     derived fallback for a block post, never re-derived server-side), and
//     trusted_html is forced false — block-rendered markup never needs the
//     sanitizer bypass.
//   - "rich"/"raw": unchanged from before blocks existed. body_blocks is
//     sent as [] explicitly, so switching a post OUT of blocks mode and
//     saving really does hand authority back to body_html (the destructive
//     side of that switch is confirmed with the user before this ever runs
//     — see switchBodyMode below).
const toApiFields = (f, bodyMode) => {
  const useBlocks = bodyMode === "blocks";
  return {
    title: f.title.trim(),
    slug: f.slug.trim(),
    class_level: f.class_level,
    subject: f.subject,
    chapter_number: f.chapter_number === "" ? null : parseInt(f.chapter_number, 10),
    excerpt: f.excerpt,
    body_html: useBlocks ? renderDocument(f.body_blocks) : f.body_html,
    body_blocks: useBlocks ? f.body_blocks : [],
    body_theme: useBlocks ? f.body_theme : {},
    trusted_html: useBlocks ? false : f.trusted_html,
    tags: f.tags,
    is_featured: f.is_featured,
    seo_title: f.seo_title,
    seo_description: f.seo_description,
  };
};

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
  <button
    type="button"
    className="blog-editor-card-head"
    onClick={() => onToggle(cardKey)}
    aria-expanded={!collapsed[cardKey]}
  >
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
  // All distinct tag names already in use, for TagChipInput's autocomplete —
  // fetched once (not per-keystroke); a stale list just means a brand-new
  // tag from elsewhere isn't suggested yet, no real cost to that staleness.
  const [tagSuggestions, setTagSuggestions] = useState([]);
  useEffect(() => {
    getContentTags().then((d) => {
      const list = Array.isArray(d) ? d : d.results || [];
      setTagSuggestions(list.map((t) => t.name).filter(Boolean));
    });
  }, []);

  // Other locales of THIS post, for the locale tab strip below. The admin
  // detail endpoint (BlogPostAdminSerializer) doesn't carry a `translations`
  // field the way the public one does — reusing the existing
  // ?translation_group= list filter here instead of adding a duplicate
  // field/round-trip shape just for this editor.
  const [translationSiblings, setTranslationSiblings] = useState([]);
  const [duplicatingTranslation, setDuplicatingTranslation] = useState(false);
  useEffect(() => {
    if (!post?.translation_group) { setTranslationSiblings([]); return; }
    let cancelled = false;
    getContentBlogs({ translation_group: post.translation_group }).then((d) => {
      if (cancelled) return;
      const list = Array.isArray(d) ? d : d.results || [];
      setTranslationSiblings(list.filter((r) => r.id !== post.id));
    });
    return () => { cancelled = true; };
  }, [post?.translation_group, post?.id]);

  const addHindiTranslation = async () => {
    if (!post || duplicatingTranslation) return;
    setDuplicatingTranslation(true);
    try {
      const created = await duplicateTranslationContentBlog(post.id, "hi");
      navigate(`/content/blogs/${created.id}`);
    } catch (e) {
      setSaveError(errText(e));
    } finally {
      setDuplicatingTranslation(false);
    }
  };

  // "blocks" | "rich" | "raw". A brand-new post starts in "blocks" — this
  // redesign's whole point is that new chapters shouldn't be hand-typed
  // HTML. An existing post starts wherever its content actually lives (see
  // the load effect below), never a mode that would silently discard it.
  const [bodyMode, setBodyMode] = useState("blocks");
  const [selectedBlockId, setSelectedBlockId] = useState(null);

  // Legacy-post importer (Phase 6). `importPreview` is a SEPARATE state slot
  // from `form` — it holds the proposed { blocks, theme, report } until the
  // author explicitly clicks "Use these blocks" in ImportPreview, which is
  // the only place that ever copies it into `form`/`bodyMode`. Autosave and
  // the dirty-tracking below only ever read `form`, so a proposal sitting
  // here unconfirmed can never be silently saved.
  const [importPreview, setImportPreview] = useState(null);
  const runImport = () => {
    const result = importLegacyHtml(form.body_html, THEME_TOKENS);
    setImportPreview(result);
  };
  const useImportedBlocks = () => {
    if (!importPreview) return;
    setForm((f) => ({ ...f, body_blocks: importPreview.blocks, body_theme: importPreview.theme }));
    setBodyMode("blocks");
    setSelectedBlockId(null);
    setImportPreview(null);
  };
  const discardImportPreview = () => setImportPreview(null);

  // Switching OUT of blocks mode is destructive at save time (toApiFields
  // sends body_blocks: [] once bodyMode !== "blocks") — confirm first if
  // there's actually something to lose. Switching between rich/raw, or into
  // blocks mode, is always safe (rich/raw both operate on body_html; a
  // reversed decision before the next Save loses nothing, since form state
  // itself is untouched by the mode switch).
  const switchBodyMode = (next) => {
    if (next === bodyMode) return;
    if (bodyMode === "blocks" && form.body_blocks.length > 0 && next !== "blocks") {
      const ok = window.confirm(
        "Switching away from Blocks will clear this post's block content the next time you save. Continue?"
      );
      if (!ok) return;
    }
    setBodyMode(next);
  };

  const [showPreview, setShowPreview] = useState(false);
  // Container max-width for the preview iframe — "100%" fills the writing
  // column (already ~1480px wide with the sidebar hidden), the other two
  // approximate common breakpoints. The iframe's own content (blogBodyStyles.js,
  // e.g. the feature-grid's @media max-width:620px rule) already reacts
  // correctly to a narrower iframe — this is purely a container-width toggle,
  // no content-side changes needed.
  const [previewWidth, setPreviewWidth] = useState("100%");

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
  const bodyModeRef = useRef(bodyMode); // same reasoning as formRef — see the effect below
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
  useEffect(() => { bodyModeRef.current = bodyMode; }, [bodyMode]);

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
      setBodyMode("blocks");
      setSelectedBlockId(null);
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
        // An existing post opens in whichever mode its content actually
        // lives in — never defaults to "blocks" out from under a rich-text
        // or raw-HTML post that has no body_blocks to show.
        setBodyMode(f.body_blocks.length > 0 ? "blocks" : "rich");
        setSelectedBlockId(null);
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

  /* ───────────────────────── Block editing ───────────────────────── */
  const patchBlocks = (updater) => setForm((f) => ({ ...f, body_blocks: updater(f.body_blocks) }));

  const addBlock = (type) => {
    const block = createBlock(type);
    patchBlocks((blocks) => [...blocks, block]);
    setSelectedBlockId(block.id);
  };
  const updateBlockFields = (blockId, fields) => {
    patchBlocks((blocks) => blocks.map((b) => (b.id === blockId ? { ...b, ...fields } : b)));
  };
  const updateBlockSettings = (blockId, fields) => {
    patchBlocks((blocks) => blocks.map((b) => (b.id === blockId ? { ...b, s: { ...b.s, ...fields } } : b)));
  };
  const removeBlock = (blockId) => {
    patchBlocks((blocks) => blocks.filter((b) => b.id !== blockId));
    setSelectedBlockId((cur) => (cur === blockId ? null : cur));
  };
  const duplicateBlock = (blockId) => {
    patchBlocks((blocks) => {
      const index = blocks.findIndex((b) => b.id === blockId);
      if (index === -1) return blocks;
      const copy = { ...blocks[index], id: newBlockId() };
      return [...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)];
    });
  };
  const moveBlock = (blockId, dir) => {
    patchBlocks((blocks) => {
      const index = blocks.findIndex((b) => b.id === blockId);
      const swapIndex = index + dir;
      if (index === -1 || swapIndex < 0 || swapIndex >= blocks.length) return blocks;
      const next = [...blocks];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  };

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
      const payload = toApiFields(snapshot, bodyModeRef.current); // JSON only — no cover, no status, no publish_at
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
  }, [form, loading, id, status, busy, bodyMode]);

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
    // Backfill body_blocks/body_theme for a draft saved before this editor
    // mode existed — an older localStorage entry has neither key at all.
    const restored = { body_blocks: [], body_theme: {}, ...recoveredDraft.form };
    setForm(restored);
    setBodyMode(restored.body_blocks.length > 0 ? "blocks" : "rich");
    setSelectedBlockId(null);
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
      const payload = toApiFields(form, bodyMode);
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
  // In blocks mode, "headings" are Hero titles (h1-equivalent) and Section
  // Header titles (h2-equivalent) — keyed by block id (stable across
  // reorders) rather than array index, since the block list can be
  // reordered between a render and a click. In rich/raw mode, this is the
  // original read-only DOM-parse extraction over the author's own
  // in-session content (never third-party HTML, so a detached-DOM parse is
  // fine here even though it'd be wrong for sanitizing untrusted input).
  const tocHeadings = useMemo(() => {
    if (bodyMode === "blocks") {
      return form.body_blocks
        .map((b) => {
          if (b.t === "hero") {
            return { blockId: b.id, level: "h1", text: [b.title, b.titleAccent].filter(Boolean).join(" ") };
          }
          if (b.t === "section_header") {
            return { blockId: b.id, level: "h2", text: [b.title, b.titleAccent].filter(Boolean).join(" ") };
          }
          return null;
        })
        .filter(Boolean)
        .filter((h) => h.text);
    }
    const html = form.body_html || "";
    if (!html.trim()) return [];
    const scratch = document.createElement("div");
    scratch.innerHTML = html;
    return Array.from(scratch.querySelectorAll("h1, h2, h3"))
      .map((el, index) => ({ index, level: el.tagName.toLowerCase(), text: el.textContent.trim() }))
      .filter((h) => h.text);
  }, [form.body_html, form.body_blocks, bodyMode]);

  const jumpToHeading = (heading) => {
    if (bodyMode === "blocks") {
      if (!heading.blockId) return;
      setSelectedBlockId(heading.blockId);
      const row = document.querySelector(`.blk-row[data-block-id="${heading.blockId}"]`);
      if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // Raw-HTML-source mode has no contenteditable heading to scroll to —
    // the textarea has no per-heading DOM nodes — so clicks are a no-op there.
    if (bodyMode === "raw" || showPreview) return;
    const root = document.querySelector(".blog-editor-main .rte-content");
    const target = root && root.querySelectorAll("h1, h2, h3")[heading.index];
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const derivedSlug = form.slug.trim() || deriveBlogSlug(form);
  const publicUrl = derivedSlug ? `${HOME_URL}/blogs/${derivedSlug}` : `${HOME_URL}/blogs/…`;
  // In blocks mode, the live word count/reading-time hint reads the RENDERED
  // output (same renderDocument() call site as toApiFields), so it tracks
  // what the backend will actually compute reading_minutes from, rather than
  // just the raw block JSON.
  const { words, minutes } = wordsAndReadingMinutes(
    bodyMode === "blocks" ? renderDocument(form.body_blocks) : form.body_html
  );

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
          {id && post && (
            translationSiblings.length > 0 ? (
              <div className="blog-editor-locale-tabs">
                <button
                  type="button"
                  className={`blog-editor-locale-tab${post.locale === "en" ? " active" : ""}`}
                  disabled={post.locale === "en"}
                  onClick={() => {
                    const en = post.locale === "en" ? post : translationSiblings.find((s) => s.locale === "en");
                    if (en && en.id !== post.id) navigate(`/content/blogs/${en.id}`);
                  }}
                >
                  English
                </button>
                <button
                  type="button"
                  className={`blog-editor-locale-tab${post.locale === "hi" ? " active" : ""}`}
                  disabled={post.locale === "hi"}
                  onClick={() => {
                    const hi = post.locale === "hi" ? post : translationSiblings.find((s) => s.locale === "hi");
                    if (hi && hi.id !== post.id) navigate(`/content/blogs/${hi.id}`);
                  }}
                >
                  हिंदी
                </button>
              </div>
            ) : post.locale === "en" && (
              <button
                type="button"
                className="mod-btn ghost small"
                onClick={addHindiTranslation}
                disabled={duplicatingTranslation}
              >
                <Languages size={13} /> {duplicatingTranslation ? "Adding…" : "Add Hindi translation"}
              </button>
            )
          )}
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
            <>
              <div className="blog-editor-preview-devicebar">
                <button
                  type="button"
                  className={`mod-btn ghost small${previewWidth === "100%" ? " active" : ""}`}
                  onClick={() => setPreviewWidth("100%")}
                  title="Desktop width"
                >
                  <Monitor size={14} /> Desktop
                </button>
                <button
                  type="button"
                  className={`mod-btn ghost small${previewWidth === "768px" ? " active" : ""}`}
                  onClick={() => setPreviewWidth("768px")}
                  title="Tablet width"
                >
                  <Tablet size={14} /> Tablet
                </button>
                <button
                  type="button"
                  className={`mod-btn ghost small${previewWidth === "375px" ? " active" : ""}`}
                  onClick={() => setPreviewWidth("375px")}
                  title="Mobile width"
                >
                  <Smartphone size={14} /> Mobile
                </button>
              </div>
              <div className="blog-editor-preview-frame-wrap" style={{ maxWidth: previewWidth }}>
                {bodyMode === "blocks" ? (
                  <BlogBodyPreview blocks={form.body_blocks} theme={form.body_theme} />
                ) : (
                  <BlogBodyPreview html={form.body_html} />
                )}
              </div>
            </>
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
                        key={h.blockId ?? h.index}
                        className={`blog-editor-toc-item lvl-${h.level}`}
                        onClick={() => jumpToHeading(h)}
                        title={bodyMode === "raw" ? "Switch to rich text to jump to this heading" : "Scroll to this heading"}
                      >
                        {h.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="cm-field-label-row">
                <span>Body</span>
                <div className="blk-mode-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={bodyMode === "blocks"}
                    className={`blk-mode-tab${bodyMode === "blocks" ? " active" : ""}`}
                    onClick={() => switchBodyMode("blocks")}
                  >
                    <Blocks size={13} /> Blocks
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={bodyMode === "rich"}
                    className={`blk-mode-tab${bodyMode === "rich" ? " active" : ""}`}
                    onClick={() => switchBodyMode("rich")}
                  >
                    <Pencil size={13} /> Rich text
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={bodyMode === "raw"}
                    className={`blk-mode-tab${bodyMode === "raw" ? " active" : ""}`}
                    onClick={() => switchBodyMode("raw")}
                  >
                    <Code2 size={13} /> HTML source
                  </button>
                </div>
                {/* Only offered for an existing legacy post — a brand-new
                    post already starts in Blocks mode with nothing to
                    convert, and a post that already has blocks has nothing
                    left to import. */}
                {id && bodyMode !== "blocks" && form.body_blocks.length === 0 && form.body_html.trim() && (
                  <button type="button" className="mod-btn ghost small" onClick={runImport}>
                    <Sparkles size={13} /> Convert to blocks
                  </button>
                )}
              </div>

              {importPreview && (
                <ImportPreview
                  html={form.body_html}
                  proposal={importPreview}
                  onUse={useImportedBlocks}
                  onDiscard={discardImportPreview}
                />
              )}

              {bodyMode === "blocks" && (
                <div className="blk-editor-shell">
                  <BlockCanvas
                    blocks={form.body_blocks}
                    selectedId={selectedBlockId}
                    onSelect={setSelectedBlockId}
                    onAdd={addBlock}
                    onMove={moveBlock}
                    onDuplicate={duplicateBlock}
                    onRemove={removeBlock}
                  />
                  <BlockInspector
                    block={form.body_blocks.find((b) => b.id === selectedBlockId) || null}
                    onChange={updateBlockFields}
                    onSettingsChange={updateBlockSettings}
                  />
                </div>
              )}

              {bodyMode === "raw" && (
                <label className="cm-field">
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
                  <textarea ref={bodyRef} rows={16} className="blog-editor-html-textarea" value={form.body_html} onChange={set("body_html")} placeholder="<p>Post body as plain HTML…</p>" />
                </label>
              )}

              {bodyMode === "rich" && (
                <label className="cm-field">
                  <RichTextEditor
                    mode="full"
                    value={form.body_html}
                    onChange={(html) => setForm((f) => ({ ...f, body_html: html }))}
                    placeholder="Write the post body…"
                    tall
                  />
                </label>
              )}

              <p className="cm-hint blog-editor-wordcount">{words} words · ~{minutes} min read</p>

              {bodyMode === "blocks" ? (
                <p className="cm-hint">Rendered from blocks — sanitized automatically, no HTML bypass needed.</p>
              ) : (
                <label className="cm-check">
                  <input type="checkbox" checked={form.trusted_html} onChange={set("trusted_html")} />
                  <span>Skip HTML sanitization (only for trusted imported content)</span>
                </label>
              )}
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

          {bodyMode === "blocks" && (
            <div className="blog-editor-card">
              <CardHead icon={Palette} label="Theme" cardKey="theme" collapsed={collapsed} onToggle={toggleCard} />
              {!collapsed.theme && (
                <ThemePanel theme={form.body_theme} onChange={(theme) => setForm((f) => ({ ...f, body_theme: theme }))} />
              )}
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
                <TagChipInput value={form.tags} onChange={(v) => setForm((f) => ({ ...f, tags: v }))} placeholder="Type a tag, press Enter…" suggestions={tagSuggestions} />
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
