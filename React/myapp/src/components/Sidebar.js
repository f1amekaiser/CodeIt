import { useState } from "react";
import "./Sidebar.css";

function Sidebar({
  files,
  activeFile,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
  user,
  onLogout,
  currentRoom,
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [editingFile, setEditingFile] = useState(null);
  const [editName, setEditName] = useState("");

  const handleCreate = () => {
    if (!newFileName.trim()) return;

    let fileName = newFileName.trim();
    if (!fileName.endsWith(".py")) {
      fileName += ".py";
    }

    // Validate filename
    const validName = /^[a-zA-Z0-9_-]+\.py$/;
    if (!validName.test(fileName)) {
      alert(
        "Invalid filename. Use only letters, numbers, underscores, and hyphens."
      );
      return;
    }

    // Check for duplicates
    if (files.some((f) => f.name === fileName)) {
      alert("A file with this name already exists.");
      return;
    }

    onFileCreate(fileName);
    setNewFileName("");
    setIsCreating(false);
  };

  const handleRename = (oldName) => {
    if (!editName.trim()) {
      setEditingFile(null);
      return;
    }

    let fileName = editName.trim();
    if (!fileName.endsWith(".py")) {
      fileName += ".py";
    }

    const validName = /^[a-zA-Z0-9_-]+\.py$/;
    if (!validName.test(fileName)) {
      alert("Invalid filename.");
      return;
    }

    if (fileName !== oldName && files.some((f) => f.name === fileName)) {
      alert("A file with this name already exists.");
      return;
    }

    onFileRename(oldName, fileName);
    setEditingFile(null);
    setEditName("");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="logo">
          <span className="logo-icon">⟨/⟩</span>
          CodeIt
        </h1>
      </div>

      {user && (
        <div className="user-section">
          <div className="user-avatar">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <span className="user-name">{user.username}</span>
            {currentRoom && (
              <span className="room-badge">📁 {currentRoom}</span>
            )}
          </div>
          <button className="logout-btn" onClick={onLogout} title="Logout">
            ⎋
          </button>
        </div>
      )}

      <div className="files-section">
        <div className="files-header">
          <h3>Session Files</h3>
          <button
            className="add-file-btn"
            onClick={() => setIsCreating(true)}
            title="Create new file"
          >
            +
          </button>
        </div>

        {isCreating && (
          <div className="new-file-form">
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="filename.py"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setIsCreating(false);
              }}
            />
            <div className="form-actions">
              <button className="confirm-btn" onClick={handleCreate}>
                ✓
              </button>
              <button
                className="cancel-btn"
                onClick={() => setIsCreating(false)}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <ul className="file-list">
          {files.map((file) => (
            <li
              key={file.name}
              className={`file-item ${
                activeFile === file.name ? "active" : ""
              }`}
            >
              {editingFile === file.name ? (
                <div className="edit-file-form">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(file.name);
                      if (e.key === "Escape") setEditingFile(null);
                    }}
                  />
                  <button
                    className="confirm-btn"
                    onClick={() => handleRename(file.name)}
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <>
                  <span
                    className="file-name"
                    onClick={() => onFileSelect(file.name)}
                  >
                    <span className="file-icon">🐍</span>
                    {file.name}
                  </span>
                  <div className="file-actions">
                    <button
                      className="action-btn"
                      onClick={() => {
                        setEditingFile(file.name);
                        setEditName(file.name.replace(".py", ""));
                      }}
                      title="Rename"
                    >
                      ✎
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => {
                        if (window.confirm(`Delete ${file.name}?`)) {
                          onFileDelete(file.name);
                        }
                      }}
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>

        {files.length === 0 && !isCreating && (
          <p className="no-files">No files yet. Click + to create one.</p>
        )}
      </div>

      <div className="sidebar-footer">
        <p className="session-note">💡 Files are saved in this session only</p>
      </div>
    </aside>
  );
}

export default Sidebar;
