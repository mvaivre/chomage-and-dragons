import { seededRandom } from "../rng";

export const DRAGON_GAME = { duration: 16, required: 5, lives: 3, heroX: 16, speed: 31, wave: 0.65 } as const;
export interface DragonObject { id: number; lane: number; x: number; kind: "fire" | "gold"; }
export interface DragonRun { t: number; lane: number; lives: number; gold: number; nextWave: number; wave: number; status: "running" | "won" | "lost"; objects: DragonObject[]; seed: number; }
export function createDragonRun(seed: number): DragonRun {
  return { t: 0, lane: 1, lives: DRAGON_GAME.lives, gold: 0, nextWave: 1.1, wave: 0, status: "running", objects: [], seed };
}
export function steerDragonRun(run: DragonRun, direction: number): void {
  if (run.status === "running") run.lane = Math.max(0, Math.min(2, run.lane + direction));
}
/** Percent-space keeps identical speed and hit boxes on phone and desktop. */
export function advanceDragonRun(run: DragonRun, elapsed: number): void {
  if (run.status !== "running") return;
  const dt = Math.max(0, Math.min(0.1, elapsed));
  run.t += dt;
  if (run.t >= run.nextWave && run.nextWave < DRAGON_GAME.duration - 3) {
    const random = seededRandom(run.seed + run.wave * 7919);
    const lane = Math.floor(random() * 3);
    run.objects.push({ id: run.wave * 2, lane, x: 95, kind: "fire" });
    if (run.wave % 2 === 0) run.objects.push({ id: run.wave * 2 + 1, lane: (lane + 1 + Math.floor(random() * 2)) % 3, x: 95, kind: "gold" });
    run.wave++;
    run.nextWave += DRAGON_GAME.wave;
  }
  run.objects = run.objects.filter(object => {
    const before = object.x;
    object.x -= DRAGON_GAME.speed * dt;
    if (object.lane === run.lane && before >= DRAGON_GAME.heroX - 3 && object.x <= DRAGON_GAME.heroX + 3) {
      if (object.kind === "gold") run.gold++;
      else run.lives--;
      return false;
    }
    return object.x > -8;
  });
  if (run.lives <= 0) run.status = "lost";
  else if (run.t >= DRAGON_GAME.duration) run.status = run.gold >= DRAGON_GAME.required ? "won" : "lost";
}
export function dragonScore(run: DragonRun): number {
  return run.gold * 25 + Math.round(Math.min(run.t, DRAGON_GAME.duration) * 3) + (run.status === "won" ? 50 : 0);
}
