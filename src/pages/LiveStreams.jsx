// Live Streams hub — list of Academy live/scheduled/recent streams and the
// entry point to the Livestream Monitor. Data: GET /livestream/admin/streams/.
import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, Eye, MonitorPlay, AlertTriangle, ChevronDown, ChevronRight, Video } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { getAdminStreams, getAdminWebhookEvents } from "../api/livestream";
import { getSettings, updateSettings } from "../api/admin";
import "../css/LiveStreams.css";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "live", label: "Live now" },
  { key: "scheduled", label: "Scheduled" },
];

const WEBHOOK_FILTERS = [
  { key: "failed", label: "Failed" },
  { key: "unprocessed", label: "Unprocessed" },
  { key: "all", label: "All" },
];

function WebhookEventsPanel() {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("failed");
  const [expanded, setExpanded] = useState(null); // id of the row showing its full payload

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getAdminWebhookEvents({ status: statusFilter })
      .then((d) => {
        if (!alive) return;
        setRows(d.data || []);
        setCounts(d.counts || {});
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [statusFilter]);

  return (
    <>
      <div className="ls-chips">
        {WEBHOOK_FILTERS.map((f) => (
          <button
            key={f.key}
            className={`ls-chip${statusFilter === f.key ? " active" : ""}`}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <span className="ls-webhook-counts">
          {counts.total ?? 0} total · {counts.unprocessed ?? 0} unprocessed · {counts.failed ?? 0} failed
        </span>
      </div>

      <div className="dashboard-card payments-table-card">
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No webhook events match this filter.</div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th></th><th>Event type</th><th>Room</th><th>Session</th>
                <th>Processed</th><th>Error</th><th>Received</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <Fragment key={w.id}>
                  <tr className="ls-webhook-row" onClick={() => setExpanded(expanded === w.id ? null : w.id)}>
                    <td>{expanded === w.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                    <td><code>{w.event_type}</code></td>
                    <td>{w.room_name || "—"}</td>
                    <td>{w.session_id ? <code>{w.session_id.slice(0, 8)}…</code> : "—"}</td>
                    <td><StatusBadge color={w.processed ? "green" : "yellow"}>{w.processed ? "Processed" : "Unprocessed"}</StatusBadge></td>
                    <td>{w.error ? <span className="ls-webhook-error"><AlertTriangle size={12} /> {w.error.slice(0, 60)}</span> : "—"}</td>
                    <td>{new Date(w.received_at).toLocaleString()}</td>
                  </tr>
                  {expanded === w.id && (
                    <tr className="ls-webhook-detail-row">
                      <td colSpan={7}>
                        {w.error && <div className="ls-webhook-detail-error">{w.error}</div>}
                        <pre className="ls-webhook-payload">{JSON.stringify(w.payload, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

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

/* ── Automatic class recording, global default ──
   `auto_record_classes` on the SAME GlobalSettings singleton the Payment
   Settings and Live Session Rules screens edit — see api/admin_live_rules.js
   for why there is no separate resource.

   Deliberately NOT put on the Live Session Rules screen next to
   `live_recording_enabled`, despite the similar names: that flag belongs to
   Skill Dev private/group rooms (sessions_app), this one to academy live
   classes. Two unrelated products, and a single screen showing both would
   invite someone to assume one switch covers both.

   Egress is billed per MINUTE of class time, so the copy below states that
   plainly rather than presenting this as a harmless feature toggle. */
function AutoRecordPanel() {
  const [enabled, setEnabled] = useState(null);   // null = not loaded yet
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    getSettings()
      .then((s) => alive && setEnabled(!!s.auto_record_classes))
      .catch(() => alive && setErr("Could not load the current setting."));
    return () => { alive = false; };
  }, []);

  const toggle = async (next) => {
    setSaving(true);
    setErr("");
    /* Optimistic, then reconciled against what the server actually stored —
       silently showing "on" for a save that failed would be worse here than
       a moment of flicker, because the difference is a bill. */
    setEnabled(next);
    try {
      const saved = await updateSettings({ auto_record_classes: next });
      setEnabled(!!saved.auto_record_classes);
    } catch {
      setEnabled(!next);
      setErr("Could not save. The setting is unchanged.");
    } finally {
      setSaving(false);
    }
  };

  if (enabled === null && !err) {
    return <div className="dashboard-card ls-rec-card">Loading…</div>;
  }

  return (
    <div className="dashboard-card ls-rec-card">
      <div className="ls-rec-title"><Video size={16} /> Automatic class recording</div>

      <p className="ls-rec-copy">
        Records academy live classes to the recordings library automatically,
        starting when the teacher joins. Recordings appear for students once
        transcoding finishes.
      </p>

      <label className="ls-rec-toggle">
        <input
          type="checkbox"
          checked={!!enabled}
          disabled={saving}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span>Record live classes by default</span>
      </label>

      <p className="ls-rec-cost">
        <AlertTriangle size={13} />
        Billed per minute of class time. This is the default for every course —
        individual courses can override it in Courses.
      </p>

      {/* Not a hypothetical: with no credentials the backend keeps recording
          off regardless of this switch, and saying so here saves someone
          debugging a toggle that looks on but does nothing. */}
      <p className="ls-rec-note">
        Requires LiveKit egress and Bunny storage credentials on the server. If
        those are missing, recording stays off whatever this is set to.
      </p>

      {err && <p className="ls-rec-err">{err}</p>}
    </div>
  );
}

const LiveStreams = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState("streams");
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

      <div className="ls-tabs">
        <button className={`ls-tab${tab === "streams" ? " active" : ""}`} onClick={() => setTab("streams")}>Streams</button>
        <button className={`ls-tab${tab === "webhooks" ? " active" : ""}`} onClick={() => setTab("webhooks")}>Webhook events</button>
        <button className={`ls-tab${tab === "recording" ? " active" : ""}`} onClick={() => setTab("recording")}>Recording</button>
      </div>

      {tab === "recording" ? (
        <AutoRecordPanel />
      ) : tab === "webhooks" ? (
        <WebhookEventsPanel />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
};

export default LiveStreams;
