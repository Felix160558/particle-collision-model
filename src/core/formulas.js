export function createFormulaLayer(element) {
  let visible = true;

  function render(title, formulas = []) {
    element.innerHTML = "";
    const heading = document.createElement("h2");
    heading.textContent = title;
    element.append(heading);

    for (const item of formulas) {
      const step = document.createElement("div");
      step.className = "formula-step";

      const formula = document.createElement("code");
      formula.textContent = item.formula;
      step.append(formula);

      if (item.note) {
        const note = document.createElement("span");
        note.textContent = item.note;
        step.append(note);
      }

      element.append(step);
    }
  }

  function setVisible(nextVisible) {
    visible = nextVisible;
    element.classList.toggle("hidden", !visible);
  }

  return {
    render,
    setVisible,
    get visible() {
      return visible;
    }
  };
}
