// Labels (design_handoff_content_studio Phase 7).
//
// One screen over two models in two Django apps: content.ContentTag (blog
// tags) and courses.CourseCategory (what the catalog and navbar browse by).
// The TABLES stay separate — merging them would touch the public blog filters,
// the navbar and the catalog for a cosmetic win, and no single migration owns
// both apps.
//
// ⚠ CourseCategory.group is load-bearing: the `competitive` group is what puts
// the seven competitive exams in the navbar at all. The server refuses a merge
// across groups and a delete that would empty one; this screen surfaces those
// refusals rather than hiding them behind a generic error.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Merge, Plus, Search, Tag } from "lucide-react";
import {
  createLabel, deleteLabel, getLabels, mergeLabels, renameLabel,
} from "../../api/admin_content_studio";
import { errText } from "../../utils/errText";
import Toast from "../../components/Toast";
import "../../css/ContentStudio.css";

// "used on 1 courses" reads as a bug even though the number is right. The
// server sends a plural noun; this trims it when the count is one.
const singular = (n, noun) => {
  if (n !== 1) return noun;
  if (noun === "posts and articles") return "post or article";
  return noun.replace(/s$/, "");
};

const Labels = () => {
  const [rows, setRows] = useState([]);
  const [dupeCount, setDupeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [merging, setMerging] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [creating, setCreating] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const say = useCallback((m) => {
    clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const load = useCallback(async (term, { signal } = {}) => {
    setLoading(true);
    try {
      const data = await getLabels(term, { signal });
      setRows(data.results || []);
      setDupeCount(data.duplicate_count || 0);
      setError("");
    } catch (e) {
      // Expected on every keystroke; only a real failure is worth reporting.
      if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED"
          || e?.name === "AbortError") return;
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Clearing only the timer left in-flight requests racing each other.
    const controller = new AbortController();
    const t = setTimeout(
      () => load(q.trim(), { signal: controller.signal }), q ? 250 : 0,
    );
    return () => { clearTimeout(t); controller.abort(); };
  }, [q, load]);

  const doCreate = async () => {
    const { kind, name, group } = creating;
    if (!name.trim()) return say("Give the label a name.");
    setBusy("new");
    try {
      await createLabel(kind, name.trim(), kind === "category" ? group : undefined);
      say(`Created “${name.trim()}”.`);
      setCreating(null);
      load(q.trim());
    } catch (e) {
      // A case-variant tag is a designed 409, not a failure — the server names
      // the label that already exists.
      say(e?.response?.data?.detail || errText(e));
    } finally {
      setBusy(null);
    }
  };

  const doRename = async () => {
    const { kind, id, value } = renaming;
    if (!value.trim()) return say("Give the label a name.");
    setBusy(id);
    try {
      await renameLabel(kind, id, value.trim());
      say("Renamed everywhere it’s used. Nothing broke.");
      setRenaming(null);
      load(q.trim());
    } catch (e) {
      say(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const doMerge = async () => {
    const { source, targetId } = merging;
    if (!targetId) return say("Pick a label to merge into.");
    setBusy(source.id);
    try {
      const res = await mergeLabels(source.kind, source.id, Number(targetId));
      say(res.detail);
      setMerging(null);
      load(q.trim());
    } catch (e) {
      // A refusal here is the design working: merging across groups would take
      // courses out of the section visitors browse them in.
      say(e?.response?.data?.detail || errText(e));
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async (row) => {
    setBusy(row.id);
    try {
      await deleteLabel(row.kind, row.id);
      say(`Deleted “${row.name}”.`);
      load(q.trim());
    } catch (e) {
      if (e?.response?.status === 409) {
        setBlocked({ row, detail: e.response.data.detail });
      } else {
        say(errText(e));
      }
    } finally {
      setBusy(null);
    }
  };

  // Merge targets: same kind only, never itself. For categories the server
  // also demands the same group, so offering others would only produce a
  // refusal the person could have been spared.
  // Grouped once per data change instead of scanning every row for every other
  // row on every render — the search box re-renders the whole list, so this ran
  // n^2 comparisons per keystroke purely to decide if one button is disabled.
  const targetsByBucket = useMemo(() => {
    const buckets = new Map();
    for (const r of rows) {
      const key = r.kind === "category" ? `category:${r.group}` : r.kind;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(r);
    }
    return buckets;
  }, [rows]);

  const targetsFor = useCallback((row) => {
    const key = row.kind === "category" ? `category:${row.group}` : row.kind;
    return (targetsByBucket.get(key) || []).filter((r) => r.id !== row.id);
  }, [targetsByBucket]);

  return (
    <div className="dashboard-wrapper">
      <div className="cs-home__head">
        <div>
          <h1 className="dashboard-title">Labels</h1>
          <p className="cs-home__sub">
            The words used to group things — tags on posts, and the categories
            visitors browse courses by.
          </p>
        </div>
      </div>

      <div className="cs-pilltabs">
        <div className="cs-searchfield">
          <Search size={14} aria-hidden="true" />
          <input
            className="cs-searchfield__input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search labels…"
            aria-label="Search labels"
          />
        </div>
        <div className="cs-pilltabs__spacer" />
        <button
          type="button"
          className="cs-btn-primary cs-btn-primary--sm"
          onClick={() => setCreating({ kind: "tag", name: "", group: "boards" })}
        >
          <Plus size={14} aria-hidden="true" /> New label
        </button>
        <span className="cs-muted">
          {rows.length} label{rows.length === 1 ? "" : "s"}
          {dupeCount > 0 && (dupeCount === 1
            ? " · 1 looks like a duplicate"
            : ` · ${dupeCount} look like duplicates`)}
        </span>
      </div>

      {loading && <p className="cs-muted">Loading…</p>}
      {error && <p className="cs-error" role="alert">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="cs-empty">
          <Tag size={20} aria-hidden="true" />
          <p>{q ? `Nothing matches “${q}”.` : "No labels yet."}</p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="cs-card cs-card--flush">
          {rows.map((r) => (
            <div key={`${r.kind}-${r.id}`} className="cs-qrow">
              <span className="cs-labelpill">{r.name}</span>

              <span className="cs-chip cs-tone-muted">{r.kind_label}</span>
              {r.group_label && (
                <span className="cs-chip cs-tone-muted">{r.group_label}</span>
              )}

              {r.duplicate_of && (
                <span className="cs-chip cs-tone-warn" title={`Similar to ${r.duplicate_of.name}`}>
                  <AlertTriangle size={11} aria-hidden="true" />
                  looks like a duplicate
                </span>
              )}

              <span className="cs-qrow__spacer" />

              <span className="cs-labelrow__usage">
                {r.usage_count === 0
                  ? "not used yet"
                  : `used on ${r.usage_count} ${singular(r.usage_count, r.usage_label)}`}
              </span>

              <button
                type="button"
                className="cs-btn-ghost"
                onClick={() => setRenaming({ kind: r.kind, id: r.id, value: r.name })}
              >
                Rename
              </button>
              <button
                type="button"
                className="cs-btn-ghost"
                disabled={targetsFor(r).length === 0}
                onClick={() => setMerging({ source: r, targetId: "" })}
              >
                <Merge size={13} aria-hidden="true" /> Merge
              </button>
              <button
                type="button"
                className="cs-btn-ghost"
                disabled={busy === r.id}
                onClick={() => doDelete(r)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="cs-note">
        Renaming a label updates it everywhere it’s used — nothing breaks.
      </p>

      {creating && (
        <div className="cs-palette-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setCreating(null);
        }}>
          <div className="cs-confirm" role="dialog" aria-modal="true">
            <h2 className="cs-card__title">New label</h2>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="new-kind">What kind</label>
              <select
                id="new-kind"
                className="cs-input cs-input--block"
                value={creating.kind}
                onChange={(e) => setCreating((c) => ({ ...c, kind: e.target.value }))}
              >
                <option value="tag">Blog tag — groups posts and articles</option>
                <option value="category">Course category — what visitors browse by</option>
              </select>
            </div>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="new-name">Name</label>
              <input
                id="new-name"
                className="cs-input cs-input--block"
                value={creating.name}
                autoFocus
                onChange={(e) => setCreating((c) => ({ ...c, name: e.target.value }))}
              />
            </div>

            {creating.kind === "category" && (
              <div className="cs-field">
                <label className="cs-field__label" htmlFor="new-group">Which section</label>
                <select
                  id="new-group"
                  className="cs-input cs-input--block"
                  value={creating.group}
                  onChange={(e) => setCreating((c) => ({ ...c, group: e.target.value }))}
                >
                  <option value="boards">Boards</option>
                  <option value="class8-12">Class 8-12</option>
                  <option value="competitive">Competitive</option>
                </select>
                <p className="cs-field__hint">
                  This decides where courses using it appear on the site. It
                  can’t be changed by merging later.
                </p>
              </div>
            )}

            <div className="cs-confirm__actions">
              <button type="button" className="cs-btn-ghost" onClick={() => setCreating(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="cs-btn-primary cs-btn-primary--sm"
                disabled={busy === "new"}
                onClick={doCreate}
              >
                {busy === "new" ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {renaming && (
        <div className="cs-palette-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setRenaming(null);
        }}>
          <div className="cs-confirm" role="dialog" aria-modal="true">
            <h2 className="cs-card__title">Rename label</h2>
            <div className="cs-field">
              <input
                className="cs-input cs-input--block"
                value={renaming.value}
                autoFocus
                onChange={(e) => setRenaming((s) => ({ ...s, value: e.target.value }))}
              />
              <p className="cs-field__hint">
                Everything already using it follows the new name.
              </p>
            </div>
            <div className="cs-confirm__actions">
              <button type="button" className="cs-btn-ghost" onClick={() => setRenaming(null)}>
                Cancel
              </button>
              <button type="button" className="cs-btn-primary cs-btn-primary--sm" onClick={doRename}>
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {merging && (
        <div className="cs-palette-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setMerging(null);
        }}>
          <div className="cs-confirm" role="dialog" aria-modal="true">
            <h2 className="cs-card__title">Merge “{merging.source.name}”</h2>
            <p className="cs-field__hint cs-field__hint--tight">
              Everything using “{merging.source.name}” moves to the label you
              pick, and “{merging.source.name}” is removed.
              {merging.source.usage_count > 0 && (
                <> That affects <strong>{merging.source.usage_count}</strong>{" "}
                  {merging.source.usage_label}.</>
              )}
            </p>

            <div className="cs-field">
              <label className="cs-field__label" htmlFor="merge-into">Merge into</label>
              <select
                id="merge-into"
                className="cs-input cs-input--block"
                value={merging.targetId}
                onChange={(e) => setMerging((s) => ({ ...s, targetId: e.target.value }))}
              >
                <option value="">Pick a label…</option>
                {targetsFor(merging.source).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.usage_count ? ` (${t.usage_count})` : ""}
                  </option>
                ))}
              </select>
              {merging.source.kind === "category" && (
                <p className="cs-field__hint">
                  Only categories in {merging.source.group_label} are offered —
                  moving a course to another section would change where
                  visitors find it.
                </p>
              )}
            </div>

            <div className="cs-confirm__actions">
              <button type="button" className="cs-btn-ghost" onClick={() => setMerging(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="cs-btn-primary cs-btn-primary--sm"
                disabled={!merging.targetId || busy === merging.source.id}
                onClick={doMerge}
              >
                Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {blocked && (
        <div className="cs-palette-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setBlocked(null);
        }}>
          <div className="cs-confirm" role="dialog" aria-modal="true">
            <h2 className="cs-card__title">Still in use</h2>
            <p className="cs-muted">{blocked.detail}</p>
            <div className="cs-confirm__actions">
              <button type="button" className="cs-btn-ghost" onClick={() => setBlocked(null)}>
                Close
              </button>
              <button
                type="button"
                className="cs-btn-primary cs-btn-primary--sm"
                onClick={() => { setMerging({ source: blocked.row, targetId: "" }); setBlocked(null); }}
              >
                Merge it instead
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
};

export default Labels;
