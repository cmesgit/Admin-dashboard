// The eight ticker surfaces, mirroring content.models.TickerSlot.
//
// One module rather than a copy in each component: the screen and the editor
// both need this list, and a constant exported from a component file breaks
// fast refresh (react-refresh/only-export-components).
//
// `where` is plain language on purpose — "hero" means nothing to an admin
// deciding where a notice should appear.
export const TICKER_SLOTS = [
  { id: "navbar", label: "Navbar strip", where: "Every page, under the menu" },
  { id: "hero", label: "Homepage hero", where: "Cards inside the circle" },
  { id: "home_band", label: "Homepage band", where: "Between sections" },
  { id: "courses", label: "Courses rail", where: "Course listing pages" },
  { id: "dashboard", label: "Student dashboard", where: "The right-hand rail" },
  { id: "footer", label: "Footer strip", where: "Bottom of every page" },
  { id: "auth_login", label: "Login screen", where: "Under the sign-in form" },
  { id: "auth_signup", label: "Signup screen", where: "Under the join form" },
];

/** The server treats an empty `slots` as navbar-only
 *  (AnnouncementQuerySet.for_slot). Every client-side count or chip list has
 *  to apply the SAME rule, or an item created without slots shows on the strip
 *  while the admin screen reports the navbar as empty. */
export const slotsOf = (item) => (item.slots?.length ? item.slots : ["navbar"]);
