// Small stack of "where this will show up on the real site" chips.
// Reuses the existing .mod-badge palette (Moderator.css) for the pill
// itself, plus a couple of admin-native additions in Content.css
// (.cms-placement-*) for the two-line label/sublabel layout — no CSS was
// copied from shiksha-frontend for this one, it's purely an Admin-dashboard
// UI convention.
const PALETTE_BY_LABEL = {
  Homepage: "pal-purple",
  Navbar: "pal-blue",
  Catalog: "pal-green",
  "/blogs": "pal-green",
};

const paletteFor = (label) => {
  if (PALETTE_BY_LABEL[label]) return PALETTE_BY_LABEL[label];
  if (label && label.startsWith("/blogs")) return "pal-green";
  return "pal-gray";
};

const PlacementBadge = ({ items = [] }) => {
  if (!items.length) return null;
  return (
    <div className="cms-placement-stack">
      {items.map((item, i) => (
        <div className="cms-placement-chip" key={`${item.label}-${i}`}>
          <span className={`mod-badge ${paletteFor(item.label)}`}>{item.label}</span>
          {item.sublabel && <span className="cms-placement-sub">{item.sublabel}</span>}
        </div>
      ))}
    </div>
  );
};

export default PlacementBadge;
