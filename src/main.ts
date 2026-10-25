import { Ssd1306Device } from "./ssd1306.ts";
import { Libc } from "./libc.ts";
import { serve } from "./server.ts";

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
  const [p1] = device.pages;

  writeChar(p1, [
    0b0111_1110,
    0b0001_0001,
    0b0001_0001,
    0b0001_0001,
    0b0111_1110,
  ]);
  device.writeFrame();
  confirm("Should have a letter");

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
