import { App } from "./app";

interface WorkerMessageData {
  canvas: OffscreenCanvas;
  port: MessagePort;
}

const APPS = new Set<App>();

self.onmessage = (ev: MessageEvent<WorkerMessageData>) => {
  const { canvas, port } = ev.data;
  if (canvas instanceof OffscreenCanvas && port instanceof MessagePort) {
    APPS.add(new App({ canvas, port }));
  }
};
