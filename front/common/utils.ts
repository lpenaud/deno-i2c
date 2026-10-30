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

export function genId() {
  const animals = [
    "lion",
    "éléphant",
    "girafe",
    "zèbre",
    "tigre",
    "ours",
    "renard",
    "lapin",
    "cheval",
    "dauphin",
  ];
  const adjectives = [
    "grand",
    "petit",
    "rapide",
    "lent",
    "joyeux",
    "calme",
    "curieux",
    "courageux",
    "doux",
    "malin",
  ];
  return `${Date.now().toString(36)}-${randomPick(animals)}-${
    randomPick(adjectives)
  }`;
}
