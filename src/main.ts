import { Color, Ssd1306Device } from "./ssd1306.ts";
import { Libc } from "./libc.ts";

function checkedPattern(device: Ssd1306Device, mod: 0 | 1) {
  let i = 0;
  for (const page of device.pages) {
    const color = i % 2 === mod ? Color.WHITE : Color.BLACK;
    page.fill(color);
    i++;
  }
}

function main(args: string[]): number {
  const [path] = args;
  if (path === undefined) {
    console.error("Usage: %s DEVICE", import.meta.filename ?? import.meta.url);
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

  device.shutdown();
  confirm("L'écran devrait être éteint");
  return 0;
}

if (import.meta.main) {
  Deno.exit(main(Deno.args.slice()));
}
