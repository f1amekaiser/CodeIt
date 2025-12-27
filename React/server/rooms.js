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

module.exports = router;
