import { seededRandom } from "@/lib/rng";
import * as THREE from "three";
import type { VoxelResources } from "./resources";
import { BACKGROUND_DEPTH, FOREGROUND_DEPTH, CHUNK_SIZE, biomeWeights, continuationSurface, riverAt, voxelPalette } from "./world";

/** One envelope crosses the old tile cut; it has no discontinuity at that cut. */
export function groundCoverFade(z: number) {
  const outside = z < 0 ? -z - BACKGROUND_DEPTH : z - FOREGROUND_DEPTH;
  const u = Math.max(0, Math.min(1, (outside + 6) / 16));
  return 1 - u * u * (3 - 2 * u);
}


function detailChance(x: number, z: number) { const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return v - Math.floor(v); }
/** Separate randomness preserves the existing authored/seeded landscape placement. */
export function groundCoverKeep(x: number, z: number) { return detailChance(x, z) < groundCoverFade(z); }
export function detailBiome(x: number, z: number) { const { a, b, t } = biomeWeights(x); return detailChance(x + 5.3, z - 3.7) < t ? b.id : a.id; }

/** Low silhouettes using the existing batch: texture carries the distant detail,
 * so extra grass/stone geometry thins to zero before reaching the fog. */
export function shoulderCover(root: THREE.Group, r: VoxelResources, cx: number) {
  // Separate near ground from distant cover, and front from back. Extending the
  // original foliage batch's bounds forced all its dense near grass to render.
  const batches = [-1, 1].map(side => { const group = new THREE.Group(); group.name = `shoulder-cover:${side}`; root.add(group); return r.batch(group, false, r.terrainStripWidth ? 8 : 0, true); });
  const random = seededRandom((Math.imul(cx, 79843) ^ 0x8c7a31) >>> 0);
  const positions: number[][] = [];
  for (let ix = 0; ix < CHUNK_SIZE; ix++) for (const side of [-1, 1]) for (let row = 0; row < 10; row++) for (let i = 0; i < 2; i++) {
    const x = cx * CHUNK_SIZE + ix + .15 + random() * .7;
    const z = side < 0 ? -BACKGROUND_DEPTH - row - .15 - random() * .7 : FOREGROUND_DEPTH + row + .15 + random() * .7;
    const chance = random(), box = batches[side < 0 ? 0 : 1].box;
    if (chance > 1.16 * groundCoverFade(z) || riverAt(x, z)) continue;
    const biome = detailBiome(x, z), p = voxelPalette(x), y = continuationSurface(x, z);
    const rock = ["montagne", "desert", "volcan"].includes(biome);
    if (rock) {
      if (chance > .22) continue;
      positions.push([x, y, z]);
      box(biome === "montagne" ? 0xdde3d7 : p.rock, x, y + .055, z, .12 + random() * .12, .11, .15);
      if (biome === "desert" && ix % 5 === 0) box(0xa8976e, x + .1, y + .12, z, .04, .23, .04);
    } else {
      positions.push([x, y, z]);
      const h = .08 + random() * .19;
      box(p.leaf, x, y + h / 2 - .02, z, .045, h, .045);
      if (random() < .22) {
        const flower = biome === "marais" ? 0xb6afc4 : biome === "lac" || biome === "cascade" ? 0xb6cdd0 : ix % 2 ? 0xd1aa77 : 0xcba3b5;
        box(flower, x, y + h, z, .1, .05, .09);
      }
      if (random() < .12) box(p.rock, x + .17, y + .045, z, .19, .09, .15);
    }
  }
  batches.forEach(batch => batch.finish());
  return positions;
}
