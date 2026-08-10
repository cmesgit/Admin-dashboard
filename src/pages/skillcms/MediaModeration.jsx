import { useEffect, useState } from "react";
import { getAdminExperts, getSkillCourses, updateExpertPhoto, updateSkillCourseCover } from "../../api/admin";
import { errText } from "../../utils/errText";

/* Shared "current thumbnail + replace" row, used for both experts and
   courses — the only difference is which update call it invokes. */
function MediaRow({ title, subtitle, imageUrl, onReplace, notify }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputId = `media-${title}-${subtitle}`.replace(/\s+/g, "-");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setError("");
    try {
      await onReplace(file);
      notify(`Updated image for "${title}"`);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td>
        {imageUrl ? (
          <img src={imageUrl} alt="" className="cm-thumb" />
        ) : (
          <span className="mod-badge pal-gray">No image</span>
        )}
      </td>
      <td className="courses-title">{title}</td>
      <td>{subtitle}</td>
      <td className="cm-actions">
        <label className="cm-icon-btn" htmlFor={inputId} style={{ cursor: busy ? "wait" : "pointer" }}>
          {busy ? "Uploading…" : "Replace image"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          disabled={busy}
          onChange={handleFile}
        />
        {error && <div className="cm-form-error">{error}</div>}
      </td>
    </tr>
  );
}

const MediaModeration = ({ onAction }) => {
  const [experts, setExperts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const notify = (msg) => onAction && onAction(msg);

  const load = async () => {
    setLoading(true);
    const [expertRows, courseRows] = await Promise.all([
      getAdminExperts(),
      getSkillCourses({ status: "all" }),
    ]);
    setExperts(Array.isArray(expertRows) ? expertRows : expertRows.results || []);
    setCourses(Array.isArray(courseRows) ? courseRows : courseRows.results || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const replaceExpertPhoto = async (id, file) => {
    const updated = await updateExpertPhoto(id, file);
    setExperts((prev) => prev.map((e) => (e.id === id ? { ...e, photo: updated.photo } : e)));
  };

  const replaceCourseCover = async (id, file) => {
    const updated = await updateSkillCourseCover(id, file);
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, cover: updated.cover } : c)));
  };

  if (loading) return <div className="dashboard-loading">Loading…</div>;

  return (
    <div>
      <p className="content-subtitle">
        Override an expert's public photo or a course's cover image. Teachers normally set these
        themselves — use this only to fix an inappropriate or missing image.
      </p>

      <h3>Expert photos</h3>
      <div className="dashboard-card courses-table-card" style={{ marginBottom: 24 }}>
        {experts.length === 0 ? (
          <div className="dashboard-loading">No experts yet.</div>
        ) : (
          <table className="courses-table">
            <thead><tr><th>Photo</th><th>Name</th><th>Category</th><th aria-label="actions" /></tr></thead>
            <tbody>
              {experts.map((e) => (
                <MediaRow
                  key={e.id}
                  title={e.name}
                  subtitle={e.category || "—"}
                  imageUrl={e.photo}
                  onReplace={(file) => replaceExpertPhoto(e.id, file)}
                  notify={notify}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h3>Course covers</h3>
      <div className="dashboard-card courses-table-card">
        {courses.length === 0 ? (
          <div className="dashboard-loading">No courses yet.</div>
        ) : (
          <table className="courses-table">
            <thead><tr><th>Cover</th><th>Title</th><th>Status</th><th aria-label="actions" /></tr></thead>
            <tbody>
              {courses.map((c) => (
                <MediaRow
                  key={c.id}
                  title={c.title}
                  subtitle={c.status}
                  imageUrl={c.cover}
                  onReplace={(file) => replaceCourseCover(c.id, file)}
                  notify={notify}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default MediaModeration;
