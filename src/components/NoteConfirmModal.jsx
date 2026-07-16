import { useState } from "react";
import ConfirmModal from "./ConfirmModal";

// Wraps the existing ConfirmModal with an optional note textarea, matching
// the moderator-action confirmation shapes from the approved design (delete/
// ban/warn/unban/restore all share this one shell).
//
// `durationOptions`, when given (e.g. [3, 7, 14, 30]), renders a day-count
// chip picker above the note textarea (used by Suspend actions) and the
// selected value is passed back as the second argument to onConfirm.
const NoteConfirmModal = ({
  title,
  message,
  notePlaceholder,
  durationOptions,
  defaultDays,
  onConfirm,
  onCancel,
}) => {
  const [note, setNote] = useState("");
  const [days, setDays] = useState(defaultDays || (durationOptions ? durationOptions[0] : null));

  return (
    <ConfirmModal
      title={title}
      message={message}
      onCancel={onCancel}
      onConfirm={() => onConfirm(note, days)}
      extra={
        <>
          {durationOptions && (
            <div className="mod-duration-picker">
              <div className="mod-duration-label">Duration</div>
              <div className="mod-duration-chips">
                {durationOptions.map((d) => (
                  <button
                    type="button"
                    key={d}
                    className={`mod-chip${days === d ? " active" : ""}`}
                    onClick={() => setDays(d)}
                  >
                    {d} days
                  </button>
                ))}
              </div>
            </div>
          )}
          {notePlaceholder ? (
            <textarea
              className="mod-search"
              style={{ width: "100%", minHeight: 72, marginTop: 10, resize: "vertical" }}
              placeholder={notePlaceholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          ) : null}
        </>
      }
    />
  );
};

export default NoteConfirmModal;
