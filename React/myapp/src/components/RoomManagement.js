import { useCallback, useEffect, useState } from "react";
import "./RoomManagement.css";

function RoomManagement({ isOpen, onClose, roomName, token, permissions, onRoomDeleted }) {
  const API_URL = process.env.REACT_APP_API_URL || "https://codeit-ervv.onrender.com";
  const [members, setMembers] = useState([]);
  const [fileName, setFileName] = useState("main.py");
  const [startLine, setStartLine] = useState(1);
  const [endLine, setEndLine] = useState(1);
  const [message, setMessage] = useState("");

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_URL}/api/rooms/${roomName}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Room operation failed");
    return data;
  }, [API_URL, roomName, token]);

  const loadMembers = useCallback(() => request("/members").then((data) => setMembers(data.members)).catch((error) => setMessage(error.message)), [request]);

  useEffect(() => {
    if (isOpen) loadMembers();
  }, [isOpen, loadMembers]);

  if (!isOpen) return null;
  const canManage = permissions.role === "owner" || permissions.role === "admin";

  const updateMember = async (member, role, canEdit) => {
    try {
      await request(`/members/${member.id}`, { method: "PATCH", body: JSON.stringify({ role, canEdit }) });
      loadMembers();
    } catch (error) { setMessage(error.message); }
  };

  const removeMember = async (member) => {
    try {
      await request(`/members/${member.id}`, { method: "DELETE" });
      loadMembers();
    } catch (error) { setMessage(error.message); }
  };

  const addRestriction = async (event) => {
    event.preventDefault();
    try {
      await request("/edit-ranges", { method: "POST", body: JSON.stringify({ fileName, startLine, endLine }) });
      setMessage("Edit restriction added");
    } catch (error) { setMessage(error.message); }
  };

  const deleteRoom = async () => {
    if (!window.confirm(`Delete room ${roomName}?`)) return;
    try {
      await request("", { method: "DELETE" });
      onRoomDeleted();
      onClose();
    } catch (error) { setMessage(error.message); }
  };

  return (
    <div className="room-management-overlay" onClick={onClose}>
      <section className="room-management" onClick={(event) => event.stopPropagation()}>
        <button className="room-management-close" onClick={onClose}>x</button>
        <h2>Manage {roomName}</h2>
        {canManage && <>
          <h3>Members</h3>
          <div className="member-list">
            {members.map((member) => (
              <div className="member-row" key={member.id}>
                <strong>{member.username}</strong><span>{member.role}</span>
                {member.role !== "owner" && <>
                  <select value={member.role} onChange={(event) => updateMember(member, event.target.value, member.can_edit)} disabled={permissions.role !== "owner"}>
                    <option value="member">Member</option><option value="admin">Admin</option>
                  </select>
                  <label><input type="checkbox" checked={member.can_edit} onChange={(event) => updateMember(member, member.role, event.target.checked)} /> edit</label>
                  <button onClick={() => removeMember(member)}>Remove</button>
                </>}
              </div>
            ))}
          </div>
          <h3>Restrict member editing</h3>
          <form className="restriction-form" onSubmit={addRestriction}>
            <input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="file.py" />
            <input type="number" min="1" value={startLine} onChange={(event) => setStartLine(Number(event.target.value))} />
            <input type="number" min="1" value={endLine} onChange={(event) => setEndLine(Number(event.target.value))} />
            <button type="submit">Restrict</button>
          </form>
          {permissions.role === "owner" && <button className="delete-room-button" onClick={deleteRoom}>Delete room</button>}
        </>}
        {!canManage && <p>You have member access. Ask an owner or admin to change room settings.</p>}
        {message && <p className="room-management-message">{message}</p>}
      </section>
    </div>
  );
}

export default RoomManagement;
