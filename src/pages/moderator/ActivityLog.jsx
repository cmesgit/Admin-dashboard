import { useEffect, useState } from "react";
import { Trash2, TriangleAlert, Check } from "lucide-react";
import { getModLog } from "../../api/admin";

const PAGE_SIZE = 20;

const TYPE_ICON = { bad: Trash2, warn: TriangleAlert, ok: Check };
const TYPE_PAL = { bad: "pal-red", warn: "pal-yellow", ok: "pal-green" };

const formatAgo = (iso) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const ActivityLog = () => {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPage = (p, replace) => {
    (replace ? setLoading : setLoadingMore)(true);
    getModLog({ page: p, page_size: PAGE_SIZE })
      .then((d) => {
        setCount(typeof d.count === "number" ? d.count : 0);
        setRows((prev) => (replace ? (d.results || []) : [...prev, ...(d.results || [])]));
        setPage(p);
      })
      .finally(() => (replace ? setLoading : setLoadingMore)(false));
  };

  useEffect(() => { loadPage(1, true); }, []);

  const hasMore = rows.length < count;

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  return (
    <div>
      {rows.length === 0 ? (
        <div className="mod-empty"><h4>No moderator actions yet</h4></div>
      ) : (
        <div className="mod-log-list">
          {rows.map((l) => {
            const Icon = TYPE_ICON[l.type] || Check;
            return (
              <div key={l.id} className="mod-log-row">
                <div className={`mod-log-icon ${l.type}`}>
                  <Icon size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mod-log-head">
                    <span className={`mod-badge ${TYPE_PAL[l.type] || "pal-gray"}`}>{l.label}</span>
                    <span className="mod-log-text">{l.text}</span>
                  </div>
                  {l.note && <div className="mod-log-note">&ldquo;{l.note}&rdquo;</div>}
                  <div className="mod-log-meta">by {l.moderator} · {formatAgo(l.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button
          className="mod-btn ghost mod-log-loadmore"
          disabled={loadingMore}
          onClick={() => loadPage(page + 1, false)}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
};

export default ActivityLog;
