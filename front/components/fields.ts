export interface FieldComponent {
  parent: HTMLDivElement;
  label: HTMLLabelElement;
  input: HTMLInputElement;
}

interface CreateLabelOptions {
  name: string;
  text: string;
}

function createLabel({ text, name }: CreateLabelOptions): HTMLLabelElement {
  const label = document.createElement("label");
  label.textContent = text;
  label.htmlFor = name;
  label.title = text;
  return label;
}

interface CreateInputOptions {
  name: string;
  type: "number" | "text" | "file";
  title: string;
  readOnly?: boolean;
  value?: string;
  accept?: string;
}

function createInput(
  { name, type, title, readOnly, value, accept }: CreateInputOptions,
): HTMLInputElement {
  const input = document.createElement("input");
  input.name = name;
  input.type = type;
  input.title = title;
  input.readOnly = readOnly === true;
  input.value = value ?? "";
  input.accept = accept ?? "";
  return input;
}

function preventDefault(ev: Event) {
  ev.preventDefault();
}

interface FieldOptions {
  label: string;
  name: string;
}

export interface FieldTextOptions extends FieldOptions {
  value?: string;
  readOnly?: boolean;
}

export interface FieldNumberOptions extends FieldOptions {
  min: number;
  max: number;
  step: number;
  value?: number;
  readOnly?: boolean;
}

export interface FieldSelectOptions extends FieldOptions {
  options: {
    value: string;
    text: string;
    selected?: boolean;
  }[];
}

export interface FieldButtonOptions extends FieldOptions {
  type: HTMLButtonElement["type"];
}

export interface FieldFileOptions extends FieldOptions {
  accept: string;
}

class ComponentBuilder<K extends keyof HTMLElementTagNameMap> {
  #parent: HTMLElementTagNameMap[K];

  get parent(): HTMLElementTagNameMap[K] {
    return this.#parent;
  }

  constructor(tagName: K) {
    this.#parent = document.createElement(tagName);
  }

  fieldNumber(
    { label, max, min, name, step, readOnly, value }: FieldNumberOptions,
  ): HTMLInputElement {
    const labelElement = createLabel({
      name,
      text: label,
    });
    const inputElement = createInput({
      name,
      type: "number",
      readOnly,
      value: `${value ?? min}`,
      title: label,
    });
    inputElement.min = `${min}`;
    inputElement.max = `${max}`;
    inputElement.step = `${step}`;

    return this.#field(labelElement, inputElement);
  }

  fieldText(
    { label, name, readOnly, value }: FieldTextOptions,
  ): HTMLInputElement {
    const labelElement = createLabel({
      name,
      text: label,
    });
    const inputElement = createInput({
      name,
      type: "text",
      readOnly,
      value,
      title: label,
    });
    return this.#field(labelElement, inputElement);
  }

  fieldSelect({ label, name, options }: FieldSelectOptions): HTMLSelectElement {
    const labelElement = createLabel({
      name,
      text: label,
    });
    const selectElement = document.createElement("select");
    selectElement.title = label;
    for (const { text, value, selected } of options) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.selected = selected === true;
      opt.textContent = text;
      selectElement.appendChild(opt);
    }
    return this.#field(labelElement, selectElement);
  }

  button({ label, name, type }: FieldButtonOptions): HTMLButtonElement {
    const button = document.createElement("button");
    button.name = name;
    button.type = type;
    button.textContent = label;
    button.title = label;

    this.#parent.appendChild(button);
    return button;
  }

  fieldFile({ accept, label, name }: FieldFileOptions): HTMLInputElement {
    const labelElement = createLabel({
      name,
      text: label,
    });
    const inputElement = createInput({
      name,
      title: label,
      type: "file",
      accept,
    });
    return this.#field(labelElement, inputElement);
  }

  #field<I extends HTMLInputElement | HTMLSelectElement>(
    label: HTMLLabelElement,
    input: I,
  ): I {
    const div = document.createElement("div");
    div.appendChild(label);
    div.appendChild(input);
    this.#parent.appendChild(div);
    return input;
  }
}

export class FieldsetBuilder extends ComponentBuilder<"fieldset"> {
  #legend?: HTMLLegendElement;

  constructor() {
    super("fieldset");
  }

  legend(text: string): void {
    if (this.#legend === undefined) {
      this.#legend = document.createElement("legend");
      this.parent.appendChild(this.#legend);
    }
    this.#legend.textContent = text;
  }
}

export class FormBuilder extends ComponentBuilder<"form"> {
  constructor() {
    super("form");
    this.parent.addEventListener("submit", preventDefault);
  }

  fieldset(): FieldsetBuilder {
    const builder = new FieldsetBuilder();
    this.parent.appendChild(builder.parent);
    return builder;
  }
}
