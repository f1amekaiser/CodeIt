import { useRef, useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import CodeEditor from "./components/codeEditor";
import Terminal from "./components/Terminal";
import AuthPage from "./components/AuthPage";
import RoomModal from "./components/RoomModal";
import { io } from "socket.io-client";
import "./App.css";

const API_URL =
  process.env.REACT_APP_API_URL || "https://codeit-ervv.onrender.com";

function App() {
  // Authentication state
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Room state
  const [currentRoom, setCurrentRoom] = useState(null);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);

  // File management state (session-based, no persistence)
  const [files, setFiles] = useState([
    {
      name: "main.py",
      content:
        '# Welcome to CodeIt!\n# Start coding here\n\nprint("Hello, World!")',
    },
  ]);
  const [activeFile, setActiveFile] = useState("main.py");

  // Editor state
  const [code, setCode] = useState(
    '# Welcome to CodeIt!\n# Start coding here\n\nprint("Hello, World!")'
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Terminal state
  const [isRunning, setIsRunning] = useState(false);

  // Socket reference
  const socketRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    if (token) {
      socketRef.current = io(API_URL, {
        auth: { token },
      });

      socketRef.current.on("connect", () => {
        console.log("Connected to server");
      });

      socketRef.current.on("code-sync", (newCode) => {
        setCode(newCode);
        // Update the active file content
        setFiles((prev) =>
          prev.map((f) =>
            f.name === activeFile ? { ...f, content: newCode } : f
          )
        );
      });

      socketRef.current.on("room-joined", (data) => {
        setCurrentRoom(data.roomName);
      });

      socketRef.current.on("room-error", (data) => {
        alert(data.error);
      });

      socketRef.current.on("process-ended", () => {
        setIsRunning(false);
      });

      return () => {
        socketRef.current?.disconnect();
      };
    }
  }, [token, activeFile]);

  // Check for existing session on load
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      // Verify token is still valid
      fetch(`${API_URL}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then((res) => {
          if (res.ok) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          } else {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
          }
        })
        .catch(() => {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // Handle authentication
  const handleAuth = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    socketRef.current?.disconnect();
    setUser(null);
    setToken(null);
    setCurrentRoom(null);
    // Reset to default state
    setFiles([{ name: "main.py", content: "# type your code" }]);
    setActiveFile("main.py");
    setCode("# type your code");
  };

  // File management functions
  const handleFileCreate = (fileName) => {
    const newFile = { name: fileName, content: "# " + fileName + "\n" };
    setFiles((prev) => [...prev, newFile]);
    setActiveFile(fileName);
    setCode(newFile.content);
  };

  const handleFileDelete = (fileName) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
    if (activeFile === fileName) {
      const remaining = files.filter((f) => f.name !== fileName);
      if (remaining.length > 0) {
        setActiveFile(remaining[0].name);
        setCode(remaining[0].content);
      } else {
        setActiveFile(null);
        setCode("");
      }
    }
  };

  const handleFileSelect = (fileName) => {
    // Save current file content
    setFiles((prev) =>
      prev.map((f) => (f.name === activeFile ? { ...f, content: code } : f))
    );
    // Switch to selected file
    const selectedFile = files.find((f) => f.name === fileName);
    if (selectedFile) {
      setActiveFile(fileName);
      setCode(selectedFile.content);
    }
  };

  const handleFileRename = (oldName, newName) => {
    setFiles((prev) =>
      prev.map((f) => (f.name === oldName ? { ...f, name: newName } : f))
    );
    if (activeFile === oldName) {
      setActiveFile(newName);
    }
  };

  // Code editor change handler
  const handleCodeChange = useCallback(
    (newCode) => {
      setCode(newCode);
      setFiles((prev) =>
        prev.map((f) =>
          f.name === activeFile ? { ...f, content: newCode } : f
        )
      );
      socketRef.current?.emit("code-update", newCode);
    },
    [activeFile]
  );

  // Run code handler
  const runCode = useCallback(() => {
    if (!activeFile || isRunning) return;

    const fileToRun = files.find((f) => f.name === activeFile);
    if (!fileToRun) return;

    setIsRunning(true);
    socketRef.current?.emit("run-code", {
      code: fileToRun.content,
      filename: activeFile,
    });
  }, [activeFile, files, isRunning]);

  // Terminal run command handler (from typing in terminal)
  const handleTerminalRunCommand = useCallback(
    (filename) => {
      const fileToRun = files.find((f) => f.name === filename);
      if (fileToRun) {
        setIsRunning(true);
        socketRef.current?.emit("run-code", {
          code: fileToRun.content,
          filename,
        });
      } else {
        // File doesn't exist, send anyway - server will create it with current code
        setIsRunning(true);
        socketRef.current?.emit("run-code", {
          code,
          filename,
        });
      }
    },
    [files, code]
  );

  // Clear editor
  const clearCode = () => {
    setCode("");
    setFiles((prev) =>
      prev.map((f) => (f.name === activeFile ? { ...f, content: "" } : f))
    );
  };

  // Install package
  const handleInstallPackage = () => {
    if (!searchTerm.trim()) {
      alert("Please enter a package name");
      return;
    }

    fetch(`${API_URL}/api/load`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: searchTerm }),
    })
      .then((response) => response.text())
      .then((data) => {
        alert(data);
      })
      .catch((error) => alert(`Error: ${error.message}`));
    setSearchTerm("");
  };

  // Room handlers
  const handleRoomJoin = (room) => {
    setCurrentRoom(room.name);
  };

  const handleRoomCreate = (room) => {
    setCurrentRoom(room.name);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <h1 className="loading-logo">⟨/⟩ CodeIt</h1>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  // Not authenticated - show auth page
  if (!user) {
    return <AuthPage onAuth={handleAuth} />;
  }

  // Authenticated - show main app
  return (
    <div className="app-container">
      <Sidebar
        files={files}
        activeFile={activeFile}
        onFileSelect={handleFileSelect}
        onFileCreate={handleFileCreate}
        onFileDelete={handleFileDelete}
        onFileRename={handleFileRename}
        user={user}
        onLogout={handleLogout}
        currentRoom={currentRoom}
      />
      <main className="main-content">
        <Topbar
          onRun={runCode}
          onClear={clearCode}
          searchTerm={searchTerm}
          setTerm={setSearchTerm}
          onSearch={handleInstallPackage}
          onOpenRoomModal={() => setIsRoomModalOpen(true)}
          currentRoom={currentRoom}
          activeFile={activeFile}
          isRunning={isRunning}
        />
        <div className="editor-terminal-container">
          <div className="editor-section">
            <CodeEditor
              code={code}
              setCode={handleCodeChange}
              socket={socketRef}
            />
          </div>
          <div className="terminal-section">
            <Terminal
              socket={socketRef.current}
              isRunning={isRunning}
              onRunCommand={handleTerminalRunCommand}
            />
          </div>
        </div>
      </main>

      <RoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        onJoin={handleRoomJoin}
        onCreate={handleRoomCreate}
        socket={socketRef.current}
        token={token}
      />
    </div>
  );
}

export default App;
