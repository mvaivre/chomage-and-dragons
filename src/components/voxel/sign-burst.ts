import * as THREE from "three";
import { signReaction } from "@/lib/game/sign-reactions";
import type { VoxelResources } from "./resources";

const PALETTES = {
  confetti: [0xef5161, 0xffc844, 0x46b9f0, 0x75d049, 0xc790f0, 0xfff1ca],
  letters: [0xffebc6, 0xe6c793, 0xd5ac76],
  dust: [0x9e8e77, 0xb9aa92, 0xd9c6a7],
  stars: [0xfff1a8, 0xffc555, 0xffffe7],
};

export function signBurst(resources: VoxelResources, text: string, reduced: boolean) {
  const reaction = signReaction(text);
  const palette = PALETTES[reaction];
  const root = new THREE.Group();
  root.name = `sign-burst:${reaction}`;
  const batch = resources.batch(root);
  const count = reduced ? 4 : reaction === "confetti" ? 32 : reaction === "letters" ? 9 : 13;
  const size = reaction === "letters" ? .21 : .13;
  const pieces = Array.from({ length: count }, (_, i) => {
    batch.box(palette[i % palette.length], 0, 0, 0, size, size, size, 0, reaction !== "dust");
    const angle = i * 2.39996;
    const speed = .9 + Math.random() * 2.4;
    return { dx: Math.cos(angle) * speed, dz: Math.sin(angle) * speed, vy: 2.5 + Math.random() * 2.8, spin: 2 + Math.random() * 5 };
  });
  batch.finish();
  const mesh = root.children[0] as THREE.InstancedMesh;
  mesh.frustumCulled = false;
  const transform = new THREE.Object3D();
  const animate = (age: number) => {
    const t = reduced ? .23 : age;
    pieces.forEach(({ dx, dz, vy, spin }, i) => {
      transform.position.set(dx * t, vy * t - t * t * 3.9, dz * t);
      transform.rotation.set(spin * t, t * 4 + i, t * spin * .6);
      const scale = size * Math.min(1, Math.max(0, (1.35 - age) * 4));
      transform.scale.set(scale, scale * (reaction === "confetti" ? 1.65 : .82), scale * .36);
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  animate(0);
  return { root, animate };
}
