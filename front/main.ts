import { createForm } from "./form";
import { IApp } from "./types";

function initApp(canvas: OffscreenCanvas): IApp {
  const worker = new Worker(new URL("worker.js", window.location.href), {
    type: "module",
  });
  const { port1, port2 } = new MessageChannel();
  worker.postMessage({ canvas, port: port1 }, [canvas, port1]);
  // TODO: Return
  return new Proxy({} as IApp, {
    get: (_target, name) => {
      if (typeof name === "symbol") {
        throw new Error(`Invalid symbol ${name.toString()}`);
      }
      if (name !== "fillText" && name !== "fillRect" && name !== "send") {
        throw new Error(`Invalid method ${name}`);
      }
      return (...args: unknown[]) => {
        port2.postMessage({ method: name, args });
      };
    },
  });
}

(() => {
  const { fontSize, form, text, fontFamily } = createForm();
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const app = initApp(canvas.transferControlToOffscreen());

  const setText = () => {
    app.fillRect({
      fillStyle: "white",
      height: canvas.height,
      width: canvas.width,
      x: 0,
      y: 0,
    });
    app.fillText({
      baseline: "top",
      fillStyle: "black",
      fontFamily: fontFamily.value,
      fontSize: fontSize.valueAsNumber,
      text: text.value,
      x: 0,
      y: 0,
    });
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

  form.addEventListener("submit", () => {
    app.send();
  });

  document.body.appendChild(form);
  document.body.appendChild(canvas);
})();
