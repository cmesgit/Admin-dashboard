import { useEffect, useState } from "react";
import {
  getQuestionBank, createQuestionBankItem, updateQuestionBankItem, deleteQuestionBankItem,
} from "../../api/admin_scholarship";
import ConfirmModal from "../../components/ConfirmModal";
import GenerateAiModal from "./GenerateAiModal";
import { errText } from "../../utils/errText";

const CLASS_LEVELS = [8, 9, 10, 11, 12];
const SUBJECTS = [
  ["mathematics", "Mathematics"], ["science", "Science"], ["english", "English"],
  ["social_studies", "Social Studies"], ["general_knowledge", "General Knowledge"],
  ["current_affairs", "Current Affairs"],
];
const DIFFICULTIES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Challenging"]];
const KEYS = ["A", "B", "C", "D"];

function QuestionFormModal({ mode, initial, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    class_level: initial?.class_level ?? 10,
    subject: initial?.subject ?? SUBJECTS[0][0],
    difficulty: initial?.difficulty ?? "medium",
    text: initial?.text ?? "",
    options: initial?.options ?? ["", "", "", ""],
    correct_option_index: initial?.correct_option_index ?? 0,
    explanation: initial?.explanation ?? "",
    is_active: initial?.is_active ?? true,
  });
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setOption = (i) => (e) =>
    setForm((f) => ({ ...f, options: f.options.map((o, idx) => (idx === i ? e.target.value : o)) }));

  const valid = form.text.trim() && form.options.every((o) => o.trim());

  const submit = () => {
    onSubmit({
      class_level: Number(form.class_level),
      subject: form.subject,
      difficulty: form.difficulty,
      text: form.text.trim(),
      options: form.options.map((o) => o.trim()),
      correct_option_index: Number(form.correct_option_index),
      explanation: form.explanation.trim(),
      is_active: form.is_active,
    });
  };

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div className="cm-form-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <h3>{mode === "edit" ? "Edit Question" : "New Question"}</h3>

        <div className="cm-row">
          <label className="cm-field">
            <span>Class</span>
            <select value={form.class_level} onChange={set("class_level")}>
              {CLASS_LEVELS.map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </label>
          <label className="cm-field">
            <span>Subject</span>
            <select value={form.subject} onChange={set("subject")}>
              {SUBJECTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="cm-field">
            <span>Difficulty</span>
            <select value={form.difficulty} onChange={set("difficulty")}>
              {DIFFICULTIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>

        <label className="cm-field">
          <span>Question text</span>
          <textarea rows={2} value={form.text} onChange={set("text")} style={{ resize: "vertical", fontFamily: "inherit" }} />
        </label>

        <span style={{ fontWeight: 600, fontSize: 13, display: "block", margin: "10px 0 4px" }}>
          Options — mark the correct one
        </span>
        {form.options.map((opt, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <input
              type="radio"
              name="correct_option_index"
              checked={Number(form.correct_option_index) === i}
              onChange={() => setForm((f) => ({ ...f, correct_option_index: i }))}
            />
            <span style={{ width: 18, fontWeight: 700, color: "#4f6df5" }}>{KEYS[i]}</span>
            <input value={opt} onChange={setOption(i)} style={{ flex: 1, padding: 6 }} placeholder={`Option ${KEYS[i]}`} />
          </div>
        ))}

        <label className="cm-field">
          <span>Explanation (optional)</span>
          <textarea rows={2} value={form.explanation} onChange={set("explanation")} style={{ resize: "vertical", fontFamily: "inherit" }} />
        </label>

        <label className="cm-check" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={form.is_active} onChange={set("is_active")} />
          <span>Active (eligible to be sampled into a real exam)</span>
        </label>

        {error && <div className="cm-form-error">{error}</div>}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="confirm-ok" onClick={submit} disabled={busy || !valid}>
            {busy ? "Saving…" : mode === "edit" ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QuestionBankTab({ onAction }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ class_level: "", subject: "", difficulty: "", source: "", is_active: "" });
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [aiModal, setAiModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const notify = (msg) => onAction && onAction(msg);

  const load = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ""));
      const d = await getQuestionBank(params);
      setRows(Array.isArray(d) ? d : d.results || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters]);

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (payload) => {
    setBusy(true); setFormError("");
    try {
      if (modal.mode === "edit") {
        const updated = await updateQuestionBankItem(modal.initial.id, payload);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        notify("Question updated.");
      } else {
        const created = await createQuestionBankItem(payload);
        setRows((prev) => [created, ...prev]);
        notify("Question created.");
      }
      setModal(null);
    } catch (e) {
      setFormError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await deleteQuestionBankItem(confirm.item.id);
      setRows((prev) => prev.filter((r) => r.id !== confirm.item.id));
      notify("Question deleted.");
      setConfirm(null);
    } catch (e) {
      setConfirm((c) => ({ ...c, error: errText(e) }));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      const updated = await updateQuestionBankItem(row.id, { is_active: !row.is_active });
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    } catch (e) {
      onAction && onAction(errText(e));
    }
  };

  return (
    <div>
      <div className="cms-toolbar" style={{ flexWrap: "wrap", gap: 10 }}>
        <select value={filters.class_level} onChange={setFilter("class_level")} style={{ padding: 8 }}>
          <option value="">All classes</option>
          {CLASS_LEVELS.map((c) => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <select value={filters.subject} onChange={setFilter("subject")} style={{ padding: 8 }}>
          <option value="">All subjects</option>
          {SUBJECTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.difficulty} onChange={setFilter("difficulty")} style={{ padding: 8 }}>
          <option value="">All difficulties</option>
          {DIFFICULTIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.is_active} onChange={setFilter("is_active")} style={{ padding: 8 }}>
          <option value="">Active + inactive</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
        <div className="cms-toolbar-spacer" />
        <button className="cm-add-btn" style={{ background: "#fff", color: "#4f6df5", border: "1.5px solid #4f6df5" }} onClick={() => setAiModal(true)}>
          ✨ Generate with AI
        </button>
        <button className="cm-add-btn" onClick={() => { setFormError(""); setModal({ mode: "create", initial: {} }); }}>
          + New Question
        </button>
      </div>

      <div className="dashboard-card courses-table-card">
        {loading ? (
          <div className="dashboard-loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="dashboard-loading">No questions match these filters.</div>
        ) : (
          <table className="courses-table">
            <thead>
              <tr><th>Question</th><th>Class</th><th>Subject</th><th>Difficulty</th><th>Source</th><th>Status</th><th aria-label="actions" /></tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id}>
                  <td className="courses-title" style={{ maxWidth: 360 }}>{q.text}</td>
                  <td>{q.class_level}</td>
                  <td style={{ textTransform: "capitalize" }}>{q.subject.replace("_", " ")}</td>
                  <td style={{ textTransform: "capitalize" }}>{q.difficulty}</td>
                  <td>{q.source === "ai_generated" ? "AI" : "Manual"}</td>
                  <td>
                    <button
                      className={`mod-badge ${q.is_active ? "pal-green" : "pal-gray"}`}
                      style={{ border: "none", cursor: "pointer" }}
                      onClick={() => toggleActive(q)}
                      title="Click to toggle"
                    >
                      {q.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="cm-actions">
                    <button className="cm-icon-btn" onClick={() => { setFormError(""); setModal({ mode: "edit", initial: q }); }}>Edit</button>
                    <button className="cm-icon-btn cm-icon-btn--danger" onClick={() => setConfirm({ item: q })}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <QuestionFormModal
          mode={modal.mode}
          initial={modal.initial}
          busy={busy}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={() => setModal(null)}
        />
      )}

      {confirm && (
        <ConfirmModal
          title="Delete Question"
          message="Delete this question from the bank? Exams that already used it keep their own frozen copy — this only removes it from future generation."
          extra={confirm.error ? <div className="cm-form-error">{confirm.error}</div> : null}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}

      {aiModal && (
        <GenerateAiModal
          onClose={() => setAiModal(false)}
          onCreated={(created) => {
            setRows((prev) => [...created, ...prev]);
            notify(`${created.length} question${created.length !== 1 ? "s" : ""} added (inactive — review then activate).`);
            setAiModal(false);
          }}
        />
      )}
    </div>
  );
}
