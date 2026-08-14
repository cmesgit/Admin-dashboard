// Which tracks a teacher holds approved — "Academy" (school faculty, admin-
// reviewed) vs "Skill" (guest expert, auto-approved at signup). Shown wherever
// an admin picks or inspects a teacher, so the two are never confused.
// Styles: .ns-track-chips / .ns-track-chip in css/NewScreens.css.
import "../css/NewScreens.css";

const TrackChips = ({ tracks = [] }) => (
  <div className="ns-track-chips">
    {tracks.map((t) => (
      <span key={t} className={`ns-track-chip ${t}`}>
        {t === "academy" ? "Academy" : "Skill"}
      </span>
    ))}
  </div>
);

export default TrackChips;
