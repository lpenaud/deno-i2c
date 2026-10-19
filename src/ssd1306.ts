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
const DISPLAY_OFF = 0xAE;
const CLOCK_DIVIDE_RATIO = Uint8Array.of(0xD5, 0x80);
//  1/64
const MULTIPLEX_RATIO = Uint8Array.of(0xA8, 0x3F);
const DISPLAY_OFFSET = Uint8Array.of(0xD3, 0x00);
const START_LINE_0 = 0x40;
const CHARGE_PUMP = Uint8Array.of(0x8D, 0x14);
const SEGMENT_REMAP = 0xA1;
const COM_SCAN_DIRECTION_REMAP = 0xC8;
const COM_PINS_HARDWARE_CONFIG = Uint8Array.of(0xDA, 0x12);
const CONTRAST = Uint8Array.of(0x7F, 0x5F);
const PRE_CHARGE_PERIOD = Uint8Array.of(0xD9, 0x22);
const VCHOMH_DESELECT_LEVEL = Uint8Array.of(0xDB, 0x40);
const RAM_DISPLAY = 0xA4;
const NOT_ROTATE = 0xA6;
const DISPLAY_ON = 0xAF;

const ACTIVATION_BYTE = 0x40;

const NB_PAGE = 8;
const NB_COLUMN = 128;

const INIT = Uint8Array.of(
  COMMAND_MODE,
  DISPLAY_OFF,
  ...CLOCK_DIVIDE_RATIO,
  ...MULTIPLEX_RATIO,
  ...DISPLAY_OFFSET,
  START_LINE_0,
  ...CHARGE_PUMP,
  SEGMENT_REMAP,
  COM_SCAN_DIRECTION_REMAP,
  ...COM_PINS_HARDWARE_CONFIG,
  ...CONTRAST,
  ...PRE_CHARGE_PERIOD,
  ...VCHOMH_DESELECT_LEVEL,
  RAM_DISPLAY,
  NOT_ROTATE,
  DISPLAY_ON,
);

const HORIZONTAL_MODE = Uint8Array.of(
  COMMAND_MODE,
  // Set memory addressing mode
  0x20,
  // Horizontal
  0x00,
  // Set Column Address, from 0 to 127
  0x21,
  // Set start index column
  0x00,
  // Set end index column
  0x7F,
  // Set Page address, from 0 to 7
  0x22,
  // Page start
  0x00,
  // Page end
  0x07,
);

const SHUTDOWN = Uint8Array.of(0x00, 0xAE);

function initFrame(page: number, column: number) {
  const frame = new Uint8Array(page * column + 1);
  frame[0] = ACTIVATION_BYTE;
  return frame.buffer;
}

export const enum Color {
  BLACK = 0x00,
  WHITE = 0xFF,
}

export class Ssd1306Device implements Disposable {
  #fd: number;

  #libc: Libc;

  #frame: ArrayBuffer;

  get pages() {
    return this.#pages();
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
    this.#write(HORIZONTAL_MODE.buffer);
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
      .fill(Color.BLACK);
    this.writeFrame();
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
