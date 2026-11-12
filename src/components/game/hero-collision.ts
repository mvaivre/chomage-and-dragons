export type HeroBump = { age: number; direction: 1 | -1 };
export type HeroContact = { x: number; room: number | undefined; ready: boolean; bump: HeroBump | null };

const CONTACT_RADIUS = 48;
export const HERO_BUMP_FLIGHT = .64;
export const HERO_BUMP_DURATION = 1.02;

/** Sweep the whole stride, including a low-FPS frame that passes the other hero. */
export function crossedHero(from: number, to: number, target: number) {
  const direction = Math.sign(to - from);
  return direction !== 0 && (target - from) * direction >= -4 && (target - to) * direction <= CONTACT_RADIUS;
}

export function heroBumpPose({ age, direction }: HeroBump) {
  const flight = Math.min(1, age / HERO_BUMP_FLIGHT);
  const recovery = Math.min(1, Math.max(0, (age - HERO_BUMP_FLIGHT) / (HERO_BUMP_DURATION - HERO_BUMP_FLIGHT)));
  const arc = 4 * flight * (1 - flight);
  return {
    lift: 148 * arc,
    x: direction * 78 * flight * (1 - recovery * recovery * (3 - 2 * recovery)),
    tilt: direction * arc * 1.12,
  };
}
