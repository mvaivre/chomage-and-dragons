import * as THREE from "three";
import { VoxelResources } from "./resources";
import { routeHeight, routeZ } from "./world";
import type { ContactPatch } from "./contact-shadows";

type Mood = "work" | "wait" | "cry" | "tantrum" | "serve";
type Part = { bone: THREE.Object3D; matrix: THREE.Matrix4; color: number };
type Resident = { mood: Mood; index: number; root: THREE.Group; head: THREE.Group; arms: THREE.Group[]; legs: THREE.Group[]; tears: THREE.Group[]; phase: number };
const loop = (value: number) => ((value % 1) + 1) % 1;

/** A finite paper shower: each sheet settles, then rejoins the next delivery. */
export function officePaperPose(time: number, index: number) {
  const phase = loop(time / 3.6 + index / 9), fall = Math.min(1, phase / 0.78);
  return { phase, x: Math.sin(index * 2.4) * 0.26 + Math.sin(fall * 8 + index) * (1 - fall) * 0.3,
    y: 1.67 + (1 - fall * fall) * 3.3, z: Math.cos(index * 2.4) * 0.04,
    rotation: Math.sin(fall * 9 + index) * (1 - fall) * 0.5 };
}

/** Small stage scenes, kept off the walking lane and rendered in one shared draw. */
export function interiorActivity(r: VoxelResources, room: string, from: number, to: number, stations: number[]) {
  const root = new THREE.Group(), rig = new THREE.Group(), parts: Part[] = [], residents: Resident[] = [], papers: THREE.Group[] = [];
  const center = (from + to) / 2, base = routeHeight(center);
  const contacts: ContactPatch[] = [];
  root.userData.contactPatches = contacts;
  root.name = "interior-activity";
  const box = (bone: THREE.Object3D, color: number, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const transform = new THREE.Object3D(); transform.position.set(x, y, z); transform.scale.set(w, h, d); transform.updateMatrix();
    parts.push({ bone, color, matrix: transform.matrix.clone() });
  };
  const bone = (parent: THREE.Group, x: number, y: number, z: number) => {
    const node = new THREE.Group(); node.position.set(x, y, z); parent.add(node); return node;
  };
  const person = (mood: Mood, x: number, z: number, index: number, facing = 0) => {
    const body = bone(rig, x - center, routeHeight(x) - base + 0.18, z), seated = mood === "wait";
    body.rotation.order = "YXZ";
    body.rotation.y = facing;
    contacts.push({ x, y: routeHeight(x) + 0.195, z: routeZ(center) + z + (mood === "tantrum" ? (facing ? 0.7 : -0.7) : 0), rx: 0.5, rz: mood === "tantrum" ? 1 : 0.4, opacity: 0.65 });
    const shirt = [0x587c94, 0xb86757, 0x779566, 0xb79756, 0x826888][index % 5], skin = [0xe1b48c, 0xba805c, 0xf1cba5][index % 3];
    const hip = seated ? 0.55 : 0.88;
    box(body, shirt, 0, hip + 0.23, 0, 0.55, 0.6, 0.37);
    box(body, 0x344454, 0, hip - 0.09, 0, 0.53, 0.19, 0.38);
    if (mood === "work" || mood === "serve") box(body, 0xe7dcc1, 0, hip + 0.21, 0.2, 0.25, 0.49, 0.035);
    const head = bone(body, 0, hip + 0.71, 0);
    box(head, skin, 0, 0, 0, 0.47, 0.47, 0.43);
    box(head, [0x4b352d, 0x382c2c, 0x8a6140][index % 3], 0, 0.22, -0.025, 0.5, 0.15, 0.45);
    for (const side of [-1, 1]) {
      box(head, 0x28353c, side * 0.12, 0.02, 0.224, 0.065, 0.055, 0.025);
      if (mood === "cry" || mood === "wait" || mood === "tantrum") box(head, 0x2d9ce1, side * 0.12, -0.09, 0.23, 0.085, 0.13, 0.035);
    }
    box(head, 0x674638, 0, -0.13, 0.23, 0.11, mood === "work" ? 0.03 : 0.075, 0.025);
    const arms = [-1, 1].map(side => {
      const arm = bone(body, side * 0.36, hip + 0.4, 0);
      box(arm, shirt, 0, -0.13, 0, 0.2, 0.3, 0.24);
      box(arm, skin, 0, -0.36, 0, 0.19, 0.2, 0.22);
      return arm;
    });
    const legs = [-1, 1].map(side => {
      const leg = bone(body, side * 0.16, hip - 0.15, 0);
      box(leg, 0x344454, 0, -0.31, 0, 0.21, 0.6, 0.25);
      box(leg, 0x3c3634, 0, -0.66, 0.085, 0.25, 0.14, 0.39);
      if (seated) {
        // Bent thighs rest on the existing waiting chairs; shins reach the floor.
        leg.position.z = 0.25; leg.position.y = 0.62; leg.scale.y = 0.85;
        box(body, 0x344454, side * 0.16, 0.55, 0.18, 0.21, 0.2, 0.55);
      }
      return leg;
    });
    if (mood === "work") {
      box(arms[1], 0x49382e, 0, -0.48, 0, 0.12, 0.16, 0.12);
      box(arms[1], 0x9b4e46, 0, -0.59, 0, 0.29, 0.09, 0.25);
    } else if (mood === "serve") box(arms[1], 0xe4c27a, 0, -0.47, 0.06, 0.21, 0.28, 0.23);
    else if (mood === "wait") box(arms[0], 0xe9ddbf, 0, -0.4, 0.13, 0.34, 0.04, 0.4);
    const tears: THREE.Group[] = [];
    if (["cry", "wait", "tantrum"].includes(mood)) for (let drop = 0; drop < 6; drop++) {
      const tear = bone(body, 0, 0, 0);
      box(tear, 0x43b9ef, 0, 0, 0, 0.15, 0.26, 0.15);
      box(tear, 0xabe8f5, -0.02, 0.04, 0.083, 0.055, 0.1, 0.015);
      tears.push(tear);
    }
    residents.push({ mood, index, root: body, head, arms, legs, tears, phase: 0 });
  };
  if (room === "orp") {
    for (const [i, x] of stations.entries()) {
      if (i % 2 === 0) person("work", x + 0.55, -3.95, i);
      person("wait", x + (i % 2 ? 0.8 : -0.8), 3, i + 1, Math.PI);
      if (i === 0 || i === 3) person("cry", x + 2.5, -3.5, i + 2);
      if (i === 1 || i === 4) person("tantrum", x + 2.5, -2.95, i + 3);
    }
    const x = stations[2];
    for (let i = 0; i < 9; i++) {
      const paper = bone(rig, x - center - 0.9, routeHeight(x) - base, -2.7);
      box(paper, i % 2 ? 0xf6edcf : 0xe1d6b5, 0, 0, 0, 0.65, 0.035, 0.48);
      box(paper, 0x7b999a, 0, 0.022, -0.06, 0.36, 0.012, 0.045);
      papers.push(paper);
    }
  } else if (room === "factory") {
    // The presses and their operators keep working; these colleagues occupy the gaps
    // between the existing output heaps, on the opposite side of the clear aisle.
    for (const i of [1, 3]) person("cry", stations[i] + 1.7, 3.45, i + 2);
    person("tantrum", stations[2] + 2.6, 3, 7, Math.PI);
  } else if (room === "tavern") {
    for (const [i, x] of stations.entries()) {
      if (i % 2 === 0) person("serve", x + 0.6, -4.2, i);
      else person("wait", x - 0.8, 3.8, i + 2, Math.PI);
    }
    person("tantrum", stations[2] + 2.8, 3, 8, Math.PI);
  }
  const mesh = new THREE.InstancedMesh(r.cube, r.material(0xffffff), parts.length);
  mesh.name = "interior-residents-and-effects";
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
  mesh.castShadow = false; mesh.receiveShadow = true;
  parts.forEach((part, i) => mesh.setColorAt(i, new THREE.Color(part.color)));
  root.add(mesh); r.instances.add(mesh);
  const matrix = new THREE.Matrix4();
  root.userData.animate = (time: number) => {
    for (const p of residents) {
      const t = time + p.index * 0.73, cycle = loop(t / 1.8); p.phase = cycle;
      p.head.rotation.set(0, Math.sin(t * 1.3) * 0.09, Math.sin(t * 2.6) * 0.045);
      if (p.mood === "work" || p.mood === "serve") {
        p.arms[0].rotation.x = -0.95;
        p.arms[1].rotation.x = -0.8 - Math.max(0, Math.sin(cycle * Math.PI * 2)) * 0.8;
      } else if (p.mood === "tantrum") {
        p.root.rotation.x = -Math.PI / 2; p.root.position.y = routeHeight(p.root.position.x + center) - base + 0.43;
        p.arms.forEach((arm, i) => { arm.rotation.z = (i ? 1 : -1) * (0.45 + Math.sin(t * 11 + i) * 0.6); arm.rotation.x = Math.sin(t * 9 + i * 2) * 0.5; });
        p.legs.forEach((leg, i) => { leg.rotation.x = Math.max(0, Math.sin(t * 10 + i * Math.PI)) * 0.8; });
      } else {
        p.head.rotation.x = 0.12 + Math.abs(Math.sin(t * 5)) * 0.1;
        p.arms.forEach((arm, i) => { arm.rotation.x = -0.9 + Math.sin(t * 5 + i) * 0.15; arm.rotation.z = (i ? 1 : -1) * 0.2; });
      }
      p.tears.forEach((tear, i) => {
        const fall = loop(t / 0.95 + i / 3), side = i % 2 ? 1 : -1;
        if (p.mood === "tantrum") {
          tear.position.set(side * (0.14 + fall * 0.35), 1.56 + fall * 0.22, 0.28 - fall * 0.45);
          tear.rotation.x = Math.PI / 2;
        } else tear.position.set(side * (0.14 + fall * 0.23), (p.mood === "wait" ? 1.23 : 1.56) - fall * 1.4, 0.29 + fall * 0.28);
        tear.scale.setScalar(fall > 0.86 ? 1 + (fall - 0.86) * 3 : 1);
        tear.rotation.z = side * fall * 0.35;
      });
    }
    papers.forEach((paper, i) => {
      const p = officePaperPose(time, i), x = stations[2];
      paper.position.set(x - center - 0.9 + p.x, routeHeight(x) - base + p.y, -2.7 + p.z);
      paper.rotation.set(p.rotation, p.rotation * 0.7, p.rotation * 0.6);
    });
    rig.updateMatrixWorld(true);
    parts.forEach((part, i) => { matrix.multiplyMatrices(part.bone.matrixWorld, part.matrix); mesh.setMatrixAt(i, matrix); });
    mesh.instanceMatrix.needsUpdate = true;
  };
  root.userData.snapshot = () => ({
    residents: residents.map(p => ({ mood: p.mood, phase: p.phase, position: p.root.position.toArray(), head: p.head.rotation.toArray(), arms: p.arms.map(a => a.rotation.toArray()) })),
    papers: papers.map(p => p.position.toArray()),
    tears: residents.flatMap(p => p.tears.map(t => new THREE.Vector3().setFromMatrixPosition(t.matrixWorld).toArray())),
    boxes: parts.map(part => new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5)).applyMatrix4(matrix.multiplyMatrices(part.bone.matrixWorld, part.matrix))).map(b => ({ min: b.min.toArray(), max: b.max.toArray() })),
  });
  root.userData.animate(0);
  return root;
}
