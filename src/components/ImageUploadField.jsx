// Shared "pick an image, see a small preview" field: a file input plus
// either the newly-selected file's name, or (if none picked yet) the
// existing image at `previewUrl`. State stays with the caller — this just
// standardizes the markup that used to be duplicated inline at 4 call sites
// (Courses.jsx's course thumbnail + subject image, content/Showcase.jsx's
// card image, content/BlogPosts.jsx's cover).
const ImageUploadField = ({
  value,
  onChange,
  previewUrl,
  previewClassName = "cm-thumb",
  accept = "image/*",
  disabled = false,
}) => (
  <>
    <input
      type="file"
      accept={accept}
      disabled={disabled}
      onChange={(e) => onChange(e.target.files?.[0] || null)}
    />
    {value ? (
      <small className="cm-file-name">{value.name}</small>
    ) : previewUrl ? (
      <img src={previewUrl} alt="" className={previewClassName} />
    ) : null}
  </>
);

export default ImageUploadField;
