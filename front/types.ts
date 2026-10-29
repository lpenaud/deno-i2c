export interface AppOptions {
  canvas: OffscreenCanvas;
  port: MessagePort;
}

export type Color = string | CanvasGradient | CanvasPattern;

export interface AppFillTextOptions {
  text: string;
  fillStyle: Color;
  fontSize: number;
  fontFamily: string;
  baseline: CanvasTextBaseline;
  x: number;
  y: number;
}

export interface AppFillRectOptions {
  fillStyle: Color;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IApp {
  fillText(options: AppFillTextOptions): void;
  fillRect(options: AppFillRectOptions): void;
  send(): Promise<void>;
}

export interface DictPublicMethods<M extends keyof IApp> {
  method: M;
  args: Parameters<IApp[M]>;
}

export type MessageData = {
  [M in keyof IApp]: DictPublicMethods<M>;
}[keyof IApp];
