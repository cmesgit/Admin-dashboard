/**
 * /content/redirects — the artboard's "SEO and redirects" screen.
 * design_handoff_admin_counsellor, Admin v2 Phase 5.
 *
 * WHAT THIS ACTUALLY FIXES. `Course.slug` is derived from the title on first
 * save and never re-derived on rename, so renaming a course silently kills
 * every link to it that has already been shared. Until now an admin had no
 * way to repair that.
 *
 * ⚠ These are CLIENT-SIDE redirects. nginx serves index.html for every
 * unmatched path, so Django never sees a dead SPA URL — the public site's
 * catch-all 404 asks the resolver before rendering. They fix the visitor
 * experience; they are not a 301 from the origin and do not pass PageRank.
 * The screen says so, because an admin who believes otherwise will wonder
 * why search rankings never move.
 *
 * ⚠ `react-hot-toast` does not exist in this app. The convention is local
 * state cleared on a timer, rendered by components/Toast.jsx.
 */
import { useEffect, useState } from "react";
import { ArrowRight, ExternalLink, Trash2 } from "lucide-react";
import {
  createRedirect, deleteRedirect, getRedirects, updateRedirect,
} from "../../api/admin_redirects";
import Toast from "../../components/Toast";
import "../../css/Redirects.css";

const BLANK = { from_path: "", to_path: "", permanent: true, note: "" };

const isOffsite = (p) => /^https?:\/\//i.test(p || "");

export default function Redirects() {
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const say = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  const load = (term = q) => {
    getRedirects(term)
      .then((d) => { setRows(d.results || []); setFailed(false); })
      // ⚠ Never render "no redirects yet" for a failed request — an outage
      // would read as "nothing is configured", which is the exact wrong
      // conclusion on this screen.
      .catch(() => { setFailed(true); setRows([]); });
  };

  useEffect(() => { load(""); /* eslint-disable-next-line */ }, []);

  const submit = async () => {
    setBusy(true); setErrors({});
    try {
      await createRedirect(form);
      setForm(BLANK);
      say("Redirect added.");
      load();
    } catch (err) {
      // The server returns per-field messages — which half is wrong matters
      // on a two-field form.
      const data = err?.response?.data;
      setErrors(typeof data === "object" && data ? data : { to_path: "Couldn't save." });
    } finally { setBusy(false); }
  };

  const toggle = async (row) => {
    try {
      await updateRedirect(row.id, { is_active: !row.is_active });
      say(row.is_active ? "Redirect paused." : "Redirect live.");
      load();
    } catch { say("Couldn't change that."); }
  };

  const remove = async (row) => {
    if (!window.confirm(
      `Delete the redirect from ${row.from_path}?\n\n` +
      `Anyone following that old link will get a 404 again.`)) return;
    try { await deleteRedirect(row.id); say("Redirect deleted."); load(); }
    catch { say("Couldn't delete that."); }
  };

  return (
    <div className="rdr">
      <header className="rdr__head">
        <div>
          <h1 className="rdr__h1">Redirects</h1>
          <p className="rdr__sub">
            Send an old link somewhere that still exists. Useful after a
            rename — a course keeps its original slug when you retitle it, so
            links shared before the rename stop working.
          </p>
        </div>
      </header>

      {/* Stated up front rather than discovered later. */}
      <p className="rdr__note">
        These run in the visitor's browser when a page isn't found. They fix
        broken links for people; they are not server-side 301s and won't move
        search rankings.
      </p>

      <section className="rdr__add">
        <div className="rdr__field">
          <label className="rdr__label" htmlFor="rdr-from">Old path</label>
          <input
            id="rdr-from"
            className={`rdr__input${errors.from_path ? " rdr__input--bad" : ""}`}
            placeholder="/courses/old-name"
            value={form.from_path}
            onChange={(e) => setForm({ ...form, from_path: e.target.value })}
          />
          {errors.from_path && <span className="rdr__err">{String(errors.from_path)}</span>}
        </div>

        <ArrowRight className="rdr__arrow" size={16} aria-hidden="true" />

        <div className="rdr__field">
          <label className="rdr__label" htmlFor="rdr-to">Send to</label>
          <input
            id="rdr-to"
            className={`rdr__input${errors.to_path ? " rdr__input--bad" : ""}`}
            placeholder="/courses/new-name — or a full https:// URL"
            value={form.to_path}
            onChange={(e) => setForm({ ...form, to_path: e.target.value })}
          />
          {errors.to_path && <span className="rdr__err">{String(errors.to_path)}</span>}
        </div>

        <label className="rdr__perm" title="A permanent move, rather than a temporary detour">
          <input
            type="checkbox"
            checked={form.permanent}
            onChange={(e) => setForm({ ...form, permanent: e.target.checked })}
          />
          Permanent
        </label>

        <button
          className="rdr__add-btn"
          disabled={busy || !form.from_path.trim() || !form.to_path.trim()}
          onClick={submit}
        >
          {busy ? "Adding…" : "Add redirect"}
        </button>
      </section>

      <div className="rdr__search">
        <input
          className="rdr__input"
          placeholder="Search redirects…"
          value={q}
          onChange={(e) => { setQ(e.target.value); load(e.target.value); }}
        />
      </div>

      {failed && (
        <div className="rdr__failed" role="status">
          Couldn't load the redirects — this list may be incomplete.
        </div>
      )}

      {rows === null ? (
        <p className="rdr__sub">Loading…</p>
      ) : rows.length === 0 && !failed ? (
        <div className="rdr__empty">
          <strong>No redirects yet.</strong>
          <p>Add one when a page moves, or when you rename something that
            people have already linked to.</p>
        </div>
      ) : (
        <div className="adm-table-card">
          <div className="adm-count">{rows.length} redirect{rows.length !== 1 ? "s" : ""}</div>
          <table className="adm-table adm-table--wide">
            <thead>
              <tr>
                <th>Old path</th>
                <th>Sends to</th>
                <th>Kind</th>
                <th>Used</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><code className="rdr__path">{r.from_path}</code></td>
                  <td>
                    <code className="rdr__path">{r.to_path}</code>
                    {isOffsite(r.to_path) && (
                      <ExternalLink size={12} aria-label="off-site" className="rdr__ext" />
                    )}
                  </td>
                  <td>{r.permanent ? "Permanent" : "Temporary"}</td>
                  {/* Evidence the rule is earning its place: a rule with no
                      hits a year after a rename can be retired. */}
                  <td>{r.hits > 0 ? `${r.hits}×` : "—"}</td>
                  <td>
                    <button
                      className={`rdr__pill${r.is_active ? " rdr__pill--on" : ""}`}
                      onClick={() => toggle(r)}
                    >
                      {r.is_active ? "Live" : "Paused"}
                    </button>
                  </td>
                  <td>
                    <button className="rdr__del" onClick={() => remove(r)} aria-label="Delete">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
}
