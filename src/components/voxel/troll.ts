import * as THREE from "three";
import { VoxelResources } from "./resources";

/** A hunched forest brute with a readable face, tusks and articulated, oversized hands. */
export function trollModel(r: VoxelResources) {
  const root = new THREE.Group(), torso = new THREE.Group(), head = new THREE.Group();
  root.name = "forest-troll";
  root.userData.kind = "troll"; root.userData.resident = true;
  root.add(torso); torso.add(head); head.position.set(0, 1.9, 0.17);
  const body = r.batch(torso), face = r.batch(head), arms: THREE.Group[] = [], legs: THREE.Group[] = [];
  const skin = 0x73956a, light = 0x94ad76, dark = 0x4b7355;
  body.box(dark, 0, 1.35, -0.04, 1.2, 0.95, 0.66);
  body.box(skin, 0, 1.24, 0.15, 0.98, 0.88, 0.71);
  body.box(light, 0, 1.2, 0.51, 0.65, 0.58, 0.07);
  body.box(0x6e4e37, 0, 0.79, 0.03, 0.96, 0.14, 0.73);
  body.box(0xb8a46a, 0, 0.8, 0.43, 0.18, 0.16, 0.07);
  for (const side of [-1, 1]) body.box(0x80603e, side * 0.23, 0.61, 0.15, 0.4, 0.27 + side * 0.04, 0.66);
  face.box(skin, 0, 0.07, 0, 0.82, 0.68, 0.62);
  face.box(dark, 0, 0.39, -0.02, 0.67, 0.12, 0.55);
  face.box(light, 0, -0.14, 0.32, 0.75, 0.3, 0.36);
  face.box(0x35493b, 0, -0.1, 0.51, 0.5, 0.065, 0.025);
  face.box(0x88a16c, 0, 0.08, 0.43, 0.32, 0.28, 0.32);
  for (const side of [-1, 1]) {
    face.box(skin, side * 0.48, 0.08, -0.02, 0.3, 0.24, 0.23);
    face.box(light, side * 0.64, 0.17, -0.04, 0.14, 0.12, 0.18);
    face.box(0xe3d79a, side * 0.23, 0.17, 0.32, 0.18, 0.12, 0.025);
    face.box(0x263c30, side * 0.23, 0.17, 0.34, 0.065, 0.085, 0.024);
    face.box(dark, side * 0.23, 0.27, 0.35, 0.28, 0.095, 0.09, side * -0.15);
    face.box(0xe4d7ab, side * 0.24, -0.06, 0.53, 0.12, 0.25, 0.12);
    face.box(0xf1e6bf, side * 0.24, 0.09, 0.53, 0.07, 0.09, 0.08);
    const arm = new THREE.Group(), a = r.batch(arm);
    arm.position.set(side * 0.72, 1.64, -0.02);
    a.box(skin, 0, -0.3, 0, 0.38, 0.65, 0.42);
    a.box(dark, side * 0.06, -0.78, 0.05, 0.34, 0.48, 0.37);
    a.box(skin, side * 0.07, -1.01, 0.15, 0.46, 0.27, 0.47);
    a.box(light, side * -0.16, -0.99, 0.31, 0.13, 0.17, 0.22);
    if (side === 1) {
      a.box(0x775236, 0.09, -0.82, 0.41, 0.13, 0.96, 0.13);
      a.box(0x926a42, 0.09, -0.21, 0.41, 0.37, 0.51, 0.35);
      a.box(0xa78b57, 0.09, -0.05, 0.41, 0.39, 0.09, 0.37);
    }
    a.finish(); torso.add(arm); arms.push(arm);
    const leg = new THREE.Group(), l = r.batch(leg);
    leg.position.set(side * 0.29, 0.66, 0);
    l.box(dark, 0, -0.24, 0, 0.34, 0.48, 0.36);
    l.box(skin, 0, -0.55, 0.15, 0.42, 0.22, 0.64);
    l.box(light, 0, -0.58, 0.46, 0.32, 0.13, 0.07);
    l.finish(); root.add(leg); legs.push(leg);
  }
  body.finish(); face.finish();
  root.userData.head = head; root.userData.arms = arms; root.userData.legs = legs;
  root.userData.animate = (time: number, moving = false, pose?: { blend?: number; stride?: number; motion?: string }) => {
    const blend = pose?.blend ?? Number(moving), stride = pose?.stride ?? time * 5;
    torso.position.y = Math.sin(time * 1.5) * 0.018 + Math.abs(Math.sin(stride)) * 0.035 * blend;
    head.rotation.y = Math.sin(time * 0.6) * 0.08;
    head.rotation.x = pose?.motion === "send" ? Math.sin(time * 3) * 0.08 : 0.04;
    legs.forEach((leg, i) => { leg.rotation.x = Math.sin(stride + i * Math.PI) * 0.38 * blend; });
    arms.forEach((arm, i) => { arm.rotation.x = Math.sin(stride + (1 - i) * Math.PI) * 0.3 * blend; arm.rotation.z = (i ? -1 : 1) * (0.06 + Math.sin(time * 1.3) * 0.015); });
  };
  return root;
}
