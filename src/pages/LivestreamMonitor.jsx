// Livestream Monitor — multi-stream grid (/live-streams/monitor) that focuses
// into a single stream (/live-streams/monitor/:id) with live chat, stream
// health, and attendance. End-stream + admin chat-send are functional.
// Polls the admin endpoints (WS fallback per API_SPEC).
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, Radio, Send, Activity, Wifi, Users } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import ConfirmModal from "../components/ConfirmModal";
import Toast from "../components/Toast";
import {
  getAdminStreams,
  getAdminStream,
  postAdminStreamChat,
  endAdminStream,
  spectateAdminStream,
} from "../api/livestream";
import { errText } from "../utils/errText";
import "../css/LiveStreams.css";

const STATUS_BADGE = {
  LIVE: "red", RECONNECTING: "orange", PAUSED: "yellow",
  WAITING_FOR_TEACHER: "blue", SCHEDULED: "gray", COMPLETED: "gray", CANCELLED: "gray",
};
const isLive = (s) => s && (s.status === "LIVE" || s.status === "RECONNECTING");
const fmtTime = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }); }
  catch { return iso; }
};
const qualityColor = (q) =>
  ({ excellent: "teal", good: "green", fair: "yellow", poor: "red" }[q] || "gray");
const fmtDuration = (secs) => {
  if (!secs) return "0m";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/* ── Multi-stream grid ── */
function MonitorGrid() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const load = () =>
      getAdminStreams("live")
        .then((d) => alive && setRows(d.data || []))
        .catch(() => alive && setRows([]))
        .finally(() => alive && setLoading(false));
    load();
    const t = setInterval(load, 8000); // live grid refresh
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Livestream Monitor</h1>
      {loading ? (
        <div className="dashboard-loading">Loading live streams…</div>
      ) : rows.length === 0 ? (
        <div className="dashboard-card" style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
          No streams are live right now.
        </div>
      ) : (
        <div className="lm-grid">
          {rows.map((s) => (
            <button key={s.id} className="lm-tile" onClick={() => navigate(`/live-streams/monitor/${s.id}`)}>
              <div className="lm-tile-video">
                <Radio size={26} />
                {isLive(s) && <span className="lm-tile-live"><span className="ls-live-dot sm" /> LIVE</span>}
                <span className="lm-tile-watch"><Eye size={12} /> {s.watching ?? 0}</span>
              </div>
              <div className="lm-tile-body">
                <div className="lm-tile-title">{s.title}</div>
                <div className="lm-tile-meta">{s.batch_code ? `${s.batch_code} · ` : ""}{s.subject_name} · {s.teacher}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Shared minimal sparkline — values are plotted 0..max on a fixed-height
// viewBox; `vectorEffect="non-scaling-stroke"` keeps the line 1.5px on
// screen no matter how the viewBox gets stretched by preserveAspectRatio.
function Sparkline({ values, color = "#2563eb", className = "" }) {
  if (values.length < 2) return null;
  const W = 100, H = 32;
  const max = Math.max(1, ...values);
  const step = W / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(2)},${(H - (v / max) * H).toFixed(2)}`)
    .join(" ");
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function ViewerTrend({ samples = [] }) {
  return (
    <div className="dashboard-card lm-viewer-trend">
      <div className="lm-card-title">
        <Eye size={15} /> Viewer trend
        {samples.length > 0 && <span className="lm-viewer-trend-now">{samples[samples.length - 1].viewers} now</span>}
      </div>
      {samples.length < 2 ? (
        <p className="lm-empty">Not enough samples yet.</p>
      ) : (
        <Sparkline className="lm-viewer-trend-svg" values={samples.map((s) => s.viewers)} />
      )}
    </div>
  );
}

const HEALTH_METRICS = [
  { key: "bitrate_kbps", label: "Bitrate", color: "#2563eb", fmt: (v) => `${v} kbps` },
  { key: "fps", label: "FPS", color: "#16a34a", fmt: (v) => `${v}` },
  { key: "latency_ms", label: "Latency", color: "#d97706", fmt: (v) => `${v} ms` },
  { key: "packet_loss", label: "Packet loss", color: "#dc2626", fmt: (v) => `${(v * 100).toFixed(1)}%` },
];

function HealthTrend({ samples = [] }) {
  if (samples.length < 2) {
    return <p className="lm-empty">Not enough samples yet for a trend.</p>;
  }
  return (
    <div className="lm-health-trend-grid">
      {HEALTH_METRICS.map((m) => {
        const values = samples.map((s) => s[m.key]).filter((v) => v != null);
        if (values.length < 2) return null;
        return (
          <div className="lm-health-trend-cell" key={m.key}>
            <span className="lm-health-trend-label">{m.label}</span>
            <Sparkline className="lm-health-trend-svg" values={values} color={m.color} />
            <span className="lm-health-trend-val">{m.fmt(values[values.length - 1])}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Single-stream focus ── */
function MonitorSingle({ id }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatText, setChatText] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [toast, setToast] = useState(null);

  // Live observation. The video area used to be a literal placeholder — an
  // icon in a grey box — so the Monitor could show viewer counts and stream
  // health but never the class itself.
  const [watching, setWatching] = useState(false);
  const [watchErr, setWatchErr] = useState("");
  const roomRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const stopWatching = useCallback(() => {
    try { roomRef.current?.disconnect(); } catch { /* already gone */ }
    roomRef.current = null;
    setWatching(false);
  }, []);

  // Leaving the page must drop the connection. Without this the admin stays
  // silently subscribed to a live classroom after navigating away — still
  // consuming media, and still counted against LiveKit.
  useEffect(() => () => stopWatching(), [stopWatching]);

  const startWatching = useCallback(async () => {
    setWatchErr("");
    try {
      const { Room, RoomEvent } = await import("livekit-client");
      const info = await spectateAdminStream(id);
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === "video" && videoRef.current) track.attach(videoRef.current);
        if (track.kind === "audio" && audioRef.current) track.attach(audioRef.current);
      });
      room.on(RoomEvent.Disconnected, () => setWatching(false));

      await room.connect(info.livekit_url, info.token);
      setWatching(true);
    } catch (err) {
      stopWatching();
      setWatchErr(errText(err) || "Could not join the class.");
    }
  }, [id, stopWatching]);
  const toastTimer = useRef(null);
  const chatEndRef = useRef(null);

  const fireToast = useCallback((m) => {
    clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const load = useCallback(() => {
    getAdminStream(id)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000); // poll chat/health/attendance
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.chat?.length]);

  const sendChat = async () => {
    const text = chatText.trim();
    if (!text) return;
    setSending(true);
    try {
      await postAdminStreamChat(id, text);
      setChatText("");
      load();
    } catch (e) {
      fireToast(errText(e));
    } finally {
      setSending(false);
    }
  };

  const doEnd = async () => {
    try {
      await endAdminStream(id);
      setConfirmEnd(false);
      fireToast("Stream ended.");
      load();
    } catch (e) {
      setConfirmEnd(false);
      fireToast(errText(e));
    }
  };

  if (loading) return <div className="dashboard-wrapper"><div className="dashboard-loading">Loading stream…</div></div>;
  if (!data) return (
    <div className="dashboard-wrapper">
      <button className="ls-back" onClick={() => navigate("/live-streams/monitor")}><ArrowLeft size={15} /> Back to monitor</button>
      <div className="dashboard-card" style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Stream not found.</div>
    </div>
  );

  const { stream, attendance = [], chat = [], health, health_samples = [], viewer_samples = [] } = data;
  const online = attendance.filter((a) => a.online).length;

  return (
    <div className="dashboard-wrapper">
      <button className="ls-back" onClick={() => navigate("/live-streams/monitor")}><ArrowLeft size={15} /> Back to monitor</button>

      <div className="lm-single-head">
        <div>
          <h1 className="dashboard-title" style={{ marginBottom: 4 }}>{stream.title}</h1>
          <div className="lm-single-meta">
            {stream.batch_code ? `${stream.batch_code} · ` : ""}{stream.course_name} · {stream.subject_name} · {stream.teacher}
          </div>
        </div>
        <div className="lm-single-actions">
          <StatusBadge color={STATUS_BADGE[stream.status] || "gray"}>{stream.status?.replace(/_/g, " ")}</StatusBadge>
          {isLive(stream) && (
            <button className="lm-end-btn" onClick={() => setConfirmEnd(true)}>End stream</button>
          )}
        </div>
      </div>

      <div className="lm-single-grid">
        {/* Left: video placeholder + health + viewer trend */}
        <div className="lm-left">
          <div className="lm-video">
            {/* Hidden until connected so the poster state is not a black box */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={false}
              style={{
                width: "100%", height: "100%", objectFit: "contain",
                display: watching ? "block" : "none",
              }}
            />
            <audio ref={audioRef} autoPlay />

            {!watching && <Radio size={40} />}

            {isLive(stream) && <span className="lm-tile-live"><span className="ls-live-dot sm" /> LIVE</span>}
            <span className="lm-tile-watch"><Eye size={13} /> {stream.watching ?? 0} watching</span>

            {isLive(stream) && (
              <button
                className="lm-watch-btn"
                onClick={watching ? stopWatching : startWatching}
                title={watching
                  ? "Stop watching"
                  : "Watch this class. You join silently — the teacher and students are not shown that you are here. Every observation is recorded against your account."}
              >
                {watching ? "Stop watching" : "Watch class"}
              </button>
            )}
          </div>
          {watchErr && <div className="lm-watch-err">{watchErr}</div>}

          <div className="lm-stats-row">
            <div className="lm-stat">
              <span className="lm-stat-label"><Eye size={13} /> Watching</span>
              <span className="lm-stat-val">{stream.watching ?? 0}</span>
            </div>
            <div className="lm-stat">
              <span className="lm-stat-label"><Users size={13} /> Peak</span>
              <span className="lm-stat-val">{stream.peak_viewers ?? 0}</span>
            </div>
            <div className="lm-stat">
              <span className="lm-stat-label"><Activity size={13} /> Online</span>
              <span className="lm-stat-val">{online}</span>
            </div>
          </div>

          <ViewerTrend samples={viewer_samples} />

          <div className="dashboard-card lm-health">
            <div className="lm-card-title"><Wifi size={15} /> Stream health</div>
            {health ? (
              <div className="lm-health-grid">
                <div><span>Bitrate</span><b>{health.bitrate_kbps != null ? `${health.bitrate_kbps} kbps` : "—"}</b></div>
                <div><span>FPS</span><b>{health.fps ?? "—"}</b></div>
                <div><span>Latency</span><b>{health.latency_ms != null ? `${health.latency_ms} ms` : "—"}</b></div>
                <div><span>Packet loss</span><b>{health.packet_loss != null ? `${(health.packet_loss * 100).toFixed(1)}%` : "—"}</b></div>
                <div><span>Quality</span><b><StatusBadge color={qualityColor(health.quality)}>{health.quality || "—"}</StatusBadge></b></div>
              </div>
            ) : (
              <p className="lm-empty">No health telemetry received yet. Clients report health during the class.</p>
            )}
            {health && <HealthTrend samples={health_samples} />}
          </div>
        </div>

        {/* Right: chat + attendance */}
        <div className="lm-right">
          <div className="dashboard-card lm-chat">
            <div className="lm-card-title">Live chat</div>
            <div className="lm-chat-scroll">
              {chat.length === 0 ? (
                <p className="lm-empty">No messages yet.</p>
              ) : (
                chat.map((m, i) => (
                  <div key={i} className={`lm-msg${m.isTeacher ? " teacher" : ""}`}>
                    <span className="lm-msg-sender">{m.sender}{m.isTeacher ? " (teacher)" : ""}</span>
                    <span className="lm-msg-text">{m.text}</span>
                    <span className="lm-msg-time">{fmtTime(m.time)}</span>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="lm-chat-input">
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder="Message as Admin…"
              />
              <button onClick={sendChat} disabled={sending || !chatText.trim()}><Send size={15} /></button>
            </div>
          </div>

          <div className="dashboard-card lm-attend">
            <div className="lm-card-title"><Users size={15} /> Attendance ({attendance.length})</div>
            <div className="lm-attend-scroll">
              {attendance.length === 0 ? (
                <p className="lm-empty">No attendees recorded.</p>
              ) : (
                attendance.map((a, i) => (
                  <div key={i} className="lm-attend-row">
                    <span className={`lm-dot${a.online ? " on" : ""}`} />
                    <span className="lm-attend-name">
                      {a.user_name || a.user_email}
                      {a.rejoin_count > 0 && (
                        <span className="lm-attend-rejoin" title={`Rejoined ${a.rejoin_count} time(s)`}>
                          ↻ {a.rejoin_count}
                        </span>
                      )}
                      {a.reconciled && (
                        <span className="lm-attend-reconciled" title="This attendance record was closed automatically by the system — likely a dropped connection or a closed tab, not the student clicking Leave.">
                          auto-closed
                        </span>
                      )}
                    </span>
                    <span className="lm-attend-watch">{fmtDuration(a.total_seconds)}</span>
                    <span className="lm-attend-time">{a.online ? "online" : fmtTime(a.left_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {confirmEnd && (
        <ConfirmModal
          title="End this stream?"
          message="This will mark the session completed and disconnect participants. This cannot be undone."
          onConfirm={doEnd}
          onCancel={() => setConfirmEnd(false)}
        />
      )}
      <Toast message={toast} />
    </div>
  );
}

const LivestreamMonitor = () => {
  const { id } = useParams();
  return id ? <MonitorSingle id={id} /> : <MonitorGrid />;
};

export default LivestreamMonitor;
