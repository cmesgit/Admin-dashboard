import { Heart, ArrowRight, BookOpen } from "lucide-react";
import "./preview.css";

// Mirrors the markup FeaturedCourses() renders per-card in
// shiksha-frontend/src/components/home/HomeGreen.jsx (the `.hm-fc-*`
// classnames — see preview.css for where the matching CSS was copied
// from). Fed straight from the admin's in-progress form state, not
// from any API, so it updates as the admin types.
const FeaturedCardPreview = ({
  title,
  priceLabel,
  mrp,
  discountLabel,
  thumbnailUrl,
  ribbon,
  tutorName,
  isComingSoon,
  gradientCss,
}) => {
  return (
    <div className="cms-preview">
      <article className="hm-fc-card">
        {/* This preview ignored `gradient_css` and always drew the same green,
            so the one field an admin can type a colour into was the one thing
            the preview could not show. The stops are wrapped here exactly as
            the public card wraps them; the hardcoded pair is only the fallback
            for a card that has no value stored yet (the model's own default). */}
        <div
          className="hm-fc-thumb"
          style={{
            background: thumbnailUrl
              ? `url('${thumbnailUrl}') center/cover`
              : `linear-gradient(135deg,${gradientCss || "#0F9D6B,#0B5B3E"})`,
          }}
        >
          {/* The icon is the no-artwork fallback and the public card hides it
              once a real picture exists — showing both here would preview a
              card the site never renders. */}
          {!thumbnailUrl && (
            <span className="hm-fc-thumb-ic">
              <BookOpen />
            </span>
          )}
          {ribbon && <span className="hm-fc-ribbon">{ribbon}</span>}
          <button className="hm-fc-heart" type="button" tabIndex={-1} aria-hidden="true">
            <Heart />
          </button>
        </div>
        <div className="hm-fc-body">
          <h3>{title || "Untitled course"}</h3>
          <div className="hm-fc-foot">
            {isComingSoon ? (
              <>
                <span className="hm-fc-tutor">
                  <span className="hm-fc-av" style={{ background: "#0B5B3E" }}>
                    {(tutorName || "S")[0].toUpperCase()}
                  </span>
                  {tutorName || "Staff"}
                </span>
                <span className="hm-fc-price hm-soon">Coming Soon</span>
              </>
            ) : (
              <>
                <span className="hm-fc-price">
                  ₹{priceLabel || 0}
                  <small>
                    {" "}
                    {mrp ? (
                      <span style={{ textDecoration: "line-through", marginRight: 4 }}>₹{mrp}</span>
                    ) : null}
                    {discountLabel || "/month"}
                  </small>
                </span>
                <button type="button" className="hm-fc-enroll" tabIndex={-1}>
                  Enroll now <ArrowRight />
                </button>
              </>
            )}
          </div>
        </div>
      </article>
    </div>
  );
};

export default FeaturedCardPreview;
