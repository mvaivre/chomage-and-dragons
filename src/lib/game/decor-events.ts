import { mulberry32, seedFrom } from "@/lib/game/random";

/** A common clock and 1200-unit cells: resizing never rerolls a passing event. */
export function decorEventAt(worldX: number, seconds: number) {
  const zone = Math.max(0, Math.floor(worldX / 1200));
  const cycle = Math.floor(seconds / 90);
  const random = mulberry32(seedFrom(`decor-event:${zone}:${cycle}`));
  const start = 18 + Math.floor(random() * 45);
  const phase = (seconds % 90 - start) / 9;
  const kind = (["cv", "pigeon", "cloud"] as const)[Math.floor(random() * 3)];
  return { kind, phase, active: phase >= 0 && phase < 1, x: zone * 1200 - 240 + phase * 1680 };
}
