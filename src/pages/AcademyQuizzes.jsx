import { useEffect, useMemo, useState } from "react";
import { getAcademyQuizzes, getAcademyQuizDetail, reviewAcademyQuiz } from "../api/admin";
import ConfirmModal from "../components/ConfirmModal";
import "../css/Approvals.css";
import "../css/AcademyQuizzes.css";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "draft", label: "Draft" },
];

const STATUS_BADGE = {
  draft:    { bg: "#f1f5f9", fg: "#475569", label: "Draft" },
  pending:  { bg: "#fff4e0", fg: "#b45309", label: "Pending review" },
  approved: { bg: "#dcfce7", fg: "#166534", label: "Approved" },
  rejected: { bg: "#fef2f2", fg: "#991b1b", label: "Rejected" },
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function Badge({ status }) {
  const meta = STATUS_BADGE[status] || STATUS_BADGE.draft;
  return (
    <span style={{
      background: meta.bg, color: meta.fg, padding: "4px 10px", borderRadius: 999,
      fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {meta.label}
    </span>
  );
}

function QuizDetailModal({ quizId, onClose, onReviewed }) {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAcademyQuizDetail(quizId)
      .then((d) => { if (!cancelled) setQuiz(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [quizId]);

  const approve = async () => {
    setBusy(true);
    try {
      const updated = await reviewAcademyQuiz(quizId, "approve");
      onReviewed(updated);
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to approve quiz.");
    } finally {
      setBusy(false);
    }
  };

  const submitReject = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      const updated = await reviewAcademyQuiz(quizId, "reject", reason.trim());
      onReviewed(updated);
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to reject quiz.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ap-modal-overlay" onClick={onClose}>
      <div className="ap-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        {loading || !quiz ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading…</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>{quiz.title}</h2>
                <div style={{ color: "#6b7280", marginTop: 4, fontSize: 13 }}>
                  {quiz.subject_name} · {quiz.course_title} · by {quiz.teacher_name}
                </div>
              </div>
              <div style={{ marginLeft: "auto" }}><Badge status={quiz.review_status} /></div>
            </div>

            <div className="ap-detail-grid" style={{ marginTop: 16 }}>
              <div><span>Mode</span><b style={{ textTransform: "capitalize" }}>{quiz.quiz_type}</b></div>
              <div><span>Time limit</span><b>{quiz.time_limit_minutes ? `${quiz.time_limit_minutes} min` : "—"}</b></div>
              <div><span>Total marks</span><b>{quiz.total_marks}</b></div>
              <div><span>Submitted</span><b>{formatDate(quiz.submitted_for_review_at)}</b></div>
            </div>

            {quiz.review_status === "rejected" && quiz.review_note && (
              <div style={{ background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: "10px 14px", marginTop: 14, fontSize: 13 }}>
                <strong>Previous feedback:</strong> {quiz.review_note}
              </div>
            )}

            <h4 style={{ margin: "20px 0 10px" }}>{quiz.questions.length} question{quiz.questions.length !== 1 ? "s" : ""}</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflowY: "auto" }}>
              {quiz.questions.map((q, i) => {
                const correct = (q.choices || []).find((c) => c.is_correct);
                return (
                  <div key={q.id} style={{ border: "1px solid #eef0f3", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 12.5, color: "#4f6df5" }}>Q{i + 1}</span>
                      {q.topic && <span className="aq-chip">{q.topic}</span>}
                      <span className="aq-chip aq-chip--muted">{q.difficulty}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#9ca3af" }}>{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>{q.text}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {(q.choices || []).map((c) => (
                        <div key={c.id} style={{
                          fontSize: 12.5, padding: "5px 9px", borderRadius: 6,
                          background: c.is_correct ? "#dcfce7" : "#f8fafc",
                          color: c.is_correct ? "#166534" : "#4b5563",
                          fontWeight: c.is_correct ? 600 : 400,
                        }}>
                          {c.is_correct ? "✓ " : ""}{c.text}
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
                        <strong>Explanation:</strong> {q.explanation}
                      </div>
                    )}
                    {correct && !q.choices?.length && (
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>No choices found.</div>
                    )}
                  </div>
                );
              })}
            </div>

            {quiz.review_status === "pending" && !rejecting && (
              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <button className="approve-btn" onClick={approve} disabled={busy}>
                  {busy ? "Approving…" : "Approve & Publish"}
                </button>
                <button className="reject-btn" onClick={() => setRejecting(true)} disabled={busy}>
                  Reject
                </button>
                <button onClick={onClose} style={{ marginLeft: "auto", padding: "8px 16px", cursor: "pointer" }}>Close</button>
              </div>
            )}

            {quiz.review_status === "pending" && rejecting && (
              <div style={{ marginTop: 18 }}>
                <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 8 }}>
                  This reason is shown to the teacher so they can fix and resubmit.
                </p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Q4's explanation doesn't match the marked answer…"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d7dbe0", borderRadius: 8, fontFamily: "inherit", resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
                  <button onClick={() => setRejecting(false)} style={{ padding: "8px 16px", cursor: "pointer" }}>Cancel</button>
                  <button className="reject-btn" onClick={submitReject} disabled={busy || !reason.trim()}>
                    {busy ? "Rejecting…" : "Send back to teacher"}
                  </button>
                </div>
              </div>
            )}

            {quiz.review_status !== "pending" && (
              <div style={{ display: "flex", marginTop: 22 }}>
                <button onClick={onClose} style={{ marginLeft: "auto", padding: "8px 16px", cursor: "pointer" }}>Close</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AcademyQuizzes() {
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = () => {
    setLoading(true);
    getAcademyQuizzes({ status: status || undefined, search: search || undefined })
      .then((d) => setRows(Array.isArray(d) ? d : d?.results || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  // Debounce search a touch so we don't hammer the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, draft: 0 };
    rows.forEach((r) => { if (c[r.review_status] !== undefined) c[r.review_status] += 1; });
    return c;
  }, [rows]);

  const handleQuickApprove = (row) => {
    setConfirm({
      title: "Approve & publish this quiz?",
      message: `"${row.title}" will become visible to students immediately.`,
      onConfirm: async () => {
        try {
          const updated = await reviewAcademyQuiz(row.id, "approve");
          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
        } catch (err) {
          alert(err.response?.data?.detail || "Failed to approve quiz.");
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Academy Quizzes</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginTop: -8, marginBottom: 16 }}>
        Verify quizzes teachers submit before they go live to students.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {STATUS_TABS.map((t) => (
          <button
            key={t.key || "all"}
            onClick={() => setStatus(t.key)}
            style={{
              padding: "8px 18px", borderRadius: 100, cursor: "pointer", fontWeight: 600, fontSize: 13,
              border: status === t.key ? "2px solid #4f6df5" : "1px solid #d7dbe0",
              background: status === t.key ? "#4f6df515" : "#fff",
            }}
          >
            {t.label}{t.key && counts[t.key] ? ` (${counts[t.key]})` : ""}
          </button>
        ))}
      </div>

      <div className="dashboard-card approvals-table-card">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, teacher, or subject…"
          style={{ width: "100%", maxWidth: 360, padding: "8px 12px", border: "1px solid #d7dbe0", borderRadius: 8, margin: 14 }}
        />

        {loading ? (
          <div className="approvals-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="approvals-empty">No quizzes match these filters.</div>
        ) : (
          <table className="approvals-table">
            <thead>
              <tr>
                <th>Quiz</th><th>Subject</th><th>Teacher</th><th>Mode</th>
                <th>Questions</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="approvals-name">{r.title}</td>
                  <td>{r.subject_name}</td>
                  <td>{r.teacher_name}</td>
                  <td style={{ textTransform: "capitalize" }}>{r.quiz_type}</td>
                  <td>{r.questions_count}</td>
                  <td><Badge status={r.review_status} /></td>
                  <td className="approvals-actions">
                    <button onClick={() => setDetailId(r.id)} style={{ padding: "6px 12px", cursor: "pointer" }}>
                      Review
                    </button>
                    {r.review_status === "pending" && (
                      <button className="approve-btn" onClick={() => handleQuickApprove(r)}>Approve</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detailId && (
        <QuizDetailModal
          quizId={detailId}
          onClose={() => setDetailId(null)}
          onReviewed={(updated) => {
            setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated, questions_count: r.questions_count } : r)));
          }}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
