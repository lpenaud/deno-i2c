import { AccessMode, Libc } from "./libc.ts";

// I2C specific
/**
 * Kernel indication to get a communication to a specific adress.
 * Named from official name.
 */
const I2C_SLAVE = 0x0703n;
/**
 * Address where we have to write.
 */
const I2C_ADDR = 0x3Cn;

// SSD1306 specific

const COMMAND_MODE = 0x00;
const ACTIVATION_BYTE = 0x40;

export const NB_PAGE = 8;
export const NB_COLUMN = 128;

const INIT = Uint8Array.of(
  COMMAND_MODE,
  0xAE, // Display OFF
  0xD5,
  0x80,
  0xA8,
  0x3F,
  0xD3,
  0x00, // ← IMPORTANT : Offset = 0 (sinon décalage vertical)
  0x40,
  0x8D,
  0x14,
  0x20,
  0x00, // Horizontal mode
  0xA0, // ← Colonne 0 = GAUCHE
  0xC0, // ← Ligne 0 = HAUT
  0xDA,
  0x12,
  0x81,
  0x7F,
  0xD9,
  0xF1,
  0xDB,
  0x40,
  0xA4,
  0xA6,
  0xAF, // Display ON
);

const SHUTDOWN = Uint8Array.of(0x00, 0xAE);

function initFrame(page: number, column: number) {
  const frame = new Uint8Array(page * column + 1);
  frame[0] = ACTIVATION_BYTE;
  return frame.buffer;
}

export class Ssd1306Device implements Disposable {
  #fd: number;

  #libc: Libc;

  #frame: ArrayBuffer;

  get pages() {
    return this.#pages();
  }

  get min() {
    return 0;
  }

  get max() {
    return this.#frame.byteLength - 1;
  }

  static fromPath(libc: Libc, path: string) {
    const fd = libc.open(path, AccessMode.O_RDWR);
    return new Ssd1306Device(fd, libc);
  }

  constructor(fd: number, libc: Libc) {
    this.#fd = fd;
    this.#libc = libc;
    this.#frame = initFrame(NB_PAGE, NB_COLUMN);
  }

  init(): void {
    this.#libc.ioctl(this.#fd, I2C_SLAVE, I2C_ADDR);
    // Initialise bytes
    this.#write(INIT.buffer);
    // Set horizontal mode
    // To have just one buffer
    // this.#write(HORIZONTAL_MODE.buffer);
  }

  writeFrame(): void {
    this.#write(this.#frame);
  }

  /**
   * Shutdown but keep GDDRAM values.
   */
  shutdown(): void {
    this.#write(SHUTDOWN.buffer);
  }

  resetFrame(): void {
    new Uint8Array(this.#frame, 1)
      .fill(0);
    this.writeFrame();
  }

  saveState(): Uint8Array {
    return new Uint8Array(this.#frame.slice(1));
  }

  loadState(src: Uint8Array) {
    const dest = new Uint8Array(this.#frame, 1);
    dest.set(src);
  }

  set(position: number, color: number): void {
    if (color < 0 || color > 255) {
      throw new Error(
        `Expected a color between 0 and 255`,
      );
    }
    if (position < this.min || position >= this.max) {
      throw new Error(
        `Expected a position between ${this.min} and ${this.max}`,
      );
    }
    const view = new Uint8Array(this.#frame, 1);
    view[position] = color;
  }

  *#pages() {
    for (let i = 0; i < NB_PAGE; i++) {
      yield this.#getPage(i);
    }
  }

  #getPage(page: number) {
    return new Uint8Array(this.#frame, NB_COLUMN * page + 1, NB_COLUMN);
  }

  #write(buffer: ArrayBuffer): void {
    const size = this.#libc.write(this.#fd, new Uint8Array(buffer));
    if (size !== buffer.byteLength) {
      throw new Error(`Write ${size} instead of ${buffer.byteLength} bytes`);
    }
  }

  close(): void {
    this.#libc.close(this.#fd);
  }

  [Symbol.dispose](): void {
    this.close();
  }
}
