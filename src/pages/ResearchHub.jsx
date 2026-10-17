import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { listResearch, getResearch, actResearch, listReviewers, approveReviewer, researchDownload, researchError } from "../api/admin_research";
import "../css/ResearchHub.css";

const states = { submitted: "Awaiting assignment", invited: "Waiting for acceptance", reviewing: "Under review", changes: "Changes requested", approval: "Awaiting admin decision", published: "Published", rejected: "Rejected", withdrawn: "Withdrawn" };
const liveStates = ["submitted", "invited", "reviewing"];
const labels = { submitted: "Submitted", assign: "Reviewer invited", auto_invite: "Subject reviewer invited automatically", accept: "Review accepted", decline: "Review declined",
  review_approve: "Reviewer recommends approval", review_changes: "Reviewer requests changes", review_reject: "Reviewer recommends rejection", changes: "Changes requested",
  revised: "Revision submitted", publish: "Published", reject: "Administrator decision", withdraw: "Withdrawn", reviewer_revoked: "Reviewer access revoked",
  deadline_expired: "Deadline expired — review slot released", matching_wait: "Waiting for more available reviewers", match: "Matching checked", configure: "Review settings updated",
  appeal: "Author appealed decision", uphold_appeal: "Appeal upheld — fresh reviews arranged", dismiss_appeal: "Appeal dismissed", correction_requested: "Correction proposed", cancel_correction: "Correction cancelled" };
const recommendation = value => ({ approve: "Recommends approval", changes: "Requests changes", reject: "Recommends rejection" }[value] || "Awaiting recommendation");

export default function ResearchHub() {
  const [params, setParams] = useSearchParams();
  const id = params.get("paper");
  const [tab, setTab] = useState("papers");
  const [rows, setRows] = useState(null);
  const [reviewers, setReviewers] = useState(null);
  const [paper, setPaper] = useState(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [caseFilter, setCaseFilter] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [target, setTarget] = useState("");
  const [days, setDays] = useState(7);
  const [required, setRequired] = useState(2);
  const [automatic, setAutomatic] = useState(true);
  const [note, setNote] = useState("");
  const [publicNote, setPublicNote] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true; setRows(null); setError("");
    Promise.all([listResearch({ page, status: filter, case: caseFilter, q: query }), listReviewers()]).then(([data, profiles]) => {
      if (alive) { setRows(data); setReviewers(profiles.results); }
    }).catch(e => { if (alive) setError(researchError(e)); });
    return () => { alive = false; };
  }, [page, filter, caseFilter, query, refresh]);
  useEffect(() => {
    let alive = true; setPaper(null); setReviewer(""); setTarget(""); setNote(""); setPublicNote(""); setConfirmation(false);
    if (id) getResearch(id).then(p => { if (alive) { setPaper(p); setRequired(p.required_reviews); setAutomatic(p.automatic_matching); } })
      .catch(e => { if (alive) setError(researchError(e)); });
    return () => { alive = false; };
  }, [id, refresh]);
  const run = async (fn, text, reload = true) => {
    setBusy(true); setError(""); setMessage("");
    try { await fn(); setMessage(text); if (reload) setRefresh(n => n+1); }
    catch (e) { setError(researchError(e)); } finally { setBusy(false); }
  };
  const action = (action, extra = {}) => run(() => actResearch(paper.id, { action, version: paper.current_version, note, ...extra }), "Submission updated.");
  const matching = (reviewers || []).filter(r => r.approved && r.available && r.subjects.some(s => s.toLowerCase() === paper?.subject.toLowerCase()) && !(paper?.assignments || []).some(a => a.reviewer_id === r.user_id));
  const closed = paper && ["published", "rejected", "withdrawn"].includes(paper.status);
  const correction = paper?.cases?.find(c => c.kind === "correction" && c.status === "open");
  const appeal = paper?.cases?.find(c => c.kind === "appeal" && c.status === "open");
  const reviews = paper?.assignments || [];
  const countLocked = reviews.some(r => ["accepted", "completed"].includes(r.status));
  const canPublish = paper?.status === "approval" && reviews.filter(r => r.status === "completed").length >= paper.required_reviews
    && reviews.filter(r => r.status === "completed").every(r => r.decision === "approve");

  return <main className="research-admin">
    <h1>Research Hub</h1><p>Arrange independent subject reviews, resolve appeals, and publish approved papers or corrections.</p>
    <nav className="research-actions" aria-label="Research administration">
      <button className="mod-btn" onClick={() => { setTab("papers"); setParams({}); }}>Submissions</button>
      <button className="mod-btn ghost" onClick={() => { setTab("reviewers"); setParams({}); }}>Reviewer applications</button>
    </nav>
    {error && <div role="alert" className="research-alert">{error} <button className="mod-btn ghost" onClick={() => setRefresh(n => n+1)}>Retry loading</button></div>}
    {message && <p role="status">{message}</p>}
    {id ? !paper ? <section className="dashboard-card research-panel"><p>{error ? "This submission could not be loaded." : "Loading submission…"}</p>
      {error && <button className="mod-btn ghost" onClick={() => setParams({})}>Back to submissions</button>}</section> : <section className="dashboard-card research-panel">
      <button className="mod-btn ghost" onClick={() => setParams({})}>Back to submissions</button><h2>{paper.title}</h2>
      <p><strong>{paper.status === "published" ? `Published version ${paper.published_version}` : paper.status_label}</strong> · Latest submission version {paper.current_version}</p><p>Authors: {paper.authors}</p>
      <p>{paper.institution ? `${paper.institution} · ` : ""}{paper.subject}{paper.topic ? ` / ${paper.topic}` : ""}</p><p className="research-text">{paper.abstract}</p>
      {paper.original_url && <a href={paper.original_url} target="_blank" rel="noreferrer">Original publication</a>}
      <div className="research-progress"><strong>{paper.status === "published" ? `${paper.published_review_count || paper.required_reviews} independent review(s) for published version ${paper.published_version}` : closed ? "This review round is closed" : `${paper.review_progress?.completed || 0} of ${paper.required_reviews} required reviews completed`}</strong>
        {!closed && <p>{paper.review_progress?.accepted || 0} in progress · {paper.review_progress?.invited || 0} invitations waiting · Automatic matching {paper.automatic_matching ? "on" : "off"}</p>}
        {paper.published_version && <p>Published version {paper.published_version}{correction ? " stays available while this correction is reviewed." : "."}</p>}
      </div>
      <h3>Manuscript versions</h3>{paper.revisions?.map(r => <div key={r.id}>
        <button disabled={busy} className="mod-btn ghost" onClick={() => run(() => researchDownload(r.file_path, r.version), "Download started.", false)}>Download PDF · v{r.version}</button>
        {r.response && <p className="research-text">Author response: {r.response}</p>}
      </div>)}

      {reviews.length > 0 && <section className="research-block"><h3>Current reviewer assignments</h3><div className="research-review-grid">
        {reviews.map(r => <article key={r.id} className="research-review-card"><strong>{r.reviewer_name}</strong>
          <p>{r.status === "invited" ? "Invitation waiting" : r.status === "accepted" ? "Review in progress" : "Review completed"} · v{r.version}</p>
          <p>{r.status === "invited" ? "Invitation expires" : "Review deadline"}: {new Date(r.due_at).toLocaleString()}{r.overdue ? " — expired; replacement is handled by the deadline sweep" : ""}</p>
          {r.decision && <><p><strong>{recommendation(r.decision)}</strong></p><p className="research-text">{r.feedback}</p>
            {Object.entries(r.checks || {}).map(([key, value]) => <p key={key}>{key}: {value.replaceAll("_", " ")}</p>)}</>}
        </article>)}
      </div></section>}
      {liveStates.includes(paper.status) && <section className="research-block"><h3>Review requirements and matching</h3>
        <p>New papers normally need two independent reviewers. Invitations expire after 48 hours; accepted reviews normally have seven days. The background sweep sends one reminder and replaces overdue assignments.</p>
        <form onSubmit={e => { e.preventDefault(); action("configure", { automatic_matching: automatic, ...(!countLocked ? { required_reviews: Number(required) } : {}) }); }}>
          <label>Required independent reviews<select value={required} disabled={countLocked} onChange={e => setRequired(e.target.value)}>
            {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          {countLocked && <p>The review count is fixed after a reviewer accepts.</p>}
          <label className="research-check"><input type="checkbox" checked={automatic} onChange={e => setAutomatic(e.target.checked)} />Automatically invite matching available reviewers and replace expired assignments.</label>
          <div className="research-actions"><button disabled={busy} className="mod-btn">Save matching settings</button>
            <button type="button" disabled={busy || !paper.automatic_matching} className="mod-btn ghost" onClick={() => action("match")}>Find reviewers now</button></div>
        </form>
      </section>}
      {[...liveStates, "approval"].includes(paper.status) && <form className="research-block" onSubmit={e => {
        e.preventDefault(); action("assign", { reviewer_id: reviewer, days: Number(days), ...(target ? { assignment_id: Number(target) } : {}) });
      }}>
        <h3>Assign or replace a reviewer manually</h3><p>Choose an independent approved specialist with matching subject expertise. On an upheld appeal, choose fresh reviewers.</p>
        <label>Review slot<select value={target} onChange={e => setTarget(e.target.value)}><option value="">Add to an open slot</option>
          {reviews.map(r => <option key={r.id} value={r.id}>Replace {r.reviewer_name} ({r.status})</option>)}</select></label>
        <label>Approved subject reviewer<select required value={reviewer} onChange={e => setReviewer(e.target.value)}><option value="">Choose reviewer…</option>
          {matching.map(r => <option key={r.id} value={r.user_id}>{r.name} — {r.topics.join(", ") || r.subjects.join(", ")}</option>)}</select></label>
        {matching.length === 0 && <p>No approved available reviewer matches this subject. Approve a suitable application first.</p>}
        <label>Review deadline after acceptance (days)<input type="number" min="1" max="30" required value={days} onChange={e => setDays(e.target.value)} /></label>
        <button disabled={busy || !reviewer} className="mod-btn">{busy ? "Assigning…" : "Send review invitation"}</button>
      </form>}

      {appeal && <section className="research-block"><h3>Author appeal awaiting decision</h3><p className="research-text">{appeal.reason}</p>
        <p>Upholding the appeal arranges a fresh review round. It does not publish the paper or reuse the previous approval.</p>
        <label>Appeal decision reason<textarea value={note} maxLength={15000} onChange={e => setNote(e.target.value)} /></label>
        <div className="research-actions"><button disabled={busy || !note.trim()} className="mod-btn" onClick={() => action("uphold_appeal")}>Uphold appeal and arrange fresh reviews</button>
          <button disabled={busy || !note.trim()} className="mod-btn ghost" onClick={() => action("dismiss_appeal")}>Dismiss appeal with explanation</button></div>
      </section>}
      {!closed && <section className="research-block"><h3>{correction ? "Correction decision" : "Administrator decision"}</h3>
        <label>Feedback / decision reason<textarea maxLength={15000} value={note} onChange={e => setNote(e.target.value)} placeholder="Give the author a clear reason and next steps." /></label>
        <div className="research-actions"><button disabled={busy || !note.trim()} className="mod-btn ghost" onClick={() => action("changes")}>Request changes</button>
          <button disabled={busy || !note.trim()} className="mod-btn danger" onClick={() => action("reject")}>{correction ? "Reject correction; keep published paper" : "Reject submission"}</button></div>
        {paper.status === "approval" && !canPublish && <p>Reviewer objections must be resolved before publication. Request changes or arrange a replacement assessment where appropriate.</p>}
        {canPublish && <>
          {correction && <label>Public correction notice (shown on the published paper)<textarea required maxLength={5000} value={publicNote} onChange={e => setPublicNote(e.target.value)} placeholder="Explain what changed and why. This text will be public." /></label>}
          <label className="research-check"><input type="checkbox" checked={confirmation} onChange={e => setConfirmation(e.target.checked)} />I checked all required independent reviews and the current revision and approve publication.</label>
          <button disabled={busy || !confirmation || (correction && !publicNote.trim())} className="mod-btn" onClick={() => action("publish", { public_note: publicNote })}>{correction ? "Publish approved correction" : "Publish approved revision"}</button>
        </>}
      </section>}
      {paper.cases?.length > 0 && <section className="research-block"><h3>Appeal and correction history</h3>
        {paper.cases.map(c => <article key={c.id} className="research-review-card"><strong>{c.kind === "appeal" ? "Appeal" : "Correction"} · v{c.version} · {c.status}</strong>
          <p className="research-text">{c.reason}</p>{c.resolution && <p className="research-text">Decision: {c.resolution}</p>}{c.public_note && <p className="research-text">Public notice: {c.public_note}</p>}
        </article>)}
      </section>}
      {paper.review_history?.length > 0 && <section className="research-block"><h3>All review findings</h3>
        {paper.review_history.map(r => <article key={r.id} className="research-review-card"><strong>{r.reviewer_name} · v{r.version} · {recommendation(r.decision)}</strong><p className="research-text">{r.feedback}</p></article>)}
      </section>}
      {paper.document_id && paper.status !== "withdrawn" && <section className="research-block"><h3>Withdraw the published paper</h3>
        <p>This hides the existing publication and ends any pending correction review. Previously downloaded copies cannot be recalled.</p>
        <label>Withdrawal reason<textarea required value={note} onChange={e => setNote(e.target.value)} /></label>
        <button disabled={busy || !note.trim()} className="mod-btn danger" onClick={() => action("withdraw")}>Withdraw from Explore</button>
      </section>}
      <section className="research-block"><h3>Progress and feedback</h3><ol>{paper.events?.map((e, index) => <li key={index}>
        <strong>{labels[e.action] || "Research update"}</strong> · v{e.version} · {new Date(e.created_at).toLocaleString()}{e.note && <p className="research-text">{e.note}</p>}
      </li>)}</ol></section>
    </section> : tab === "reviewers" ? <section className="dashboard-card research-panel"><h2>Reviewer applications</h2>
      <p>Check qualifications and subject expertise before approval. Suspending a reviewer revokes manuscript access and releases their current slots for reassignment.</p>
      {reviewers === null ? <p>Loading…</p> : reviewers.length === 0 ? <p>No applications yet. Ask specialists to apply through Explore → Research → Reviewer profile.</p> : reviewers.map(r =>
        <article key={r.id} className="research-block"><h3>{r.name}</h3><p>{r.email}</p><p className="research-text">{r.expertise}</p><p>Subjects: {r.subjects.join(", ")}</p>
          <p>Specialist topics: {r.topics.join(", ") || "Not specified"}</p><p>{r.approved ? "Approved" : "Awaiting approval"} · {r.available ? "Available for invitations" : "New invitations paused"}</p>
          <button disabled={busy} className="mod-btn" onClick={() => run(() => approveReviewer(r.id, !r.approved), r.approved ? "Reviewer suspended." : "Reviewer approved. Eligible papers are matched by the next background sweep.")}>{r.approved ? "Suspend reviewer access" : "Approve reviewer"}</button>
        </article>)}
    </section> : <section className="dashboard-card research-panel">
      <form className="research-actions" onSubmit={e => { e.preventDefault(); setQuery(q); setPage(1); }}>
        <label>Search papers<input value={q} maxLength={300} onChange={e => setQ(e.target.value)} placeholder="Title, author or subject" /></label><button className="mod-btn">Search</button>
        <label>Status<select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="">All statuses</option>{Object.entries(states).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <label>Appeals and corrections<select value={caseFilter} onChange={e => { setCaseFilter(e.target.value); setPage(1); }}><option value="">All submissions</option><option value="appeal">Open appeals</option><option value="correction">Open corrections</option></select></label>
      </form>
      {!rows ? <p>{error ? "Couldn’t load submissions." : "Loading…"}</p> : <>
        {rows.results.length === 0 ? <p>No submissions match these filters.</p> : rows.results.map(p => <button className="research-row" key={p.id} onClick={() => setParams({ paper: p.id })}>
          <strong>{p.title}</strong><span>{p.authors} · {p.subject}</span><span>{p.status_label} · v{p.current_version} · {p.review_progress?.completed || 0}/{p.required_reviews} reviews</span>
          {p.open_case && <span>{p.open_case.kind === "appeal" ? "Author appeal awaiting decision" : "Correction under review"}</span>}
        </button>)}
        <div className="research-actions"><button disabled={page === 1} className="mod-btn ghost" onClick={() => setPage(p => p-1)}>Previous</button><span>Page {page} · {rows.count} submissions</span>
          <button disabled={page*20 >= rows.count} className="mod-btn ghost" onClick={() => setPage(p => p+1)}>Next</button></div>
      </>}
    </section>}
  </main>;
}
