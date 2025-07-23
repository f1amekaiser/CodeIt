function Topbar({ onRun, onClear, searchTerm, setTerm, onSearch, joinTerm, setId, onJoin, showId }) {
  return (
    <header className="topbar">
      <button className="splbtn" onClick={onRun}>Run</button>
      <button className="splbtn">Save</button>
      <button className="splbtn" onClick={onClear}>Clear</button>
      <div className="search-container">
      <input type="text" className="search-input" placeholder="Search module" value={searchTerm} onChange={(e) => setTerm(e.target.value)} />
      <button className="splbtn" onClick={onSearch}>Install</button>
      </div>
      <div className="join-container">
          <input type="text" className="search-input" placeholder="Enter space id" value={joinTerm} onChange={(e) => setId(e.target.value)} />
          <button className="splbtn" onClick={onJoin}>Join space</button>
      </div>
      <div>
          <button className="splbtn" onClick={showId}>Invite to space</button>
      </div>
    </header>
  );
}

export default Topbar;
