import { useEffect, useRef, useState } from "react";
import "./Topbar.css";

function Topbar({
  onRun,
  onClear,
  searchTerm,
  setTerm,
  onSearch,
  onOpenRoomModal,
  currentRoom,
  activeFile,
  isRunning,
  onManageRoom,
  onManageLabels,
  canEdit,
  labels,
  onSaveLabel,
  onUseLabel,
}) {
  const [isLabelMenuOpen, setIsLabelMenuOpen] = useState(false);
  const labelMenuRef = useRef(null);

  useEffect(() => {
    const closeLabelMenu = (event) => {
      if (!labelMenuRef.current?.contains(event.target)) {
        setIsLabelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeLabelMenu);
    return () => document.removeEventListener("mousedown", closeLabelMenu);
  }, []);

  const handleLabelUse = (label) => {
    onUseLabel(label);
    setIsLabelMenuOpen(false);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className={`run-btn ${isRunning ? "running" : ""}`}
          onClick={onRun}
          disabled={isRunning || !activeFile || !canEdit}
          title={
            !activeFile
              ? "Create a file first"
              : isRunning
              ? "Process running..."
              : "Run code"
          }
        >
          {isRunning ? (
            <>
              <span className="run-icon spinning">⟳</span>
              Running
            </>
          ) : (
            <>
              <span className="run-icon">▶</span>
              Run
            </>
          )}
        </button>
        <button className="clear-btn" onClick={onClear} disabled={!canEdit} title="Clear editor">
          <span className="btn-icon">🗑</span>
          Clear
        </button>

        {activeFile && (
          <div className="current-file">
            <span className="file-label">Editing:</span>
            <span className="file-name">{activeFile}</span>
          </div>
        )}
      </div>

      <div className="topbar-center">
        <div className="module-search">
          <input
            type="text"
            className="search-input"
            placeholder="Package name..."
            value={searchTerm}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
          />
          <button
            className="install-btn"
            onClick={onSearch}
            title="Install Python package"
          >
            Install
          </button>
        </div>
        <button className="label-manager-button" onClick={onManageLabels} disabled={!currentRoom} title="Manage reusable room code labels">
          <span className="label-manager-icon">#</span>
          Manage labels
        </button>
        <div className="label-picker" ref={labelMenuRef}>
          <button
            className={`label-dropdown ${isLabelMenuOpen ? "open" : ""}`}
            onClick={() => setIsLabelMenuOpen((open) => !open)}
            disabled={!labels.length || !canEdit}
            title="Insert a label at the editor cursor"
            aria-haspopup="listbox"
            aria-expanded={isLabelMenuOpen}
          >
            <span>Use label</span>
            <span className="label-dropdown-chevron">⌄</span>
          </button>
          {isLabelMenuOpen && (
            <div className="label-dropdown-menu" role="menu">
              {labels.map((item) => (
                <button
                  className="label-dropdown-option"
                  key={item.label}
                  onClick={() => handleLabelUse(item.label)}
                  role="menuitem"
                >
                  <span className="label-option-mark">#</span>
                  <span>{item.label}</span>
                  <small>{item.fileName}:{item.startLine}-{item.endLine}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="topbar-right">
        {currentRoom ? (
          <div className="room-info">
            <span className="room-indicator"></span>
            <span className="room-name">{currentRoom}</span>
          </div>
        ) : null}
        <button className="room-btn" onClick={onOpenRoomModal}>
          {currentRoom ? "Switch Room" : "Join Room"}
        </button>
        {currentRoom && (onManageRoom && <button className="room-btn" onClick={onManageRoom}>Manage</button>)}
      </div>
    </header>
  );
}

export default Topbar;
