import { AppFillRectOptions, AppFillTextOptions, AppOptions, IApp, MessageData } from "./types";
import { notNullable } from "./utils";

function imgDateToBuffer(
  { data, width, height }: ImageData,
): Uint8Array<ArrayBuffer> {
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

export class App implements IApp {
  #canvas: OffscreenCanvas;

  #context: OffscreenCanvasRenderingContext2D;

  #port: MessagePort;

  constructor({ canvas, port }: AppOptions) {
    this.#canvas = canvas;
    this.#context = notNullable(
      canvas.getContext("2d"),
      "Cannot get 2D context from canvas",
    );
    this.#port = port;
    this.#initPort();
  }

  fillText(
    { fillStyle, fontSize, fontFamily, baseline, text, x, y }:
      AppFillTextOptions,
  ): void {
    this.#context.fillStyle = fillStyle;
    this.#context.font = `${fontSize}px ${fontFamily}`;
    this.#context.textBaseline = baseline;
    this.#context.fillText(text, x, y);
  }

  fillRect({ fillStyle, height, width, x, y }: AppFillRectOptions): void {
    this.#context.fillStyle = fillStyle;
    this.#context.fillRect(x, y, width, height);
  }

  async send(): Promise<void> {
    const img = this.#context.getImageData(
      0,
      0,
      this.#canvas.width,
      this.#canvas.height,
      {
        colorSpace: "srgb",
      },
    );
    const response = await fetch("/", {
      method: "PUT",
      body: imgDateToBuffer(img),
    });
    if (!response.ok) {
      console.error("Response ko", await response.text());
    }
  }
 
  #initPort(): void {
    this.#port.onmessage = (ev: MessageEvent<MessageData>) => {
      const { method, args } = ev.data;
      if (this[method] === undefined) {
        console.warn("Invalid method name", method);
        return;
      }
      this.#handleMethod(method, args);
    };
    this.#port.onmessageerror = (ev) => {
      console.error(ev.type, ev);
    };
  }

  #handleMethod<M extends keyof IApp>(
    method: M,
    args: Parameters<IApp[M]>,
  ): void {
    (this[method] as (...args: Parameters<IApp[M]>) => ReturnType<IApp[M]>)(...args);
  }
}
