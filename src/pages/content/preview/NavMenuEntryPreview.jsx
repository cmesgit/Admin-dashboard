// Not a copy of Navbar.jsx markup — the real mega-menu (see COURSES_MENU in
// shiksha-frontend/src/components/Navbar.jsx) is chrome-heavy and its links
// are hand-curated per board/exam-track rather than generated from a single
// course record, so there's no one real DOM node to mirror here. This is a
// small admin-native stand-in that shows how the title reads as a nav link,
// including the "Soon" treatment the real menu uses for `{ soon: true }`
// entries — styled with Admin-dashboard's own conventions (see
// .cms-navlink-* in src/css/Content.css), not shiksha-frontend's.
const NavMenuEntryPreview = ({ label, comingSoon }) => (
  <div className="cms-navlink-preview">
    <span className="cms-navlink-dot" />
    <span className="cms-navlink-label">{label || "Untitled"}</span>
    {comingSoon && <span className="mod-badge pal-yellow cms-navlink-soon">Soon</span>}
  </div>
);

export default NavMenuEntryPreview;
