export function notNullable<T>(
  element: T | undefined | null,
  message: string,
): T {
  if (element === null || element === undefined) {
    throw new Error(message);
  }
  return element;
}

export function randomPick<T>(array: T[]): T {
  return array[Math.random() * array.length | 0];
}
