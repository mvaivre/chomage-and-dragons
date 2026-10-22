import * as THREE from "three";
import { VoxelResources } from "./resources";

export const CHEST_OPEN_AT = 1.9;
export const CHEST_PICKUP_DURATION = 3.2;
const smooth = (n: number) => {
  const t = Math.max(0, Math.min(1, n));
  return t * t * (3 - 2 * t);
};
/** Closed anticipation, pickup, then the lid: the reward never precedes the collection. */
export function chestPickupPose(seconds: number, reducedMotion = false) {
  const lift = smooth((seconds - 0.65) / 0.85),
    opening = smooth((seconds - CHEST_OPEN_AT) / 0.45);
  return {
    lift,
    opening,
    phase:
      seconds < 0.65
        ? "found"
        : seconds < CHEST_OPEN_AT
          ? "collecting"
          : "opening",
    wobble: reducedMotion
      ? 0
      : Math.sin(seconds * 24) * 0.045 * (1 - smooth(seconds / 0.65)),
    hop: reducedMotion ? 0 : Math.sin(lift * Math.PI) * 0.35,
    scale: 1.15 + lift * 0.35,
  };
}

/** A hollow wooden chest with a hinged voxel lid; every box shares pooled resources. */
export function chestModel(r: VoxelResources) {
  const root = new THREE.Group(),
    lid = new THREE.Group();
  root.name = "treasure-chest";
  const body = r.batch(root),
    top = r.batch(lid);
  body.box(0x715035, 0, 0.06, 0, 1.08, 0.12, 0.8);
  for (let x = -3; x <= 3; x++)
    for (let row = 0; row < 3; row++)
      for (const side of [-1, 1])
        body.box(
          (x + row) % 3 ? 0x987044 : 0xad8652,
          x * 0.15,
          0.18 + row * 0.12,
          side * 0.36,
          0.145,
          0.12,
          0.08,
        );
  for (const side of [-1, 1]) {
    body.box(0x8c633f, side * 0.5, 0.3, 0, 0.08, 0.36, 0.64);
    for (const z of [-0.41, 0.41])
      body.box(0xd7b56c, side * 0.33, 0.29, z, 0.09, 0.5, 0.035);
  }
  body.box(0x513e2c, 0, 0.14, 0, 0.88, 0.035, 0.6);
  body.box(0xe4c578, 0, 0.38, 0.42, 0.16, 0.2, 0.055);
  body.box(0x594b32, 0, 0.39, 0.451, 0.035, 0.065, 0.01);
  lid.position.set(0, 0.49, -0.39);
  for (let x = -3; x <= 3; x++) {
    top.box(
      x % 3 ? 0xa67b49 : 0xb78c55,
      x * 0.15,
      0.065,
      0.39,
      0.145,
      0.13,
      0.8,
    );
    top.box(
      x % 2 ? 0xad8652 : 0x987044,
      x * 0.15,
      0.15,
      0.39,
      0.145,
      0.07,
      0.58,
    );
  }
  for (const x of [-0.33, 0.33])
    top.box(0xd7b56c, x, 0.2, 0.39, 0.09, 0.03, 0.72);
  for (const x of [-0.33, 0.33])
    body.box(0xbda263, x, 0.48, -0.43, 0.14, 0.11, 0.075);
  root.add(lid);
  body.finish();
  top.finish();
  root.userData.lid = lid;
  return root;
}

export function chestPickup(r: VoxelResources) {
  const root = new THREE.Group(),
    chest = chestModel(r),
    sparkle = new THREE.Group();
  root.add(chest, sparkle);
  const particles = r.batch(sparkle);
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    particles.box(
      i % 3 ? 0xf3d784 : 0xffefbb,
      Math.cos(a) * (0.5 + i * 0.025),
      0.15 + (i % 4) * 0.12,
      Math.sin(a) * (0.5 + i * 0.025),
      0.055,
      0.055,
      0.055,
      0,
      true,
    );
  }
  particles.finish();
  const glow = r.pointLight(0xffd57c, 0, 5);
  root.add(glow);
  return {
    root,
    update(_u: number, elapsed: number, heroHeight = 2) {
      root.position.set(0, 0, 0);
      const pose = chestPickupPose(
        elapsed,
        root.userData.reducedMotion === true,
      );
      const target = root.userData.collectorOffset as
        { x: number; y: number; z: number } | undefined;
      chest.position.set(
        (target?.x ?? -1.2) * pose.lift,
        (target?.y ?? heroHeight + 0.25) * pose.lift + pose.hop + 0.02,
        (target?.z ?? -0.95) * pose.lift,
      );
      chest.scale.setScalar(pose.scale);
      chest.rotation.z = pose.wobble;
      (chest.userData.lid as THREE.Group).rotation.x =
        -pose.opening * Math.PI * 0.57;
      sparkle.position.copy(chest.position);
      sparkle.position.y += 0.4;
      sparkle.scale.setScalar(0.7 + pose.opening * 0.7);
      sparkle.rotation.y = root.userData.reducedMotion ? 0 : elapsed * 0.7;
      glow.position.copy(chest.position);
      glow.position.y += 0.55;
      glow.intensity = pose.opening * 12;
      root.userData.pickupPose = {
        ...pose,
        chestPosition: chest.position.toArray(),
        lidAngle: (chest.userData.lid as THREE.Group).rotation.x,
      };
    },
  };
}
