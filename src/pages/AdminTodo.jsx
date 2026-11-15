/**
 * Admin v2 Home — "N things are waiting for you".
 * design_handoff_admin_counsellor Phase 2.
 *
 * Replaces Overview as the Home area's screen when admin_v2_enabled is on.
 * Overview itself is NOT deleted and stays at `/` behind the flag — the stats
 * tiles, payment-mode card and "Live now" panel have no counterpart here yet.
 *
 * ⚠ WHAT THIS SCREEN DOES NOT DO, AND WHY.
 * The artboard shows each waiting item as a ROW — "Meera Gokhale · Chemistry ·
 * All uploaded" — with Approve / Decline buttons inline. This renders the
 * COUNTS and sends you to the screen that already resolves each kind.
 *
 * That is a deliberate split, not an abandoned half. Inline approval spans
 * sixteen different endpoints across ten apps, each with its own permission
 * rule and its own confirm semantics — approving a teacher, voiding a flagged
 * exam and removing a reported chat message are not the same verb. Getting one
 * of them subtly wrong means approving the wrong person from a screen that
 * looked like a list. The rows and their actions are the next phase; the
 * counts are correct and useful now.
 *
 * ⚠ `safe()`-style failure handling matters here (CLAUDE.md rule 24): if the
 * request fails this says so. A queue screen that renders "all clear" because
 * the backend is down is the worst possible lie for this particular screen.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { getAdminQueue } from "../api/admin_queue";
import { actOnApproval, actOnEnrollmentRequest, reviewSkillCourse } from "../api/admin";
import { actOnCounselorApplication } from "../api/admin_counseling";
import "../css/AdminTodo.css";

/** Which call resolves each inline-actionable kind.
 *
 *  ⚠ These REUSE the exact functions the dedicated screens already call —
 *  `Approvals.jsx`, `EnrollmentRequests.jsx` and `SkillCourses.jsx` — rather
 *  than posting to the same URLs a second way. One caller per endpoint means
 *  a change to the contract breaks in one place, not two.
 *
 *  ⚠ The server decides WHICH kinds appear here, via `can_act` on the group
 *  (see dashboard/admin_queue.py's _INLINE_ACTIONABLE). The criterion is that
 *  the endpoint re-checks the row is still pending and refuses a second
 *  click. Do not add a kind to this map without the server agreeing — an
 *  entry here with `can_act` false simply never renders, which is the
 *  intended fail-safe direction.
 */
const ACTIONS = {
  teacher: {
    approve: (id) => actOnApproval(id, "approve"),
    decline: (id, reason) => actOnApproval(id, "reject", reason),
    noun: "application",
  },
  admission: {
    approve: (id) => actOnEnrollmentRequest(id, "approve"),
    decline: (id, reason) => actOnEnrollmentRequest(id, "reject", reason),
    noun: "admission request",
  },
  skill_course: {
    approve: (id) => reviewSkillCourse(id, "approve"),
    decline: (id, reason) => reviewSkillCourse(id, "reject", reason),
    noun: "course",
  },
  counsellor: {
    // ⚠ `id` here is the CounselorProfile pk, which is what the row carries
    // and what the endpoint takes — NOT the User pk. Both are ints, so a
    // mix-up would action a real but different applicant instead of 404ing.
    approve: (id) => actOnCounselorApplication(id, "approve"),
    decline: (id, reason) => actOnCounselorApplication(id, "reject", reason),
    noun: "application",
  },
};

/** How long something has been sitting there, in words.
 *
 *  The server sends `at` as an ISO string or null. Null means that kind has
 *  no timestamp field to read — TeacherProfile has none, for instance — and
 *  the row simply omits the age rather than inventing one from `now`.
 */
const waitingFor = (iso) => {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d` : `${Math.floor(days / 30)}mo`;
};

const AdminTodo = () => {
  const [state, setState] = useState({ status: "loading", data: null });
  const [filter, setFilter] = useState(null);
  // Which row is mid-request, which row is being declined (its reason box is
  // open), and the last outcome message. Keyed `${kind}:${id}` so two rows of
  // different kinds can never collide on a shared pk.
  const [busy, setBusy] = useState(null);
  const [declining, setDeclining] = useState(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState(null);

  const fetchQueue = (signal) =>
    getAdminQueue({ signal })
      .then((data) => setState({ status: "ready", data }))
      .catch((err) => {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
        setState((s) => ({ ...s, status: "failed" }));
      });

  // The effect body must not setState synchronously — initial state is already
  // "loading", so there is nothing to mark. The manual refresh below does need
  // to flag itself, which is why the two are separate rather than one `load`.
  useEffect(() => {
    const ac = new AbortController();
    fetchQueue(ac.signal);
    return () => ac.abort();
  }, []);

  const load = () => {
    setState((s) => ({ ...s, status: s.data ? "refreshing" : "loading" }));
    fetchQueue(undefined);
  };

  /** Run one inline decision, then re-read the queue.
   *
   *  ⚠ ALWAYS refetches, including on failure. The four endpoints behind
   *  this each refuse a second click — teacher and skill-course with a 404,
   *  admission with a 400 "already been reviewed", counsellor with a 400 from
   *  its transition table — which is exactly what a colleague having just
   *  actioned the same row looks like. Treating that as an error and leaving
   *  the stale row on screen would invite a third click. Refetching makes the
   *  row disappear, which is the truth.
   */
  const decide = async (group, item, verb) => {
    const key = `${group.kind}:${item.id}`;
    const spec = ACTIONS[group.kind];
    if (!spec || !item.id || busy) return;

    setBusy(key);
    setNotice(null);
    try {
      await (verb === "approve"
        ? spec.approve(item.id)
        : spec.decline(item.id, reason.trim()));
      setNotice({
        tone: "ok",
        text: `${item.title} — ${verb === "approve" ? "approved" : "declined"}.`,
      });
    } catch (err) {
      const code = err?.response?.status;
      // Prefer the server's own refusal when it sent one. The counsellor
      // endpoint says WHICH state the row is in and what to do instead
      // ("already approved — suspend them first"), which is strictly more
      // use than the generic line; the other three send a sentence too.
      const detail = err?.response?.data?.detail;
      setNotice(
        code === 404 || code === 400
          ? {
              tone: "warn",
              text: `${detail || `That ${spec.noun} was already dealt with.`} The list has been refreshed.`,
            }
          : { tone: "warn", text: `Couldn't complete that — ${err?.message || "please try again"}.` }
      );
    } finally {
      setBusy(null);
      setDeclining(null);
      setReason("");
      fetchQueue(undefined);
    }
  };

  const { status, data } = state;

  if (status === "loading") {
    return (
      <div className="todo">
        <h1 className="todo__h1">Loading your queue…</h1>
      </div>
    );
  }

  // Never render an empty state for a failed request — see the header note.
  if (status === "failed" && !data) {
    return (
      <div className="todo">
        <h1 className="todo__h1">Couldn't load your queue</h1>
        <p className="todo__sub">
          The list of things waiting for you couldn't be fetched, so this page
          can't tell you whether there is anything to do.
        </p>
        <button type="button" className="todo__retry" onClick={load}>
          <RefreshCw size={15} aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }

  const groups = data?.groups || [];
  const shown = filter ? groups.filter((g) => g.kind === filter) : groups;

  return (
    <div className="todo">
      <header className="todo__head">
        <div>
          <h1 className="todo__h1">
            {data.total === 0
              ? "Nothing is waiting for you"
              : `${data.total} ${data.total === 1 ? "thing is" : "things are"} waiting for you`}
          </h1>
          <p className="todo__sub">
            {data.total === 0
              ? "Every queue across the console is clear."
              : "Grouped by what it is. Open a group to deal with it."}
          </p>
        </div>
        <button
          type="button"
          className="todo__retry"
          onClick={load}
          disabled={status === "refreshing"}
        >
          <RefreshCw size={15} aria-hidden="true" />
          {status === "refreshing" ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {notice && (
        <div className={`todo__notice todo__notice--${notice.tone}`} role="status">
          {notice.text}
        </div>
      )}

      {groups.length > 0 && (
        <div className="todo__chips">
          <button
            type="button"
            className={`todo__chip${filter === null ? " is-on" : ""}`}
            onClick={() => setFilter(null)}
          >
            All {data.total}
          </button>
          {groups.map((g) => (
            <button
              key={g.kind}
              type="button"
              className={`todo__chip${filter === g.kind ? " is-on" : ""}`}
              onClick={() => setFilter(filter === g.kind ? null : g.kind)}
            >
              {g.label} {g.count}
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="todo__clear">
          <CheckCircle2 size={22} aria-hidden="true" />
          <div>
            <strong>All clear.</strong>
            <p>
              Nothing across teachers, counsellors, admissions, questions,
              scholarship, the help desk, the website or research needs a
              decision right now.
            </p>
          </div>
        </div>
      ) : (
        <div className="todo__groups">
          {shown.map((g) => {
            const items = g.items || [];
            const more = g.count - items.length;
            return (
              <section key={g.kind} className="todo__group">
                <header className="todo__row">
                  <span className="todo__kind">{g.label}</span>
                  <span className="todo__where">{g.where}</span>
                  <span className="todo__count">{g.count}</span>
                  <Link className="todo__open" to={g.url}>
                    Open
                  </Link>
                </header>

                {items.length > 0 && (
                  <ul className="todo__items">
                    {items.map((it, i) => {
                      const key = `${g.kind}:${it.id}`;
                      // Both halves must agree: the server says the kind is
                      // safe to action inline, and the row carries an id.
                      const actionable = g.can_act && !!it.id && ACTIONS[g.kind];
                      const isDeclining = declining === key;
                      return (
                        <li className="todo__item" key={`${g.kind}-${i}`}>
                          <span className="todo__item-title">{it.title}</span>
                          {it.subtitle && (
                            <span className="todo__item-sub">{it.subtitle}</span>
                          )}
                          {it.at && (
                            <span className="todo__item-at">{waitingFor(it.at)}</span>
                          )}

                          {actionable && !isDeclining && (
                            <span className="todo__acts">
                              <button
                                type="button"
                                className="todo__act todo__act--yes"
                                disabled={busy === key}
                                onClick={() => decide(g, it, "approve")}
                              >
                                {busy === key ? "Working…" : "Approve"}
                              </button>
                              <button
                                type="button"
                                className="todo__act"
                                disabled={!!busy}
                                onClick={() => { setDeclining(key); setReason(""); }}
                              >
                                Decline
                              </button>
                            </span>
                          )}

                          {/* Declining asks for a reason before it will go.
                              All three endpoints treat it as optional, but a
                              decision the person never gets an explanation
                              for is a support ticket waiting to happen. */}
                          {actionable && isDeclining && (
                            <span className="todo__decline">
                              <input
                                className="todo__reason"
                                autoFocus
                                placeholder="Why? (they will see this)"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                              />
                              <button
                                type="button"
                                className="todo__act todo__act--no"
                                disabled={busy === key || !reason.trim()}
                                onClick={() => decide(g, it, "decline")}
                              >
                                {busy === key ? "Working…" : "Confirm decline"}
                              </button>
                              <button
                                type="button"
                                className="todo__act"
                                disabled={busy === key}
                                onClick={() => { setDeclining(null); setReason(""); }}
                              >
                                Cancel
                              </button>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* `items` is a capped preview, `count` is the truth. Saying so
                    stops the list reading as "that's all of them". */}
                {more > 0 && (
                  <Link className="todo__more" to={g.url}>
                    and {more} more →
                  </Link>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Not an error and not a zero — these kinds exist but belong to someone
          else. Saying so beats silently omitting them. */}
      {data.unavailable?.length > 0 && (
        <div className="todo__note">
          <AlertCircle size={15} aria-hidden="true" />
          <span>
            {data.unavailable.length === 1 ? "One queue is" : `${data.unavailable.length} queues are`}{" "}
            hidden because your account can't act on them
            {data.unavailable[0]?.reason ? ` — ${data.unavailable[0].reason}` : "."}
          </span>
        </div>
      )}
    </div>
  );
};

export default AdminTodo;
