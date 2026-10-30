import * as THREE from "three";
import { VoxelResources } from "./resources";
import { routeHeight } from "./world";

// Keep hardware outside the complete walking envelope, including hats and tools.
export const FACTORY_AISLE = 2.2;
export type FactoryStation = { index: number; x: number; workerX: number; workerZ: number };
export function factoryStations(from: number, to: number): FactoryStation[] {
  const stations: FactoryStation[] = [];
  for (let x = from + 5, index = 0; x < to - 4; x += 5.8, index++)
    stations.push({ index, x, workerX: x + 2.15, workerZ: -3.85 });
  return stations;
}
/** Staggered lift, quick impact, hold and release; workers and paper use one clock. */
export function factoryCycle(time: number, index: number) {
  const phase = ((time / 1.8 + index * 0.23) % 1 + 1) % 1;
  const lift = phase < 0.4 ? Math.sin(phase / 0.4 * Math.PI / 2)
    : phase < 0.54 ? Math.cos((phase - 0.4) / 0.14 * Math.PI / 2) : 0;
  return { phase, lift, stamped: phase >= 0.54 && phase < 0.88 };
}
export type FactoryPaperPose = { x: number; y: number; z: number; rx: number; ry: number; rz: number; phase: number };
export const factoryPileTop = (station: number, sheet: number) => 0.182 + (6 + (sheet + station) % 4) * 0.047;
export function factoryPaperPose(time: number, station: FactoryStation, sheet: number,
  out: FactoryPaperPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, phase: 0 }) {
  const phase = ((time / 5.4 + station.index * 0.19 + sheet / 3) % 1 + 1) % 1;
  const t = Math.min(1, phase / 0.88), v = Math.max(0, Math.min(1, (t - 0.12) / 0.76)), travel = v * v * (3 - 2 * v), startX = station.x - 0.6,
    endX = station.x - 1.05 + (sheet - 1) * 0.3;
  const startY = routeHeight(station.x) + 2.38,
    endY = routeHeight(station.x - 1.05) + factoryPileTop(station.index, sheet) + 0.012;
  out.x = startX + (endX - startX) * travel + Math.sin(t * Math.PI * 2) * 0.25;
  out.y = startY + (endY - startY) * t + Math.sin(t * Math.PI) * 3.2;
  out.z = -2.65 + (6.05 + (sheet - 1) * 0.18) * travel;
  out.rx = Math.sin(t * Math.PI * 3) * 0.3;
  out.ry = Math.sin(t * Math.PI * 2) * 0.5;
  out.rz = Math.sin(t * Math.PI * 4) * 0.24;
  out.phase = phase;
  return out;
}

/** Five presses, processing desks and paper heaps, confined to the edges of the aisle. */
export function factoryLine(r: VoxelResources, from: number, to: number, centerZ: number) {
  const root = new THREE.Group(), center = (from + to) / 2, base = routeHeight(center);
  root.name = "factory-production-line";
  const stations = factoryStations(from, to), wheels: THREE.Group[] = [], desks: THREE.Group[] = [], machines: THREE.Group[] = [];
  for (const s of stations) {
    const y = routeHeight(s.x) - base, press = new THREE.Group(), b = r.batch(press, false, 0, true);
    press.name = `factory-machine:${s.index}`;
    press.position.set(s.x - center, y, -3.65);
    b.box(0x526f67, 0, 0.85, 0, 2.7, 1.7, 1.6);
    b.box(0x30443e, 0, 1.75, 0, 2.5, 0.17, 1.5);
    b.box(0xb79e60, 0, 2.15, 0, 2.4, 0.18, 1.5);
    for (const dx of [-1, 1]) b.box(0x839b8e, dx, 1.9, 0, 0.14, 0.6, 1.45);
    // An output mouth and a readable little CV on the hopper.
    b.box(0x253c36, -0.6, 2.22, 0.8, 0.82, 0.16, 0.19);
    b.box(0xe6dcc0, 0.2, 2.26, 0.1, 0.7, 0.025, 0.5);
    b.box(0x74847b, 0.2, 2.28, 0.1, 0.4, 0.012, 0.045);
    b.box(0x3f564a, 0, 0.75, 0.55, 2.5, 0.15, 0.9);
    for (let k = 0; k < 6; k++) b.box(0xb7b9a5, -1 + k * 0.38, 0.86, 0.55, 0.14, 0.09, 0.8);
    const wheel = new THREE.Group(), w = r.batch(wheel, false, 0, true);
    wheel.position.set(-0.9, 1.2, 0.86);
    for (let k = 0; k < 10; k++) {
      const a = k * Math.PI / 5;
      w.box(0xc9a25f, Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0, 0.14, 0.14, 0.1);
    }
    w.box(0x565848, 0, 0, 0, 0.22, 0.22, 0.15); w.finish();
    press.add(wheel); wheels.push(wheel); b.finish(); root.add(press); machines.push(press);
    const desk = new THREE.Group(), d = r.batch(desk, false, 0, true);
    desk.name = `factory-desk:${s.index}`;
    desk.position.set(s.workerX - center, routeHeight(s.workerX) - base, -3.1);
    d.box(0x87613e, 0.2, 0.91, 0, 1.15, 0.16, 0.85);
    for (const dx of [-0.2, 0.6]) d.box(0x594e37, dx, 0.45, 0, 0.1, 0.9, 0.65);
    d.box(0xdbcfae, -0.13, 1.06, 0.03, 0.42, 0.16, 0.52);
    d.box(0x272f35, 0.57, 1.02, 0.05, 0.26, 0.08, 0.27);
    d.box(0xa54e45, 0.57, 1.065, 0.05, 0.2, 0.015, 0.2);
    // The CV under the right hand receives a red imprint at each impact.
    d.box(0xf0e6cc, 0.37, 1.005, -0.14, 0.49, 0.018, 0.39);
    const ink = new THREE.Group(), ib = r.batch(ink, false, 0, true);
    ink.name = `factory-imprint:${s.index}`; ink.position.set(0.37, 1.018, -0.14);
    for (const dx of [-0.09, 0.09]) ib.box(0xb35a4c, dx, 0, 0, 0.025, 0.012, 0.2);
    for (const dz of [-0.09, 0.09]) ib.box(0xb35a4c, 0, 0, dz, 0.2, 0.012, 0.025);
    ib.finish(); desk.add(ink); desk.userData.ink = ink;
    d.finish(); root.add(desk); desks.push(desk);
    const heap = new THREE.Group(), h = r.batch(heap, false, 0, true);
    heap.name = `factory-paper-heap:${s.index}`;
    heap.position.set(s.x - 1.05 - center, routeHeight(s.x - 1.05) - base, 3.4);
    for (const side of [-1, 1]) h.box(0x775a3e, side * 0.35, 0.06, 0, 0.12, 0.12, 1.25);
    for (let n = 0; n < 3; n++) {
      const layers = 7 + (n + s.index) % 4;
      for (let k = 0; k < layers; k++) h.box(k % 2 ? 0xe1d6b7 : 0xf0e6cc,
        (n - 1) * 0.42 + Math.sin(k * 7 + n) * 0.07, 0.16 + k * 0.047, Math.cos(k * 13 + n) * 0.09,
        0.6, 0.044, 0.75, Math.sin(k * 3) * 0.035);
      h.box(0x87918a, (n - 1) * 0.42, 0.16 + layers * 0.047, 0.03, 0.3, 0.015, 0.04);
    }
    h.finish(); root.add(heap);
  }
  // One bounded, multicolour draw for all flying sheets and their printed lines.
  const flyers = new THREE.Group(); flyers.name = "factory-flying-cvs";
  const p = r.batch(flyers);
  p.box(0xeee4c9, 0, 0, 0, 0.56, 0.018, 0.39);
  p.box(0x687c79, -0.1, 0.012, -0.07, 0.25, 0.01, 0.05);
  for (const dz of [0.02, 0.09]) p.box(0x8d9990, -0.025, 0.012, dz, 0.39, 0.01, 0.025);
  p.finish();
  const source = flyers.children[0] as THREE.InstancedMesh, parts: THREE.Matrix4[] = [];
  for (let i = 0; i < source.count; i++) { const matrix = new THREE.Matrix4(); source.getMatrixAt(i, matrix); parts.push(matrix); }
  const papers = new THREE.InstancedMesh(r.cube, source.material, stations.length * 3 * parts.length);
  for (let i = 0; i < papers.count; i++) papers.setColorAt(i, new THREE.Color().fromBufferAttribute(source.instanceColor!, i % parts.length));
  papers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  papers.castShadow = false; papers.receiveShadow = false; papers.frustumCulled = false;
  r.release(source); flyers.add(papers); r.instances.add(papers); root.add(flyers);
  const transform = new THREE.Object3D(), combined = new THREE.Matrix4(), pose: FactoryPaperPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, phase: 0 };
  root.userData.animate = (time: number) => {
    for (const wheel of wheels) wheel.rotation.z = -time * 1.7;
    desks.forEach((desk, i) => { desk.userData.ink.visible = factoryCycle(time, i).stamped; });
    let instance = 0;
    for (const station of stations) for (let sheet = 0; sheet < 3; sheet++) {
      factoryPaperPose(time, station, sheet, pose);
      transform.position.set(pose.x - center, pose.y - base, pose.z);
      transform.rotation.set(pose.rx, pose.ry, pose.rz); transform.updateMatrix();
      for (const part of parts) { combined.multiplyMatrices(transform.matrix, part); papers.setMatrixAt(instance++, combined); }
    }
    papers.instanceMatrix.needsUpdate = true;
  };
  root.userData.snapshot = () => ({
    machines: machines.map(model => ({ min: new THREE.Box3().setFromObject(model).min.toArray(), max: new THREE.Box3().setFromObject(model).max.toArray() })),
    papers: Array.from({ length: stations.length * 3 }, (_, index) => { const matrix = new THREE.Matrix4(); papers.getMatrixAt(index * parts.length, matrix); return new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(root.matrixWorld).toArray(); }),
    imprints: desks.map(desk => desk.userData.ink.visible),
  });
  root.userData.contactPatches = stations.flatMap(s => [
    { x: s.x, y: routeHeight(s.x) + 0.195, z: centerZ - 3.65, rx: 1.5, rz: 0.85, opacity: 0.8 },
    { x: s.x - 1.05, y: routeHeight(s.x - 1.05) + 0.195, z: centerZ + 3.4, rx: 0.85, rz: 0.65, opacity: 0.7 },
  ]);
  root.userData.animate(0);
  return root;
}

/** Rolled sleeves, ink-stained apron and a stamp held in a vertically moving hand. */
export function factoryWorker(r: VoxelResources, index: number) {
  const root = new THREE.Group(), head = new THREE.Group(), arm = new THREE.Group();
  root.name = "factory-stamper"; root.userData.kind = "worker"; root.userData.factoryWork = true; root.userData.phase = 0;
  const body = r.batch(root), h = r.batch(head), a = r.batch(arm);
  const shirt = [0x7f9993, 0xa48c70, 0x6d858f][index % 3], skin = index % 2 ? 0xc89f78 : 0xe0b99b;
  body.box(shirt, 0, 0.98, 0, 0.6, 0.58, 0.38);
  body.box(0xd0c4a4, 0, 0.79, 0.22, 0.5, 0.72, 0.04);
  body.box(0x67736a, 0.08, 0.73, 0.25, 0.16, 0.1, 0.02);
  body.box(0x575f57, 0, 0.55, 0, 0.49, 0.25, 0.34);
  for (const side of [-1, 1]) { body.box(0x465650, side * 0.16, 0.29, 0, 0.2, 0.38, 0.24); body.box(0x333d38, side * 0.16, 0.08, 0.08, 0.26, 0.16, 0.4); }
  body.box(shirt, -0.37, 1.04, 0.05, 0.22, 0.35, 0.25);
  body.box(skin, -0.37, 0.85, 0.27, 0.17, 0.17, 0.35);
  head.position.set(0, 1.52, 0);
  h.box(skin, 0, 0, 0, 0.6, 0.57, 0.53);
  h.box(0x5e5140, 0, 0.28, -0.03, 0.63, 0.14, 0.54);
  h.box(0xd9d2b4, 0, 0.37, 0, 0.7, 0.12, 0.58);
  h.box(0xe9e0c6, 0, 0.47, 0.02, 0.53, 0.13, 0.4);
  for (const side of [-1, 1]) h.box(0x2e3e38, side * 0.14, 0.03, 0.276, 0.07, 0.08, 0.025);
  h.box(skin, 0, -0.07, 0.31, 0.12, 0.11, 0.1); h.box(0x675b49, 0, -0.18, 0.278, 0.16, 0.035, 0.02);
  arm.position.set(0.37, 1.24, 0);
  a.box(shirt, 0, -0.02, 0.16, 0.23, 0.3, 0.39);
  a.box(skin, 0, -0.12, 0.41, 0.17, 0.2, 0.33);
  a.box(0x743f38, 0, -0.08, 0.61, 0.23, 0.14, 0.2);
  a.box(0x8f6845, 0, -0.23, 0.61, 0.09, 0.23, 0.09);
  a.box(0xa95047, 0, -0.35, 0.61, 0.36, 0.1, 0.28);
  body.finish(); h.finish(); a.finish(); root.add(head, arm);
  root.userData.animate = (time: number, moving = false, options: { motion?: string } = {}) => {
    const cycle = factoryCycle(time, index), chatting = options.motion === "send", working = !moving && !chatting;
    arm.position.y = 1.24 + (working ? cycle.lift * 0.48 : 0.38);
    head.rotation.set(chatting ? Math.sin(time * 3) * 0.08 : 0.08 + cycle.lift * 0.05, chatting ? 0.15 : 0.02, 0);
    root.userData.stamp = { phase: cycle.phase, lift: arm.position.y - 1.24, stamped: working && cycle.stamped };
  };
  root.userData.animate(0);
  return root;
}
