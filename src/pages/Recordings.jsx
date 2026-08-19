// Recordings — library of past session recordings. Data: GET
// /livestream/admin/recordings/.
//
// "View" used to be a toast reading "playback opens the Bunny player in
// production" — there was no production branch anywhere, no player route,
// and the admin endpoint didn't even return bunny_video_id. All three are
// fixed now: the endpoint returns the id, and View opens the same Bunny
// iframe embed the student and teacher apps use.
import { useEffect, useRef, useState, useCallback } from "react";
import { Video, PlayCircle, Search, X } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { getAdminRecordings } from "../api/livestream";
import { BUNNY_LIBRARY_ID } from "../config/urls";
import "../css/LiveStreams.css";

const STATUS_BADGE = {
  Finished: "green", Uploaded: "blue", Processing: "yellow",
  Transcoding: "yellow", Created: "gray", Error: "red",
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return iso; }
};
const fmtDur = (secs) => {
  if (!secs) return "—";
  const m = Math.round(secs / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
};

const Recordings = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState(null);
  const [playing, setPlaying] = useState(null);
  const toastTimer = useRef(null);

  const fireToast = useCallback((m) => {
    clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Two distinct "can't play" reasons, reported distinctly — conflating them
  // is what made this page's failure mode impossible to diagnose.
  const openPlayer = useCallback((r) => {
    if (!BUNNY_LIBRARY_ID) {
      fireToast("Playback is not configured: VITE_BUNNY_LIBRARY_ID is unset in this build.");
      return;
    }
    if (!r.bunny_video_id) {
      fireToast(`“${r.title}” has no uploaded video yet (status: ${r.status}).`);
      return;
    }
    setPlaying(r);
  }, [fireToast]);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e) => { if (e.key === "Escape") setPlaying(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      getAdminRecordings(q ? { q } : undefined)
        .then((d) => setRows(d.data || []))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, q ? 300 : 0); // debounce search
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Recordings</h1>

      <div className="rec-search">
        <Search size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recordings by title…" />
      </div>

      <div className="dashboard-card payments-table-card">
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No recordings found.</div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th>Title</th><th>Course · Subject</th><th>Batch</th>
                <th>Date</th><th>Duration</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="ls-title"><Video size={14} /> {r.title}</span>
                  </td>
                  <td>{r.course_name}{r.subject_name ? ` · ${r.subject_name}` : ""}</td>
                  <td>{r.batch_name || "Course-wide"}</td>
                  <td>{fmtDate(r.session_date || r.created_at)}</td>
                  <td>{fmtDur(r.duration_seconds)}</td>
                  <td><StatusBadge color={STATUS_BADGE[r.status] || "gray"}>{r.status}</StatusBadge></td>
                  <td>
                    <button className="ls-row-monitor" onClick={() => openPlayer(r)}>
                      <PlayCircle size={13} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {playing && (
        <div className="rec-playerOverlay" onClick={() => setPlaying(null)}>
          <div className="rec-player" onClick={(e) => e.stopPropagation()}>
            <div className="rec-playerHead">
              <span className="ls-title"><Video size={14} /> {playing.title}</span>
              <button className="rec-playerClose" onClick={() => setPlaying(null)} aria-label="Close player">
                <X size={16} />
              </button>
            </div>
            <div className="rec-playerFrame">
              <iframe
                title={playing.title}
                src={`https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${playing.bunny_video_id}?autoplay=false`}
                loading="lazy"
                allow="accelerometer; gyroscope; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
            <div className="rec-playerMeta">
              {playing.course_name}
              {playing.subject_name ? ` · ${playing.subject_name}` : ""}
              {playing.batch_name ? ` · ${playing.batch_name}` : " · Course-wide"}
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
};

export default Recordings;
