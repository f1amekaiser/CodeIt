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
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className={`run-btn ${isRunning ? "running" : ""}`}
          onClick={onRun}
          disabled={isRunning || !activeFile}
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
        <button className="action-btn" onClick={onClear} title="Clear editor">
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
            📦 Install
          </button>
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
          <span className="btn-icon">👥</span>
          {currentRoom ? "Switch Room" : "Join Room"}
        </button>
      </div>
    </header>
  );
}

export default Topbar;
