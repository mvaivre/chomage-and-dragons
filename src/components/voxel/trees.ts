import * as THREE from "three";
import type { VoxelResources } from "./resources";

type Box = ReturnType<VoxelResources["batch"]>["box"];
/** Each tree is 6–8 boxes (72–96 triangles), independent of its on-screen size.
 * Leaf mottling is a shader pattern; it adds no geometry or texture memory. */
export function plantTree(
  bark: Box, leaves: Box, species: string, index: number,
  x: number, y: number, z: number, size: number, leafColor: number,
) {
  let boxes = 0;
  const block = (target: Box, color: THREE.ColorRepresentation, dx: number, dy: number, dz: number,
    w: number, h: number, d: number, rz = 0) => {
    boxes++;
    target(color, x + dx * size, y + dy * size, z + dz * size,
      w * size, h * size, d * size, rz);
  };
  const birch = species === "lac";
  block(bark, birch ? 0xc8cab4 : 0x674b35, 0, 1.15, 0, 0.27, 2.3, 0.27);
  const pine = species === "montagne" || (species === "foret" && index % 3 === 0);
  if (pine) {
    const snowy = species === "montagne";
    const tiers = snowy ? 3 : 5;
    for (let tier = 0; tier < tiers; tier++) {
      const width = 2.5 - tier * (snowy ? 0.72 : 0.43),
        level = 1.55 + tier * (snowy ? 0.68 : 0.43);
      block(leaves, leafColor, 0, level, 0, width, 0.65, width * 0.9);
      if (snowy) block(leaves, 0xe4ecdf, 0, level + 0.37, 0, width * 0.94, 0.18, width * 0.84);
    }
  } else {
    const blossom = species === "plaine" && index % 4 === 1;
    const autumn = species === "taverne";
    const colors = blossom ? [0xb46b99, 0xd08cac, 0xe8b3c3, 0x995784, 0xd08cac]
      : autumn ? [0xc9813e, 0xe2af57, 0xa96838, 0xb49249, 0xc9813e]
      : [1, 1.18, 0.85, 1.06, 0.91].map(shade => new THREE.Color(leafColor).multiplyScalar(shade));
    const crowns = [
      [0, 2.45, 0, 2.3, 1.25, 2.05],
      [0.05, 3.23, -0.05, 1.4, 0.55, 1.3],
      [-0.87, 2.23, 0.1, 0.95, 0.95, 1.45],
      [0.88, 2.12, 0.2, 0.9, 1, 1.55],
      [0.1, 2.55, -0.77, 1.6, 0.85, 0.8],
    ];
    crowns.forEach(([dx, dy, dz, w, h, d], i) => block(leaves, colors[i], dx, dy, dz, w, h, d));
    for (const side of [-1, 1]) {
      if (species === "marais")
        block(leaves, 0x789b73, side * 0.95, 1.7, 0.1, 0.2, 1.5, 0.55);
      else
        block(bark, 0x715336, side * 0.42, 1.65, 0, 0.95, 0.17, 0.17, side * 0.3);
    }
  }
  return boxes * 12;
}
