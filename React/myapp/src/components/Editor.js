function Editor({ code, setCode }) {
  return (
    <section className="editor">
      <textarea
        placeholder="Write your code here..."
        value={code}
        onChange={(e) => setCode(e.target.value)
        }
        onKeyDown={(e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart, selectionEnd } = e.target;
      const newCode =
        code.substring(0, selectionStart) + "    " + code.substring(selectionEnd);
      setCode(newCode);}
    }
}
      />
    </section>
  );
}

export default Editor;