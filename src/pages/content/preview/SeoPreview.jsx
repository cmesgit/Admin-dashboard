import { HOME_URL } from "../../../config/urls";
import "./preview.css";

// Mimics a Google organic result snippet so an author can judge the SEO
// title/description they've typed without leaving the editor. `seo_title`
// falling back to `title` and `seo_description` to `excerpt` matches what a
// search engine actually sees when those fields are blank — the backend
// itself only backfills `seo_title` (from `title[:70]`), never
// `seo_description`, so the excerpt fallback here is preview-only and not
// something the server guarantees.
const SeoPreview = ({ title, excerpt, seoTitle, seoDescription, slug }) => {
  const displayTitle = seoTitle || title || "Untitled post";
  const displayDescription = seoDescription || excerpt || "";
  const path = slug ? `blogs › ${slug.split("/").join(" › ")}` : "blogs › …";

  return (
    <div className="seo-preview">
      <div className="seo-preview-breadcrumb">
        {HOME_URL.replace(/^https?:\/\//, "")} <span>›</span> {path}
      </div>
      <div className="seo-preview-title">{displayTitle}</div>
      <div className="seo-preview-desc">{displayDescription || "No description set — search engines will generate one from the page content."}</div>
    </div>
  );
};

export default SeoPreview;
