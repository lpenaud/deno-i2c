export async function toBytes(
  readable: ReadableStream<Uint8Array>,
  byteLength: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (byteLength === 0) {
    return new Uint8Array(0);
  }
  let buffer = new ArrayBuffer(byteLength);
  const reader = readable.getReader({ mode: "byob" });
  let count = 0;
  try {
    do {
      const { done, value } = await reader.read(new Uint8Array(buffer, count));
      if (done) {
        break;
      }
      buffer = value.buffer;
      count += value.byteLength;
    } while (count < byteLength);
  } finally {
    reader.releaseLock();
  }
  return new Uint8Array(buffer, 0, count);
}
