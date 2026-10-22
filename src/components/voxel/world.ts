import { BIOMES, WORLD_LENGTH, mixColor } from "@/lib/game/world";

export const WORLD_SCALE = 50;
export const CHUNK_SIZE = 16;
/** Fixed world-space cuts: the road winds inside a single rectangular tile. */
export const FOREGROUND_DEPTH = 12;
export const BACKGROUND_DEPTH = 15;
export const TERRAIN_BASE_THICKNESS = 1.6;
export const FOG_NEAR = 23;
export const FOG_FAR = 30;
export const WORLD_METRES = WORLD_LENGTH / WORLD_SCALE;
export const MILL_Z = -7.8;
const LENGTH = WORLD_METRES;
const smooth = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
export function biomeWeights(x: number) {
  const p = x < 0 ? 0 : (((x % LENGTH) + LENGTH) % LENGTH) / LENGTH;
  const index = BIOMES.findIndex((b) => p >= b.from && p < b.to),
    i = index < 0 ? 8 : index;
  const biome = BIOMES[i],
    next = BIOMES[(i + 1) % BIOMES.length];
  const width = 12 / LENGTH;
  return { a: biome, b: next, t: smooth((p - (biome.to - width)) / width) };
}
export function routeZ(x: number) {
  return Math.sin(x * 0.055) * 4 + Math.sin(x * 0.15) * 1.2;
}
const ALTITUDES = [0, 1, 0.1, 2, 4, 13, 6, 17, 5];
export function routeHeight(x: number) {
  const { a, b, t } = biomeWeights(x),
    i = BIOMES.indexOf(a),
    j = BIOMES.indexOf(b);
  const base = ALTITUDES[i] + (ALTITUDES[j] - ALTITUDES[i]) * t;
  const undulation = Math.sin(x * 0.075) * 0.6 + Math.sin(x * 0.025) * 0.9;
  return base + undulation;
}
/** Both long edges and the closed underside share this longitudinal altitude. */
export function tileBottom(x: number) {
  return routeHeight(x) + 0.12 - TERRAIN_BASE_THICKNESS;
}
function noise(x: number, z: number) {
  return (
    Math.sin(x * 0.21 + Math.sin(z * 0.17)) * Math.cos(z * 0.25) +
    Math.sin(x * 0.067 - z * 0.13) * 0.7
  );
}
export function villagePond(x: number, z: number) {
  const local = x - Math.floor(Math.max(0, x) / LENGTH) * LENGTH;
  return (
    local > 2.1 &&
    local < 7.9 &&
    Math.abs(
      z - (routeZ(Math.floor(Math.max(0, x) / LENGTH) * LENGTH + 4) - 5.3),
    ) < 1.6
  );
}
export type ForegroundPool = { x: number; z: number; y: number; rx: number; rz: number };
const pools = new Map<number, ForegroundPool | null>();
/** Sparse, level ponds inset in the foreground; never cross the walking lane. */
export function foregroundPool(x: number): ForegroundPool | null {
  const segment = Math.floor(x / 26);
  if (pools.has(segment)) return pools.get(segment)!;
  const center = segment * 26 + 9, biome = biomeWeights(center).a.id;
  const pool = ["plaine", "foret", "marais", "lac", "taverne"].includes(biome)
    ? { x: center, z: Math.max(6.8, routeZ(center) + 4.4), y: routeHeight(center) - 0.1, rx: 2.6, rz: 1.45 }
    : null;
  if (pools.size >= 64) pools.delete(pools.keys().next().value!);
  pools.set(segment, pool);
  return pool;
}
export function poolRadius(pool: ForegroundPool, x: number, z: number) {
  return Math.hypot((x - pool.x) / pool.rx, (z - pool.z) / pool.rz);
}
export function terrainHeight(x: number, z: number) {
  if (villagePond(x, z))
    return routeHeight(Math.floor(Math.max(0, x) / LENGTH) * LENGTH + 4) - 0.25;
  const { a, b, t } = biomeWeights(x),
    distance = Math.abs(z - routeZ(x));
  const amplitude = (id: string) =>
    id === "montagne"
      ? 9
      : id === "volcan"
        ? 8
        : id === "cascade"
          ? 5
          : id === "desert"
            ? 2.4
            : 0.65;
  const amount = amplitude(a.id) * (1 - t) + amplitude(b.id) * t;
  const shoulder = smooth((routeZ(x) - z - 2.8) / 4.5);
  const base = routeHeight(x);
  // Back hills rise above the road rather than disappearing below a floating platform.
  let y = base + (noise(x, z) * 0.45 + 0.85) * amount * shoulder;
  const depth = z - routeZ(x);
  if (
    ["lac", "marais", "cascade", "volcan"].includes(a.id) &&
    t < 0.85 &&
    depth < -1.6 &&
    depth > -5.1
  ) {
    y = Math.min(
      y,
      routeHeight(x) - (a.id === "cascade" ? 2.8 : a.id === "volcan" ? 1.7 : 1),
    );
  }
  if (a.id === "volcan") {
    const local = (x % LENGTH) - (LENGTH * (a.from + a.to)) / 2;
    const radius = Math.hypot(local, z + 13);
    const cone = Math.max(0, 15 - radius * 0.8);
    y += cone * shoulder;
    if (radius < 3 && distance > 3) y -= 6;
  }
  // A broad terraced knoll carries the mill; its core is level under the tower.
  const millX = Math.max(0, Math.floor(x / LENGTH)) * LENGTH + 21;
  if (Math.abs(x - millX) < 5.8 && Math.abs(z - MILL_Z) < 4.2) {
    const radius = Math.hypot((x - millX) / 5.8, (z - MILL_Z) / 4.2);
    const plateau = Math.round((routeHeight(millX) + 1.5) * 4) / 4 + 0.12;
    if (radius < 0.43) return plateau;
    if (radius < 1) y += (plateau - y) * smooth((1 - radius) / 0.57);
  }
  const pool = foregroundPool(x);
  if (pool) {
    const radius = poolRadius(pool, x, z);
    if (radius < 1) return pool.y - 0.22;
    if (radius < 1.35) y += (pool.y - 0.22 - y) * smooth((1.35 - radius) / 0.35);
  }
  return Math.max(
    tileBottom(x) + 0.5,
    base + 0.12 + Math.floor((y - base) * 4) / 4,
  );
}
const COLORS: Record<
  string,
  { ground: number; rock: number; path: number; leaf: number; sky: number }
> = {
  plaine: {
    ground: 0x567b48,
    rock: 0x7c8067,
    path: 0xbda078,
    leaf: 0x426d3c,
    sky: 0x536f71,
  },
  foret: {
    ground: 0x3d6240,
    rock: 0x6d7760,
    path: 0x9b8b63,
    leaf: 0x305e42,
    sky: 0x385651,
  },
  marais: {
    ground: 0x526043,
    rock: 0x6a735c,
    path: 0x8a8061,
    leaf: 0x687b4c,
    sky: 0x485955,
  },
  lac: {
    ground: 0x6a886a,
    rock: 0x7e9391,
    path: 0xb4a685,
    leaf: 0x608876,
    sky: 0x60808a,
  },
  cascade: {
    ground: 0x5e7f73,
    rock: 0x7c9794,
    path: 0xa3b4a5,
    leaf: 0x4c7e73,
    sky: 0x63838e,
  },
  montagne: {
    ground: 0xc3d5d2,
    rock: 0x7f939a,
    path: 0xb9bbb0,
    leaf: 0x526f69,
    sky: 0x748d9c,
  },
  desert: {
    ground: 0xc69d60,
    rock: 0xa88052,
    path: 0xd9b67d,
    leaf: 0x8a9860,
    sky: 0xb6987c,
  },
  volcan: {
    ground: 0x493c44,
    rock: 0x60515b,
    path: 0x8d7165,
    leaf: 0x6d514b,
    sky: 0x513b49,
  },
  taverne: {
    ground: 0x466546,
    rock: 0x797963,
    path: 0xb7a077,
    leaf: 0x3a6547,
    sky: 0x384b5a,
  },
};
export function voxelPalette(x: number) {
  const { a, b, t } = biomeWeights(x);
  const p = COLORS[a.id],
    q = COLORS[b.id];
  return {
    ground: mixColor(p.ground, q.ground, t),
    rock: mixColor(p.rock, q.rock, t),
    path: mixColor(p.path, q.path, t),
    leaf: mixColor(p.leaf, q.leaf, t),
    sky: mixColor(p.sky, q.sky, t),
  };
}
export function routePoint(legacyX: number, lane = 0) {
  const x = legacyX / WORLD_SCALE;
  return { x, y: routeHeight(x) + 0.18, z: routeZ(x) + lane };
}
