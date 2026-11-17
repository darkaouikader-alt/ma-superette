/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Arrondi stochastique : 2,3 → 2 (70 %) ou 3 (30 %). */
export function stochRound(v: number, rng: Rng): number {
  const f = Math.floor(v);
  return f + (rng() < v - f ? 1 : 0);
}

export function weightedPick<T>(items: T[], weight: (t: T) => number, rng: Rng): T {
  const total = items.reduce((s, i) => s + weight(i), 0);
  let r = rng() * total;
  for (const it of items) {
    r -= weight(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
