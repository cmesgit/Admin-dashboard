// Navbar mega-menu curation.
//
// The Courses menu has always been DERIVED from the catalogue — board tabs
// and their classes for School, competitive-tagged courses for Competitive —
// which is why it has never needed editing and has never been wrong. It also
// means it cannot be curated: no hiding, no reordering, and nothing at all
// for "Skill & Career", which was hardcoded in the public app's Navbar.jsx.
//
// ⚠ REPLACE, PER COLUMN. A column with no active links keeps the derived
// menu exactly as it is today. Add one link and you own that column
// outright. The screen has to SAY that at the point of decision, because the
// moment of taking over is invisible otherwise — hence "Take over" rather
// than a bare "Add link" on an untouched column, and hence "Start from
// what's showing now", which copies the live menu into editable rows so the
// first edit is a small one instead of retyping a correct menu.
//
// ⚠ Moderator.css is imported ON PURPOSE — `.mod-toast` is defined only
// there, and every route is its own lazy chunk (see LiveTicker.jsx).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Menu } from "lucide-react";
import {
  adoptNavMenu, createNavMenuLink, deleteNavMenuLink, getNavMenu,
  reorderNavMenu, updateNavMenuLink,
} from "../../api/admin_content_studio";
import { errText } from "../../utils/errText";
import Toast from "../../components/Toast";
import "../../css/ContentStudio.css";
import "../../css/Moderator.css";

/** What a link points at, in words an admin can act on. */
const destinationOf = (row, courses) => {
  if (row.soon) return "Shown as “Coming Soon” — not clickable";
  if (row.course) {
    const c = courses.find((x) => x.id === row.course);
    if (!c) return "Course no longer exists";
    return `Course: ${c.title}`;
  }
  return row.href || "No destination";
};

/* A DRAFT or ARCHIVED course is not on the public site, so a menu row
 * pointing at one is a link to a 404. Worth saying on the row rather than
 * leaving it to be discovered by a visitor. */
const isDeadCourse = (row, courses) => {
  if (!row.course || row.soon) return false;
  const c = courses.find((x) => x.id === row.course);
  return !c || c.status !== "PUBLISHED";
};

const blankRow = (group) => ({
  group, heading: "", label: "", course: null, href: "", soon: false,
});


const LinkForm = ({ draft, setDraft, courses, onSave, onCancel, busy, error }) => (
  <form
    className="cs-card cs-navmenu__form"
    onSubmit={(e) => { e.preventDefault(); onSave(); }}
  >
    {error && <p className="cs-error" role="alert">{error}</p>}

    <label className="cs-field">
      <span className="cs-field__label">What it says</span>
      <input
        className="cs-input"
        value={draft.label}
        maxLength={60}
        autoFocus
        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
      />
      <span className="cs-field__hint">The words a visitor reads in the menu.</span>
    </label>

    <label className="cs-field">
      <span className="cs-field__label">Group it under (optional)</span>
      <input
        className="cs-input"
        value={draft.heading}
        maxLength={60}
        placeholder="e.g. National Boards"
        onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
      />
      <span className="cs-field__hint">
        Links sharing a heading appear together. Leave blank for a flat list.
      </span>
    </label>

    <label className="cs-field">
      <span className="cs-field__label">Goes to a course</span>
      <select
        className="cs-input"
        value={draft.course || ""}
        disabled={draft.soon || !!draft.href}
        onChange={(e) => setDraft({
          ...draft, course: e.target.value || null, href: "",
        })}
      >
        <option value="">— pick a course —</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}{c.status !== "PUBLISHED" ? ` (${c.status.toLowerCase()})` : ""}
          </option>
        ))}
      </select>
      <span className="cs-field__hint">
        Preferred: the link follows the course even if it is renamed.
      </span>
    </label>

    <label className="cs-field">
      <span className="cs-field__label">…or goes to a page</span>
      <input
        className="cs-input"
        value={draft.href}
        maxLength={300}
        disabled={draft.soon || !!draft.course}
        placeholder="/skill/browse"
        onChange={(e) => setDraft({
          ...draft, href: e.target.value, course: null,
        })}
      />
      <span className="cs-field__hint">
        Use for anything that isn’t a course. One or the other, not both.
      </span>
    </label>

    <label className="cs-check">
      <input
        type="checkbox"
        checked={draft.soon}
        onChange={(e) => setDraft({
          ...draft, soon: e.target.checked,
          ...(e.target.checked ? { course: null, href: "" } : {}),
        })}
      />
      <span>Show as “Coming Soon” — visible, greyed out, not clickable</span>
    </label>

    <div className="cs-navmenu__formactions">
      <button type="button" className="cs-btn-ghost" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className="cs-btn-primary cs-btn-primary--sm" disabled={busy}>
        {busy ? "Saving…" : "Save link"}
      </button>
    </div>
  </form>
);


const NavMenu = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState("school");
  const [editing, setEditing] = useState(null);   // { group, id? } | null
  const [draft, setDraft] = useState(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const dragRef = useRef(null);

  const say = useCallback((m, tone = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ message: m, tone });
    toastTimer.current = setTimeout(
      () => setToast(null), tone === "error" ? 7000 : 2600,
    );
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* `quiet` skips the loading flag. The whole screen early-returns "Loading…"
   * otherwise, which unmounts the open form and throws away what was typed —
   * the trap NewExamDialog hit. */
  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      setData(await getNavMenu());
      setError("");
    } catch (e) {
      setError(errText(e));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const courses = data?.courses || [];
  const groups = useMemo(() => data?.groups || [], [data]);
  const current = groups.find((g) => g.key === open) || null;

  const startAdd = (group) => {
    setFormError("");
    setEditing({ group });
    setDraft(blankRow(group));
  };

  const startEdit = (row) => {
    setFormError("");
    setEditing({ group: row.group, id: row.id });
    setDraft({
      group: row.group, heading: row.heading, label: row.label,
      course: row.course, href: row.href, soon: row.soon,
    });
  };

  const save = async () => {
    setBusy("form");
    setFormError("");
    try {
      if (editing.id) {
        await updateNavMenuLink(editing.id, draft);
      } else {
        await createNavMenuLink(draft);
      }
      setEditing(null);
      setDraft(null);
      await load({ quiet: true });
      say("Saved. The menu updates immediately.");
    } catch (e) {
      setFormError(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (row) => {
    setBusy(row.id);
    try {
      await deleteNavMenuLink(row.id);
      await load({ quiet: true });
      say(
        current && current.rows.length === 1
          ? "Removed. This column is back to listing your catalogue automatically."
          : "Removed.",
      );
    } catch (e) {
      say(errText(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async (row) => {
    setBusy(row.id);
    try {
      await updateNavMenuLink(row.id, { is_active: !row.is_active });
      await load({ quiet: true });
    } catch (e) {
      say(errText(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const adopt = async (group) => {
    setBusy("adopt");
    try {
      const res = await adoptNavMenu(group);
      await load({ quiet: true });
      say(res?.detail || "Copied. Visitors see no change yet.");
    } catch (e) {
      say(errText(e), "error");
    } finally {
      setBusy(null);
    }
  };

  /* Drag-reorder, optimistic with revert. The server refuses a partial list,
   * so the full column always goes over the wire. */
  const drop = async (group, targetId) => {
    const from = dragRef.current;
    dragRef.current = null;
    if (!from || from === targetId) return;
    const col = groups.find((g) => g.key === group);
    if (!col) return;

    const ids = col.rows.map((r) => r.id);
    const next = ids.filter((id) => id !== from);
    next.splice(next.indexOf(targetId), 0, from);

    const before = data;
    const order = new Map(next.map((id, i) => [id, i]));
    setData({
      ...data,
      groups: groups.map((g) => (g.key !== group ? g : {
        ...g, rows: [...g.rows].sort((a, b) => order.get(a.id) - order.get(b.id)),
      })),
    });
    try {
      await reorderNavMenu(group, next);
    } catch (e) {
      setData(before);
      say(errText(e), "error");
    }
  };

  if (loading) return <p className="cs-muted">Loading…</p>;
  if (error) return <p className="cs-error" role="alert">{error}</p>;

  return (
    <div className="cs-editor">
      <header className="cs-publishbar">
        <div className="cs-publishbar__id">
          <span className="cs-publishbar__name">Courses menu</span>
          <span className="cs-publishbar__url">
            The three columns of the Courses dropdown on the public site.
          </span>
        </div>
      </header>

      <div className="cs-editor__body">
        <aside className="cs-sectionlist">
          <p className="cs-sectionlist__label">Columns</p>
          {groups.map((g) => (
            <button
              key={g.key}
              type="button"
              className={`cs-sectionrow${open === g.key ? " is-selected" : ""}`}
              onClick={() => { setOpen(g.key); setEditing(null); }}
            >
              <span>{g.label}</span>
              <span className={`cs-chip ${g.curated ? "cs-tone-info" : "cs-tone-muted"}`}>
                {g.curated ? `${g.rows.filter((r) => r.is_active).length} chosen` : "Automatic"}
              </span>
            </button>
          ))}
          <p className="cs-sectionlist__note">
            “Automatic” means the column lists your catalogue on its own and
            stays correct without anyone editing it. Choosing links takes that
            over for that column only — remove them all and it goes back.
          </p>
        </aside>

        <main className="cs-fields">
          {current && (
            <>
              <div className="cs-navmenu__head">
                <div>
                  <h2 className="cs-fields__title">{current.label}</h2>
                  <p className="cs-muted">
                    {current.curated
                      ? "You’re choosing what appears here. Your catalogue is ignored for this column."
                      : "Listing your catalogue automatically. Nothing here needs attention."}
                  </p>
                </div>
                <div className="cs-navmenu__headactions">
                  {!current.rows.length && current.derived.length > 0 && (
                    <button
                      type="button"
                      className="cs-btn-ghost"
                      disabled={busy === "adopt"}
                      onClick={() => adopt(current.key)}
                    >
                      Start from what’s showing now
                    </button>
                  )}
                  <button
                    type="button"
                    className="cs-btn-primary cs-btn-primary--sm"
                    onClick={() => startAdd(current.key)}
                  >
                    {current.curated ? "Add a link" : "Take over this column"}
                  </button>
                </div>
              </div>

              {editing?.group === current.key && draft && (
                <LinkForm
                  draft={draft}
                  setDraft={setDraft}
                  courses={courses}
                  busy={busy === "form"}
                  error={formError}
                  onSave={save}
                  onCancel={() => { setEditing(null); setDraft(null); }}
                />
              )}

              {current.rows.length > 0 && (
                <div className="cs-card cs-card--flush">
                  {current.rows.map((row) => (
                    <div
                      className={`cs-qrow${row.is_active ? "" : " is-dim"}`}
                      key={row.id}
                      draggable
                      onDragStart={() => { dragRef.current = row.id; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => drop(current.key, row.id)}
                    >
                      <GripVertical
                        size={16}
                        className="cs-qrow__grip"
                        aria-hidden="true"
                      />
                      <div className="cs-qrow__text">
                        <span className="cs-qrow__title">{row.label}</span>
                        <span className="cs-qrow__body">
                          {destinationOf(row, courses)}
                        </span>
                        <span className="cs-steps">
                          {row.heading && (
                            <span className="cs-chip cs-tone-muted">
                              Under “{row.heading}”
                            </span>
                          )}
                          {row.soon && (
                            <span className="cs-chip cs-tone-warn">Coming soon</span>
                          )}
                          {isDeadCourse(row, courses) && (
                            <span className="cs-chip cs-tone-danger">
                              Not on the public site — this link goes nowhere
                            </span>
                          )}
                          {!row.is_active && (
                            <span className="cs-chip cs-tone-muted">Hidden</span>
                          )}
                        </span>
                      </div>
                      <div className="cs-qrow__spacer" />
                      <button
                        type="button"
                        role="switch"
                        aria-checked={row.is_active}
                        aria-label={`${row.is_active ? "Hide" : "Show"} “${row.label}”`}
                        className={`cs-switch${row.is_active ? " is-on" : ""}`}
                        disabled={busy === row.id}
                        onClick={() => toggleActive(row)}
                      >
                        <span className="cs-switch__knob" />
                      </button>
                      <button
                        type="button"
                        className="cs-btn-ghost"
                        onClick={() => startEdit(row)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="cs-btn-ghost cs-btn-ghost--danger"
                        disabled={busy === row.id}
                        onClick={() => remove(row)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* What visitors see right now, whichever mode the column is
                  in. On an automatic column this IS the menu; on a curated
                  one it is what was replaced, which is the only way to tell
                  what curation dropped. */}
              {current.derived.length > 0 && (
                <section className="cs-navmenu__derived">
                  <h3 className="cs-fields__subtitle">
                    {current.curated
                      ? "What your catalogue would show instead"
                      : "Showing to visitors right now"}
                  </h3>
                  {current.derived.map((sec, i) => (
                    <div key={`${sec.heading}-${i}`} className="cs-navmenu__dgroup">
                      {sec.heading && (
                        <p className="cs-navmenu__dheading">{sec.heading}</p>
                      )}
                      <p className="cs-muted">
                        {sec.links.map((l) => l.label).join(" · ")}
                      </p>
                    </div>
                  ))}
                </section>
              )}

              {!current.rows.length && !current.derived.length && (
                <div className="cs-empty">
                  <Menu size={20} aria-hidden="true" />
                  <p>
                    This column has no menu of its own yet — the public site
                    shows a fixed list until you choose one here.
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default NavMenu;
