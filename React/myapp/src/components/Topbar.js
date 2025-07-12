function Topbar({ onRun, onClear }) {
  return (
    <header className="topbar">
      <button className="btn" onClick={onRun}>Run</button>
      <button className="btn">Save</button>
      <button className="btn" onClick={onClear}>Clear</button>
    </header>
  );
}

export default Topbar;
