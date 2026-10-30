import * as THREE from "three";
import { VoxelResources } from "./resources";
import { CHUNK_SIZE, foregroundPool, terrainSurface as terrainHeight, type ForegroundPool } from "./world";

/** Entire vignette costs <500 triangles. Water uses the terrain's existing material. */
export function pondLife(root: THREE.Group, r: VoxelResources, cx: number) {
  const swimmers: { model: THREE.Group; pool: ForegroundPool; phase: number }[] = [];
  const b = r.batch(root);
  for (let n = Math.floor(cx * CHUNK_SIZE / 26); n <= Math.floor((cx + 1) * CHUNK_SIZE / 26); n++) {
    const pool = foregroundPool(n * 26 + 9);
    if (!pool || pool.x < cx * CHUNK_SIZE || pool.x >= (cx + 1) * CHUNK_SIZE) continue;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, x = pool.x + Math.cos(a) * pool.rx * 1.12,
        z = pool.z + Math.sin(a) * pool.rz * 1.12, y = terrainHeight(x, z);
      b.box(0x809072, x, y + 0.07, z, 0.3, 0.14, 0.22);
      if (i % 2) {
        b.box(0x6e894e, x + 0.1, y + 0.25, z, 0.055, 0.5, 0.06);
        b.box(0x7b5537, x + 0.1, y + 0.48, z, 0.09, 0.2, 0.09);
      } else {
        b.box(0x99c8b7, pool.x + Math.cos(a) * 1.5, pool.y + 0.014, pool.z + Math.sin(a) * 0.6, 0.35, 0.015, 0.04);
      }
    }
    for (let i = 0; i < 2; i++) {
      b.box(0x6a9259, pool.x - 1.4 + i * 0.4, pool.y + 0.025, pool.z - 0.65, 0.32, 0.04, 0.27);
      b.box(0xdfa9b5, pool.x - 1.4 + i * 0.4, pool.y + 0.075, pool.z - 0.65, 0.1, 0.06, 0.1);
      const duck = new THREE.Group(), d = r.batch(duck);
      duck.name = "pond-duck";
      d.box(i ? 0xd8c6a0 : 0xb2a38b, 0, 0.14, 0, 0.52, 0.25, 0.3);
      d.box(i ? 0x9f8560 : 0x566859, 0.04, 0.25, 0, 0.3, 0.09, 0.29);
      d.box(i ? 0xc2a77c : 0x396c55, -0.2, 0.35, 0, 0.22, 0.3, 0.24);
      d.box(0xe4b15c, -0.36, 0.31, 0, 0.17, 0.06, 0.16);
      for (const side of [-1, 1]) d.box(0x263d36, -0.24, 0.4, side * 0.122, 0.045, 0.045, 0.018);
      d.box(0xe7dfbf, 0.29, 0.21, 0, 0.16, 0.07, 0.2);
      // Short trailing wake, no particles or extra transparent draw passes.
      d.box(0xa3d0c0, 0.43, 0.015, 0, 0.2, 0.015, 0.3);
      d.finish(); root.add(duck);
      swimmers.push({ model: duck, pool, phase: i * Math.PI + n });
    }
  }
  b.finish();
  const prior = root.userData.animate;
  root.userData.animate = (time: number) => {
    prior?.(time);
    for (const { model, pool, phase } of swimmers) {
      const a = time * 0.16 + phase;
      model.position.set(pool.x + Math.cos(a) * 0.95, pool.y + Math.sin(time * 2 + phase) * 0.012, pool.z + Math.sin(a) * 0.5);
      model.rotation.y = Math.atan2(0.5 * Math.cos(a), 0.95 * Math.sin(a));
    }
  };
  root.userData.animate(0);
}
