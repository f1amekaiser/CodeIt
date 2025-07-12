import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Editor from './components/Editor';
import Output from './components/Output';
import './App.css';

function App() {
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('>');

 const runCode = () => {
  fetch('https://codeit-ervv.onrender.com/api/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  })
    .then((response) => response.text())
    .then((data) => setOutput(data));
 }

  const clearCode = () => {
    setCode('');
    setOutput('>');
  };

  return (
    <div className="container">
      <Sidebar />
      <main className="main-content">
        <Topbar onRun={runCode} onClear={clearCode} />
        <Editor code={code} setCode={setCode} />
        <Output output={output} />
      </main>
    </div>
  );
}

export default App;
