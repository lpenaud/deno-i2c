function createFontSize(form: HTMLFormElement): HTMLInputElement {
  const label = document.createElement("label");
  label.textContent = "Font-size";
  
  const input = document.createElement("input");
  input.type = "number";
  input.min = "8";
  input.max = "64";
  input.valueAsNumber = 14;
  input.name = "font-size";
  
  const div = document.createElement("div");
  div.appendChild(label);
  div.append(input);

  form.appendChild(div);

  return input;
}

function createText(form: HTMLFormElement): HTMLInputElement {
  const label = document.createElement("label");
  label.textContent = "Text";
  const input = document.createElement("input");
  input.type = "text";
  input.name = "text";

  const div = document.createElement("div");
  div.appendChild(label);
  div.appendChild(input);

  form.appendChild(label);
  form.appendChild(input);
  return input;
}

function createSubmit(form: HTMLFormElement): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "Send";

  form.appendChild(button);
  return button;
}

const FONT_FAMILIES = Object.freeze([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "fangsong",
]);

function createSelectFontFamily(form: HTMLFormElement): HTMLSelectElement {
  const select = document.createElement("select");
  select.name = "font-family";
  for (const family of FONT_FAMILIES) {
    const option = document.createElement("option");
    option.value = family;
    option.textContent = family;
    select.appendChild(option);
  }
  select.selectedIndex = 0;
  select.multiple = false;
  form.appendChild(select);
  return select;
}

export function createForm() {
  const form = document.createElement("form");
  const fontSize = createFontSize(form);
  const fontFamily = createSelectFontFamily(form);
  const text = createText(form);

  const submit = createSubmit(form);

  form.action = "#";
  form.addEventListener("submit", (ev) => ev.preventDefault());
  return {
    fontSize,
    form,
    text,
    fontFamily,
    submit,
  };
}
