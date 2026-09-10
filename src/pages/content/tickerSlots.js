// The eight ticker surfaces, mirroring content.models.TickerSlot.
//
// One module rather than a copy in each component: the screen and the editor
// both need this list, and a constant exported from a component file breaks
// fast refresh (react-refresh/only-export-components).
//
// `where` is plain language on purpose — "hero" means nothing to an admin
// deciding where a notice should appear.
//
// ⚠ `built` is why this exists rather than a bare list of ids. The eight
// slots ship before the eight surfaces do, so an admin could tick "Homepage
// hero", save, switch the item on and see absolutely nothing happen, with
// nowhere to find out why. The server deliberately ACCEPTS every slot —
// items must be queueable ahead of the surface, and refusing an unbuilt one
// would make items unsaveable the moment a surface was switched off — so
// saying so in the UI is the only place this can be handled.
//
// Flip a slot to `built: true` in the phase that ships its surface. Nothing
// else needs changing; the screen and the editor both read this.
export const TICKER_SLOTS = [
  { id: "navbar", label: "Navbar strip", where: "Every page, under the menu", built: true },
  { id: "hero", label: "Homepage hero", where: "Cards inside the circle", built: false },
  { id: "home_band", label: "Homepage band", where: "Between sections", built: true },
  { id: "courses", label: "Courses rail", where: "Course listing pages", built: false },
  { id: "dashboard", label: "Student dashboard", where: "The right-hand rail", built: false },
  { id: "footer", label: "Footer strip", where: "Bottom of every page", built: true },
  { id: "auth_login", label: "Login screen", where: "Under the sign-in form", built: false },
  { id: "auth_signup", label: "Signup screen", where: "Under the join form", built: false },
];

/** Slots an admin can pick that will not render anywhere yet. */
export const unbuiltSlots = (slots = []) =>
  slots.filter((id) => TICKER_SLOTS.find((s) => s.id === id)?.built === false);

/** The server treats an empty `slots` as navbar-only
 *  (AnnouncementQuerySet.for_slot). Every client-side count or chip list has
 *  to apply the SAME rule, or an item created without slots shows on the strip
 *  while the admin screen reports the navbar as empty. */
export const slotsOf = (item) => (item.slots?.length ? item.slots : ["navbar"]);
