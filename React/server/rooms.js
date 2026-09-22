const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("./db");
const { authenticateToken } = require("./auth");

const router = express.Router();

// Create a new room
router.post("/create", authenticateToken, async (req, res) => {
  const { roomName, password } = req.body;
  const userId = req.user.id;

  if (!roomName || !password) {
    return res
      .status(400)
      .json({ error: "Room name and password are required" });
  }

  if (roomName.length < 3 || roomName.length > 100) {
    return res
      .status(400)
      .json({ error: "Room name must be between 3 and 100 characters" });
  }

  if (password.length < 4) {
    return res
      .status(400)
      .json({ error: "Password must be at least 4 characters" });
  }

  // Validate room name format (alphanumeric, underscores, hyphens)
  const validName = /^[a-zA-Z0-9_-]+$/;
  if (!validName.test(roomName)) {
    return res
      .status(400)
      .json({
        error:
          "Room name can only contain letters, numbers, underscores, and hyphens",
      });
  }

  try {
    // Check if room already exists
    const existingRoom = await pool.query(
      "SELECT id FROM rooms WHERE name = $1",
      [roomName]
    );

    if (existingRoom.rows.length > 0) {
      return res.status(409).json({ error: "Room name already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create room
    const result = await pool.query(
      "INSERT INTO rooms (name, password, created_by) VALUES ($1, $2, $3) RETURNING id, name",
      [roomName, hashedPassword, userId]
    );

    const room = result.rows[0];

    await pool.query(
      "INSERT INTO room_members (room_id, user_id, role, can_edit) VALUES ($1, $2, 'owner', TRUE)",
      [room.id, userId]
    );

    res.status(201).json({
      message: "Room created successfully",
      room: { id: room.id, name: room.name },
    });
  } catch (error) {
    console.error("Room creation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Join an existing room
router.post("/join", authenticateToken, async (req, res) => {
  const { roomName, password } = req.body;

  if (!roomName || !password) {
    return res
      .status(400)
      .json({ error: "Room name and password are required" });
  }

  try {
    // Find room
    const result = await pool.query(
      "SELECT id, name, password FROM rooms WHERE name = $1",
      [roomName]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Room does not exist" });
    }

    const room = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, room.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid room password" });
    }

    await pool.query(
      `INSERT INTO room_members (room_id, user_id, role, can_edit)
       VALUES ($1, $2, 'member', TRUE)
       ON CONFLICT (room_id, user_id) DO NOTHING`,
      [room.id, req.user.id]
    );

    res.json({
      message: "Joined room successfully",
      room: { id: room.id, name: room.name },
    });
  } catch (error) {
    console.error("Room join error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Check if room exists (for validation before joining)
router.get("/exists/:roomName", authenticateToken, async (req, res) => {
  const { roomName } = req.params;

  try {
    const result = await pool.query(
      "SELECT id, name FROM rooms WHERE name = $1",
      [roomName]
    );

    res.json({ exists: result.rows.length > 0 });
  } catch (error) {
    console.error("Room check error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const getMembership = async (roomName, userId) => {
  const result = await pool.query(
    `SELECT r.id AS room_id, r.name, r.created_by, rm.role, rm.can_edit
     FROM rooms r
     JOIN room_members rm ON rm.room_id = r.id
     WHERE r.name = $1 AND rm.user_id = $2`,
    [roomName, userId]
  );
  return result.rows[0] || null;
};

const requireRoomManager = async (req, res, next) => {
  const membership = await getMembership(req.params.roomName, req.user.id);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return res.status(403).json({ error: "Room manager access required" });
  }
  req.membership = membership;
  next();
};

router.get("/:roomName/members", authenticateToken, async (req, res) => {
  const membership = await getMembership(req.params.roomName, req.user.id);
  if (!membership) return res.status(403).json({ error: "Not a room member" });

  const result = await pool.query(
    `SELECT u.id, u.username, rm.role, rm.can_edit
     FROM room_members rm JOIN users u ON u.id = rm.user_id
     WHERE rm.room_id = $1 ORDER BY rm.joined_at`,
    [membership.room_id]
  );
  res.json({ members: result.rows });
});

router.patch("/:roomName/members/:userId", authenticateToken, requireRoomManager, async (req, res) => {
  const { role, canEdit } = req.body;
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || !["admin", "member"].includes(role) || typeof canEdit !== "boolean") {
    return res.status(400).json({ error: "role and canEdit are required" });
  }

  const target = await pool.query(
    "SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2",
    [req.membership.room_id, userId]
  );
  if (!target.rows.length) return res.status(404).json({ error: "Member not found" });
  if (target.rows[0].role === "owner" || userId === req.user.id) {
    return res.status(403).json({ error: "The owner and your own membership cannot be changed here" });
  }
  if (req.membership.role !== "owner" && role === "admin") {
    return res.status(403).json({ error: "Only the owner can grant admin access" });
  }

  await pool.query(
    "UPDATE room_members SET role = $1, can_edit = $2 WHERE room_id = $3 AND user_id = $4",
    [role, canEdit, req.membership.room_id, userId]
  );
  res.json({ message: "Member permissions updated" });
});

router.delete("/:roomName/members/:userId", authenticateToken, requireRoomManager, async (req, res) => {
  const userId = Number(req.params.userId);
  const result = await pool.query(
    "DELETE FROM room_members WHERE room_id = $1 AND user_id = $2 AND role <> 'owner' RETURNING user_id",
    [req.membership.room_id, userId]
  );
  if (!result.rows.length) return res.status(404).json({ error: "Member not found or cannot remove owner" });
  res.json({ message: "Member removed" });
});

router.delete("/:roomName", authenticateToken, requireRoomManager, async (req, res) => {
  if (req.membership.role !== "owner") return res.status(403).json({ error: "Only the owner can delete a room" });
  await pool.query("DELETE FROM rooms WHERE id = $1", [req.membership.room_id]);
  res.json({ message: "Room deleted" });
});

router.post("/:roomName/edit-ranges", authenticateToken, requireRoomManager, async (req, res) => {
  const { fileName, startLine, endLine } = req.body;
  if (!fileName || !Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine) {
    return res.status(400).json({ error: "Valid fileName, startLine, and endLine are required" });
  }
  const result = await pool.query(
    `INSERT INTO room_edit_ranges (room_id, file_name, start_line, end_line, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (room_id, file_name, start_line, end_line)
     DO UPDATE SET created_by = EXCLUDED.created_by
     RETURNING id, file_name AS "fileName", start_line AS "startLine", end_line AS "endLine"`,
    [req.membership.room_id, fileName, startLine, endLine, req.user.id]
  );
  res.status(201).json({ range: result.rows[0] });
});

router.delete("/:roomName/edit-ranges/:rangeId", authenticateToken, requireRoomManager, async (req, res) => {
  await pool.query("DELETE FROM room_edit_ranges WHERE id = $1 AND room_id = $2", [req.params.rangeId, req.membership.room_id]);
  res.json({ message: "Edit restriction removed" });
});

router.get("/:roomName/labels", authenticateToken, async (req, res) => {
  const membership = await getMembership(req.params.roomName, req.user.id);
  if (!membership) return res.status(403).json({ error: "Not a room member" });
  const result = await pool.query(
    `SELECT label, file_name AS "fileName", start_line AS "startLine", end_line AS "endLine", code
     FROM room_code_labels WHERE room_id = $1 ORDER BY label`,
    [membership.room_id]
  );
  res.json({ labels: result.rows });
});

router.post("/:roomName/labels", authenticateToken, async (req, res) => {
  const membership = await getMembership(req.params.roomName, req.user.id);
  if (!membership || !membership.can_edit) return res.status(403).json({ error: "Edit access required" });
  const { label, fileName, startLine, endLine, code } = req.body;
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,99}$/.test(label || "") || !fileName || !code || !Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine) {
    return res.status(400).json({ error: "Valid label, fileName, line numbers, and code are required" });
  }
  const result = await pool.query(
    `INSERT INTO room_code_labels (room_id, label, file_name, start_line, end_line, code, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (room_id, label) DO UPDATE SET file_name = EXCLUDED.file_name,
       start_line = EXCLUDED.start_line, end_line = EXCLUDED.end_line, code = EXCLUDED.code,
       updated_at = CURRENT_TIMESTAMP
     RETURNING label, file_name AS "fileName", start_line AS "startLine", end_line AS "endLine", code`,
    [membership.room_id, label, fileName, startLine, endLine, code, req.user.id]
  );
  res.status(201).json({ label: result.rows[0] });
});

router.delete("/:roomName/labels/:label", authenticateToken, async (req, res) => {
  const membership = await getMembership(req.params.roomName, req.user.id);
  if (!membership || !membership.can_edit) {
    return res.status(403).json({ error: "Edit access required" });
  }

  const result = await pool.query(
    "DELETE FROM room_code_labels WHERE room_id = $1 AND label = $2 RETURNING label",
    [membership.room_id, req.params.label]
  );
  if (!result.rows.length) return res.status(404).json({ error: "Label not found" });
  res.json({ message: "Label removed", label: result.rows[0].label });
});

module.exports = { router, getMembership };
