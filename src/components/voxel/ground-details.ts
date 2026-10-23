import * as THREE from "three";
import { seededRandom } from "@/lib/rng";
import { VoxelResources } from "./resources";
import {
  biomeWeights,
  BACKGROUND_DEPTH,
  CHUNK_SIZE,
  routeZ,
  terrainSurface as terrainHeight,
  voxelPalette,
} from "./world";

type Box = ReturnType<VoxelResources["batch"]>["box"];
/** Small grounded vignettes, never a screen across the heroes' readable silhouette. */
export function groundDetails(
  root: THREE.Group,
  r: VoxelResources,
  cx: number,
  box: Box,
) {
  const random = seededRandom((Math.imul(cx, 83492791) ^ 0x71a42d) >>> 0);
  const fronts = new THREE.Group();
  fronts.name = "foreground-details";
  root.add(fronts);
  for (let i = 0; i < 8; i++) {
    const x = cx * CHUNK_SIZE + random() * CHUNK_SIZE;
    const z = routeZ(x) + 2.9 + random() * 2.25,
      y = terrainHeight(x, z),
      p = voxelPalette(x),
      biome = biomeWeights(x).a.id;
    if (biome === "montagne") {
      // Low snowberry shrubs, blue alpine flowers and frost-covered stones.
      for (let k = 0; k < 3 + Math.floor(random() * 3); k++) {
        const xx = x + Math.sin(k * 11) * 0.23,
          zz = z + Math.cos(k * 7) * 0.18;
        box(0x6c8580, xx, y + 0.14, zz, 0.075, 0.28, 0.075);
        box(k % 2 ? 0xc3d3d0 : 0x8baba6, xx, y + 0.24, zz, 0.18, 0.12, 0.15);
        if (k % 2 === 0) box(0xe4ecdf, xx, y + 0.33, zz, 0.14, 0.06, 0.12);
        else
          box(
            i % 2 ? 0xb26469 : 0x8cafd4,
            xx + 0.04,
            y + 0.27,
            zz + 0.07,
            0.06,
            0.06,
            0.05,
          );
      }
      box(0x7f939a, x + 0.4, y + 0.07, z, 0.27, 0.14, 0.2);
      box(0xe4ecdf, x + 0.4, y + 0.16, z, 0.24, 0.04, 0.19);
      if (i === 2 && Math.abs(cx) % 3 === 1) {
        for (const side of [-1, 1])
          box(0x806746, x + side * 0.22, y + 0.06, z + 0.45, 0.06, 0.1, 0.85);
        for (let k = 0; k < 4; k++)
          box(0xb89a67, x, y + 0.15, z + 0.15 + k * 0.18, 0.59, 0.07, 0.12);
      }
    } else if (biome === "volcan") {
      for (let k = 0; k < 4; k++) {
        box(
          p.rock,
          x + k * 0.12,
          y + 0.08 + k * 0.035,
          z,
          0.17,
          0.17 + k * 0.07,
          0.15,
        );
        if (k % 2 === 0)
          box(
            0xee8e48,
            x + k * 0.12,
            y + 0.19 + k * 0.065,
            z,
            0.08,
            0.05,
            0.07,
            0,
            true,
          );
      }
    } else if (biome === "desert") {
      for (let k = 0; k < 6; k++)
        box(
          k % 2 ? 0xc6b58c : 0xd4c39a,
          x + Math.sin(k) * 0.23,
          y + 0.045,
          z + Math.cos(k) * 0.16,
          0.14,
          0.07,
          0.12,
        );
      box(0x819267, x + 0.3, y + 0.14, z, 0.08, 0.28, 0.08);
      for (const side of [-1, 1])
        box(0x91a078, x + 0.3 + side * 0.11, y + 0.19, z, 0.2, 0.07, 0.09);
    } else {
      // Fern rosettes and flowers grow in irregular little patches.
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3,
          xx = x + Math.cos(a) * 0.18,
          zz = z + Math.sin(a) * 0.18;
        box(
          k % 2 ? p.leaf : 0x76934b,
          xx,
          y + 0.1,
          zz,
          0.22,
          0.05,
          0.12,
          Math.sin(a) * 0.22,
        );
        box(0x486a44, x, y + 0.1, z, 0.045, 0.2, 0.045);
      }
      for (let k = 0; k < 4; k++) {
        const xx = x + 0.3 + random() * 0.3,
          zz = z - 0.2 + random() * 0.4;
        box(p.leaf, xx, y + 0.12, zz, 0.035, 0.24, 0.035);
        const color =
          biome === "marais"
            ? 0xc196cd
            : biome === "lac" || biome === "cascade"
              ? 0xa5d9e2
              : i % 2
                ? 0xc874a3
                : 0xe5c069;
        box(color, xx, y + 0.26, zz, 0.12, 0.07, 0.13);
      }
      if (i % 3 === 0) {
        // A mossy fallen branch and a few red mushrooms stay below knee height.
        for (let k = 0; k < 5; k++)
          box(
            k % 2 ? 0x775c43 : 0x69503d,
            x - 0.35 + k * 0.15,
            y + 0.1,
            z + 0.4,
            0.155,
            0.16,
            0.19,
          );
        box(p.leaf, x, y + 0.2, z + 0.4, 0.28, 0.045, 0.14);
        box(0xdac9a1, x - 0.2, y + 0.14, z + 0.17, 0.05, 0.26, 0.05);
        box(0xc55b51, x - 0.2, y + 0.29, z + 0.17, 0.22, 0.1, 0.2);
      }
    }
  }
  // The extra background strip has its own small weathered stones and undergrowth.
  for (let i = 0; i < 6; i++) {
    const x = cx * CHUNK_SIZE + ((i + random()) / 6) * CHUNK_SIZE,
      z = -BACKGROUND_DEPTH + 1 + random() * 1.5,
      y = terrainHeight(x, z),
      p = voxelPalette(x),
      b = biomeWeights(x).a.id;
    for (let k = 0; k < 3; k++)
      box(
        p.rock,
        x + k * 0.18,
        y + 0.11 + k * 0.13,
        z,
        0.29,
        0.22 + k * 0.22,
        0.3,
      );
    if (b === "montagne")
      box(0xe4ecdf, x + 0.35, y + 0.67, z, 0.29, 0.08, 0.32);
    else if (b !== "volcan" && b !== "desert")
      for (let k = 0; k < 5; k++)
        box(
          p.leaf,
          x - 0.2 + k * 0.14,
          y + 0.18,
          z + 0.32,
          0.12,
          0.36 + random() * 0.25,
          0.12,
        );
  }
  const center = cx * CHUNK_SIZE + 7,
    biome = biomeWeights(center).a.id;
  if (["plaine", "foret", "lac", "marais", "taverne"].includes(biome)) {
    const butterfly = new THREE.Group(),
      wings: THREE.Group[] = [];
    const color = biome === "marais" ? 0x8ac9bc : 0xd5a0c8;
    for (const side of [-1, 1]) {
      const wing = new THREE.Group(),
        b = r.batch(wing);
      b.box(color, side * 0.11, 0, 0, 0.2, 0.025, 0.14);
      b.box(0xe5c069, side * 0.05, 0, 0.02, 0.045, 0.03, 0.06);
      b.finish();
      butterfly.add(wing);
      wings.push(wing);
    }
    const z = routeZ(center) + 3.5,
      y = terrainHeight(center, z);
    fronts.add(butterfly);
    root.userData.animate = (seconds: number) => {
      butterfly.position.set(
        center + Math.sin(seconds * 0.7 + cx) * 0.4,
        y + 0.6 + Math.sin(seconds * 1.2 + cx) * 0.12,
        z + Math.cos(seconds * 0.6 + cx) * 0.2,
      );
      wings.forEach(
        (wing, i) =>
          (wing.rotation.z = Math.sin(seconds * 11) * (i ? 1 : -1) * 0.65),
      );
    };
    root.userData.animate(0);
  }
}
