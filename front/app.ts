import { notNullable } from "./utils";

export interface AppOptions {
  canvas: OffscreenCanvas;
  port: MessagePort;
}

export type Color = string | CanvasGradient | CanvasPattern;

export interface AppFillTextOptions {
  text: string;
  fillStyle: Color;
  fontSize: number;
  fontFamily: string;
  baseline: CanvasTextBaseline;
  x: number;
  y: number;
}

export interface AppFillRectOptions {
  fillStyle: Color;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PublicMethods {
  fillText: AppFillTextOptions;
  fillRect: AppFillRectOptions;
}

interface DictPublicMethods<M extends keyof PublicMethods> {
  method: M;
  options: PublicMethods[M];
}

export type MessageData =
  | DictPublicMethods<"fillRect">
  | DictPublicMethods<"fillText">;

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

export class App {
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
  ) {
    this.#context.fillStyle = fillStyle;
    this.#context.font = `${fontSize}px ${fontFamily}`;
    this.#context.textBaseline = baseline;
    this.#context.fillText(text, x, y);
  }

  fillRect({ fillStyle, height, width, x, y }: AppFillRectOptions) {
    this.#context.fillStyle = fillStyle;
    this.#context.fillRect(x, y, width, height);
  }

  async send() {
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
      const { method, options } = ev.data;
      if (this[method] === undefined) {
        console.warn("Invalid method name", method);
        return;
      }
      this.#handleMethod(method, options);
    };
    this.#port.onmessageerror = (ev) => {
      console.error(ev.type, ev);
    };
  }

  #handleMethod<M extends keyof PublicMethods>(
    method: M,
    options: PublicMethods[M],
  ): void {
    (this[method] as (options: PublicMethods[M]) => void)(options);
  }
}
