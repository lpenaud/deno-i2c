import { ErrorStatus, STATUS_TEXT, serveDir } from "@std/http";
import { Ssd1306Device } from "./ssd1306.ts";

function sendError(status: ErrorStatus): Response {
  const statusText = STATUS_TEXT[status];
  return new Response(`${status} - ${statusText}`, {
    status,
    statusText,
  });
}

function onUpgrade(device: Ssd1306Device, sockets: Set<WebSocket>, req: Request): Response | null {
  const upgrade = req.headers.get("upgrade");
  if (upgrade === null) {
    return null;
  }
  if (upgrade !== "websocket") {
    return sendError(426);
  }
  const { response, socket } = Deno.upgradeWebSocket(req);
  socket.addEventListener("open", () => {
    console.log("A client is connected!");
    sockets.add(socket);
  });
  socket.addEventListener("message", (ev: MessageEvent<ArrayBuffer>) => {
    console.log(`New ${ev.type}`, ev.data);
    device.frame.set(new Uint8Array(ev.data));
    device.writeFrame();
  });
  socket.addEventListener("close", () => {
    if (sockets.delete(socket)) {
      console.log("A client is disconnected");
    }
  });
  socket.addEventListener("error", (e) => {
    console.error(`New ${e.type}`, e);
  });
  return response;
}

export function serve(device: Ssd1306Device): Deno.ServeHandler {
  const sockets = new Set<WebSocket>();
  return (req) => {
    const response = onUpgrade(device, sockets, req);
    if (response !== null) {
      return response;
    }
    return serveDir(req, {
      showIndex: true,
    });
  };
}
