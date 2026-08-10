import "./preview.css";

// Mirrors the blog list card markup in
// shiksha-frontend/src/components/Blogs.jsx (the `.blog-list-*`
// classnames — see preview.css for where the matching CSS was copied
// from). Fed straight from the admin's in-progress form state.
//
// The real card also overlays a `.blog-list-category` chip derived
// server-side from the post's subject (`get_subject_display()`); that
// isn't part of this component's props, so it's intentionally left out
// rather than faked with a subject value the admin never explicitly set.
const BlogCardPreview = ({ title, excerpt, coverUrl, tags = [], publishedLabel }) => (
  <div className="cms-preview">
    <div className="blog-list-card">
      <div className="blog-list-image-wrap">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="blog-list-image" />
        ) : (
          <div
            className="blog-list-image"
            style={{ background: "linear-gradient(135deg,#0F9D6B 0%,#0B5B3E 100%)" }}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="blog-list-content">
        <h2>{title || "Untitled post"}</h2>
        {excerpt && <p>{excerpt}</p>}

        {tags.length > 0 && (
          <div className="blog-list-tags">
            {tags.slice(0, 4).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}

        <div className="blog-list-read">Read Blog →</div>
        {publishedLabel && (
          <div style={{ marginTop: 10, fontSize: "11.5px", color: "#9aa0aa", fontWeight: 600 }}>
            {publishedLabel}
          </div>
        )}
      </div>
    </div>
  </div>
);

export default BlogCardPreview;
