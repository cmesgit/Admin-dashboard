/**
 * design_handoff_admin_counsellor — the Admin v2 chrome.
 *
 * Ten areas on a dark bar + a per-area sub-nav, rendered INSTEAD of the
 * sidebar when GlobalSettings.admin_v2_enabled is on. It owns no data: every
 * count, handler and flag is passed down from AdminLayout, which keeps the
 * single badge-fetching effect both chromes share.
 *
 * ⚠ DELIBERATELY NOT BUILT HERE, though the artboard shows them. Each is a
 * net-new feature, not navigation, and a decorative version of any of them
 * would make the console claim something that isn't true:
 *
 *   • The "29 things are waiting for you" unified queue. Today's three
 *     "Needs attention" cards cover 3 item types between them; the artboard's
 *     queue covers 12 and needs a backend aggregate that does not exist. Home
 *     points at the existing Overview until that is built.
 *   • The notification bell with a count. Same missing aggregate — and a bell
 *     that opens nothing is worse than no bell.
 *   • The "Viewing as <role>" switcher. There is no impersonation anywhere in
 *     this app, and `hasPermission` (AuthContext.jsx) has zero call sites, so
 *     there is nothing for it to switch. Real email shown instead.
 *
 * The search button is shown on the same condition as the existing sidebar's,
 * because it opens the same CommandPalette — whose endpoint only indexes
 * content (posts/pages/answers/labels/pictures), not users or courses.
 */
import { useEffect, useRef } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LogOut, Plus, Search } from "lucide-react";
import {
  ADMIN_V2_AREAS,
  activeRowTo,
  areaForPath,
  visibleItems,
} from "./adminV2Nav";
import "../css/AdminV2.css";

const AdminV2Shell = ({
  user,
  location,
  badges,
  flags,
  onLogout,
  onOpenPalette,
  onNewCourse,
}) => {
  const activeId = areaForPath(location.pathname);
  const area = ADMIN_V2_AREAS.find((a) => a.id === activeId) || ADMIN_V2_AREAS[0];
  const rows = visibleItems(area, flags);
  // Resolved once for the whole column, so a nested route can't light both
  // its own row and its parent's.
  const openTo = activeRowTo(rows, location);
  const initials = (user?.email || "AD").slice(0, 2).toUpperCase();

  // Both strips scroll horizontally below the tablet breakpoint, where the
  // sub-nav is a row of chips rather than a column. Land on a deep page —
  // /content/pictures, say — and the chip you are standing on is off-screen
  // to the right, so the nav looks like it is showing someone else's page.
  // scrollLeft rather than scrollIntoView: the latter can also scroll the
  // page vertically, yanking the content out from under the reader.
  const areasRef = useRef(null);
  const sideRef = useRef(null);
  useEffect(() => {
    for (const box of [areasRef.current, sideRef.current]) {
      if (!box || box.scrollWidth <= box.clientWidth) continue;
      const on = box.querySelector(".is-on");
      if (!on) continue;
      const target = on.offsetLeft - (box.clientWidth - on.offsetWidth) / 2;
      box.scrollLeft = Math.max(0, target);
    }
  }, [activeId, openTo]);

  return (
    <div className="av2">
      <div className="av2-top">
        <div className="av2-brand">
          <span className="av2-logo">S</span>
          ShikshaCom admin
        </div>

        {/* The artboard's own placeholder, and now true: Phase 5 pointed the
            palette at a console-wide search, so this is no longer gated on
            content_studio_enabled and no longer promises only CMS results. */}
        <button type="button" className="av2-search" onClick={onOpenPalette}>
          <Search size={14} aria-hidden="true" />
          <span>Find a student, course, teacher or page</span>
          <span className="av2-search__key">⌘K</span>
        </button>

        <div className="av2-top-right">
          {/* Same contextual rule as the v1 header: Academy-only, and only on
              the screens courses live on. Dropping it here would have been a
              silent regression for anyone with the flag on. */}
          {onNewCourse && (
            <button type="button" className="av2-new" onClick={onNewCourse}>
              <Plus size={15} aria-hidden="true" />
              New course
            </button>
          )}
          <span className="av2-who" title={user?.email}>
            <span className="av2-who__avatar">{initials}</span>
            <span className="av2-who__email">{user?.email}</span>
          </span>
          <button
            type="button"
            className="av2-logout"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <nav className="av2-areas" aria-label="Admin areas" ref={areasRef}>
        {ADMIN_V2_AREAS.map((a) => {
          // An area's count is the sum of what is waiting inside it, so the
          // bar answers "where is work piling up" without opening anything.
          const count = a.badgeKey ? badges[a.badgeKey] || 0 : 0;
          const firstRow = visibleItems(a, flags).find((it) => it.to);
          if (!firstRow) return null;
          return (
            <NavLink
              key={a.id}
              to={firstRow.to}
              className={`av2-area${a.id === activeId ? " is-on" : ""}`}
              aria-current={a.id === activeId ? "page" : undefined}
            >
              {a.label}
              {count > 0 && <span className="av2-area__count">{count}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="av2-body">
        <aside className="av2-side" aria-label={`${area.label} pages`} ref={sideRef}>
          <div className="av2-side__title">{area.label}</div>
          {rows.map((it, i) =>
            it.group ? (
              <div className="av2-side__group" key={`g${i}`}>{it.group}</div>
            ) : (
              <NavLink
                key={it.to}
                to={it.to}
                className={`av2-row${it.to === openTo ? " is-on" : ""}`}
                aria-current={it.to === openTo ? "page" : undefined}
              >
                <it.icon size={16} aria-hidden="true" />
                <span className="av2-row__label">
                  {it.label}
                  {it.to === openTo && it.was && (
                    <span className="av2-row__was">was: {it.was}</span>
                  )}
                </span>
                {it.badgeKey && badges[it.badgeKey] > 0 && (
                  <span className="av2-row__count">{badges[it.badgeKey]}</span>
                )}
              </NavLink>
            )
          )}
        </aside>

        <main className="av2-content page-fade" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminV2Shell;
