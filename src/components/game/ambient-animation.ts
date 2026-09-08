/** Sparse gestures keep background actors from competing with the player. */
export function gnomeFrame(variant: number, time: number): number {
  if (variant === 1) {
    const t = time % 10;
    return 4 + (t < 2 ? 0 : t < 7 ? 1 + Math.floor(t * 2) % 2 : 3);
  }
  const t = time % 12;
  return t < 6 ? 0 : t < 6.18 ? 1 : t < 9 ? 0 : t < 9.8 ? 2 : t < 10.7 ? 3 : 0;
}

export function crownedChickenFrame(time: number): number {
  const t = time % 13;
  return t < 4.2 ? 0 : t < 4.38 ? 1 : t < 7 ? 0 : t < 7.9 ? 2 : t < 8.3 ? 3 : t < 8.65 ? 2 : 0;
}
