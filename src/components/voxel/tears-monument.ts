import * as THREE from "three";
import { VoxelResources } from "./resources";

/** A carved, eight-metre guardian with a real catch basin and two continuous flows. */
export function tearsMonument(r: VoxelResources) {
  const root = new THREE.Group(), b = r.batch(root, true, 0, true);
  root.name = "monument-of-tears";
  b.box(0x667c76, 0, 0.25, 0.3, 9.2, 0.5, 6.8);
  b.box(0x8ca39b, 0, 0.58, -0.3, 6.4, 0.18, 4.5);
  b.box(0x718b82, 0, 2.45, -0.55, 4.7, 3.6, 2.8);
  b.box(0x94a99c, 0, 5.2, -0.2, 3.8, 3, 2.1);
  b.box(0xa9b9a7, 0, 6.78, -0.3, 4.2, 0.24, 2.4);
  for (let i = 0; i < 4; i++) b.box(i % 2 ? 0x7e9689 : 0x9cad99, 0, 7 + i * 0.27, -0.4, 3.6 - i * 0.6, 0.28, 2 - i * 0.22);
  for (const side of [-1, 1]) {
    b.box(0x506f66, side * 1.08, 5.9, 0.91, 0.75, 0.4, 0.14);
    b.box(0x9accc2, side * 1.08, 5.77, 1, 0.35, 0.12, 0.1);
    b.box(0xb5c6b0, side * 1.08, 6.28, 0.98, 1.1, 0.21, 0.27, side * 0.08);
    b.box(0x829d8c, side * 2.55, 2.95, -0.35, 0.65, 3.3, 2.25);
    for (let k = 0; k < 4; k++) b.box(0x4c7861, side * 2.9, 3.5 - k * 0.55, 0.6, 0.12, 0.65, 0.19);
    b.box(0x7f988a, side * 4.25, 0.72, 0.5, 0.32, 0.35, 5.8);
  }
  b.box(0xa7b59f, 0, 5.23, 1.05, 0.7, 1.05, 0.7);
  b.box(0x46685f, 0, 4.43, 0.9, 1.65, 0.16, 0.15);
  b.box(0x9fb09c, 0, 3.92, 0.25, 3.7, 0.32, 2.2);
  for (let k = -2; k <= 2; k++) b.box(0x5d8173, k * 0.52, 2.55 + Math.abs(k) * 0.18, 0.91, 0.18, 1.25, 0.1);
  b.box(0x80aaa0, 0, 0.7, 3.65, 8.2, 0.32, 0.25);
  b.box(0x73a9ac, 0, 0.59, 1.1, 7.9, 0.1, 4.6);
  b.finish();
  const flow = new THREE.Group(); flow.name = "tear-flow";
  const water = r.batch(flow, false, 0, true);
  for (let i = 0; i < 44; i++) water.box(i % 4 ? 0x81c0c6 : 0xc5e5d9, 0, 0, 0, 0.2, 0.3, 0.17);
  water.finish(); root.add(flow);
  const mesh = flow.children[0] as THREE.InstancedMesh;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.castShadow = false; mesh.frustumCulled = false;
  const splashes: THREE.Group[] = [];
  for (const side of [-1, 1]) for (let i = 0; i < 2; i++) {
    const ring = new THREE.Group(), s = r.batch(ring);
    ring.position.set(side * 1.36, 0.655, 2.75);
    for (const d of [-1, 1]) { s.box(0xc2e4d5, d * 0.3, 0, 0, 0.07, 0.025, 0.6); s.box(0xc2e4d5, 0, 0, d * 0.3, 0.6, 0.025, 0.07); }
    s.finish(); root.add(ring); splashes.push(ring);
  }
  const m = new THREE.Object3D();
  root.userData.animate = (time: number) => {
    for (let i = 0; i < 44; i++) {
      const side = i < 22 ? -1 : 1, t = ((i % 22) / 22 + time * 0.43) % 1;
      m.position.set(side * (1.08 + t * 0.26) + Math.sin(t * 8 + time * 2) * 0.025, 5.75 - t * 5.1, 1 + t * 0.65 + t * t * 1.05);
      m.scale.set(0.15 + t * 0.18, 0.29, 0.15 + t * 0.04); m.updateMatrix(); mesh.setMatrixAt(i, m.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    splashes.forEach((ring, i) => { const t = (time * 1.3 + i * 0.5) % 1; ring.scale.setScalar(0.25 + t * 1.4); ring.visible = t < 0.87; });
  };
  root.userData.camp = true; root.userData.animate(0);
  root.userData.contactFootprint = { rx: 4.7, rz: 3.3 };
  return root;
}
