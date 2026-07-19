// Live Streams hub — list of Academy live/scheduled/recent streams and the
// entry point to the Livestream Monitor. Data: GET /livestream/admin/streams/.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, Eye, MonitorPlay } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { getAdminStreams } from "../api/livestream";
import "../css/LiveStreams.css";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "live", label: "Live now" },
  { key: "scheduled", label: "Scheduled" },
];

const STATUS_BADGE = {
  LIVE: "red",
  RECONNECTING: "orange",
  PAUSED: "yellow",
  WAITING_FOR_TEACHER: "blue",
  SCHEDULED: "gray",
  COMPLETED: "gray",
  CANCELLED: "gray",
};

const fmt = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
};

const isLive = (s) => s.status === "LIVE" || s.status === "RECONNECTING";

const LiveStreams = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  const load = (f) => {
    setLoading(true);
    getAdminStreams(f)
      .then((d) => setRows(d.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(filter); }, [filter]);

  const liveCount = rows.filter(isLive).length;

  return (
    <div className="dashboard-wrapper">
      <div className="ls-head">
        <h1 className="dashboard-title" style={{ marginBottom: 0 }}>Live Streams</h1>
        <div className="ls-head-actions">
          {liveCount > 0 && (
            <span className="ls-live-pill">
              <span className="ls-live-dot" />
              {liveCount} live now
            </span>
          )}
          <button className="ls-monitor-btn" onClick={() => navigate("/live-streams/monitor")}>
            <MonitorPlay size={15} /> Open monitor
          </button>
        </div>
      </div>

      <div className="ls-chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`ls-chip${filter === f.key ? " active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="dashboard-card payments-table-card">
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No streams to show.</div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th>Session</th><th>Course · Subject</th><th>Batch</th>
                <th>Teacher</th><th>Status</th><th>Watching</th><th>Start</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="ls-title">
                      {isLive(s) && <span className="ls-live-dot sm" />}
                      {s.title}
                    </span>
                  </td>
                  <td>{s.course_name}{s.subject_name ? ` · ${s.subject_name}` : ""}</td>
                  <td>{s.batch_code || "—"}</td>
                  <td>{s.teacher}</td>
                  <td><StatusBadge color={STATUS_BADGE[s.status] || "gray"}>{s.status?.replace(/_/g, " ")}</StatusBadge></td>
                  <td>
                    <span className="ls-watch"><Eye size={13} /> {s.watching ?? 0}</span>
                  </td>
                  <td>{fmt(s.start_time)}</td>
                  <td>
                    <button className="ls-row-monitor" onClick={() => navigate(`/live-streams/monitor/${s.id}`)}>
                      <Radio size={13} /> Monitor
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LiveStreams;
