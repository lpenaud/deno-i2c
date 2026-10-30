import { RemoteOffscreenDisplay } from "./common/types";
import { createForm } from "./form";

function initWorker(canvas: OffscreenCanvas) {
  const worker = new Worker(
    new URL("workers/worker.js", window.location.href),
    {
      type: "module",
    },
  );
  const { port1, port2 } = new MessageChannel();
  worker.postMessage({ canvas, port: port1 }, [canvas, port1]);
  return {
    worker,
    port: port2,
  };
}

function initDisplay(port: MessagePort): RemoteOffscreenDisplay {
  const allowed = new Set<keyof RemoteOffscreenDisplay>([
    "fillRect",
    "fillText",
    "send",
  ]);
  // Tant que `onmessage` n'a pas de valeur
  // alors l'appel à la méthode `start` est obligatoire
  // si on veut **écouter** des messages
  port.start();
  return new Proxy({} as RemoteOffscreenDisplay, {
    get: (_target, name) => {
      if (typeof name === "symbol") {
        throw new Error(`Invalid symbol ${name.toString()}`);
      }
      if (!allowed.has(name as keyof RemoteOffscreenDisplay)) {
        throw new Error(`Invalid method ${name}`);
      }
      return (...args: unknown[]) => {
        const { port1, port2 } = new MessageChannel();
        port.postMessage({ port: port1, method: name, args }, [port1]);
        return new Promise((resolve, reject) => {
          port2.onmessage = (
            ev: MessageEvent<{ result?: unknown; error?: unknown }>,
          ) => {
            const { error, result } = ev.data;
            // Laisse le ramasse-miettes faire son travail
            port2.close();
            return error ? reject(error) : resolve(result);
          };
        });
      };
    },
  });
}

(() => {
  const { fontSize, form, text, fontFamily } = createForm();
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const { port } = initWorker(canvas.transferControlToOffscreen());
  const app = initDisplay(port);

  const setText = async () => {
    await app.fillRect({
      fillStyle: "white",
      height: canvas.height,
      width: canvas.width,
      x: 0,
      y: 0,
    });
    await app.fillText({
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
