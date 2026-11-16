// ─────────────────────────────────────────────────────────────────────────────
// src/pages/VerificationAdmin.jsx   —   /verification
//
// "Settings and reviewers." The admin half of Explore community verification.
// Spec: shiksha-backend/docs/EXPLORE_VERIFICATION.md §5.
//
// Three tabs: Settings, Reviewers, Needs attention. The design's fourth tab,
// "Research papers", is the EXISTING /research screen and is deliberately not
// rebuilt here — it is linked instead.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Minus, Plus } from "lucide-react";
import {
  getSettings, saveSettings, getReviewers, reviewerAction,
  getAttention, attentionAction, getEligibleReviewers,
  verificationOff, verificationError,
} from "../api/admin_verification";
import Toast from "../components/Toast";
// ⚠ .mod-toast is only defined in Moderator.css, and every route is its own
// lazy chunk with its own CSS. A screen that renders <Toast> without importing
// this shows an unstyled toast on a hard refresh — which is most of the Studio
// screens today. Importing it here is the fix, not an accident.
import "../css/Moderator.css";
import "../css/Verification.css";

const TABS = [
  { id: "settings", label: "Settings" },
  { id: "reviewers", label: "Reviewers" },
  { id: "attention", label: "Needs attention" },
];

/* Every knob, with the design's exact label and help text. Kept as data so the
   three groups render identically and a new setting is one line, not a new
   block of JSX that drifts from its neighbours. */
const GROUPS = [
  {
    title: "Reaching Verified",
    rows: [
      { key: "confirmations_needed", kind: "step", label: "Confirmations needed",
        help: "How many reviewers must confirm a set before it is marked Verified.", min: 1, max: 10 },
      { key: "show_unverified_in_browse", kind: "toggle", label: "Show unverified uploads in Browse",
        help: "On: uploads are public at once with an Unverified badge. Off: they stay private until Verified." },
      { key: "change_requests_before_hidden", kind: "step", label: "Change requests before a set is hidden",
        help: "After this many on one version, the set leaves Browse and comes to you.", min: 1, max: 10 },
    ],
  },
  {
    title: "Assigning reviewers",
    rows: [
      { key: "reviewer_selection", kind: "segment", label: "How reviewers are chosen",
        options: [
          { value: "open_queue", label: "Open queue",
            help: "Every reviewer in the subject sees the set. Nobody is invited and there is no deadline." },
          { value: "automatic", label: "Invite automatically",
            help: "The least busy reviewers in the subject are invited by notification. The set also stays in the open queue." },
          { value: "admin_assigns", label: "Admin assigns",
            help: "Nothing reaches a reviewer until you hand it to them on the Needs attention tab." },
        ] },
      { key: "reviewers_invited_per_set", kind: "step", label: "Reviewers invited per set",
        help: "Invited in order of fewest open reviews.", min: 1, max: 10 },
      { key: "days_to_respond", kind: "step", label: "Time to respond", unit: "days",
        help: "An unanswered invite passes to the next reviewer after this.", min: 1, max: 30 },
      { key: "notify_admins_when_no_reviewer", kind: "toggle", label: "Send to admins when no reviewer exists",
        help: "Sets tagged with a subject nobody reviews appear under Needs attention." },
    ],
  },
  {
    title: "Automatic matching",
    rows: [
      { key: "widen_to_same_field", kind: "toggle", label: "Widen to the same field",
        help: "When a subject has no reviewers, reviewers from other subjects in the same field are invited before the set comes to you." },
      { key: "prefer_same_branch", kind: "toggle", label: "Prefer the same branch",
        help: "Reviewers whose own verified uploads are in the set’s branch are invited first." },
      { key: "skip_uploader_institution", kind: "toggle", label: "Skip reviewers from the uploader’s institution",
        help: "The uploader is never asked to review their own set. This also leaves out their colleagues and classmates." },
      { key: "open_reviews_per_reviewer", kind: "step", label: "Open reviews per reviewer",
        help: "A reviewer at this limit is not invited again until they finish one.", min: 1, max: 20 },
      { key: "remind_invited_reviewers", kind: "toggle", label: "Remind invited reviewers",
        help: "A notification is sent before the invite runs out." },
      { key: "reminder_days_before", kind: "step", label: "Reminder sent", unit: "days",
        help: "Before the time to respond ends.", min: 1, max: 14 },
      { key: "pause_inactive_reviewers", kind: "toggle", label: "Pause inactive reviewers",
        help: "A reviewer who keeps missing invites stops receiving them. You can resume them on the Reviewers tab." },
      { key: "missed_invites_before_pause", kind: "step", label: "Missed invites in a row",
        help: "Before the reviewer is paused.", min: 1, max: 10 },
    ],
  },
  {
    title: "Who can review",
    rows: [
      { key: "teachers_review_their_subjects", kind: "toggle", label: "Teacher accounts",
        help: "Teachers review in the subjects they teach, with no extra step." },
      { key: "members_can_earn_it", kind: "toggle", label: "Members who earn it",
        help: "A member becomes a reviewer in a subject through their own verified uploads." },
      { key: "verified_uploads_to_earn_it", kind: "step", label: "Verified uploads needed",
        help: "In the same subject.", min: 1, max: 10 },
      { key: "members_can_request_it", kind: "toggle", label: "Members who request it",
        help: "A member sends proof of their background and an admin approves or declines." },
    ],
  },
];

const STATE_PILL = {
  active: { label: "Active", cls: "vfa-ok" },
  at_limit: { label: "At limit", cls: "vfa-warn" },
  paused: { label: "Paused", cls: "vfa-warn" },
};

function Stepper({ value, onChange, min, max, unit }) {
  return (
    <div className="vfa-step">
      <button type="button" aria-label="Decrease" disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}><Minus size={15} /></button>
      <span>{value}{unit ? ` ${unit}` : ""}</span>
      <button type="button" aria-label="Increase" disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}><Plus size={15} /></button>
    </div>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!value}
      aria-label={label}
      className={`vfa-toggle${value ? " on" : ""}`}
      onClick={() => onChange(!value)}
    ><span /></button>
  );
}

export default function VerificationAdmin() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t.id === params.get("tab")) ? params.get("tab") : "settings";

  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [reviewers, setReviewers] = useState(null);
  const [attention, setAttention] = useState(null);
  const [off, setOff] = useState(false);
  const [failed, setFailed] = useState("");
  const [toast, setToast] = useState("");
  const [tone, setTone] = useState("success");
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [candidates, setCandidates] = useState([]);

  const flash = useCallback((message, nextTone = "success") => {
    setToast(message); setTone(nextTone);
    setTimeout(() => setToast(""), 2500);
  }, []);

  /* `quiet` exists because a refresh triggered from inside the assign dialog
     would otherwise unmount it mid-flow — the Studio screens' early-return
     "Loading…" trap. Only the browser caught that one. */
  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) { setSettings(null); setReviewers(null); setAttention(null); }
    try {
      const [s, r, a] = await Promise.all([
        getSettings(), getReviewers(), getAttention(),
      ]);
      setSettings(s); setDraft(s); setReviewers(r); setAttention(a);
      setOff(false); setFailed("");
    } catch (error) {
      if (verificationOff(error)) { setOff(true); setFailed(""); }
      /* ⚠ admin.js's safe() lesson: a failed request that renders as an empty
         list is how a dead backend once got read as "there is no content".
         An outage says so. */
      else setFailed(verificationError(error));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirty = settings && draft
    && JSON.stringify(settings) !== JSON.stringify(draft);

  async function persist() {
    setSaving(true);
    try {
      const saved = await saveSettings(draft);
      setSettings(saved); setDraft(saved);
      flash("Settings saved.");
    } catch (error) {
      flash(verificationError(error), "error");
    } finally { setSaving(false); }
  }

  async function onReviewer(specId, action) {
    try {
      await reviewerAction(specId, action);
      await load({ quiet: true });
      flash({
        approve: "Reviewer approved.", decline: "Request declined.",
        pause: "Reviewer paused.", resume: "Reviewer resumed.",
      }[action]);
    } catch (error) { flash(verificationError(error), "error"); }
  }

  async function onAttention(docId, action, body) {
    try {
      await attentionAction(docId, action, body);
      await load({ quiet: true });
      flash({
        assign: "Reviewer assigned.", restore: "Set restored to Browse.",
        remove: "Set removed.",
      }[action]);
      setAssigning(null);
    } catch (error) { flash(verificationError(error), "error"); }
  }

  async function openAssign(docId) {
    setAssigning(docId);
    try { setCandidates(await getEligibleReviewers(docId)); }
    catch { setCandidates([]); }
  }

  if (off) {
    return (
      <div className="admin-content page-fade vfa">
        <div className="vfa-blank">
          <h2>Community verification is not switched on</h2>
          <p>
            Turn on <strong>Explore verification</strong> in Settings, then log
            out and back in. This screen and the Verify page appear once it is
            on.
          </p>
          <p className="vfa-aside">
            If it is already on, this screen needs a superuser or an active
            ADMIN role — staff access to the Django admin is not enough.
          </p>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="admin-content page-fade vfa">
        <div className="vfa-blank">
          <AlertTriangle size={24} />
          <h2>Couldn’t load verification</h2>
          <p>{failed}</p>
          <button className="vfa-btn" onClick={() => load()}>Try again</button>
        </div>
      </div>
    );
  }

  if (!settings || !draft) {
    return <div className="admin-content page-fade vfa"><p className="vfa-loading">Loading…</p></div>;
  }

  const pendingCount = reviewers?.requests?.length || 0;
  const attentionCount = attention?.results?.length || 0;

  return (
    <div className="admin-content page-fade vfa">
      <p className="vfa-eyebrow">Verification</p>
      <h1 className="vfa-title">Settings and reviewers</h1>

      <nav className="vfa-tabs" aria-label="Verification sections">
        {TABS.map(t => {
          const count = t.id === "reviewers" ? pendingCount
            : t.id === "attention" ? attentionCount : 0;
          return (
            <button key={t.id}
              className={`vfa-tab${tab === t.id ? " active" : ""}`}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => setParams({ tab: t.id })}>
              {t.label}
              {count > 0 && <span className="vfa-count"> · {count}</span>}
            </button>
          );
        })}
        {/* The design's fourth tab. It is the EXISTING Research Hub screen —
            linked rather than rebuilt, because a second copy of a working
            queue is a second copy to keep correct. */}
        <Link className="vfa-tab vfa-link" to="/research">Research papers ↗</Link>
      </nav>

      {tab === "settings" && (
        <>
          <section className="vfa-summary">
            <h2>What happens to an upload with these settings</h2>
            {/* ⚠ Server-computed, not written here. This box is the one place
                an admin is told what their configuration actually does; a
                hardcoded copy would keep saying "7 days" after someone set it
                to 3, and would be believed. It reflects the SAVED settings —
                see the note below when there are unsaved edits. */}
            <ol>{settings.summary.map((line, i) => <li key={i}>{line}</li>)}</ol>
            {dirty && (
              <p className="vfa-dirty">
                This describes the saved settings. Save to apply your changes.
              </p>
            )}
          </section>

          {GROUPS.map(group => (
            <section key={group.title} className="vfa-group">
              <h2>{group.title}</h2>
              {group.rows.map(row => (
                <div key={row.key} className="vfa-row">
                  <div className="vfa-rowtext">
                    <h3>{row.label}</h3>
                    <p>
                      {row.kind === "segment"
                        ? row.options.find(o => o.value === draft[row.key])?.help
                        : row.help}
                    </p>
                  </div>
                  {row.kind === "toggle" && (
                    <div className="vfa-control">
                      <span className="vfa-onoff">{draft[row.key] ? "On" : "Off"}</span>
                      <Toggle label={row.label} value={draft[row.key]}
                        onChange={v => setDraft(d => ({ ...d, [row.key]: v }))} />
                    </div>
                  )}
                  {row.kind === "step" && (
                    <Stepper value={draft[row.key]} min={row.min} max={row.max}
                      unit={row.unit}
                      onChange={v => setDraft(d => ({ ...d, [row.key]: v }))} />
                  )}
                  {row.kind === "segment" && (
                    <div className="vfa-segment" role="group" aria-label={row.label}>
                      {row.options.map(o => (
                        <button key={o.value} type="button"
                          aria-pressed={draft[row.key] === o.value}
                          className={draft[row.key] === o.value ? "on" : ""}
                          onClick={() => setDraft(d => ({ ...d, [row.key]: o.value }))}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>
          ))}

          <div className="vfa-save">
            <button className="vfa-btn" disabled={!dirty || saving} onClick={persist}>
              {saving ? "Saving…" : "Save settings"}
            </button>
            <span className="vfa-savenote">
              {dirty ? "You have unsaved changes." : "All changes saved."}
            </span>
          </div>
        </>
      )}

      {tab === "reviewers" && (
        <>
          <h2 className="vfa-sechead">Requests to review</h2>
          {pendingCount === 0 && <p className="vfa-none">No requests waiting.</p>}
          {reviewers.requests.map(r => (
            <article key={r.id} className="vfa-card">
              <div className="vfa-rowtext">
                <h3>{r.name}</h3>
                <p className="vfa-wants">Wants to review {r.subject}</p>
                {/* Shown verbatim and never truncated — it is the whole basis
                    for approving or declining. */}
                {r.evidence && <p>{r.evidence}</p>}
              </div>
              <div className="vfa-acts">
                <button className="vfa-btn" onClick={() => onReviewer(r.id, "approve")}>Approve</button>
                <button className="vfa-btn ghost" onClick={() => onReviewer(r.id, "decline")}>Decline</button>
              </div>
            </article>
          ))}

          <h2 className="vfa-sechead">Reviewers</h2>
          {reviewers.reviewers.length === 0 && (
            <p className="vfa-none">
              Nobody is confirmed to review yet. Teachers are confirmed in the
              subjects they teach as soon as the feature is on.
            </p>
          )}
          {reviewers.reviewers.map(r => {
            const pill = STATE_PILL[r.state] || STATE_PILL.active;
            return (
              <article key={r.id} className="vfa-card vfa-tight">
                <div className="vfa-rowtext">
                  <h3>{r.name}</h3>
                  <p>
                    {r.subject} · {r.qualification} · {r.reviews} review
                    {r.reviews === 1 ? "" : "s"} · {r.open_reviews} open
                  </p>
                </div>
                <div className="vfa-acts">
                  <span className={`vfa-pill ${pill.cls}`}>{pill.label}</span>
                  <button className="vfa-btn ghost"
                    onClick={() => onReviewer(r.id, r.state === "paused" ? "resume" : "pause")}>
                    {r.state === "paused" ? "Resume" : "Pause"}
                  </button>
                </div>
              </article>
            );
          })}
        </>
      )}

      {tab === "attention" && (
        <>
          <p className="vfa-lede">
            Most sets never appear here. This list only holds the ones the
            automatic flow could not finish.
          </p>
          {/* The reassuring half of that sentence. Without it a short list
              reads as a broken query rather than as a healthy system. */}
          <p className="vfa-flowing">
            {attention.handled_automatically} set
            {attention.handled_automatically === 1 ? " is" : "s are"} being
            handled automatically under your current settings.
          </p>

          {attentionCount === 0 && <p className="vfa-none">Nothing needs you right now.</p>}

          {attention.results.map(item => (
            <article key={item.id} className="vfa-card vfa-stack">
              <div className="vfa-flagrow">
                <span className={`vfa-pill ${item.reason === "hidden" ? "vfa-bad" : "vfa-warn"}`}>
                  {item.reason === "hidden" ? "Hidden after change requests"
                    : item.reason === "invites_expired" ? "Invites expired"
                      : "No reviewer in this subject"}
                </span>
                <span className="vfa-progress">{item.progress.label}</span>
              </div>
              <h3>{item.title}</h3>
              <p className="vfa-tags">{item.tags.join(" · ")}</p>

              {item.change_requests.map((cr, i) => (
                <div key={i} className="vfa-note">
                  <strong>{cr.reviewer} requested changes</strong>
                  <p>{cr.note}</p>
                </div>
              ))}

              <div className="vfa-acts">
                {item.reason === "hidden" ? (
                  <>
                    <button className="vfa-btn" onClick={() => onAttention(item.id, "restore")}>Restore to Browse</button>
                    <button className="vfa-btn danger" onClick={() => onAttention(item.id, "remove")}>Remove set</button>
                  </>
                ) : (
                  <button className="vfa-btn" onClick={() => openAssign(item.id)}>Assign a reviewer</button>
                )}
              </div>

              {assigning === item.id && (
                <div className="vfa-assign">
                  {candidates.length === 0 ? (
                    <p className="vfa-none">
                      Nobody is confirmed in this set’s subjects. Approve a
                      reviewer on the Reviewers tab first.
                    </p>
                  ) : candidates.map(c => (
                    <button key={c.id} className="vfa-btn ghost"
                      onClick={() => onAttention(item.id, "assign", { reviewer_id: c.id })}>
                      {c.name} · {c.subject}
                    </button>
                  ))}
                  <button className="vfa-btn ghost" onClick={() => setAssigning(null)}>Cancel</button>
                </div>
              )}
            </article>
          ))}
        </>
      )}

      <Toast message={toast} tone={tone} />
    </div>
  );
}
