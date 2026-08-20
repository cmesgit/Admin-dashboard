// src/pages/AgreementLetter.jsx  (NEW)
//
// Admin editor for legal agreement letters (currently the Faculty Agreement),
// with immutable version history.
//   GET  /accounts/admin/agreements/faculty/            → current version (title + body)
//   POST /accounts/admin/agreements/faculty/save/       → creates a NEW version
//   GET  /accounts/admin/agreements/faculty/versions/   → history
//   GET  /accounts/admin/agreements/versions/<id>/      → view a past version
//   POST /accounts/admin/agreements/versions/<id>/restore/ → restore (as a new version)
//
// Editing never overwrites a version — Save appends a new one. Faculty stay
// bound to the version they actually signed.

import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import {
  getAgreement, saveAgreement, getAgreementVersions,
  getAgreementVersion, restoreAgreement,
  publishAgreement, discardAgreementDraft,
} from "../api/admin";
import ConfirmModal from "../components/ConfirmModal";
import renderMarkdown from "../utils/miniMarkdown";
import { buildBody } from "../utils/buildBody";
import "../css/Approvals.css"; // reuse .ap-modal

const KEY = "faculty"; // the Faculty Agreement (extendable to other keys later)
/* Matches the server-side allowlist in AdminAgreementSaveView. */
const DOC_ACCEPT = ".pdf,.doc,.docx";
const DOC_MAX_MB = 10;

const fmt = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }); }
  catch { return iso; }
};

const AgreementLetter = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [currentNum, setCurrentNum] = useState(null);
  // An imported file for the version being written, and the one already
  // attached to the current version (so the admin can see/download it).
  const [docFile, setDocFile] = useState(null);
  const [currentDoc, setCurrentDoc] = useState(null);
  // What is LIVE right now, and whether an unpublished draft exists. Kept
  // apart so the editor never implies a saved draft is what applicants see.
  const [liveNum, setLiveNum] = useState(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(null);   // viewed version {…, body}
  const [confirm, setConfirm] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const bodyRef = useRef(null);

  // Insert markdown around the current selection (or at the caret).
  const applyFormat = (kind) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const sel = body.slice(start, end);
    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    let before = body.slice(0, start), mid = sel, after = body.slice(end);
    let caret = end;

    const wrap = (mark) => {
      mid = `${mark}${sel || "text"}${mark}`;
      before = body.slice(0, start); after = body.slice(end);
      caret = start + mid.length;
    };
    const prefixLine = (prefix) => {
      before = body.slice(0, lineStart);
      const rest = body.slice(lineStart);
      mid = prefix + rest.slice(0, (end - lineStart)) ;
      after = rest.slice(end - lineStart);
      caret = start + prefix.length;
    };

    switch (kind) {
      case "bold":   wrap("**"); break;
      case "italic": wrap("*"); break;
      case "h1":     prefixLine("# "); break;
      case "h2":     prefixLine("## "); break;
      case "h3":     prefixLine("### "); break;
      case "ol":     prefixLine("1. "); break;
      case "ul":     prefixLine("- "); break;
      default: return;
    }
    const next = before + mid + after;
    setBody(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const cur = await getAgreement(KEY);
      const live = cur.current_version;
      const draft = cur.draft;
      // Edit the DRAFT when one exists — that's the work in progress. Fall
      // back to the live text so a first edit starts from what's published.
      const editing = draft || live;
      setTitle(editing?.title || cur.title || "Faculty Agreement");
      setBody(editing?.body || "");
      setCurrentNum(live?.version_number ?? null);
      setLiveNum(live?.version_number ?? null);
      setHasDraft(!!draft);
      setCurrentDoc(
        editing?.document_url
          ? { url: editing.document_url, name: editing.document_name }
          : null,
      );
      setDocFile(null);
      setVersions(await getAgreementVersions(KEY));
    } catch {
      setErr("Failed to load the agreement.");
    } finally { setLoading(false); }
  };
  useEffect(() => { loadAll(); }, []);

  const save = async () => {
    setSaving(true); setMsg(""); setErr("");
    try {
      // A picked file makes this multipart (buildBody's convention, shared with
      // every other admin form that accepts an upload). Either authoring route
      // is valid: type the text, import a ready-made PDF/DOCX, or both.
      const { data } = buildBody(
        { title: title.trim(), body, change_note: note.trim() },
        docFile, "document",
      );
      await saveAgreement(KEY, data);
      setNote("");
      setMsg(docFile
        ? "Draft saved with the imported file — not live until you publish."
        : "Draft saved — not live until you publish.");
      await loadAll();
    } catch (e) {
      const d = e?.response?.data;
      setErr(d?.document || d?.body || d?.title || d?.detail || "Save failed.");
    } finally { setSaving(false); }
  };

  const publish = async () => {
    setConfirm({
      title: hasDraft && liveNum ? `Publish over v${liveNum}?` : "Publish this agreement?",
      message: liveNum
        ? `Every applicant from now on reads and signs this instead of v${liveNum}. `
          + `v${liveNum} stays in history, and anyone who already signed it stays bound to it.`
        : "This becomes the first live version — every applicant will read and sign it.",
      onConfirm: async () => {
        setConfirm(null); setMsg(""); setErr(""); setPublishing(true);
        try {
          const r = await publishAgreement(KEY);
          setMsg(`Published as v${r.published_version} — now live for all new applicants.`);
          await loadAll();
        } catch (e) {
          setErr(e?.response?.data?.detail || "Publish failed.");
        } finally { setPublishing(false); }
      },
    });
  };

  const discardDraft = async () => {
    setConfirm({
      title: "Discard the draft?",
      message: liveNum
        ? `Your unpublished changes are thrown away. The live v${liveNum} is untouched.`
        : "Your unpublished changes are thrown away. Nothing is live yet.",
      onConfirm: async () => {
        setConfirm(null); setMsg(""); setErr("");
        try {
          await discardAgreementDraft(KEY);
          setMsg("Draft discarded.");
          await loadAll();
        } catch (e) {
          setErr(e?.response?.data?.detail || "Could not discard the draft.");
        }
      },
    });
  };

  const viewVersion = async (id) => {
    try { setPreview(await getAgreementVersion(id)); }
    catch { setErr("Couldn't load that version."); }
  };

  const restore = (v) => {
    setConfirm({
      title: `Restore v${v.version_number}?`,
      message: `This creates a new current version from the contents of v${v.version_number}. History is preserved.`,
      onConfirm: async () => {
        setConfirm(null); setMsg(""); setErr("");
        try {
          await restoreAgreement(v.id);
          setPreview(null);
          setMsg(`Restored from v${v.version_number} (as a new version).`);
          await loadAll();
        } catch { setErr("Restore failed."); }
      },
    });
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Agreement Letter</h1>
      {msg && <div style={{ color: "#16a34a", margin: "0 0 12px" }}>{msg}</div>}
      {err && <div style={{ color: "#dc2626", margin: "0 0 12px" }}>{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, alignItems: "start" }}>
        {/* Editor */}
        <div className="dashboard-card" style={{ alignItems: "stretch", textAlign: "left" }}>
          {loading ? <div className="dashboard-loading">Loading...</div> : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>
                  {hasDraft ? "Editing draft" : liveNum ? `Editing (live: v${liveNum})` : "Editing (new)"}
                </h3>
                {/* Never leave "is this live?" ambiguous — that ambiguity is
                    the whole reason drafts exist. */}
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: .5, textTransform: "uppercase",
                  padding: "4px 10px", borderRadius: 999,
                  background: hasDraft ? "#fff4e5" : liveNum ? "#e8f5e9" : "#f1f3f4",
                  color: hasDraft ? "#8a5a00" : liveNum ? "#1b6e3c" : "#6b7280",
                  border: `1px solid ${hasDraft ? "#f5c842" : liveNum ? "#a5d6a7" : "#dfe3e6"}`,
                }}>
                  {hasDraft ? "Unpublished draft" : liveNum ? `Live · v${liveNum}` : "Nothing published"}
                </span>
              </div>
              {hasDraft && (
                <p style={{ fontSize: 12.5, color: "#8a5a00", background: "#fff4e5",
                            border: "1px solid #f5c842", borderRadius: 8,
                            padding: "9px 12px", margin: "10px 0 0" }}>
                  These changes are <strong>not live</strong>.{" "}
                  {liveNum
                    ? `Applicants still see v${liveNum} until you press Publish.`
                    : "No agreement is published yet, so the signup screen has none to show."}
                </p>
              )}
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginTop: 14, display: "block" }}>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #d7dbe0", borderRadius: 8, marginTop: 4 }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Body</label>
                <button type="button" onClick={() => setShowPreview((v) => !v)}
                  style={{ fontSize: 12, fontWeight: 600, color: "#4f6df5", background: "none", border: "none", cursor: "pointer" }}>
                  {showPreview ? "Edit" : "Preview"}
                </button>
              </div>

              {showPreview ? (
                <div className="agreement-preview"
                  style={{ border: "1px solid #d7dbe0", borderRadius: 8, padding: "16px 18px", marginTop: 4, minHeight: 300, background: "#fff", lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(body)) }} />
              ) : (
                <>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6, marginBottom: 6 }}>
                    {[
                      ["h1", "H1"], ["h2", "H2"], ["h3", "H3"],
                      ["bold", "B"], ["italic", "I"], ["ol", "1."], ["ul", "•"],
                    ].map(([kind, label]) => (
                      <button key={kind} type="button" onClick={() => applyFormat(kind)}
                        title={kind}
                        style={{
                          padding: "4px 10px", border: "1px solid #d7dbe0", borderRadius: 6,
                          background: "#f8fafc", cursor: "pointer", fontSize: 13,
                          fontWeight: kind === "bold" ? 800 : 600,
                          fontStyle: kind === "italic" ? "italic" : "normal",
                        }}>{label}</button>
                    ))}
                    <span style={{ alignSelf: "center", fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>
                      Markdown: # heading, **bold**, *italic*, 1. / - lists
                    </span>
                  </div>
                  <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={20}
                    placeholder="Full agreement text. Use section numbers (1. Engagement, 2. Responsibilities…)."
                    style={{ width: "100%", padding: "12px", border: "1px solid #d7dbe0", borderRadius: 8, fontFamily: "inherit", lineHeight: 1.6, resize: "vertical" }} />
                </>
              )}

              {/* Import route — for a letter drafted outside the CMS (e.g. by
                  a lawyer). When a version carries a file, THAT is what the
                  applicant downloads and signs; the body above still renders
                  on screen. Replaces the old hardcoded public/faculty-agreement.pdf
                  in the frontend, which was one frozen file shared by every
                  version and disconnected from anything the CMS said. */}
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginTop: 18, display: "block" }}>
                Or import a signed-ready file <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
              </label>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 8px" }}>
                PDF or Word · up to {DOC_MAX_MB} MB. Attach one and applicants download it
                instead of printing the text above — still pinned to this version.
              </p>
              <input type="file" accept={DOC_ACCEPT}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  e.target.value = "";
                  setErr("");
                  if (!file) return;
                  if (file.size > DOC_MAX_MB * 1024 * 1024) {
                    setErr(`That file is larger than the ${DOC_MAX_MB} MB limit.`);
                    return;
                  }
                  setDocFile(file);
                }}
                style={{ fontSize: 13 }} />
              {docFile && (
                <div style={{ marginTop: 6, fontSize: 12.5 }}>
                  <strong>{docFile.name}</strong> will be attached to the next version.{" "}
                  <button type="button" onClick={() => setDocFile(null)}
                    style={{ background: "none", border: "none", color: "#4f6df5", fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                    Remove
                  </button>
                </div>
              )}
              {!docFile && currentDoc && (
                <div style={{ marginTop: 6, fontSize: 12.5, color: "#6b7280" }}>
                  {hasDraft ? "This draft" : liveNum ? `Live v${liveNum}` : "This letter"} has an imported file:{" "}
                  <a href={currentDoc.url} target="_blank" rel="noreferrer" style={{ color: "#4f6df5", fontWeight: 600 }}>
                    {currentDoc.name || "download"}
                  </a>
                  . It stays attached when you save — pick a new file only to replace it.
                </div>
              )}

              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginTop: 14, display: "block" }}>Version notes</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                placeholder="e.g. Updated Section 5 — added data retention clause, revised compensation terms for 2025–26…"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #d7dbe0", borderRadius: 8, marginTop: 4, fontFamily: "inherit", resize: "vertical" }} />

              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button onClick={save} disabled={saving || publishing}
                  style={{ padding: "11px 22px", background: "#fff", color: "#4f6df5", border: "1.5px solid #4f6df5", borderRadius: 8, fontWeight: 700, cursor: "pointer", opacity: (saving || publishing) ? 0.6 : 1 }}>
                  {saving ? "Saving…" : "Save draft"}
                </button>
                <button onClick={publish} disabled={saving || publishing || !hasDraft}
                  title={hasDraft ? "Make this the version every new applicant signs" : "Save a draft first"}
                  style={{ padding: "11px 22px", background: hasDraft ? "#0f9d58" : "#c7cdd4", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: hasDraft ? "pointer" : "not-allowed", opacity: publishing ? 0.6 : 1 }}>
                  {publishing ? "Publishing…" : "Publish"}
                </button>
                {hasDraft && (
                  <button onClick={discardDraft} disabled={saving || publishing}
                    style={{ background: "none", border: "none", color: "#c0392b", fontWeight: 600, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                    Discard draft
                  </button>
                )}
                <span style={{ fontSize: 12, color: "#9ca3af" }}>
                  Saving only stages a draft. Publishing freezes it as an immutable version
                  and is the only step applicants ever see.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Version history */}
        <div className="dashboard-card" style={{ alignItems: "stretch", textAlign: "left" }}>
          <h3 style={{ marginTop: 0 }}>Version history</h3>
          {versions.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No versions yet — save to create v1.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {versions.map((v) => (
                <div key={v.id} style={{ padding: "10px 12px", border: "1px solid #eef0f3", borderRadius: 8,
                         background: v.is_current ? "#eff6ff" : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <b>v{v.version_number}{v.is_current ? " · current" : ""}</b>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmt(v.created_at)}</span>
                  </div>
                  {v.change_note && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{v.change_note}</div>}
                  {v.created_by && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>by {v.created_by}</div>}
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <button onClick={() => viewVersion(v.id)} style={{ padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>View</button>
                    {!v.is_current && (
                      <button onClick={() => restore(v)} style={{ padding: "5px 10px", fontSize: 12, cursor: "pointer", color: "#4f6df5", border: "1px solid #4f6df5", borderRadius: 6, background: "#fff" }}>Restore</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* View a version */}
      {preview && (
        <div className="ap-modal-overlay" onClick={() => setPreview(null)}>
          <div className="ap-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ margin: 0 }}>{preview.title} · v{preview.version_number}</h2>
              {!preview.is_current && (
                <button onClick={() => restore(preview)} style={{ padding: "6px 14px", cursor: "pointer", color: "#4f6df5", border: "1px solid #4f6df5", borderRadius: 6, background: "#fff", fontWeight: 600 }}>Restore this</button>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{fmt(preview.created_at)}{preview.created_by ? ` · ${preview.created_by}` : ""}{preview.is_current ? " · current" : ""}</div>
            <div className="agreement-preview" style={{ marginTop: 16, lineHeight: 1.6, color: "#1f2937" }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(preview.body)) }} />
            <div style={{ textAlign: "right", marginTop: 16 }}>
              <button onClick={() => setPreview(null)} style={{ padding: "8px 16px", cursor: "pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmModal title={confirm.title} message={confirm.message}
          onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
};

export default AgreementLetter;
