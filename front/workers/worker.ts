import { DefaultOffscreenDisplay } from "./offscreen-display";
import { PortBridge } from "./port-bridge";

interface WorkerMessageData {
  canvas: OffscreenCanvas;
  port: MessagePort;
}

const APPS = new Set<PortBridge>();

self.onmessage = (ev: MessageEvent<WorkerMessageData>) => {
  const { canvas, port } = ev.data;
  if (canvas instanceof OffscreenCanvas && port instanceof MessagePort) {
    const app = new DefaultOffscreenDisplay({
      canvas,
    });
    APPS.add(new PortBridge({ app, port }));
  }
};
