import Editor from '@monaco-editor/react';

function CodeEditor({ code, setCode }) {
  return (
    <Editor
      height="500px" defaultLanguage="python" value={code} onChange={(value) => setCode(value)} theme="vs-dark"
  options={{
    tabSize: 4,
    insertSpaces: true,
    detectIndentation: false,
    autoIndent: 'advanced'
  }}/>
  );
}

export default CodeEditor;