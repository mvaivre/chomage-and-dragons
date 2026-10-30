import * as THREE from "three";
import { VoxelResources } from "./resources";
import { plantTree } from "./trees";
import { routeZ, terrainSurface as terrainHeight, voxelPalette } from "./world";

export function foregroundGrove(r: VoxelResources, x: number, biome: string) {
  const root = new THREE.Group(), bark = r.batch(root, false, 0, true), leaves = r.batch(root, true, 0, true);
  const z = Math.max(5.5, Math.min(9, routeZ(x) + 4.2));
  root.position.set(x, terrainHeight(x, z), z); root.name = "foreground-grove";
  if (biome === "desert") {
    for (const [dx, h] of [[0, 4], [1.3, 2.3], [-1.2, 1.4]]) {
      bark.box(0x688859, dx, h / 2, 0, .45, h, .45);
      leaves.box(0x8aa16b, dx + .4, h * .6, 0, .9, .25, .3);
    }
  } else if (biome === "volcan") {
    for (let i = 0; i < 5; i++) bark.box(i % 2 ? 0x625a70 : 0x454654, (i - 2) * .7, 1 + i % 3 * .5, Math.sin(i) * .4, .8, 2 + i % 3, .9);
  } else plantTree(bark.box, leaves.box, biome, 0, 0, 0, 0, biome === "marais" ? 1.35 : 1.8, voxelPalette(x).leaf);
  for (const side of [-1, 1]) bark.box(0x6d7154, side * 0.75, 0.16, 0.2, 0.6, 0.32, 0.45);
  bark.finish(); leaves.finish();
  return root;
}
