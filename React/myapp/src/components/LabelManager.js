import { useState } from "react";
import "./LabelManager.css";

function LabelManager({ isOpen, onClose, labels, canEdit, onSaveLabel, onDeleteLabel }) {
  const [label, setLabel] = useState("");
  const [startLine, setStartLine] = useState(1);
  const [endLine, setEndLine] = useState(1);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [message, setMessage] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!label.trim() || startLine < 1 || endLine < startLine) {
      setMessage("Enter a label and a valid line range.");
      return;
    }
    onSaveLabel(label.trim(), startLine, endLine);
    setLabel("");
    setMessage("Label saved to this room.");
  };

  const handleDelete = async (labelName) => {
    if (!labelName) return;
    if (!window.confirm(`Remove label "${labelName}"?`)) return;
    try {
      await onDeleteLabel(labelName);
      if (selectedLabel === labelName) setSelectedLabel("");
      setMessage("Label removed from this room.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="label-manager-overlay" onClick={onClose}>
      <section className="label-manager" onClick={(event) => event.stopPropagation()}>
        <button className="label-manager-close" onClick={onClose} aria-label="Close label manager">x</button>
        <div className="label-manager-heading">
          <span className="label-manager-mark">&lt;/&gt;</span>
          <div>
            <h2>Manage labels</h2>
            <p>Save reusable code blocks for everyone in this room.</p>
          </div>
        </div>

        {canEdit ? (
          <form className="label-form" onSubmit={handleSubmit}>
            <label>
              Label name
              <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="load_data" pattern="[a-zA-Z][a-zA-Z0-9_-]{0,99}" />
            </label>
            <div className="label-line-fields">
              <label>Starting line<input type="number" min="1" value={startLine} onChange={(event) => setStartLine(Number(event.target.value))} /></label>
              <label>Ending line<input type="number" min="1" value={endLine} onChange={(event) => setEndLine(Number(event.target.value))} /></label>
            </div>
            <button className="label-primary-button" type="submit">Save label</button>
          </form>
        ) : (
          <p className="label-readonly">You need edit access to create or update labels.</p>
        )}

        <div className="label-use-section">
          <label htmlFor="room-label-select">Remove a saved label</label>
          <div className="label-use-row">
            <select id="room-label-select" value={selectedLabel} onChange={(event) => setSelectedLabel(event.target.value)}>
              <option value="">Choose a label to remove</option>
              {labels.map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
            </select>
            <button className="label-remove-action-button" disabled={!selectedLabel || !canEdit} onClick={() => handleDelete(selectedLabel)}>Remove label</button>
          </div>
        </div>
        {message && <p className="label-manager-message">{message}</p>}
      </section>
    </div>
  );
}

export default LabelManager;
