import { MessageData, OffscreenDisplay } from "../common/types";

export interface PortBridgeOptions {
  port: MessagePort;
  app: OffscreenDisplay;
}

export class PortBridge {
  #port: MessagePort;

  #app: OffscreenDisplay;

  constructor({ app, port }: PortBridgeOptions) {
    this.#port = port;
    this.#app = app;
    this.#initPort();
  }

  #initPort(): void {
    this.#port.onmessage = (ev: MessageEvent<MessageData>) => {
      const { method, args, port } = ev.data;
      if (this.#app[method] === undefined) {
        console.warn("Invalid method name", method);
        return;
      }
      this.#handleMethod(method, args, port);
    };
    this.#port.onmessageerror = (ev) => {
      console.error(ev.type, ev);
    };
  }

  async #handleMethod<M extends keyof OffscreenDisplay>(
    method: M,
    args: Parameters<OffscreenDisplay[M]>,
    port: MessagePort,
  ): Promise<void> {
    let result: Awaited<ReturnType<OffscreenDisplay[M]>> | undefined;
    let error: unknown | undefined;
    try {
      result = await (this.#app[method] as (
        ...args: Parameters<OffscreenDisplay[M]>
      ) => ReturnType<OffscreenDisplay[M]>).apply(this.#app, args);
    } catch (e) {
      error = e;
    }
    port.postMessage({ result, error });
    port.close();
  }
}
