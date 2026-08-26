// Live preview of a homepage section (design_handoff_content_studio Phase 5b).
//
// ⚠ Renders the DRAFT, never the live row. A preview of what is already
// published tells the editor nothing they could not get by opening the site,
// and would quietly reassure them about an edit they have not looked at.
//
// The point is that it uses the public site's real fonts and colours, so the
// judgement "does this heading fit" is made against what visitors get. Those
// values are hardcoded here on purpose: they belong to shiksha-frontend, not
// to the admin token system, and pulling them through --admin-* would make the
// preview lie. This is the one place in the Studio where that is correct.
import { Monitor, Smartphone, Tablet } from "lucide-react";

export const DEVICES = [
  { id: "desktop", icon: Monitor, label: "Desktop", width: "100%" },
  { id: "tablet", icon: Tablet, label: "Tablet", width: "340px" },
  { id: "phone", icon: Smartphone, label: "Phone", width: "290px" },
];

const SectionPreview = ({ device, onDevice, values, sectionLabel }) => {
  const frame = DEVICES.find((d) => d.id === device) || DEVICES[0];
  const {
    eyebrow, heading, heading_secondary: headingTwo, subhead, body,
    cta_primary_label: ctaOne, cta_secondary_label: ctaTwo, img,
  } = values || {};

  const empty = !eyebrow && !heading && !subhead && !body && !ctaOne && !img;

  return (
    <aside className="cs-preview">
      <div className="cs-preview__bar">
        <span className="cs-preview__title">Preview</span>
        <div className="cs-preview__devices" role="group" aria-label="Preview width">
          {DEVICES.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              className={`cs-preview__device${id === device ? " is-on" : ""}`}
              onClick={() => onDevice(id)}
              aria-pressed={id === device}
              aria-label={label}
              title={label}
            >
              <Icon size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <div className="cs-preview__stage">
        <div className="cs-preview__card" style={{ width: frame.width }}>
          {empty ? (
            <p className="cs-preview__empty">
              Nothing to show yet — fill in the fields on the left.
            </p>
          ) : (
            <div className="cs-site">
              {eyebrow && <p className="cs-site__eyebrow">{eyebrow}</p>}
              {(heading || headingTwo) && (
                <h1 className="cs-site__heading">
                  {heading}
                  {headingTwo && <><br />{headingTwo}</>}
                </h1>
              )}
              {subhead && <p className="cs-site__subhead">{subhead}</p>}
              {img && (
                <div className="cs-site__image">
                  <img src={img} alt="" />
                </div>
              )}
              {body && <p className="cs-site__body">{body}</p>}
              {(ctaOne || ctaTwo) && (
                <div className="cs-site__ctas">
                  {ctaOne && <span className="cs-site__btn">{ctaOne}</span>}
                  {ctaTwo && <span className="cs-site__btn cs-site__btn--ghost">{ctaTwo}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="cs-preview__note">
        This is {sectionLabel} as it would look with your unpublished changes.
      </p>
    </aside>
  );
};

export default SectionPreview;
