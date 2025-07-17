function Topbar({ onRun, onClear, searchTerm, setTerm, onSearch }) {
  return (
    <header className="topbar">
      <button className="btn" onClick={onRun}>Run</button>
      <button className="btn">Save</button>
      <button className="btn" onClick={onClear}>Clear</button>
      <div className="search-container">
      <input type="text" className="search-input" placeholder="Search module" value={searchTerm} onChange={(e) => setTerm(e.target.value)} />
      <button className="btn" onClick={onSearch}>Install</button>
      </div>
    </header>
  );
}

export default Topbar;
