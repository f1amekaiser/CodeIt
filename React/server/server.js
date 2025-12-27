require("dotenv").config();
const { spawn } = require("child_process");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool, initDB } = require("./db");
const { router: authRouter, authenticateToken } = require("./auth");
const roomsRouter = require("./rooms");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    allowedOrigins: process.env.FRONTEND_URL || [
      "https://codeiit.netlify.app",
      "localhost:3000",
    ],
    methods: ["GET", "POST"],
  },
});

// Store room code and active Python processes
const roomCodeMap = new Map();
const activeProcesses = new Map(); // socketId -> { process, tempDir }

// Create temp directory for code files
const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  let currentRoom = null;
  const socketId = socket.id;

  console.log(`Client connected: ${socketId}`);

  // Join room event
  socket.on("join-room", async (data) => {
    const { roomName, password, token } = data;

    try {
      // Verify JWT token
      const jwt = require("jsonwebtoken");
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Verify room password
      const result = await pool.query(
        "SELECT id, name, password FROM rooms WHERE name = $1",
        [roomName]
      );

      if (result.rows.length === 0) {
        socket.emit("room-error", { error: "Room does not exist" });
        return;
      }

      const room = result.rows[0];
      const validPassword = await bcrypt.compare(password, room.password);

      if (!validPassword) {
        socket.emit("room-error", { error: "Invalid room password" });
        return;
      }

      // Leave previous room if any
      if (currentRoom) {
        socket.leave(currentRoom);
      }

      currentRoom = roomName;
      socket.join(roomName);

      // Send existing code if any
      const existingCode = roomCodeMap.get(roomName);
      if (existingCode) {
        socket.emit("code-sync", existingCode);
      }

      socket.emit("room-joined", {
        roomName,
        message: `Successfully joined room: ${roomName}`,
      });

      console.log(`User ${decoded.username} joined room: ${roomName}`);
    } catch (error) {
      console.error("Room join error:", error);
      socket.emit("room-error", { error: "Failed to join room" });
    }
  });

  // Code update event
  socket.on("code-update", (code) => {
    if (currentRoom) {
      roomCodeMap.set(currentRoom, code);
      socket.to(currentRoom).emit("code-sync", code);
    }
  });

  // Terminal input event - for sending input to running Python process
  socket.on("terminal-input", (input) => {
    const processInfo = activeProcesses.get(socketId);
    if (processInfo && processInfo.process) {
      processInfo.process.stdin.write(input + "\n");
    }
  });

  // Run code event
  socket.on("run-code", (data) => {
    const { code, filename } = data;
    runPythonCode(socket, socketId, code, filename || "main.py");
  });

  // Kill process event
  socket.on("kill-process", () => {
    killProcess(socketId);
    socket.emit("terminal-output", "\n^C KeyboardInterrupt\n>>> ");
  });

  // Disconnect handler
  socket.on("disconnect", () => {
    killProcess(socketId);
    console.log(`Client disconnected: ${socketId}`);
  });
});

// Function to run Python code
function runPythonCode(socket, socketId, code, filename) {
  // Kill existing process if any
  killProcess(socketId);

  // Create session temp directory
  const sessionDir = path.join(tempDir, socketId.replace(/[^a-zA-Z0-9]/g, ""));
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Write code to file
  const filePath = path.join(sessionDir, filename);
  fs.writeFileSync(filePath, code, "utf8");

  socket.emit("terminal-output", `>>> python ${filename}\n`);

  // Spawn Python process
  const pythonProcess = spawn("python", [filePath], {
    cwd: sessionDir,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });

  activeProcesses.set(socketId, {
    process: pythonProcess,
    tempDir: sessionDir,
  });

  // Handle stdout
  pythonProcess.stdout.on("data", (data) => {
    socket.emit("terminal-output", data.toString());
  });

  // Handle stderr
  pythonProcess.stderr.on("data", (data) => {
    socket.emit("terminal-output", data.toString());
  });

  // Handle process exit
  pythonProcess.on("close", (code) => {
    activeProcesses.delete(socketId);
    socket.emit(
      "terminal-output",
      `\n[Process exited with code ${code}]\n>>> `
    );
    socket.emit("process-ended");
  });

  // Handle errors
  pythonProcess.on("error", (err) => {
    activeProcesses.delete(socketId);
    socket.emit("terminal-output", `\nError: ${err.message}\n>>> `);
    socket.emit("process-ended");
  });
}

// Function to kill a process
function killProcess(socketId) {
  const processInfo = activeProcesses.get(socketId);
  if (processInfo) {
    try {
      processInfo.process.kill("SIGTERM");
    } catch (e) {
      // Process may already be dead
    }
    activeProcesses.delete(socketId);
  }
}

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "https://codeiit.netlify.app",
    credentials: true,
  })
);
app.use(express.json());

// Auth routes
app.use("/api/auth", authRouter);

// Room routes
app.use("/api/rooms", roomsRouter);

// Run code endpoint (HTTP fallback)
app.post("/api/run", authenticateToken, (req, res) => {
  const { code, filename } = req.body;

  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  const sessionDir = path.join(tempDir, `http_${Date.now()}`);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const filePath = path.join(sessionDir, filename || "main.py");
  fs.writeFileSync(filePath, code, "utf8");

  const pythonProcess = spawn("python", [filePath], {
    cwd: sessionDir,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });

  let output = "";
  let errorOutput = "";

  pythonProcess.stdout.on("data", (data) => {
    output += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    errorOutput += data.toString();
  });

  pythonProcess.on("close", (exitCode) => {
    // Clean up temp directory
    fs.rmSync(sessionDir, { recursive: true, force: true });

    if (errorOutput) {
      res.json({ output: errorOutput, exitCode, error: true });
    } else {
      res.json({ output, exitCode, error: false });
    }
  });

  pythonProcess.on("error", (err) => {
    fs.rmSync(sessionDir, { recursive: true, force: true });
    res.status(500).json({ error: err.message });
  });
});

// Install package endpoint
app.post("/api/load", authenticateToken, (req, res) => {
  const name = req.body.message;
  if (!name) {
    return res.status(400).send("No name provided");
  }

  // Validate package name to prevent command injection
  const validPackageName = /^[a-zA-Z0-9_-]+$/;
  if (!validPackageName.test(name)) {
    return res.status(400).send("Invalid package name");
  }

  const { exec } = require("child_process");
  exec(`pip install ${name}`, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).send(`Error: ${err.message}`);
    }
    if (stderr && !stderr.includes("Successfully")) {
      return res.status(500).send(`Error: ${stderr}`);
    }
    res.send(`> ${stdout || stderr}`);
  });
});

// Initialize database and start server
const PORT = process.env.PORT || 5000;

initDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
