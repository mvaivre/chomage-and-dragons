import * as THREE from "three";
import { VoxelResources } from "./resources";
import { routeHeight, routeZ, WORLD_METRES } from "./world";

export function skyFlights(lap: number) { return [.415, .665, .83].map((ratio, i) => ({ id: `sky:${lap}:${i}`, x: (lap + ratio) * WORLD_METRES, color: [0x698f93, 0x9b7188, 0xa98456][i] })); }
/** A distant silhouette, independent of the interactive resident dragon. 276 triangles. */
export function skyDragon(r: VoxelResources, anchor: number, color: number) {
  const root = new THREE.Group(), body = r.batch(root), wings: THREE.Group[] = [];
  body.box(color, 0, 0, 0, 1.55, .5, .5);
  body.box(color, .8, .27, 0, .65, .45, .43);
  body.box(0xd5bc88, 1.17, .12, 0, .45, .23, .38);
  for (const s of [-1, 1]) { body.box(0xe1d0a3, .62, .59, s * .15, .14, .4, .11, -.3); body.box(0xf4d989, 1.04, .33, s * .22, .08, .07, .035, 0, true); }
  for (let i = 0; i < 4; i++) body.box(color, -.9 - i * .35, -.06 + i * .08, 0, .4, .32 - i * .06, .35 - i * .06);
  body.finish();
  for (const s of [-1, 1]) {
    const wing = new THREE.Group(), b = r.batch(wing);
    for (let i = 0; i < 4; i++) b.box(i % 2 ? color : 0xbaad98, -.3 - i * .2, .02, s * (.4 + i * .4), 1.1 - i * .16, .09, .5);
    for (let i = 0; i < 2; i++) b.box(color, i * .65 - .5, -.37, s * .2, .15, .4, .14);
    b.finish(); root.add(wing); wings.push(wing);
  }
  root.name = "flying-dragon"; root.userData.camp = true;
  root.traverse(o => { if (o instanceof THREE.InstancedMesh) o.castShadow = false; });
  root.userData.animate = (time: number) => {
    const phase = time * .11 + anchor, x = anchor + Math.sin(phase) * 10;
    root.position.set(x, routeHeight(x) + 5.7 + Math.sin(time * .7) * .35, routeZ(x) - 1.5);
    root.rotation.y = Math.cos(phase) < 0 ? Math.PI : 0;
    wings.forEach((w, i) => { w.rotation.x = (i ? -1 : 1) * (.25 + Math.sin(time * 2.8) * .55); });
  };
  root.userData.animate(0); return root;
}
