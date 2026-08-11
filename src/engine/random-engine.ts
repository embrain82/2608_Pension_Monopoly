export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

export function nextRandom(state: number): { value: number; state: number } {
  let x = state >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const next = x >>> 0 || 1;
  return { value: next / 4294967296, state: next };
}

export function rollDie(state: number): { value: number; state: number } {
  const next = nextRandom(state);
  return { value: Math.floor(next.value * 6) + 1, state: next.state };
}

export function randomSeed(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(2));
  return `${bytes[0].toString(36)}-${bytes[1].toString(36)}`;
}
