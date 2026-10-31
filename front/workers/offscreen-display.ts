import {
  AppFillRectOptions,
  AppFillTextOptions,
  DrawImageOptions,
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

function imageLightning(
  { data, width, height }: ImageData,
): Uint8Array<ArrayBuffer> {
  // Copie de la luminosité pour éviter d'écraser les données pendant le calcul
  const luminance = new Float32Array(width * height);

  for (let i = 0; i < luminance.length; i++) {
    const src = i * 4;
    const r = data[src];
    const g = data[src + 1];
    const b = data[src + 2];
    luminance[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const buffer = new Uint8Array(1024);

  // Parcours ligne par ligne
  for (let y = 0; y < height; y++) {
    const page = y >> 3;
    const bit = y & 7;

    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldVal = luminance[idx];
      
      // Seuilage binaire
      const newVal = oldVal < 128 ? 0 : 255;
      const error = oldVal - newVal;

      // Écriture dans le buffer (pixel noir = bit à 1)
      if (newVal === 0) {
        const dst = page * 128 + x;
        buffer[dst] |= 1 << bit;
      }

      // Diffusion de l'erreur (Floyd-Steinberg)
      const distributeError = (dx: number, dy: number, factor: number) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          luminance[nx + ny * width] += (error * factor);
        }
      };

      distributeError(1, 0, 7 / 16);     // Pixel à droite
      distributeError(-1, 1, 3 / 16);    // Bas-gauche
      distributeError(0, 1, 5 / 16);     // Bas
      distributeError(1, 1, 1 / 16);     // Bas-droite
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
    { fillStyle, font, baseline, text, x, y }: AppFillTextOptions,
  ): void {
    this.#context.fillStyle = fillStyle;
    this.#context.font = font;
    this.#context.textBaseline = baseline;
    this.#context.fillText(text, x, y);
  }

  fillRect({ fillStyle, height, width, x, y }: AppFillRectOptions): void {
    this.#context.fillStyle = fillStyle;
    this.#context.fillRect(x, y, width, height);
  }

  async drawImage({ dx, dy, src }: DrawImageOptions): Promise<void> {
    const img = await createImageBitmap(src, {
      resizeWidth: this.#canvas.width,
    });
    this.#context.drawImage(img, dx, dy);
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
