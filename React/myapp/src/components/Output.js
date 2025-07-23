function Output({ output }) {
  return (
    <section className="output">
      <h3>Console:</h3>
      <div contentEditable="false" id="output" className="output-box">
          {output}
      </div>
    </section>
  );
}

export default Output;
