import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { listResearch, getResearch, actResearch, listReviewers, approveReviewer, researchDownload, researchError } from "../api/admin_research";
import "../css/ResearchHub.css";

const states = { submitted: "Awaiting assignment", invited: "Waiting for acceptance", reviewing: "Under review", changes: "Changes requested", approval: "Awaiting admin decision", published: "Published", rejected: "Rejected", withdrawn: "Withdrawn" };
const labels = { submitted: "Submitted", assign: "Reviewer invited", accept: "Review accepted", decline: "Review declined", review_approve: "Reviewer recommends approval", review_changes: "Reviewer requests changes", review_reject: "Reviewer recommends rejection", changes: "Changes requested", revised: "Revision submitted", publish: "Published", reject: "Rejected", withdraw: "Withdrawn", reviewer_revoked: "Reviewer access revoked" };
export default function ResearchHub() {
  const [params, setParams] = useSearchParams();
  const id = params.get("paper");
  const [tab, setTab] = useState("papers");
  const [rows, setRows] = useState(null);
  const [reviewers, setReviewers] = useState(null);
  const [paper, setPaper] = useState(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [days, setDays] = useState(7);
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let alive = true; setRows(null); setError("");
    Promise.all([listResearch({ page, status: filter, q: query }), listReviewers()]).then(([data, profiles]) => {
      if (alive) { setRows(data); setReviewers(profiles.results); }
    }).catch(e => { if (alive) setError(researchError(e)); });
    return () => { alive = false; };
  }, [page, filter, query, refresh]);
  useEffect(() => {
    let alive = true; setPaper(null); setReviewer(""); setNote(""); setConfirmation(false);
    if (id) getResearch(id).then(p => { if (alive) setPaper(p); }).catch(e => { if (alive) setError(researchError(e)); });
    return () => { alive = false; };
  }, [id, refresh]);
  const run = async (fn, text, reload = true) => { setBusy(true); setError(""); setMessage(""); try { await fn(); setMessage(text); if (reload) setRefresh(n => n+1); } catch (e) { setError(researchError(e)); } finally { setBusy(false); } };
  const action = (action, extra = {}) => run(() => actResearch(paper.id, { action, version: paper.current_version, note, ...extra }), "Submission updated.");
  const matching = (reviewers || []).filter(r => r.approved && r.available && r.subjects.some(s => s.toLowerCase() === paper?.subject.toLowerCase()));
  const closed = paper && ["published", "rejected", "withdrawn"].includes(paper.status);
  return <main className="research-admin">
    <h1>Research Hub</h1><p>Approve subject reviewers, arrange manuscript reviews, and publish only the approved revision.</p>
    <nav className="research-actions" aria-label="Research administration"><button className="mod-btn" onClick={() => { setTab("papers"); setParams({}); }}>Submissions</button><button className="mod-btn ghost" onClick={() => { setTab("reviewers"); setParams({}); }}>Reviewer applications</button></nav>
    {error && <div role="alert" className="research-alert">{error} <button className="mod-btn ghost" onClick={() => setRefresh(n => n+1)}>Retry loading</button></div>}
    {message && <p role="status">{message}</p>}
    {id ? !paper ? <p>Loading submission…</p> : <section className="dashboard-card research-panel">
      <button className="mod-btn ghost" onClick={() => setParams({})}>Back to submissions</button><h2>{paper.title}</h2>
      <p><strong>{paper.status_label}</strong> · Version {paper.current_version}</p><p>Authors: {paper.authors}</p><p>{paper.institution ? `${paper.institution} · ` : ""}{paper.subject}{paper.topic ? ` / ${paper.topic}` : ""}</p><p className="research-text">{paper.abstract}</p>
      {paper.original_url && <a href={paper.original_url} target="_blank" rel="noreferrer">Original publication</a>}
      <h3>Manuscript versions</h3>{paper.revisions?.map(r => <div key={r.id}><button disabled={busy} className="mod-btn ghost" onClick={() => run(() => researchDownload(r.file_path, r.version), "Download started.", false)}>Download PDF · v{r.version}</button>{r.response && <p className="research-text">Author response: {r.response}</p>}</div>)}
      {paper.assignment && <section className="research-block"><h3>Current review</h3><p>{paper.assignment.reviewer_name} · {paper.assignment.status} · v{paper.assignment.version}</p><p>Due {new Date(paper.assignment.due_at).toLocaleDateString()}{paper.assignment.overdue ? " — overdue; contact or reassign the reviewer" : ""}</p>{paper.assignment.decision && <p>Recommendation: {paper.assignment.decision}</p>}{Object.entries(paper.assignment.checks || {}).map(([key, value]) => <p key={key}>{key}: {value.replaceAll("_", " ")}</p>)}</section>}
      {!closed && ["submitted", "invited", "reviewing"].includes(paper.status) && <form className="research-block" onSubmit={e => { e.preventDefault(); action("assign", { reviewer_id: reviewer, days: Number(days) }); }}><h3>{paper.assignment ? "Reassign reviewer" : "Assign reviewer"}</h3><p>Choose an independent specialist. Main subject must match approved expertise; check their specialist topics for this paper.</p><label>Approved subject reviewer<select required value={reviewer} onChange={e => setReviewer(e.target.value)}><option value="">Choose reviewer…</option>{matching.map(r => <option key={r.id} value={r.user_id}>{r.name} — {r.topics.join(", ") || r.subjects.join(", ")}</option>)}</select></label>{matching.length === 0 && <p>No approved reviewer matches this subject. Approve a suitable application first.</p>}<label>Review deadline (days)<input type="number" min="1" max="30" required value={days} onChange={e => setDays(e.target.value)} /></label><button disabled={busy || !reviewer} className="mod-btn">{busy ? "Assigning…" : "Send review invitation"}</button></form>}
      {!closed && <section className="research-block"><h3>Administrator decision</h3><label>Feedback / decision reason<textarea maxLength={15000} value={note} onChange={e => setNote(e.target.value)} placeholder="Give the author a clear reason and any next steps." /></label><div className="research-actions"><button disabled={busy || !note.trim()} className="mod-btn ghost" onClick={() => action("changes")}>Request changes</button><button disabled={busy || !note.trim()} className="mod-btn danger" onClick={() => action("reject")}>Reject submission</button></div>
        {paper.status === "approval" && paper.assignment?.decision === "approve" && <><label className="research-check"><input type="checkbox" checked={confirmation} onChange={e => setConfirmation(e.target.checked)} />I checked the reviewer’s findings and the current revision and approve publication.</label><button disabled={busy || !confirmation} className="mod-btn" onClick={() => action("publish")}>Publish approved revision</button></>}
      </section>}
      {paper.status === "published" && <section className="research-block"><h3>Withdraw published paper</h3><p>This hides the paper from Explore. Previously downloaded copies cannot be recalled.</p><label>Reason<textarea required value={note} onChange={e => setNote(e.target.value)} /></label><button disabled={busy || !note.trim()} className="mod-btn danger" onClick={() => action("withdraw")}>Withdraw from Explore</button></section>}
      <section className="research-block"><h3>Progress and feedback</h3><ol>{paper.events?.map((e, index) => <li key={index}><strong>{labels[e.action] || e.action}</strong> · v{e.version} · {new Date(e.created_at).toLocaleString()}{e.note && <p className="research-text">{e.note}</p>}</li>)}</ol></section>
    </section> : tab === "reviewers" ? <section className="dashboard-card research-panel"><h2>Reviewer applications</h2><p>Check qualifications and subject expertise before approval. Suspending a reviewer revokes manuscript access and returns unfinished papers for assignment.</p>{reviewers === null ? <p>Loading…</p> : reviewers.length === 0 ? <p>No applications yet. Ask teachers to apply through Explore → Research → Reviewer profile.</p> : reviewers.map(r => <article key={r.id} className="research-block"><h3>{r.name}</h3><p>{r.email}</p><p className="research-text">{r.expertise}</p><p>Subjects: {r.subjects.join(", ")}</p><p>Specialist topics: {r.topics.join(", ") || "Not specified"}</p><p>{r.approved ? "Approved" : "Awaiting approval"}</p><button disabled={busy} className="mod-btn" onClick={() => run(() => approveReviewer(r.id, !r.approved), r.approved ? "Reviewer suspended." : "Reviewer approved.")}>{r.approved ? "Suspend reviewer access" : "Approve reviewer"}</button></article>)}</section> : <section className="dashboard-card research-panel">
      <form className="research-actions" onSubmit={e => { e.preventDefault(); setQuery(q); setPage(1); }}><label>Search papers<input value={q} maxLength={300} onChange={e => setQ(e.target.value)} placeholder="Title, author or subject" /></label><button className="mod-btn">Search</button><label>Status<select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="">All statuses</option>{Object.entries(states).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label></form>
      {!rows ? <p>{error ? "Couldn’t load submissions." : "Loading…"}</p> : <>{rows.results.length === 0 ? <p>No submissions match these filters.</p> : rows.results.map(p => <button className="research-row" key={p.id} onClick={() => setParams({ paper: p.id })}><strong>{p.title}</strong><span>{p.authors} · {p.subject}</span><span>{p.status_label} · v{p.current_version}{p.assignment?.overdue ? " · Review overdue" : ""}</span></button>)}<div className="research-actions"><button disabled={page === 1} className="mod-btn ghost" onClick={() => setPage(p => p-1)}>Previous</button><span>Page {page} · {rows.count} submissions</span><button disabled={page*20 >= rows.count} className="mod-btn ghost" onClick={() => setPage(p => p+1)}>Next</button></div></>}
    </section>}
  </main>;
}
