import { useState } from "react";
import { generateAiQuestions, bulkCreateQuestionBankItems } from "../../api/admin_scholarship";
import { errText } from "../../utils/errText";

const CLASS_LEVELS = [8, 9, 10, 11, 12];
const SUBJECTS = [
  ["mathematics", "Mathematics"], ["science", "Science"], ["english", "English"],
  ["social_studies", "Social Studies"], ["general_knowledge", "General Knowledge"],
  ["current_affairs", "Current Affairs"],
];
const DIFFICULTIES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Challenging"]];
const KEYS = ["A", "B", "C", "D"];

// Two-step, drafts-then-save flow — mirrors the backend's own separation
// (generate-ai/ writes nothing; bulk-create/ is the only thing that
// persists). Nothing an AI writes reaches a real exam unreviewed: drafts
// land here editable, and even after saving they're created `is_active:
// false` until an admin explicitly activates them from the main list.
export default function GenerateAiModal({ onClose, onCreated }) {
  const [params, setParams] = useState({ class_level: 10, subject: SUBJECTS[0][0], difficulty: "medium", count: 5 });
  const [drafts, setDrafts] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setParam = (k) => (e) => setParams((p) => ({ ...p, [k]: e.target.value }));

  const generate = async () => {
    setGenerating(true); setError("");
    try {
      const { questions } = await generateAiQuestions({
        class_level: Number(params.class_level), subject: params.subject,
        difficulty: params.difficulty, count: Number(params.count),
      });
      setDrafts(questions);
    } catch (e) {
      setError(errText(e));
    } finally {
      setGenerating(false);
    }
  };

  const updateDraft = (i, patch) => setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const updateDraftOption = (i, optIdx, value) =>
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, options: d.options.map((o, oi) => (oi === optIdx ? value : o)) } : d)));
  const removeDraft = (i) => setDrafts((prev) => prev.filter((_, idx) => idx !== i));

  const saveAll = async () => {
    setSaving(true); setError("");
    try {
      const { created, errors } = await bulkCreateQuestionBankItems(drafts);
      if (errors?.length) {
        setError(`${errors.length} question(s) failed validation and were skipped.`);
      }
      if (created?.length) onCreated(created);
      else if (!errors?.length) onClose();
    } catch (e) {
      setError(errText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="confirm-overlay" onClick={generating || saving ? undefined : onClose}>
      <div className="cm-form-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }}>
        <h3>Generate questions with AI</h3>

        {!drafts && (
          <>
            <div className="cm-row">
              <label className="cm-field">
                <span>Class</span>
                <select value={params.class_level} onChange={setParam("class_level")}>
                  {CLASS_LEVELS.map((c) => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </label>
              <label className="cm-field">
                <span>Subject</span>
                <select value={params.subject} onChange={setParam("subject")}>
                  {SUBJECTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </div>
            <div className="cm-row">
              <label className="cm-field">
                <span>Difficulty</span>
                <select value={params.difficulty} onChange={setParam("difficulty")}>
                  {DIFFICULTIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="cm-field">
                <span>How many (max 20)</span>
                <input type="number" min={1} max={20} value={params.count} onChange={setParam("count")} />
              </label>
            </div>

            {error && <div className="cm-form-error">{error}</div>}

            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={onClose} disabled={generating}>Cancel</button>
              <button className="confirm-ok" onClick={generate} disabled={generating}>
                {generating ? "Generating…" : "Generate drafts"}
              </button>
            </div>
          </>
        )}

        {drafts && (
          <>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 14px" }}>
              Review and edit before saving — nothing is stored yet. Saved questions land <strong>inactive</strong>;
              activate them from the list once you're happy.
            </p>
            {drafts.length === 0 ? (
              <div className="dashboard-loading">No drafts left — add more with "Generate drafts" again.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 14 }}>
                {drafts.map((d, i) => (
                  <div key={i} style={{ border: "1px solid #eef0f3", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 12.5, color: "#4f6df5" }}>Draft {i + 1}</span>
                      <button className="cm-icon-btn cm-icon-btn--danger" onClick={() => removeDraft(i)}>Remove</button>
                    </div>
                    <textarea
                      value={d.text} onChange={(e) => updateDraft(i, { text: e.target.value })}
                      rows={2} style={{ width: "100%", padding: 8, fontFamily: "inherit", marginBottom: 8, resize: "vertical" }}
                    />
                    {d.options.map((opt, oi) => (
                      <div key={oi} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <input
                          type="radio" name={`correct-${i}`}
                          checked={Number(d.correct_option_index) === oi}
                          onChange={() => updateDraft(i, { correct_option_index: oi })}
                        />
                        <span style={{ width: 16, fontWeight: 700, color: "#4f6df5" }}>{KEYS[oi]}</span>
                        <input value={opt} onChange={(e) => updateDraftOption(i, oi, e.target.value)} style={{ flex: 1, padding: 6 }} />
                      </div>
                    ))}
                    {d.explanation && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>{d.explanation}</div>}
                  </div>
                ))}
              </div>
            )}

            {error && <div className="cm-form-error">{error}</div>}

            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setDrafts(null)} disabled={saving}>Back</button>
              <button className="confirm-ok" onClick={saveAll} disabled={saving || drafts.length === 0}>
                {saving ? "Saving…" : `Save ${drafts.length} question${drafts.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
