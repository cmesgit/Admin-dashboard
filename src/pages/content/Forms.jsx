/**
 * /content/forms — the artboard's "Forms" screen.
 * design_handoff_admin_counsellor, Admin v2 Phase 5.
 *
 * ⚠ NOT A FORM BUILDER. The artboard lists the forms the site already has —
 * Teacher application, Contact us, Book a counselling session — with their
 * fields, where the answers go, and their submissions. A builder would
 * invent a second way to collect information that nothing on the public site
 * renders.
 *
 * WHAT THIS CLOSES. `ContactMessage` has `status` and `handled_note` — it was
 * built to be worked — and had no admin API and no console screen. A visitor
 * filled in Contact us, was told "we got it", and nobody here ever saw it.
 * Forms owned by another screen link out instead of being duplicated: two
 * inboxes for one teacher application is two ways to miss it.
 *
 * ⚠ No toast library in this app — local state on a timer + components/Toast.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Inbox } from "lucide-react";
import {
  getContactSubmissions, getForms, updateContactSubmission,
} from "../../api/admin_forms";
import Toast from "../../components/Toast";
import "../../css/Forms.css";

const STATUSES = [
  ["", "All"],
  ["new", "New"],
  ["in_progress", "In progress"],
  ["closed", "Closed"],
];

const when = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", {
    dateStyle: "medium", timeStyle: "short",
  });
};

export default function Forms() {
  const [forms, setForms] = useState(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState("new");
  const [subs, setSubs] = useState(null);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");

  const say = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    getForms().then((d) => setForms(d.results || []))
      // ⚠ Never render "no forms" for a failed request — on this screen that
      // reads as "the site collects nothing", which is the opposite of true.
      .catch(() => { setFailed(true); setForms([]); });
  }, []);

  const loadSubs = (st = status) => {
    getContactSubmissions(st ? { status: st } : {})
      .then((d) => { setSubs(d.results || []); setTotal(d.count || 0); })
      .catch(() => { setSubs([]); setTotal(0); });
  };

  useEffect(() => { loadSubs(status); /* eslint-disable-next-line */ }, [status]);

  const work = async (row, next) => {
    try {
      await updateContactSubmission(row.id, { status: next, handled_note: note });
      say(next === "closed" ? "Enquiry closed." : "Enquiry updated.");
      setOpen(null); setNote("");
      loadSubs();
      getForms().then((d) => setForms(d.results || [])).catch(() => {});
    } catch { say("Couldn't update that."); }
  };

  const contact = (forms || []).find((f) => f.key === "contact");

  return (
    <div className="fm">
      <header>
        <h1 className="fm__h1">Forms</h1>
        <p className="fm__sub">
          Every form on the public site, what it asks for, and where the
          answers end up.
        </p>
      </header>

      {failed && (
        <div className="fm__failed" role="status">
          Couldn't load the form list — this page may be incomplete.
        </div>
      )}

      <section className="fm__grid">
        {(forms || []).map((f) => (
          <article key={f.key} className="fm__card">
            <div className="fm__card-top">
              <h2 className="fm__name">{f.name}</h2>
              {f.counts?.new > 0 && <span className="fm__new">{f.counts.new} new</span>}
            </div>
            <p className="fm__where">{f.where}</p>
            <p className="fm__fields">{(f.fields || []).join(" · ")}</p>
            <div className="fm__dest">
              <span className="fm__dest-label">Answers go to</span>
              {/* A form owned elsewhere links there. Duplicating its inbox
                  here would create two places to action the same thing. */}
              {f.url ? (
                <Link className="fm__dest-link" to={f.url}>
                  {f.destination} <ArrowUpRight size={13} aria-hidden="true" />
                </Link>
              ) : (
                <span className="fm__dest-here">{f.destination}</span>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="fm__inbox">
        <div className="fm__inbox-head">
          <h2 className="fm__h2">
            <Inbox size={17} aria-hidden="true" /> Contact enquiries
          </h2>
          <div className="fm__tabs">
            {STATUSES.map(([v, label]) => (
              <button
                key={v || "all"}
                className={`fm__tab${status === v ? " fm__tab--on" : ""}`}
                onClick={() => setStatus(v)}
              >
                {label}
                {v === "new" && contact?.counts?.new > 0 && (
                  <span className="fm__tab-count">{contact.counts.new}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {subs === null ? (
          <p className="fm__sub">Loading…</p>
        ) : subs.length === 0 ? (
          <div className="fm__empty">
            <strong>Nothing here.</strong>
            <p>
              {status === "new"
                ? "No unanswered enquiries — everything has been picked up."
                : "No enquiries with that status."}
            </p>
          </div>
        ) : (
          <>
            {/* The list is capped server-side; say so rather than implying
                this is everything. */}
            {total > subs.length && (
              <p className="fm__capped">
                Showing {subs.length} of {total} — narrow the filter to see the rest.
              </p>
            )}
            <ul className="fm__list">
              {subs.map((s) => (
                <li key={s.id} className={`fm__row fm__row--${s.status}`}>
                  <div className="fm__row-head">
                    <div>
                      <strong className="fm__row-name">{s.name}</strong>
                      <span className="fm__row-meta">
                        {s.role_label} · {s.topic_label} · {when(s.created_at)}
                      </span>
                    </div>
                    <span className={`fm__pill fm__pill--${s.status}`}>
                      {s.status.replace("_", " ")}
                    </span>
                  </div>

                  <p className="fm__msg">{s.message}</p>

                  <p className="fm__contact-at">
                    <a href={`mailto:${s.email}`}>{s.email}</a>
                    {s.phone && <> · <a href={`tel:${s.phone}`}>{s.phone}</a></>}
                  </p>

                  {s.handled_note && (
                    <p className="fm__note-saved">Note: {s.handled_note}</p>
                  )}

                  {open === s.id ? (
                    <div className="fm__work">
                      <input
                        className="fm__input"
                        autoFocus
                        placeholder="What did you do? (saved with the enquiry)"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                      <button className="fm__btn" onClick={() => work(s, "in_progress")}>
                        Mark in progress
                      </button>
                      <button className="fm__btn fm__btn--done" onClick={() => work(s, "closed")}>
                        Close
                      </button>
                      <button className="fm__btn fm__btn--ghost"
                        onClick={() => { setOpen(null); setNote(""); }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    s.status !== "closed" && (
                      <button
                        className="fm__btn fm__btn--ghost"
                        onClick={() => { setOpen(s.id); setNote(s.handled_note || ""); }}
                      >
                        Handle this
                      </button>
                    )
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <Toast message={toast} />
    </div>
  );
}
