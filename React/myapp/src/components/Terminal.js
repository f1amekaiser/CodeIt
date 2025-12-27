import { useState, useEffect, useRef, useCallback } from "react";
import "./Terminal.css";

function Terminal({ socket, isRunning, onRunCommand }) {
  const [lines, setLines] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandHistory, setCommandHistory] = useState([]);
  const terminalRef = useRef(null);
  const inputRef = useRef(null);

  // Handle terminal output from server
  useEffect(() => {
    if (!socket) return;

    const handleOutput = (output) => {
      setLines((prev) => {
        const newLines = [...prev];
        // Parse output and append
        const outputLines = output.split("\n");
        outputLines.forEach((line, idx) => {
          if (idx === outputLines.length - 1 && line === ">>> ") {
            newLines.push();
          } else if (line) {
            newLines.push({ type: "output", content: line });
          } else if (idx < outputLines.length - 1) {
            newLines.push({ type: "output", content: "" });
          }
        });
        return newLines;
      });
    };

    socket.on("terminal-output", handleOutput);

    return () => {
      socket.off("terminal-output", handleOutput);
    };
  }, [socket]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input when clicking terminal
  const handleTerminalClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Handle input submission
  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();

      if (!inputValue.trim()) return;

      const command = inputValue.trim();
      setCommandHistory((prev) => [...prev, command]);
      setHistoryIndex(-1);

      // Check if it's a Python run command
      const runMatch = command.match(/^python\s+(.+\.py)$/i);
      if (runMatch && !isRunning) {
        const filename = runMatch[1];
        // Add command to display
        setLines((prev) => [
          ...prev,
          { type: "command", content: `>>> ${command}` },
        ]);
        onRunCommand(filename);
      } else if (isRunning) {
        // Send input to running process
        setLines((prev) => [...prev, { type: "input", content: inputValue }]);
        socket?.emit("terminal-input", inputValue);
      } else if (command === "clear" || command === "cls") {
        setLines([]);
      } else if (command === "help") {
        setLines((prev) => [
          ...prev,
          { type: "command", content: `>>> ${command}` },
          { type: "output", content: "" },
          {
            type: "output",
            content: "╔══════════════════════════════════════════════════════╗",
          },
          {
            type: "output",
            content:
              "║               CodeIt Terminal Commands                ║",
          },
          {
            type: "output",
            content: "╠══════════════════════════════════════════════════════╣",
          },
          {
            type: "output",
            content: "║  python <filename.py>  - Run a Python file           ║",
          },
          {
            type: "output",
            content: "║  clear / cls           - Clear terminal              ║",
          },
          {
            type: "output",
            content: "║  help                  - Show this help message      ║",
          },
          {
            type: "output",
            content: "║  files                 - List session files          ║",
          },
          {
            type: "output",
            content: "╠══════════════════════════════════════════════════════╣",
          },
          {
            type: "output",
            content: "║  Ctrl+C                - Stop running process        ║",
          },
          {
            type: "output",
            content: "╚══════════════════════════════════════════════════════╝",
          },
          { type: "output", content: "" },
          { type: "prompt", content: ">>> " },
        ]);
      } else {
        setLines((prev) => [
          ...prev,
          { type: "command", content: `>>> ${command}` },
          {
            type: "error",
            content: `Error: '${command}' is not a valid command. Type 'help' for available commands.`,
          },
          { type: "prompt", content: ">>> " },
        ]);
      }

      setInputValue("");
    },
    [inputValue, isRunning, onRunCommand, socket]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e) => {
      // Ctrl+C to kill process
      if (e.ctrlKey && e.key === "c") {
        e.preventDefault();
        if (isRunning) {
          socket?.emit("kill-process");
        }
        return;
      }

      // Command history navigation
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length > 0) {
          const newIndex =
            historyIndex < commandHistory.length - 1
              ? historyIndex + 1
              : historyIndex;
          setHistoryIndex(newIndex);
          setInputValue(commandHistory[commandHistory.length - 1 - newIndex]);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInputValue(commandHistory[commandHistory.length - 1 - newIndex]);
        } else {
          setHistoryIndex(-1);
          setInputValue("");
        }
      }
    },
    [commandHistory, historyIndex, isRunning, socket]
  );

  return (
    <div className="terminal-container" onClick={handleTerminalClick}>
      <div className="terminal-header">
        <div className="terminal-dots"></div>
        <span className="terminal-title">CodeIt Terminal</span>
        <div className="terminal-status">
          {isRunning && (
            <span className="status-running">
              <span className="pulse"></span>
              Running
            </span>
          )}
        </div>
      </div>
      <div className="terminal-body" ref={terminalRef}>
        {lines.map((line, index) => (
          <div key={index} className={`terminal-line ${line.type}`}>
            {line.content}
          </div>
        ))}
        <form onSubmit={handleSubmit} className="terminal-input-form">
          <span className="terminal-prompt">{isRunning ? "" : ">>> "}</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="terminal-input"
            autoComplete="off"
            spellCheck="false"
            autoFocus
          />
        </form>
      </div>
    </div>
  );
}

export default Terminal;
