/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 *
 * Indispensable ici : le décor et les événements narratifs doivent être identiques à
 * chaque rendu. Avec Math.random(), les arbres sauteraient à chaque re-render et le
 * mini-boss RH disparaîtrait au moment de le montrer à quelqu'un.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
