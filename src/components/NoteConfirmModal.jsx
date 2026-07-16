import { useState } from "react";
import ConfirmModal from "./ConfirmModal";

// Wraps the existing ConfirmModal with an optional note textarea, matching
// the moderator-action confirmation shapes from the approved design (delete/
// ban/warn/unban/restore all share this one shell).
const NoteConfirmModal = ({ title, message, notePlaceholder, onConfirm, onCancel }) => {
  const [note, setNote] = useState("");
  return (
    <ConfirmModal
      title={title}
      message={message}
      onCancel={onCancel}
      onConfirm={() => onConfirm(note)}
      extra={
        notePlaceholder ? (
          <textarea
            className="mod-search"
            style={{ width: "100%", minHeight: 72, marginTop: 10, resize: "vertical" }}
            placeholder={notePlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        ) : null
      }
    />
  );
};

export default NoteConfirmModal;
