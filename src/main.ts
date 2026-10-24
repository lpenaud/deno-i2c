import { Ssd1306Device } from "./ssd1306.ts";
import { Libc } from "./libc.ts";
import { serve } from "./server.ts";

function getStatePath(message: string): string {
  const re = /^\w+$/;
  let path: string | null;
  do {
    path = prompt(message);
  } while (path === null || !re.test(path));
  return path;
}

function getInt(name: string, min: number, max: number): number {
  let value: string | null;
  let nb: number;
  for (;;) {
    value = prompt(`${name}:`);
    if (value === null) {
      continue;
    }
    nb = parseInt(value);
    if (!isNaN(nb) && nb >= min && nb < max) {
      break;
    }
    console.log(`Expected ${name} between ${min} and ${max}`);
  }
  return nb;
}

function checkedPattern(device: Ssd1306Device, mod: 0 | 1) {
  let i = 0;
  for (const page of device.pages) {
    const color = i % 2 === mod ? 1 : 0;
    page.fill(color);
    i++;
  }
}

function help() {
  console.log("%cHELP", "font-weight: bold; color: blue;");
  console.log("  quit   Quit and turn off the screen.");
  console.log("  reset  Write black pixel everywhere.");
  console.log("  state  Save current state.");
  console.log("  load   Load a state.");
  console.log("  help   Show this help.");
  console.log("  set    Set a pixel.");
}

type Char = [number, number, number, number, number];

function writeChar(page: Uint8Array, char: Char): void {
  for (let i = 0; i < char.length; i++) {
    page[i] = char[i];
  }
}

async function main(args: string[]): Promise<number> {
  const [path] = args;
  if (args.length !== 1) {
    console.error(
      "Usage: %s DEVICE",
      import.meta.filename ?? import.meta.url,
    );
    return 1;
  }
  // On ouvre la libc
  using libc = new Libc();
  // On ouvre le périphérique
  using device = Ssd1306Device.fromPath(libc, path);
  device.init();
  device.resetFrame();

  const server = Deno.serve(serve(device));
  await server.finished;
  return 0;
}

if (import.meta.main) {
  let status = 2;
  try {
    status = await main(Deno.args.slice());
  } catch (error) {
    console.error(error);
  }
  Deno.exit(status);
}
