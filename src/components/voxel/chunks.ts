import * as THREE from "three";
import { seededRandom } from "@/lib/rng";
import {
  biomeWeights,
  CHUNK_SIZE,
  FOREGROUND_DEPTH,
  BACKGROUND_DEPTH,
  tileBottom,
  routeHeight,
  routeZ,
  terrainHeight,
  voxelPalette,
  villagePond,
  foregroundPool,
  poolRadius,
  riverAt,
  riverSites,
  WORLD_METRES,
} from "./world";
import { VoxelResources } from "./resources";
import { groundDetails } from "./ground-details";
import type { ContactPatch } from "./contact-shadows";
import { plantTree } from "./trees";
import { sceneryFootprints, treeFits } from "./layout";
import { lantern } from "./scenery";
import { pondLife } from "./pond-life";
import { riverBridge } from "./bridges";

export const TILE_DEPTH = FOREGROUND_DEPTH + BACKGROUND_DEPTH;
/** Rectangular streamed terrain with relief above a shared, closed underside. */
export function makeChunk(cx: number, cz: number, r: VoxelResources) {
  const root = new THREE.Group();
  root.name = `chunk:${cx}:${cz}`;
  const contacts: ContactPatch[] = [];
  root.userData.contactPatches = contacts;
  const random = seededRandom(
    (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663)) >>> 0,
  );
  const { box, finish } = r.batch(root, false, r.terrainStripWidth),
    cell = 0.5,
    s = CHUNK_SIZE;
  const strips = Array.from({ length: r.terrainStripWidth ? s / r.terrainStripWidth : 1 },
    () => ({ positions: [] as number[], normals: [] as number[], colors: [] as number[] }));
  const quad = (p: number[][], n: number[], c: THREE.Color) => {
    const center = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4;
    const index = r.terrainStripWidth
      ? Math.max(0, Math.min(strips.length - 1, Math.floor((center - cx * s) / r.terrainStripWidth))) : 0;
    const { positions, normals, colors } = strips[index];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      positions.push(...p[i]);
      normals.push(...n);
      colors.push(c.r, c.g, c.b);
    }
  };
  const inside = (x: number, z: number) => {
    return z > -BACKGROUND_DEPTH && z < FOREGROUND_DEPTH;
  };
  const height = (x: number, z: number) =>
    Math.abs(z - routeZ(x)) < 1.4 && !riverAt(x, z) ? routeHeight(x) + 0.17 : terrainHeight(x, z);
  // Sample the height field once, including a one-cell halo shared with neighbors.
  // Previously every cell reevaluated four neighbors and its biome/color palette.
  const columns = s / cell, rows = TILE_DEPTH / cell + 2;
  const heights = new Float64Array((columns + 2) * rows);
  for (let ix = -1; ix <= columns; ix++)
    for (let iz = -BACKGROUND_DEPTH / cell - 1; iz <= FOREGROUND_DEPTH / cell; iz++)
      heights[(ix + 1) * rows + iz + BACKGROUND_DEPTH / cell + 1] =
        height(cx * s + (ix + 0.5) * cell, (iz + 0.5) * cell);
  const palettes = Array.from({ length: columns }, (_, ix) => voxelPalette(cx * s + (ix + 0.5) * cell));
  const palette = voxelPalette(cx * s + s / 2),
    biome = biomeWeights(cx * s + s / 2).a.id;
  for (let ix = 0; ix < s / cell; ix++)
    for (
      let iz = -BACKGROUND_DEPTH / cell;
      iz < FOREGROUND_DEPTH / cell;
      iz++
    ) {
      const x = cx * s + ix * cell,
        z = iz * cell,
        xx = x + cell / 2,
        zz = z + cell / 2;
      if (!inside(xx, zz)) continue;
      const pool = foregroundPool(xx), river = riverAt(xx, zz), wet = !!river || (!!pool && poolRadius(pool, xx, zz) < 1);
      const plant = wet ? (() => {}) as typeof box : box;
      const p = palettes[ix],
        depth = zz - routeZ(xx),
        path = Math.abs(depth) < 1.4,
        heightIndex = (ix + 1) * rows + iz + BACKGROUND_DEPTH / cell + 1,
        y = heights[heightIndex];
      const top = new THREE.Color(path ? p.path : p.ground).multiplyScalar(
        0.86 + random() * 0.28,
      );
      quad(
        [
          [x, y, z],
          [x, y, z + cell],
          [x + cell, y, z + cell],
          [x + cell, y, z],
        ],
        [0, 1, 0],
        top,
      );
      if (wet) { const level = river?.y ?? pool!.y; quad([[x, level, z], [x, level, z + cell], [x + cell, level, z + cell], [x + cell, level, z]], [0, 1, 0], new THREE.Color(0x519b9b)); }
      const sides = [
        {
          dx: -cell,
          dz: 0,
          n: [-1, 0, 0],
          p: [
            [x, z + cell],
            [x, z],
          ],
        },
        {
          dx: cell,
          dz: 0,
          n: [1, 0, 0],
          p: [
            [x + cell, z],
            [x + cell, z + cell],
          ],
        },
        {
          dx: 0,
          dz: -cell,
          n: [0, 0, -1],
          p: [
            [x, z],
            [x + cell, z],
          ],
        },
        {
          dx: 0,
          dz: cell,
          n: [0, 0, 1],
          p: [
            [x + cell, z + cell],
            [x, z + cell],
          ],
        },
      ];
      for (const side of sides) {
        const nx = xx + side.dx,
          nz = zz + side.dz,
          edge = !inside(nx, nz);
        const bottom = edge ? tileBottom(xx) : heights[heightIndex + side.dx / cell * rows + side.dz / cell];
        if (bottom >= y - 0.01) continue;
        const [a, b] = side.p;
        if (edge) {
          const layers = [
            { top: y, bottom: y - 0.18, color: p.ground, base: false },
            { top: y - 0.18, bottom: y - 0.63, color: 0x8c7050, base: false },
            { top: y - 0.63, bottom, color: p.rock, base: true },
          ];
          for (const layer of layers)
            quad(
              [
                [a[0], layer.top, a[1]],
                [b[0], layer.top, b[1]],
                [b[0], layer.base ? tileBottom(b[0]) : layer.bottom, b[1]],
                [a[0], layer.base ? tileBottom(a[0]) : layer.bottom, a[1]],
              ],
              side.n,
              new THREE.Color(layer.color).multiplyScalar(
                0.72 + (Math.abs(ix + iz) % 3) * 0.035,
              ),
            );
        } else
          quad(
            [
              [a[0], y, a[1]],
              [b[0], y, b[1]],
              [b[0], bottom, b[1]],
              [a[0], bottom, a[1]],
            ],
            side.n,
            new THREE.Color(p.rock).multiplyScalar(0.82),
          );
      }
      // Fine ground cover uses tiny voxels, while the walkable silhouette stays clear.
      if (!path && random() < 0.58) {
        const h = 0.08 + random() * 0.22,
          grass = [p.leaf, 0x76934b, 0x91a862, 0x486a44];
        if (biome !== "volcan" && biome !== "montagne" && biome !== "desert") {
          plant(
            grass[Math.floor(random() * grass.length)],
            xx,
            y + h / 2,
            zz,
            0.045,
            h,
            0.045,
          );
          if (random() < 0.24) {
            const flowers =
              biome === "marais"
                ? [0x96c58d, 0xc196cd, 0x7cbaae]
                : ["lac", "cascade"].includes(biome)
                  ? [0xa5d9e2, 0xd4d3ef, 0x8ca9d1]
                  : [0xe5c069, 0xc874a3, 0xa6b5e1, 0xebe6b3, 0xd88e7c];
            const flower = flowers[Math.floor(random() * flowers.length)];
            plant(flower, xx, y + h, zz, 0.12, 0.07, 0.1);
            plant(flower, xx - 0.05, y + h - 0.02, zz, 0.07, 0.065, 0.07);
          }
        } else if (random() < 0.18)
          plant(p.rock, xx, y + 0.08, zz, 0.14 + random() * 0.2, 0.16, 0.18);
      }
      if (path && random() < 0.18)
        box(
          random() < 0.5 ? 0x8b9373 : 0xe0c598,
          xx,
          y + 0.015,
          zz,
          0.16,
          0.03,
          0.13,
        );
      if (zz > FOREGROUND_DEPTH - 0.8 && random() < 0.35) {
        const moss = random() < .5, stoneZ = 4.5 + (ix % 7) * .75, stoneY = height(xx, stoneZ);
        if (!riverAt(xx, stoneZ) && !(pool && poolRadius(pool, xx, stoneZ) < 1.2)) {
          box(p.rock, xx, stoneY + .16, stoneZ, .4, .3, .3);
          if (moss) box(p.leaf, xx, stoneY + .33, stoneZ, .3, .06, .26);
        }
      }
    }
  // One ruled strip per column closes the tile. Adjacent chunks share exact endpoints.
  for (let ix = 0; ix < s / cell; ix++) {
    const x = cx * s + ix * cell,
      right = x + cell;
    const a = tileBottom(x),
      b = tileBottom(right);
    const n = new THREE.Vector3((b - a) / cell, -1, 0).normalize();
    quad(
      [
        [x, a, -BACKGROUND_DEPTH],
        [right, b, -BACKGROUND_DEPTH],
        [right, b, FOREGROUND_DEPTH],
        [x, a, FOREGROUND_DEPTH],
      ],
      n.toArray(),
      new THREE.Color(voxelPalette(x).rock).multiplyScalar(0.65),
    );
  }
  const mat = r.material(0xffffff).clone();
  mat.vertexColors = true;
  r.addFog(mat, true);
  const geometries = strips.map(({ positions, normals, colors }) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeBoundingSphere();
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    ground.castShadow = true;
    root.add(ground);
    return geo;
  });
  // Coarse visual ground continues beyond the walking tile and disappears in fog.
  const apronPositions: number[] = [], apronNormals: number[] = [], apronColors: number[] = [];
  for (let ix = 0; ix < columns; ix++) for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
    const x = cx * s + ix * cell, z0 = side < 0 ? -BACKGROUND_DEPTH - row * 6 : FOREGROUND_DEPTH + row * 6;
    const z1 = z0 + side * 6, a = Math.min(z0, z1), b = Math.max(z0, z1);
    const leftY = routeHeight(x) + .12, rightY = routeHeight(x + cell) + .12, river = riverAt(x + cell / 2, (a + b) / 2);
    const color = new THREE.Color(river ? 0x519b9b : palettes[ix].ground).multiplyScalar(0.9 + (ix % 3) * 0.04);
    for (const v of [[x, river?.y ?? leftY, a], [x, river?.y ?? leftY, b], [x + cell, river?.y ?? rightY, b], [x, river?.y ?? leftY, a], [x + cell, river?.y ?? rightY, b], [x + cell, river?.y ?? rightY, a]]) {
      apronPositions.push(...v); apronNormals.push(0, 1, 0); apronColors.push(color.r, color.g, color.b);
    }
  }
  const apronGeometry = r.geometry(new THREE.BufferGeometry());
  apronGeometry.setAttribute("position", new THREE.Float32BufferAttribute(apronPositions, 3)); apronGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(apronNormals, 3)); apronGeometry.setAttribute("color", new THREE.Float32BufferAttribute(apronColors, 3)); apronGeometry.computeBoundingSphere();
  const apron = new THREE.Mesh(apronGeometry, mat); apron.name = "fogged-ground-continuation"; apron.receiveShadow = true; apron.userData.ownedGeometry = apronGeometry; root.add(apron);
  // Trees stay present behind the camera; their opaque shader protects the hero.
  const planting = new THREE.Group();
  root.add(planting);
  root.userData.backPlanting = planting;
  const treeBatch = r.batch(planting, false, 0, true);
  const canopyBatch = r.batch(planting, true, 0, true);
  let treeTriangles = 0;
  const reserved = sceneryFootprints(cx * s - 4, (cx + 1) * s + 4);
  const trees: { x: number; z: number; size: number }[] = [];
  root.userData.trees = trees;
  const treeCount = ({ foret: 18, plaine: 8, lac: 7, marais: 8, cascade: 9, montagne: 10, desert: 7, volcan: 8, taverne: 9 } as Record<string, number>)[biome] ?? 8;
  for (let t = 0; t < treeCount; t++) {
    const box = treeBatch.box;
    const rowCount = Math.ceil(treeCount / 2),
      row = t < rowCount ? 0 : 1;
    const x =
        cx * s + (((t % rowCount) + 0.35 + random() * 0.3) / rowCount) * s,
      z =
        row === 0
          ? routeZ(x) - 5.8 - random() * 0.8
          : -BACKGROUND_DEPTH + 2.2 + random() * 1.2,
      p = voxelPalette(x),
      biome = biomeWeights(x).a.id,
      y = terrainHeight(x, z),
      size = 0.85 + random() * 0.6;
    // Buildings and the pond have intentional clearings, rather than trees through roofs.
    if (
      !treeFits(x, z, size, reserved) ||
      villagePond(x, z)
    )
      continue;
    if (biome === "desert") {
      box(0x588259, x, y + 1, z, 0.34, 2, 0.34);
      box(0x6d9764, x + 0.38, y + 1.15, z, 0.7, 0.25, 0.26);
      box(0x6d9764, x + 0.65, y + 1.4, z, 0.24, 0.6, 0.26);
      continue;
    }
    if (biome === "volcan") {
      for (let k = 0; k < 6; k++)
        box(
          k % 2 ? 0x454355 : 0x62536a,
          x + k * 0.22,
          y + 0.25 + k * 0.24,
          z,
          0.45,
          0.5 + k * 0.3,
          0.55,
        );
      box(0xff9b42, x, y + 0.12, z, 1.2, 0.12, 0.22, 0, true);
      continue;
    }
    trees.push({ x, z, size });
    contacts.push({ x, y: y + 0.035, z, rx: 1.05 * size, rz: 0.8 * size, opacity: 0.65 });
    treeTriangles += plantTree(treeBatch.box, canopyBatch.box, biome, t,
      x, y, z, size, p.leaf);
  }
  treeBatch.finish();
  canopyBatch.finish();
  root.userData.treeTriangles = treeTriangles;
  for (let i = 0; i < 2; i++) {
    const x = cx * s + 3 + i * 8,
      z = routeZ(x) + 2.05,
      lamp = lantern(r, 2.4, 14);
    if (riverAt(x, z)) { r.release(lamp); continue; }
    lamp.position.set(x, terrainHeight(x, z), z);
    root.add(lamp);
  }
  if (biome === "volcan") {
    const x = cx * s + 8,
      light = r.pointLight(0xff6528, 18, 11, 2);
    light.position.set(x, routeHeight(x) + 0.8, routeZ(x) - 2.8);
    root.add(light);
  }
  // Water remains inside the depth-bounded tile, rather than an infinite plane.
  if (["lac", "marais", "cascade", "volcan"].includes(biome)) {
    for (let i = 0; i < 32; i++) {
      const x = cx * s + i * 0.5 + 0.25,
        z = routeZ(x) - 3.3,
        y =
          routeHeight(x) -
          (biome === "cascade" ? 0.85 : biome === "volcan" ? 1 : 0.35);
      box(
        biome === "volcan" ? 0xe87428 : 0x4a969e,
        x,
        y,
        z,
        0.51,
        0.08,
        3.3,
        0,
        biome === "volcan",
      );
      if (biome !== "volcan" && i % 4 === 0) {
        box(0x80ae70, x, y + 0.09, z + 0.6, 0.36, 0.035, 0.29);
        box(0x6f9251, x, y + 0.22, z + 1.5, 0.045, 0.4, 0.045);
        box(0xc9ab66, x, y + 0.45, z + 1.5, 0.07, 0.18, 0.07);
      }
      if (i % 3 === 0)
        box(
          biome === "volcan" ? 0xffbf4b : 0x92c3bb,
          x,
          y + 0.05,
          z + Math.sin(i) * 0.7,
          0.27,
          0.025,
          0.06,
          0,
          biome === "volcan",
        );
    }
  }
  groundDetails(root, r, cx, box);
  pondLife(root, r, cx);
  for (const river of riverSites(Math.max(0, Math.floor(cx * CHUNK_SIZE / WORLD_METRES))))
    if (river.x >= cx * CHUNK_SIZE && river.x < (cx + 1) * CHUNK_SIZE) {
      const bridge = riverBridge(r, river), before = root.userData.animate;
      root.add(bridge); root.userData.animate = (time: number) => { before?.(time); bridge.userData.animate?.(time); };
    }
  finish();
  root.userData.dispose = () => {
    for (const geo of geometries) geo.dispose();
    mat.dispose();
    r.release(root);
  };
  root.userData.biome = biome;
  root.userData.palette = palette;
  return root;
}
