export type Color = string | CanvasGradient | CanvasPattern;

export interface AppFillTextOptions {
  text: string;
  fillStyle: Color;
  font: string;
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

export interface DrawImageOptions {
  src: Blob;
  dx: number;
  dy: number;
}

export interface OffscreenDisplay {
  fillText(options: AppFillTextOptions): void;
  fillRect(options: AppFillRectOptions): void;
  drawImage(options: DrawImageOptions): Promise<void>;
  send(): Promise<void>;
}

export type RemoteOffscreenDisplay = {
  [M in keyof OffscreenDisplay]: (
    ...args: Parameters<OffscreenDisplay[M]>
  ) => Promise<Awaited<ReturnType<OffscreenDisplay[M]>>>;
};

export interface DictPublicMethods<M extends keyof OffscreenDisplay> {
  port: MessagePort;
  method: M;
  args: Parameters<OffscreenDisplay[M]>;
}

export type MessageData = {
  [M in keyof OffscreenDisplay]: DictPublicMethods<M>;
}[keyof OffscreenDisplay];
