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
const roomsRouter = require("./rooms");

const app = express();
const server = http.createServer(app);

/* =======================
   SECURITY LIMITS
======================= */
const EXECUTION_TIMEOUT_MS = 30000; // 30s wall time
const MAX_CPU_SECONDS = 2; // CPU time
const MAX_MEMORY_KB = 256 * 1024; // 256MB RAM

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
const activeProcesses = new Map();

const tempRoot = path.join(__dirname, "temp");
fs.mkdirSync(tempRoot, { recursive: true });

/* =======================
   SOCKET HANDLERS
======================= */
io.on("connection", (socket) => {
  let currentRoom = null;
  const socketId = socket.id;

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

      if (currentRoom) socket.leave(currentRoom);
      currentRoom = roomName;
      socket.join(roomName);

      if (roomCodeMap.has(roomName))
        socket.emit("code-sync", roomCodeMap.get(roomName));

      socket.emit("room-joined", { roomName });
      console.log(`${decoded.username} joined ${roomName}`);
    } catch {
      socket.emit("room-error", { error: "Join failed" });
    }
  });

  socket.on("code-update", (code) => {
    if (!currentRoom) return;
    roomCodeMap.set(currentRoom, code);
    socket.to(currentRoom).emit("code-sync", code);
  });

  socket.on("terminal-input", (input) => {
    const info = activeProcesses.get(socketId);
    if (info?.process) info.process.stdin.write(input + "\n");
  });

  socket.on("run-code", ({ code, filename }) => {
    runPythonCode(socket, socketId, code, filename || "main.py");
  });

  socket.on("kill-process", () => killProcess(socketId));

  socket.on("disconnect", () => {
    killProcess(socketId);
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

  const sessionDir = path.join(tempRoot, socketId.replace(/[^a-zA-Z0-9]/g, ""));
  fs.mkdirSync(sessionDir, { recursive: true });

  const filePath = path.join(sessionDir, filename);
  fs.writeFileSync(filePath, code, "utf8");

  socket.emit("terminal-output", `>>> python ${filename}\n`);

  const command = `
    ulimit -t ${MAX_CPU_SECONDS} &&
    ulimit -v ${MAX_MEMORY_KB} &&
    python -I -u "${filePath}"
  `;

  const proc = spawn("bash", ["-c", command], {
    cwd: sessionDir,
    env: {
      PATH: process.env.PATH,
      PYTHONUNBUFFERED: "1",
    },
  });

  activeProcesses.set(socketId, {
    process: proc,
    tempDir: sessionDir,
    timeout: null,
  });

  // start idle timer
  resetIdleTimeout(socket, socketId);

  activeProcesses.set(socketId, {
    process: proc,
    tempDir: sessionDir,
    timeout: null,
    active: true,
  });

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

  if (info.tempDir && fs.existsSync(info.tempDir)) {
    fs.rmSync(info.tempDir, { recursive: true, force: true });
  }

  activeProcesses.delete(socketId);
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

initDB()
  .then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("DB init failed:", err);
    process.exit(1);
  });
