import { serveDir, STATUS_TEXT, StatusCode } from "@std/http";
import { type Ssd1306Device } from "./ssd1306.ts";
import { toBytes } from "./utils.ts";

function sendStatus(status: StatusCode): Response {
  const statusText = STATUS_TEXT[status];
  return new Response(`${status} - ${statusText}`, {
    status,
    statusText,
  });
}

export interface ServerOptions {
  device: Ssd1306Device;
}

export class HttpServer {
  #device: Ssd1306Device;

  #server: Deno.HttpServer<Deno.NetAddr>;

  get finished(): Promise<void> {
    return this.#server.finished;
  }

  constructor({ device }: ServerOptions) {
    this.#device = device;
    this.#server = Deno.serve(this.#logHandler);
  }

  async shutdown(): Promise<void> {
    await this.#server.shutdown();
  }

  async #onPut(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== "/") {
      return sendStatus(404);
    }
    if (req.body === null) {
      return sendStatus(400);
    }
    const frame = this.#device.frame;
    const bytes = await toBytes(req.body, frame.byteLength);
    frame.set(bytes);
    this.#device.writeFrame();
    return sendStatus(200);
  }

  #handler(req: Request) {
    if (req.method === "PUT") {
      return this.#onPut(req);
    }
    return serveDir(req, {
      showIndex: true,
      quiet: true,
    });
  }

  #logHandler: Deno.ServeHandler<Deno.NetAddr> = async (req, info) => {
    let res: Response;
    try {
      res = await this.#handler(req);
    } catch (error) {
      console.log(error);
      res = sendStatus(500);
    }
    const url = new URL(req.url);
    const { hostname } = info.remoteAddr;
    info.completed.then(() => {
      console.error(
        `[${new Date().toLocaleString()}]`,
        `${hostname}`,
        `${req.method}`,
        `${url.pathname}`,
        `${res.status}`,
      );
    });
    return res;
  };
}
