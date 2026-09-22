require("dotenv").config();
const { spawn, exec } = require("child_process");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { pool, initDB } = require("./db");
const { router: authRouter, authenticateToken } = require("./auth");
const { router: roomsRouter, getMembership, getRestrictedRangesForFile } = require("./rooms");

const app = express();
const server = http.createServer(app);

/* =======================
   SECURITY LIMITS
======================= */
const EXECUTION_TIMEOUT_MS = 30000; // 30s wall time
const MAX_CPU_SECONDS = 2; // CPU time
const MAX_MEMORY_KB = 256 * 1024; // 256MB RAM

function resolvePythonCommand() {
  const configured = process.env.PYTHON_COMMAND || process.env.PYTHON || process.env.PYTHON_BIN;
  if (configured && configured.trim()) return configured.trim();

  const candidates = process.platform === "win32"
    ? ["py", "python", "python3"]
    : ["python3", "python"];

  for (const candidate of candidates) {
    try {
      const command = process.platform === "win32"
        ? "where"
        : "which";

      const result = require("child_process").execFileSync(command, [candidate], {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });

      if (result && result.toString().trim()) return candidate;
    } catch {}
  }

  return process.platform === "win32" ? "python" : "python3";
}

function buildPythonArgs(pythonCommand, filePath) {
  if (process.platform === "win32" && pythonCommand.toLowerCase() === "py") {
    return ["-3", "-I", "-u", filePath];
  }
  return ["-I", "-u", filePath];
}

function sanitizeFilename(filename) {
  const safeName = typeof filename === "string" ? filename : "main.py";
  const fileName = safeName
    .replace(/\\/g, "/")
    .split(/[\/]+/)
    .filter(Boolean)
    .pop();

  return fileName && fileName.trim() ? fileName.trim() : "main.py";
}

/* =======================
   SOCKET SETUP
======================= */
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "https://codeiit.netlify.app",
    methods: ["GET", "POST"],
  },
});

/* =======================
   STATE
======================= */
const roomCodeMap = new Map();
const roomSyncVersions = new Map();
const activeProcesses = new Map();

const tempRoot = path.join(__dirname, "temp");
fs.mkdirSync(tempRoot, { recursive: true });

/* =======================
   SOCKET HANDLERS
======================= */
io.on("connection", (socket) => {
  let currentRoom = null;
  let currentUser = null;
  let currentMembership = null;
  const socketId = socket.id;

  const refreshMembership = async () => {
    if (currentRoom && currentUser) {
      currentMembership = await getMembership(currentRoom, currentUser.id);
    }
    return currentMembership;
  };

  console.log("Connected:", socketId);

  socket.on("join-room", async ({ roomName, password, token }) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const res = await pool.query(
        "SELECT password FROM rooms WHERE name = $1",
        [roomName]
      );
      if (!res.rows.length)
        return socket.emit("room-error", { error: "Room not found" });

      const valid = await bcrypt.compare(password, res.rows[0].password);
      if (!valid)
        return socket.emit("room-error", { error: "Invalid password" });

      const membership = await getMembership(roomName, decoded.id);
      if (!membership) return socket.emit("room-error", { error: "Membership unavailable" });

      if (currentRoom) socket.leave(currentRoom);
      currentRoom = roomName;
      currentUser = decoded;
      currentMembership = membership;
      socket.join(roomName);

      if (roomCodeMap.has(roomName)) {
        const roomFiles = roomCodeMap.get(roomName);
        const roomVersions = roomSyncVersions.get(roomName) || {};
        if (typeof roomFiles === "string") {
          socket.emit("code-sync", { code: roomFiles, filename: "main.py", version: roomVersions["main.py"] || 0 });
        } else {
          Object.entries(roomFiles).forEach(([filename, code]) => {
            socket.emit("code-sync", { code, filename, version: roomVersions[filename] || 0 });
          });
        }
      }

      socket.emit("room-joined", {
        roomName,
        role: membership.role,
        canEdit: membership.can_edit,
      });
      console.log(`${decoded.username} joined ${roomName}`);
    } catch {
      socket.emit("room-error", { error: "Join failed" });
    }
  });

  socket.on("code-update", async ({ code, filename, version }) => {
    await refreshMembership();
    if (!currentRoom || !currentMembership?.can_edit) return;

    const safeFilename = sanitizeFilename(filename || "main.py");
    const roomFiles = roomCodeMap.get(currentRoom) || {};
    const roomVersions = roomSyncVersions.get(currentRoom) || {};
    const previousCode = roomFiles[safeFilename] || "";
    if (currentMembership.role === "member") {
      const ranges = getRestrictedRangesForFile(currentMembership.room_id, safeFilename);
      const oldLines = previousCode.split("\n");
      const newLines = code.split("\n");
      const changedRestrictedLine = ranges.some(({ startLine, endLine }) => {
        for (let line = startLine; line <= endLine; line += 1) {
          if (oldLines[line - 1] !== newLines[line - 1]) return true;
        }
        return false;
      });
      if (changedRestrictedLine) {
        return socket.emit("room-error", { error: "This code block is restricted for members" });
      }
    }

    const nextVersion = typeof version === "number" ? version : (roomVersions[safeFilename] || 0) + 1;
    if (typeof version === "number" && version < (roomVersions[safeFilename] || 0)) {
      return;
    }

    roomVersions[safeFilename] = nextVersion;
    roomSyncVersions.set(currentRoom, roomVersions);
    roomFiles[safeFilename] = code;
    roomCodeMap.set(currentRoom, roomFiles);
    socket.to(currentRoom).emit("code-sync", { code, filename: safeFilename, version: nextVersion });
  });

  socket.on("terminal-input", (input) => {
    const info = activeProcesses.get(socketId);
    if (info?.process) info.process.stdin.write(input + "\n");
  });

  socket.on("run-code", async ({ code, filename }) => {
    await refreshMembership();
    if (currentRoom && !currentMembership?.can_edit) return;
    runPythonCode(socket, socketId, code, sanitizeFilename(filename || "main.py"));
  });

  socket.on("save-label", async ({ label, filename, startLine, endLine, code }) => {
    await refreshMembership();
    if (!currentMembership?.can_edit) return socket.emit("room-error", { error: "Edit access required" });
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,99}$/.test(label || "")) return;
    await pool.query(
      `INSERT INTO room_code_labels (room_id, label, file_name, start_line, end_line, code, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (room_id, label) DO UPDATE SET file_name = EXCLUDED.file_name,
       start_line = EXCLUDED.start_line, end_line = EXCLUDED.end_line, code = EXCLUDED.code,
       updated_at = CURRENT_TIMESTAMP`,
      [currentMembership.room_id, label, filename, startLine, endLine, code, currentUser.id]
    );
    io.to(currentRoom).emit("label-saved", { label, filename, startLine, endLine, code });
  });

  socket.on("use-label", async (label) => {
    await refreshMembership();
    if (!currentMembership) return;
    const result = await pool.query(
      "SELECT label, file_name AS filename, start_line AS \"startLine\", end_line AS \"endLine\", code FROM room_code_labels WHERE room_id = $1 AND label = $2",
      [currentMembership.room_id, label]
    );
    if (result.rows[0]) socket.emit("label-code", result.rows[0]);
  });

  socket.on("kill-process", () => killProcess(socketId));

  socket.on("disconnect", () => {
    killProcess(socketId);
    currentRoom = null;
    currentMembership = null;
    console.log("Disconnected:", socketId);
  });
});

/* =======================
   PYTHON EXECUTION (SAFE)
======================= */
function resetIdleTimeout(socket, socketId) {
  const info = activeProcesses.get(socketId);
  if (!info || !info.active) return;

  if (info.timeout) clearTimeout(info.timeout);

  info.timeout = setTimeout(() => {
    const current = activeProcesses.get(socketId);

    if (!current || !current.active) return;

    try {
      current.process.kill("SIGKILL");
    } catch {}

    socket.emit(
      "terminal-output",
      "\n⏱ Program terminated due to inactivity (30s idle)\n"
    );

    cleanup(socketId);
    socket.emit("process-ended");
  }, EXECUTION_TIMEOUT_MS);
}

function runPythonCode(socket, socketId, code, filename) {
  killProcess(socketId);

  const safeFilename = sanitizeFilename(filename || "main.py");
  const sessionDir = path.join(tempRoot, socketId.replace(/[^a-zA-Z0-9]/g, ""));
  fs.mkdirSync(sessionDir, { recursive: true });

  const filePath = path.join(sessionDir, safeFilename);
  fs.writeFileSync(filePath, code, "utf8");

  const pythonCommand = resolvePythonCommand();
  const pythonArgs = buildPythonArgs(pythonCommand, filePath);
  socket.emit("terminal-output", `>>> ${pythonCommand} ${safeFilename}\n`);

  const proc = spawn(pythonCommand, pythonArgs, {
    cwd: sessionDir,
    env: {
      ...process.env,
      PATH: process.env.PATH || "C:\\Windows\\System32;C:\\Python310;C:\\Python311",
      PYTHONUNBUFFERED: "1",
    },
    shell: process.platform === "win32",
  });

  activeProcesses.set(socketId, {
    process: proc,
    tempDir: sessionDir,
    timeout: null,
    active: true,
  });

  // Start the execution timeout after the active process record exists.
  resetIdleTimeout(socket, socketId);

  proc.stdout.on("data", (d) => socket.emit("terminal-output", d.toString()));
  proc.stderr.on("data", (d) => socket.emit("terminal-output", d.toString()));

  proc.on("close", (code) => {
    const info = activeProcesses.get(socketId);
    if (info) info.active = false;

    cleanup(socketId);

    socket.emit("terminal-output", `\n[Process exited with code ${code}]\n`);
    socket.emit("process-ended");
  });

  proc.on("error", (err) => {
    const info = activeProcesses.get(socketId);
    if (info) info.active = false;

    cleanup(socketId);

    socket.emit("terminal-output", `\nError: ${err.message}\n`);
    socket.emit("process-ended");
  });
}

/* =======================
   CLEANUP
======================= */
function killProcess(socketId) {
  const info = activeProcesses.get(socketId);
  if (!info) return;

  info.active = false;

  try {
    info.process.kill("SIGKILL");
  } catch {}

  cleanup(socketId);
}

function cleanup(socketId) {
  const info = activeProcesses.get(socketId);
  if (!info) return;

  if (info.timeout) {
    clearTimeout(info.timeout);
    info.timeout = null;
  }

  activeProcesses.delete(socketId);

  if (info.tempDir) {
    fs.rm(
      info.tempDir,
      { recursive: true, force: true, maxRetries: 5, retryDelay: 100 },
      (error) => {
        if (error) {
          console.warn(`Temporary directory cleanup deferred: ${error.message}`);
        }
      }
    );
  }
}

/* =======================
   MIDDLEWARE
======================= */
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/rooms", roomsRouter);

/* =======================
   SAFE PIP INSTALL
======================= */
const ALLOWED_PACKAGES = ["numpy", "pandas"];

app.post("/api/load", authenticateToken, (req, res) => {
  const name = req.body.message;
  if (!ALLOWED_PACKAGES.includes(name))
    return res.status(403).send("Package not allowed");

  exec(`pip install ${name}`, (err, out) => {
    if (err) return res.status(500).send(err.message);
    res.send(out);
  });
});

/* =======================
   START SERVER
======================= */
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  initDB()
    .then(() => {
      server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => {
      console.error("DB init failed:", err);
      process.exit(1);
    });
}

module.exports = {
  app,
  server,
  resolvePythonCommand,
  sanitizeFilename,
  runPythonCode,
};
