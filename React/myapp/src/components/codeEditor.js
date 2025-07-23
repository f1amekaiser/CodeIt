import Editor from '@monaco-editor/react';
import { useEffect } from 'react';

function CodeEditor({ code, setCode, socket }) {
  useEffect(() => {
      const s = socket.current;
      s.on('change', (newCode) => {
          setCode(newCode);
      })
      return () => {
          s.off('change');
      }
  }, [socket, setCode]);

  const handleChange = (value) => {
      setCode(value);
      socket.current.emit('code', value);
  }

  return (
    <Editor
      height="500px"
      defaultLanguage="python"
      value={code}
      onChange={handleChange}
      defaultValue={code}
      theme="vs-dark"
      options={{
        tabSize: 4,
        insertSpaces: true,
        detectIndentation: false,
        autoIndent: 'advanced'
      }}
    />
  );
}

export default CodeEditor;