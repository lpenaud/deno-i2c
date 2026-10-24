const LIBC_SYMBOLS = {
  open: {
    parameters: ["buffer", "i32"],
    result: "i32",
  },
  close: {
    parameters: ["i32"],
    result: "i32",
  },
  write: {
    parameters: ["i32", "buffer", "usize"],
    result: "isize",
  },
  ioctl: {
    parameters: ["i32", "usize", "u64"],
    result: "i32",
  },
  // Errors
  strerror: {
    parameters: ["i32"],
    result: "pointer",
  },
  __errno_location: {
    parameters: [],
    result: "pointer",
  },
} satisfies Deno.ForeignLibraryInterface;

type LibcLib = Deno.DynamicLibrary<typeof LIBC_SYMBOLS>;

export const enum AccessMode {
  /**
   * Read / Write
   */
  O_RDWR = 0x02,
}

interface LibcErrorRequiredOptions {
  message: string;
  errno: number;
}

export class LibcError extends Error {
  #errno: number;

  get errno(): number {
    return this.#errno;
  }

  constructor(
    { errno, message }: LibcErrorRequiredOptions,
    options?: ErrorOptions,
  ) {
    super(`${errno} - ${message}`, options);
    this.#errno = errno;
  }
}

function loadLibc(): LibcLib {
  const { arch, os } = Deno.build;
  if (os !== "linux") {
    throw new Error("Required a linux os");
  }
  const paths = [
    "libc.so.6",
    `/lib/${arch}-linux-gnu/libc.so.6`,
    `/usr/lib/${arch}-linux-gnu/libc.so.6`,
    "/lib64/libc.so.6",
    "/usr/lib64/libc.so.6",
  ];
  for (const p of paths) {
    try {
      return Deno.dlopen(p, LIBC_SYMBOLS);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Cannot find libc");
}

export class Libc implements Disposable {
  #libc: LibcLib;

  constructor() {
    this.#libc = loadLibc();
  }

  /**
   * Open a file.
   *
   * @param path Path to the file
   * @param accessMode Access mode
   * @param flags Extra flags
   * @returns A file descriptor
   * @see https://www.man7.org/linux/man-pages/man2/open.2.html
   */
  open(path: string, accessMode: AccessMode, ...flags: number[]): number {
    const fd = this.#libc.symbols.open(
      new TextEncoder().encode(path + "\0"),
      flags.reduce((pv, cv) => pv | cv, accessMode),
    );
    if (fd === -1) {
      throw new LibcError(this.#getError());
    }
    return fd;
  }

  /**
   * Close a file.
   *
   * @param fd File descriptor
   * @see https://www.man7.org/linux/man-pages/man2/close.2.html
   */
  close(fd: number): void {
    const result = this.#libc.symbols.close(fd);
    if (result === -1) {
      throw new LibcError(this.#getError());
    }
  }

  /**
   * Write bytes into a file.
   *
   * @param fd File descriptor
   * @param buffer Buffer to write
   * @returns The number of bytes written is returned
   * @see https://www.man7.org/linux/man-pages/man2/write.2.html
   */
  write(fd: number, buffer: Uint8Array): number {
    const result = this.#libc.symbols.write(
      fd,
      buffer,
      BigInt(buffer.byteLength),
    );
    if (result === -1n) {
      throw new LibcError(this.#getError());
    }
    return Number(result);
  }

  /**
   * Control device
   *
   * @param fd File descriptor
   * @param op Operation code (device-dependent)
   * @param option Optional argument
   * @returns Return code usually 0 for success.
   * @see https://www.man7.org/linux/man-pages/man2/ioctl.2.html
   */
  ioctl(fd: number, op: bigint, option: bigint = 0n): number {
    const result = this.#libc.symbols.ioctl(fd, op, option);
    if (result === -1) {
      throw new LibcError(this.#getError());
    }
    return result;
  }

  dlclose() {
    this.#libc.close();
  }

  [Symbol.dispose](): void {
    this.dlclose();
  }

  #getError(): LibcErrorRequiredOptions {
    let ptr = this.#libc.symbols.__errno_location();
    if (!ptr) {
      return {
        errno: 0,
        message: "Unknown errno",
      };
    }
    let view = new Deno.UnsafePointerView(ptr);
    const errno = view.getInt32();
    ptr = this.#libc.symbols.strerror(errno);
    if (!ptr) {
      return {
        errno,
        message: "Unknown error",
      };
    }
    view = new Deno.UnsafePointerView(ptr);
    return {
      errno,
      message: view.getCString(),
    };
  }
}
