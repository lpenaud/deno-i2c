import { FieldsetBuilder, FormBuilder } from "./fields";

const FONT_FAMILIES = Object.freeze(
  [
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
  ] as const,
);

function fontInput(builder: FieldsetBuilder): HTMLInputElement {
  builder.legend("Font");
  const fontSize = builder.fieldNumber({
    label: "Font-size",
    min: 0,
    max: 100,
    step: 1,
    name: "font-size",
    value: 20,
  });
  const fontFamily = builder.fieldSelect({
    label: "Font-family",
    name: "font-family",
    options: FONT_FAMILIES.map((v) => ({
      selected: v === "cursive",
      text: v,
      value: v,
    })),
  });
  const font = builder.fieldText({
    label: "Font",
    name: "font",
    readOnly: true,
  });

  const computeFont = () => {
    font.value = `${fontSize.value}px ${fontFamily.value}`;
  };
  const onInput = (ev: InputEvent) => {
    computeFont();
    font.dispatchEvent(new InputEvent(ev.type));
  };

  fontSize.addEventListener("input", onInput);
  fontFamily.addEventListener("input", onInput);
  computeFont();

  return font;
}

function positionInput(
  builder: FieldsetBuilder,
): { x: HTMLInputElement; y: HTMLInputElement } {
  builder.legend("Position");
  const x = builder.fieldNumber({
    label: "x",
    name: "x",
    min: 0,
    max: 128,
    step: 1,
  });
  const y = builder.fieldNumber({
    label: "y",
    name: "y",
    min: 0,
    max: 64,
    step: 1,
  });

  return { x, y };
}

export function createForm() {
  const builder = new FormBuilder();
  const font = fontInput(builder.fieldset());
  const { x, y } = positionInput(builder.fieldset());
  const text = builder.fieldText({
    label: "Text",
    name: "text",
    value: "Rigolo",
  });
  const image = builder.fieldFile({
    accept: "image/jpeg,image/webp,image/png",
    label: "Image",
    name: "image",
  });
  builder.button({
    label: "Send",
    name: "send",
    type: "submit",
  });
  return {
    form: builder.parent,
    font,
    x,
    y,
    text,
    image,
  };
}
