import { useState } from "react";
import "./RoomModal.css";

function RoomModal({ isOpen, onClose, onJoin, onCreate, socket, token }) {
  const [mode, setMode] = useState("join"); // 'join' or 'create'
  const [roomName, setRoomName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const API_URL =
    process.env.REACT_APP_API_URL || "https://codeit-ervv.onrender.com";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint =
        mode === "create" ? "/api/rooms/create" : "/api/rooms/join";
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomName, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Operation failed");
      }

      // Connect to room via socket
      socket.emit("join-room", { roomName, password, token });

      if (mode === "create") {
        onCreate(data.room);
      } else {
        onJoin(data.room);
      }

      // Reset form
      setRoomName("");
      setPassword("");
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <h2 className="modal-title">
          {mode === "create" ? "Create New Room" : "Join Room"}
        </h2>

        <div className="mode-toggle">
          <button
            className={`toggle-btn ${mode === "join" ? "active" : ""}`}
            onClick={() => {
              setMode("join");
              setError("");
            }}
          >
            Join Room
          </button>
          <button
            className={`toggle-btn ${mode === "create" ? "active" : ""}`}
            onClick={() => {
              setMode("create");
              setError("");
            }}
          >
            Create Room
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="roomName">Room Name</label>
            <input
              type="text"
              id="roomName"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name"
              required
              pattern="[a-zA-Z0-9_-]+"
              title="Only letters, numbers, underscores, and hyphens allowed"
            />
          </div>

          <div className="form-group">
            <label htmlFor="roomPassword">Room Password</label>
            <input
              type="password"
              id="roomPassword"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter room password"
              required
              minLength={4}
            />
          </div>

          {error && <div className="modal-error">{error}</div>}

          <button type="submit" className="modal-submit" disabled={loading}>
            {loading ? (
              <span className="loading-spinner"></span>
            ) : mode === "create" ? (
              "Create Room"
            ) : (
              "Join Room"
            )}
          </button>
        </form>

        <p className="modal-hint">
          {mode === "create"
            ? "Create a new collaborative coding room and share the name and password with teammates."
            : "Enter the room name and password to join an existing collaborative session."}
        </p>
      </div>
    </div>
  );
}

export default RoomModal;
