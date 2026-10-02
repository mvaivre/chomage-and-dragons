import { biomeMix, mixColor } from "./world";

export const GROUND_TILE_WIDTH = 1024;
export const GROUND_TOP_MARGIN = 24;
/** Native floor materials, with bottom shading matched by the deeper ground fill. */
export const GROUND_MATERIALS: Record<string, number> = { plaine: 0x2d2113, foret: 0x241a0f, marais: 0x1e1b13, lac: 0x262019, cascade: 0x1a1b1d, montagne: 0x272c32, desert: 0x332418, taverne: 0x2d261e };
export interface GroundSlice { offset: number; width: number; a: string; b: string; blend: number; }

/** Long uniform runs stay one sprite; only biome transitions need narrow blend strips. */
export function groundSlices(start: number, width = GROUND_TILE_WIDTH): GroundSlice[] {
  const slices: GroundSlice[] = [];
  for (let offset = 0; offset < width;) {
    const next = Math.min(width, offset + 8), mix = biomeMix(start + (offset + next) / 2);
    const a = mix.a.id;
    const b = mix.b.id;
    const blend = a === b ? 0 : mix.t;
    const previous = slices.at(-1);
    if (previous && blend === 0 && previous.blend === 0 && previous.a === a) previous.width += next - offset;
    else slices.push({ offset, width: next - offset, a, b, blend });
    offset = next;
  }
  return slices;
}

export function terrainBaseColor(at: number) {
  const { a, b, t } = biomeMix(at);
  return mixColor(GROUND_MATERIALS[a.id], GROUND_MATERIALS[b.id], t);
}
