import * as THREE from "three";
import { VoxelResources } from "./resources";

const ANIMALS = new Set([
  "fox",
  "hedgehog",
  "otter",
  "goat",
  "scarab",
  "hen",
  "toad",
  "mushroom",
  "heron",
  "squirrel",
]);
export function animalModel(r: VoxelResources, kind: string) {
  if (!ANIMALS.has(kind)) return null;
  const root = new THREE.Group(),
    body = new THREE.Group(),
    head = new THREE.Group(),
    tail = new THREE.Group();
  root.add(body);
  body.add(head, tail);
  const b = r.batch(body),
    h = r.batch(head),
    t = r.batch(tail);
  const fur =
    kind === "fox"
      ? 0xc77838
      : kind === "otter"
        ? 0x815c40
        : kind === "goat"
          ? 0x9d927b
          : kind === "squirrel"
            ? 0xb6804c
            : kind === "hen"
              ? 0xe4d4b1
              : kind === "heron"
                ? 0xa9bbc2
                : kind === "scarab"
                  ? 0x3e8d9a
                  : 0x92775a;
  const round = (
    batch: ReturnType<VoxelResources["batch"]>,
    col: number,
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
    step = 0.1,
  ) => {
    for (let i = -Math.ceil(rx / step); i <= Math.ceil(rx / step); i++)
      for (let j = -Math.ceil(ry / step); j <= Math.ceil(ry / step); j++)
        for (let k = -Math.ceil(rz / step); k <= Math.ceil(rz / step); k++) {
          const q =
            ((i * step) / rx) ** 2 +
            ((j * step) / ry) ** 2 +
            ((k * step) / rz) ** 2;
          if (q > 1 || q < 0.36) continue;
          const color = new THREE.Color(col).multiplyScalar(
            0.87 + (Math.abs(i + j + k) % 3) * 0.1,
          );
          batch.box(
            color,
            x + i * step,
            y + j * step,
            z + k * step,
            step * 1.02,
          );
        }
  };
  const bird = kind === "hen" || kind === "heron";
  if (kind === "mushroom") {
    round(b, 0xe0c8a0, 0, 0.35, 0, 0.22, 0.35, 0.22);
    round(h, 0xbb4b62, 0, 0.72, 0, 0.62, 0.28, 0.5);
    for (let i = 0; i < 9; i++)
      h.box(
        0xf0ddb2,
        Math.sin(i * 13) * 0.45,
        0.85 + Math.cos(i) * 0.08,
        Math.cos(i * 17) * 0.35,
        0.12,
        0.08,
        0.12,
      );
    for (const x of [-0.1, 0.1])
      b.box(0x32342e, x, 0.49, 0.22, 0.06, 0.08, 0.05);
  } else {
    const ry = kind === "hedgehog" ? 0.3 : bird ? 0.37 : 0.28;
    round(b, fur, 0, bird ? 0.75 : 0.43, 0, bird ? 0.35 : 0.5, ry, 0.25);
    head.position.set(bird ? -0.2 : -0.39, bird ? 1 : 0.62, 0);
    round(h, fur, -0.06, 0, 0, 0.24, 0.23, 0.23);
    h.box(
      bird ? 0xddac50 : kind === "fox" ? 0xf0dcb3 : fur,
      -0.27,
      -0.06,
      0,
      0.3,
      0.13,
      0.18,
    );
    h.box(0x302b29, -0.43, -0.02, 0, 0.07, 0.09, 0.1);
    for (const side of [-1, 1]) {
      h.box(0x242f2c, -0.13, 0.06, side * 0.205, 0.06, 0.07, 0.04);
      if (!bird) {
        h.box(fur, side * 0.13, 0.24, 0, 0.14, 0.25, 0.15);
        h.box(0xc8aa8c, side * 0.13, 0.24, 0.085, 0.07, 0.15, 0.025);
      }
    }
    if (kind === "goat")
      for (const side of [-1, 1])
        for (let i = 0; i < 7; i++)
          h.box(
            0x574c3d,
            side * 0.16 + i * 0.025,
            0.2 + i * 0.08,
            -i * 0.025,
            0.09,
            0.1,
            0.1,
          );
    if (kind === "hen") {
      for (let i = 0; i < 3; i++)
        h.box(
          0xc75a4d,
          -0.1 + i * 0.09,
          0.24 + (i % 2) * 0.09,
          0,
          0.1,
          0.14,
          0.1,
        );
      h.box(0xc45a4b, -0.26, -0.2, 0, 0.12, 0.19, 0.1);
    }
    if (kind === "heron") {
      b.box(0xd9e0d3, -0.22, 1.05, 0, 0.12, 0.75, 0.13);
      head.position.y = 1.5;
      h.box(0xcea561, -0.37, -0.02, 0, 0.5, 0.075, 0.09);
    }
    const legs: THREE.Group[] = [];
    for (const x of bird ? [0] : [-0.3, 0.3])
      for (const z of [-0.17, 0.17]) {
        const leg = new THREE.Group(),
          lb = r.batch(leg);
        leg.position.set(x, bird ? 0.4 : 0.25, z);
        lb.box(bird ? 0xc19b60 : fur, 0, -0.12, 0, 0.07, 0.28, 0.07);
        lb.box(
          bird ? 0xc19b60 : 0x4b3e31,
          -0.04,
          -0.24,
          0.03,
          0.18,
          0.06,
          0.12,
        );
        lb.finish();
        body.add(leg);
        legs.push(leg);
      }
    tail.position.set(0.4, 0.48, 0);
    if (!bird) {
      for (let i = 0; i < 8; i++)
        round(
          t,
          kind === "fox" && i > 5 ? 0xe6d0a3 : fur,
          i * 0.08,
          i * 0.035,
          0,
          0.13,
          0.12,
          0.12,
          0.075,
        );
      if (kind === "squirrel") round(t, fur, 0.35, 0.35, 0, 0.2, 0.45, 0.2);
    } else
      for (let i = 0; i < 4; i++)
        t.box(
          kind === "hen" ? 0x52645e : 0x78909b,
          0.03 + i * 0.09,
          0.19 + i * 0.09,
          0,
          0.16,
          0.2,
          0.23,
        );
    if (kind === "hedgehog")
      for (let i = 0; i < 55; i++)
        b.box(
          i % 2 ? 0x4d493d : 0xc8b68d,
          Math.sin(i * 17) * 0.43,
          0.55 + Math.cos(i * 3) * 0.12,
          Math.cos(i * 13) * 0.22,
          0.065,
          0.26,
          0.065,
          Math.sin(i),
        );
    if (kind === "scarab") {
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++)
          b.box(0x514d47, -0.28 + i * 0.25, 0.19, side * 0.3, 0.07, 0.07, 0.3);
      b.box(0xc5b773, 0, 0.7, 0, 0.04, 0.07, 0.38);
    }
    root.userData.animate = (time: number, moving = false) => {
      head.rotation.z =
        Math.sin(time * 1.8) * 0.1 +
        (bird ? Math.max(0, Math.sin(time * 0.7)) * 0.45 : 0);
      tail.rotation.y = Math.sin(time * 2) * 0.22;
      legs.forEach(
        (leg, i) =>
          (leg.rotation.z = moving
            ? Math.sin(time * 8 + i * Math.PI) * 0.4
            : Math.sin(time * 1.2 + i) * 0.025),
      );
    };
  }
  b.finish();
  h.finish();
  t.finish();
  return root;
}
