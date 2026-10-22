import * as THREE from "three";
import { VoxelResources } from "./resources";
import { plantTree } from "./trees";

/** A close, contained slice of the game's forest. Big colour masses, a clear path,
 * sparse foreground and a warm place behind the actors; no textures or shadow maps. */
export function initiationDiorama(r: VoxelResources, company: boolean) {
  const root = new THREE.Group(), batch = r.batch(root), foliage = r.batch(root, true), b = batch.box;
  b(0x66533c, 0, -0.34, 0, 6.8, 0.4, 4.4);
  b(0x708854, 0, -0.12, 0, 6.8, 0.25, 4.4);
  b(0x789359, 0, -0.03, -1.55, 6.8, 0.4, 1.3);
  for (let x = 0; x < 17; x++) {
    const bend = Math.sin(x * 0.35) * 0.13;
    b([0xc4b38a, 0xbbaa80, 0xd3c49b][x % 3], -3.2 + x * 0.4, 0.02, 0.3 + bend, 0.4, 0.04, 1.15);
    if (x % 3 === 0) b(0xe7d9b4, -3.15 + x * 0.4, 0.05, 0.62 + bend, 0.2, 0.035, 0.13);
  }
  plantTree(b, foliage.box, "plaine", 1, -2.55, 0.18, -1.45, 0.73, 0x557746);
  if (!company) plantTree(b, foliage.box, "foret", 2, 2.5, 0.18, -1.5, 0.68, 0x4e7950);
  plantTree(b, foliage.box, "foret", 0, 0.1, 0.18, -1.65, 0.58, 0x466a45);
  for (let i = 0; i < 22; i++) {
    const x = -2.95 + (i % 11) * 0.57 + Math.sin(i * 2.7) * 0.13, z = i < 11 ? 1.32 + Math.sin(i * 8.3) * 0.24 : -0.73 - (i % 3) * 0.13;
    b(0x507444, x, 0.12, z, 0.055, 0.22, 0.055);
    b(0x87a354, x + 0.07, 0.09, z, 0.17, 0.07, 0.1, 0.25);
    b([0xf2d77d, 0xdb9cbd, 0xdde6b2][i % 3], x, 0.26, z, 0.18, 0.09, 0.15);
    b(0xe9bd64, x, 0.32, z, 0.065, 0.045, 0.06);
  }
  for (let i = 0; i < 9; i++) b(i % 2 ? 0x93a77b : 0x829675, -3 + i * 0.76, 0.08, 1.95, 0.23, 0.16, 0.2);
  // Lanterns live behind the actors, never across their faces or walking area.
  for (const x of [-2.1, 2.8]) {
    b(0x715637, x, 0.7, -0.8, 0.085, 1.4, 0.085);
    b(0x8f7045, x, 1.47, -0.8, 0.32, 0.09, 0.32);
    b(0xffe3a1, x, 1.29, -0.8, 0.19, 0.28, 0.19, 0, true);
  }
  if (company) {
    // A tiny tavern façade: windows, readable doorway and a roof with four courses.
    b(0x756347, 2, 0.27, -1.6, 2.1, 0.2, 1.05);
    b(0x9b8052, 2, 1.04, -1.62, 1.95, 1.5, 0.7);
    for (const x of [1.1, 2, 2.9]) b(0x624a34, x, 1.03, -1.22, 0.1, 1.5, 0.1);
    b(0x513e2d, 2, 0.8, -1.21, 0.52, 1.1, 0.09);
    b(0xe2bc72, 2.16, 0.79, -1.14, 0.055, 0.055, 0.055);
    for (const x of [1.38, 2.62]) {
      b(0x5b4934, x, 1.12, -1.18, 0.48, 0.64, 0.08);
      b(0xffd28a, x, 1.12, -1.12, 0.36, 0.48, 0.04, 0, true);
      b(0x7e5d3d, x, 1.12, -1.08, 0.045, 0.49, 0.035);
    }
    for (let i = 0; i < 4; i++) b(i % 2 ? 0x9c6a48 : 0xaa7650, 2, 1.83 + i * 0.15, -1.65, 2.3 - i * 0.4, 0.16, 1.06);
    b(0x766b55, 2.65, 2.15, -1.8, 0.23, 0.8, 0.24);
    // The hearth sits in the middle; heroes stand on either side.
    for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; b(0x90967d, Math.cos(a) * 0.35, 0.08, 1.05 + Math.sin(a) * 0.3, 0.2, 0.17, 0.18); }
    b(0x745133, 0, 0.12, 1.05, 0.58, 0.13, 0.14, 0.2);
    b(0xea8c41, 0, 0.3, 1.05, 0.27, 0.44, 0.25, 0, true);
    b(0xffdc88, 0.04, 0.47, 1.05, 0.13, 0.36, 0.13, -0.12, true);
  } else {
    // Mailbox: an unmistakable letter slot with a little raised red flag.
    b(0x76583c, 1.65, 0.5, -0.42, 0.12, 1, 0.12);
    b(0x597c70, 1.65, 1.12, -0.42, 0.7, 0.44, 0.46);
    b(0x739383, 1.65, 1.37, -0.42, 0.56, 0.09, 0.43);
    b(0x213d37, 1.65, 1.13, -0.17, 0.47, 0.065, 0.035);
    b(0xd18a6c, 2.04, 1.35, -0.39, 0.07, 0.38, 0.07);
    b(0xd18a6c, 2.12, 1.5, -0.39, 0.2, 0.12, 0.06);
  }
  batch.finish(); foliage.finish(); return root;
}
