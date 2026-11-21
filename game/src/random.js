// A tiny seeded generator so the city builds the same Bay every load.
// The layout (towers, palms, traffic, peds) is drawn from fixed seeds, so
// a screenshot taken today matches a screenshot taken tomorrow.
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function nextRandom() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function range(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function pickIndex(rng, n) { return Math.floor(rng() * n); }

// Fisher-Yates on a copy: the caller's array is never reordered in place.
export function shuffle(rng, arr) {
  const out = arr.slice();
  let i = out.length - 1;
  while (i > 0) {
    const j = Math.floor(rng() * (i + 1));
    const held = out[i];
    out[i] = out[j];
    out[j] = held;
    i -= 1;
  }
  return out;
}
