import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import CodeEditor from './components/codeEditor';
import Output from './components/Output';
import './App.css';

function App() {
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('>');
  const [searchTerm, setSearchTerm] = useState('');

 const runCode = () => {
  /*fetch('https://codeit-ervv.onrender.com/api/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  })
    .then((response) => response.text())
    .then((data) => setOutput(data));*/
    setOutput('> Code outputs are currently under maintenance')
 }

  const clearCode = () => {
    setCode('');
    setOutput('>');
  };

  const clearTerm = () => {
    if (!searchTerm) {
      setOutput('Please enter a module name');
      return;
    }

    if (searchTerm.trim() === '') {
      setOutput('Module name cannot be empty');
      return;
    }

    setOutput('Loading...');

    fetch('/api/load', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: searchTerm }),
    })
      .then((response) => response.text())
      .then((data) => setOutput(data))
      .catch((error) => setOutput(`Error: ${error.message}`));
    setSearchTerm(''); 
  }

  return (
    <div className="container">
      <Sidebar />
      <main className="main-content">
        <Topbar onRun={runCode} onClear={clearCode} searchTerm={searchTerm} setTerm={setSearchTerm} onSearch ={clearTerm} />
        <CodeEditor code={code} setCode={setCode} />
        <Output output={output} />
      </main>
    </div>
  );
}

export default App;
