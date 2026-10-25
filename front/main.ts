import { createForm } from "./form";

function imgDateToBuffer({ data, width, height }: ImageData): Uint8Array<ArrayBuffer> {
  const buffer = new Uint8Array(1024);

  for (let y = 0; y < height; y++) {
    const page = y >> 3;
    const bit = y & 7;

    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = page * 128 + x;

      if (data[src] < 128) {
        buffer[dst] |= 1 << bit;
      }
    }
  }
  
  return buffer;
}

(() => {
  const { fontSize, form, text, fontFamily } = createForm();
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext("2d")!;
  
  const setText = () => {
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    // context.clearRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "black";
    context.font = `${fontSize.valueAsNumber}px ${fontFamily.value}`;
    context.textBaseline = "top";
    context.fillText(text.value, 0, 0);
  };

  fontFamily.addEventListener("input", () => {
    setText();
  });

  fontSize.addEventListener("input", () => {
    setText();
  });

  text.addEventListener("input", (_e) => {
    setText();
  });

  const ws = new WebSocket("/");

  ws.addEventListener("open", () => {
    console.log("Ws open");
    form.addEventListener("submit", () => {
      const img = context.getImageData(0, 0, canvas.width, canvas.height, {
        colorSpace: "srgb",
      });
      console.log(img.data)
      const buffer = imgDateToBuffer(img);
      console.log(buffer);
      ws.send(buffer);
    });
  });
  ws.addEventListener("close", () => {
    console.log("Ws close");
  });
  ws.addEventListener("error", (ev) => {
    console.error("Ws error", ev);
  });

  document.body.appendChild(form);
  document.body.appendChild(canvas);
})();
