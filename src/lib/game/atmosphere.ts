import { BIOMES, WORLD_LENGTH } from "./world";

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export function smoothstep(from: number, to: number, value: number) {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
}

export interface AtmosphereProfile { fog: number; rays: number; shade: number; fogColor: number; }
/** Local optical character; the illustrations and terrain remain untouched. */
const PROFILES: Record<string, AtmosphereProfile> = {
  plaine: { fog: .18, rays: .13, shade: 0, fogColor: 0xe2e7ce },
  foret: { fog: .60, rays: .40, shade: .24, fogColor: 0xd5ded0 },
  marais: { fog: .85, rays: .10, shade: 0, fogColor: 0xb6cebd },
  lac: { fog: .42, rays: .16, shade: 0, fogColor: 0xd2e3e8 },
  cascade: { fog: .72, rays: .20, shade: 0, fogColor: 0xd7ebef },
  montagne: { fog: .38, rays: .15, shade: 0, fogColor: 0xe0e8ed },
  desert: { fog: .12, rays: .08, shade: 0, fogColor: 0xedd5ab },
  taverne: { fog: .22, rays: .14, shade: 0, fogColor: 0xe3d5be },
};
const CLEAR: AtmosphereProfile = { fog: 0, rays: 0, shade: 0, fogColor: 0xffffff };

/** A feathered interval in physical world coordinates, including later laps. */
export function atmosphereAt(worldX: number): AtmosphereProfile {
  const x = Math.max(0, worldX) % WORLD_LENGTH;
  const biome = BIOMES.find(land => x >= land.from * WORLD_LENGTH && x < land.to * WORLD_LENGTH);
  const profile = biome && PROFILES[biome.id];
  if (!profile || !biome) return CLEAR;
  const fade = smoothstep(0, 260, x - biome.from * WORLD_LENGTH) * smoothstep(0, 260, biome.to * WORLD_LENGTH - x);
  return { ...profile, fog: profile.fog * fade, rays: profile.rays * fade, shade: profile.shade * fade };
}

/** One breeze with slow travelling gusts, shared by cloth, foliage, fog and shadows. */
export function windAt(time: number, worldX: number) {
  const delayed = time - worldX * .00045;
  return Math.sin(delayed * .43) * .55 + Math.sin(delayed * .17 + 1.4) * .3 + Math.sin(delayed * .91) * .15;
}

/** Recycling happens at zero opacity, even when the camera pans in portrait. */
export function atmosphereSample(center: number, interval: number, count: number, slot: number) {
  if (count === 0 || slot >= count) return { worldX: center, opacity: 0 };
  const first = Math.floor(center / interval + .5) - Math.floor(count / 2);
  const worldX = (first + slot + (count % 2 === 0 ? .5 : 0)) * interval;
  const reach = count * interval / 2;
  return { worldX, opacity: 1 - smoothstep(reach - interval * .7, reach, Math.abs(worldX - center)) };
}

/** How much of the breeze a point of the oak takes: zero on the painted trunk and roots. */
export function canopyWeight(u: number, v: number) {
  return (1 - smoothstep(.38, .60, v)) * smoothstep(.07, .28, Math.abs(u - .65));
}

/** The painted trunk and every root stay fixed; only outer branches can flex. */
export function canopyOffset(u: number, v: number, time: number, worldX: number, wake = 0) {
  const weight = canopyWeight(u, v);
  if (weight === 0) return { x: 0, y: 0 };
  const wind = windAt(time, worldX);
  return {
    x: weight * (wind * 12 + Math.sin(time * 1.3 + u * 5) * 2 + wake * 24),
    y: weight * (wind * Math.sin(u * Math.PI) * 2 + wake * 4),
  };
}

/** Optional effects never raise the frame rate; software rendering skips the meshes. */
export function atmosphereBudget(screenWidth: number, lowPower: boolean) {
  return lowPower ? { farFog: 2, nearFog: 0, rays: 0, patches: 0 }
    : screenWidth <= 760 ? { farFog: 3, nearFog: 2, rays: 3, patches: 3 }
      : { farFog: 5, nearFog: 3, rays: 5, patches: 5 };
}
