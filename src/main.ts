import { Libc } from "./libc.ts";
import { HttpServer } from "./server.ts";
import { Ssd1306Device } from "./ssd1306.ts";

function trap(
  handler: (signal: Deno.Signal) => void,
  ...signals: Deno.Signal[]
): void {
  for (const sig of signals) {
    Deno.addSignalListener(sig, () => handler(sig));
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

  const server = new HttpServer({ device });
  trap(
    (signal) => {
      console.error(`Catch ${signal}`);
      console.log("Close server...");
      server.shutdown();
    },
    "SIGTERM",
    "SIGINT",
    "SIGQUIT",
  );

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
