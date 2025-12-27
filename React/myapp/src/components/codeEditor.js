import Editor from "@monaco-editor/react";

function CodeEditor({ code, setCode, socket }) {
  const handleChange = (value) => {
    setCode(value || "");
  };

  return (
    <Editor
      height="100%"
      defaultLanguage="python"
      value={code}
      onChange={handleChange}
      theme="vs-dark"
      options={{
        tabSize: 4,
        insertSpaces: true,
        detectIndentation: false,
        autoIndent: "advanced",
        fontSize: 14,
        fontFamily:
          "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', monospace",
        fontLigatures: true,
        lineHeight: 1.6,
        minimap: { enabled: true, scale: 0.8, showSlider: "mouseover" },
        scrollBeyondLastLine: false,
        padding: { top: 16, bottom: 16 },
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        renderWhitespace: "selection",
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        wordWrap: "off",
        automaticLayout: true,
      }}
    />
  );
}

export default CodeEditor;
