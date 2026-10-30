import {
  AppFillRectOptions,
  AppFillTextOptions,
  OffscreenDisplay,
} from "../common/types";
import { notNullable } from "../common/utils";

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

export interface DefaultOffscreenDisplayOptions {
  canvas: OffscreenCanvas;
}

export class DefaultOffscreenDisplay implements OffscreenDisplay {
  #canvas: OffscreenCanvas;

  #context: OffscreenCanvasRenderingContext2D;

  constructor({ canvas }: DefaultOffscreenDisplayOptions) {
    this.#canvas = canvas;
    this.#context = notNullable(
      canvas.getContext("2d"),
      "Cannot get 2D context from canvas",
    );
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
}
