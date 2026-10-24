import { Ssd1306Device } from "./ssd1306.ts";
import { Libc } from "./libc.ts";

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

function main(args: string[]): number {
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
  confirm("Ça devrait être tout noir");

  checkedPattern(device, 0);
  const even = device.saveState();
  checkedPattern(device, 1);
  const odd = device.saveState();

  device.loadState(even);
  device.writeFrame();
  confirm("Damier pair");

  device.loadState(odd);
  device.writeFrame();
  confirm("Damier impair");

  device.resetFrame();
  const [p1, p2, p3] = device.pages;
  // 'A'
  writeChar(p1, [
    0b0111_1110,
    0b0001_0001,
    0b0001_0001,
    0b0001_0001,
    0b0111_1110,
  ]);
  // 'E'
  writeChar(p2, [
    0b01111111,
    0b01001001,
    0b01001001,
    0b01001001,
    0b01000001,
  ]);
  // 'L'
  writeChar(p3, [
    0b01111111,
    0b01000000,
    0b01000000,
    0b01000000,
    0b01000000,
  ]);
  device.writeFrame();

  help();
  mainloop:
  for (;;) {
    const input = prompt("#>");
    switch (input) {
      case "quit": {
        break mainloop;
      }

      case "reset": {
        device.resetFrame();
        continue;
      }

      case "state": {
        const outfile = getStatePath("outfile:");
        const state = device.saveState();
        Deno.writeTextFileSync(outfile, state.toHex());
        console.log(outfile);
        break;
      }

      case "load": {
        const infile = getStatePath("infile:");
        const hex = Deno.readTextFileSync(infile);
        device.loadState(Uint8Array.fromHex(hex));
        device.writeFrame();
        console.log(infile);
        break;
      }

      case "set": {
        const position = getInt("position", device.min, device.max);
        const color = getInt("color", 0, 256);
        device.set(position, color);
        device.writeFrame();
        console.log(position, color);
        break;
      }

      case "help": {
        help();
        break;
      }

      case null: {
        break;
      }

      default: {
        console.log(
          "%cERROR%c: Unknown command.",
          "font-weight: bold; color: red;",
          "font-weight: unset; color: unset;",
        );
        help();
        break;
      }
    }
  }

  device.shutdown();
  confirm("L'écran devrait être éteint");
  return 0;
}

if (import.meta.main) {
  Deno.exit(main(Deno.args.slice()));
}
