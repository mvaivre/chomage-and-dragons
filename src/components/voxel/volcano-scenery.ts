import * as THREE from "three";
import { seededRandom } from "@/lib/rng";
import { VoxelResources } from "./resources";
import { CHUNK_SIZE, continuationSurface, biomeWeights, lavaAt, routeZ, terrainHeight } from "./world";

/** Low foreground silhouettes: broken basalt, sulphur, charred scrub and skinks.
 * A fixed number per chunk; opaque batches use the existing circular cutout. */
export function volcanicForeground(root: THREE.Group, r: VoxelResources, cx: number) {
  const random = seededRandom((Math.imul(cx, 93563) ^ 0x845ef3) >>> 0), b = r.batch(root, false, 0, true);
  let clusters = 0;
  for (let i = 0; i < 16; i++) {
    const x = cx * CHUNK_SIZE + ((i % 8) + .25 + random() * .5) * CHUNK_SIZE / 8;
    const z = i < 8 ? 5 + random() * 6.2 : 13 + random() * 8;
    const ground = (xx: number, zz: number) => zz >= 12 ? continuationSurface(xx, zz) : terrainHeight(xx, zz);
    if (biomeWeights(x).a.id !== "volcan" || z - routeZ(x) < 3 || lavaAt(x, z)) continue;
    clusters++;
    for (let k = 0; k < 3; k++) {
      const xx = x + (k - 1) * .42, zz = z + Math.sin(k * 4 + i) * .35, y = ground(xx, zz), h = .3 + random() * .75;
      if (lavaAt(xx, zz)) continue;
      const color = [0x565166, 0x746b7c, 0x414452][(i + k) % 3];
      b.box(color, xx, y + h / 2 - .04, zz, .65 + random() * .4, h, .65);
      if (k === 1) b.box(0x91859a, xx - .13, y + h - .05, zz - .1, .47, .12, .43);
      if (i % 3 === 0) {
        b.box(0xb89c59, xx + .33, y + .12, zz + .25, .23, .24, .25);
        b.box(0xf4bc60, xx + .36, y + .3, zz + .25, .13, .2, .13, 0, true);
      }
    }
    if (i % 2) {
      const y = ground(x + .9, z + .2);
      b.box(0x6e6963, x + .9, y + .24, z + .2, .08, .48, .08);
      for (const side of [-1, 1]) b.box(0x91846c, x + .9 + side * .14, y + .27, z + .2, .32, .07, .07, side * .45);
    }
  }
  b.finish(); root.userData.volcanicClusters = clusters;
  // One small animated animal per volcanic chunk, with a bounded three-metre run.
  const anchor = cx * CHUNK_SIZE + 8, z = Math.max(5, routeZ(anchor) + 3.5);
  if (biomeWeights(anchor).a.id !== "volcan") return;
  const skink = new THREE.Group(), body = r.batch(skink, false, 0, true);
  body.box(0x9b8270, 0, .16, 0, .54, .23, .22);
  body.box(0xc8a67b, .31, .18, 0, .22, .19, .21);
  for (const side of [-1, 1]) {
    body.box(0x292f34, .4, .22, side * .1, .04, .04, .035);
    for (const dx of [-.17, .17]) body.box(0x7f746b, dx, .07, side * .17, .13, .09, .19);
  }
  for (let k = 0; k < 3; k++) body.box(0x9b8270, -.35 - k * .16, .11, Math.sin(k) * .04, .2, .12 - k * .025, .15 - k * .035);
  body.finish(); skink.name = "basalt-skink"; root.add(skink);
  const previous = root.userData.animate;
  root.userData.animate = (t: number) => {
    previous?.(t);
    const x = anchor + Math.sin(t * .22 + cx) * 1.2;
    skink.visible = !lavaAt(x, z);
    skink.position.set(x, terrainHeight(x, z) + .04, z);
    skink.rotation.y = Math.cos(t * .22 + cx) < 0 ? Math.PI : 0;
  };
  root.userData.animate(0);
}
