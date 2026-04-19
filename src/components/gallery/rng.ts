/**
 * mulberry32 — fast, seedable 32-bit PRNG.
 *
 * Returns a function that produces uniform floats in [0, 1).
 * Using a seeded RNG (rather than Math.random) guarantees that generated
 * datasets are identical across hot-reloads and production builds, so the
 * charts always look the same without persisting the data.
 */
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
