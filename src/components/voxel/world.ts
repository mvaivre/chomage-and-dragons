import { BIOMES, WORLD_LENGTH, mixColor } from "@/lib/game/world";
import { buildingPadsNear, outsideRoadVisible } from "./sites";
import { TEARS_MONUMENT_X } from "@/lib/game/tears";

export const WORLD_SCALE = 50;
export const CHUNK_SIZE = 16;
/** Fixed world-space cuts: the road winds inside a single rectangular tile. */
export const FOREGROUND_DEPTH = 12;
export const BACKGROUND_DEPTH = 15;
export const TERRAIN_BASE_THICKNESS = 1.6;
export { FOG_NEAR, FOG_FAR } from "./distance-fog";
export const WORLD_METRES = WORLD_LENGTH / WORLD_SCALE;
export function outdoorPathAt(x: number, z: number) { return Math.abs(z - routeZ(x)) < 1.4 && outsideRoadVisible(x); }
export const MILL_Z = -7.8;
export const TEARS_Z = -8.4;
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
export function tearsPlateau(lap: number) { return Math.round((routeHeight(lap * LENGTH + TEARS_MONUMENT_X / WORLD_SCALE) + 0.8) * 4) / 4 + 0.12; }
export type RiverSite = { id: string; x: number; y: number; biome: string };
const rivers = new Map<number, RiverSite[]>();
export function riverSites(lap: number): RiverSite[] {
  let sites = rivers.get(lap);
  if (!sites) {
    sites = [0.225, 0.31, 0.405, 0.55].map((ratio, i) => { const x = lap * LENGTH + ratio * LENGTH + Math.sin(lap * 13 + i) * 0.8; return { id: `river:${lap}:${i}`, x, y: routeHeight(x) - 0.65, biome: biomeWeights(x).a.id }; });
    if (rivers.size > 16) rivers.delete(rivers.keys().next().value!);
    rivers.set(lap, sites);
  }
  return sites;
}
/** A varying channel footprint shared by terrain, water and the current glints. */
export function riverProfile(site: RiverSite, z: number) {
  const neck = .3 + .7 * smooth(Math.abs(z - routeZ(site.x)) / 6);
  return { center: site.x + (Math.sin(z * .19 + site.x * .03) * 1.8 + Math.sin(z * .47) * .35) * neck, width: 2.05 + Math.sin(z * .28 + site.x * .07) * .38 + Math.cos(z * .51) * .12 };
}
export function riverAt(x: number, z: number) {
  if (x < 0) return null;
  for (const site of riverSites(Math.floor(x / LENGTH))) {
    if (Math.abs(x - site.x) > 6) continue;
    const profile = riverProfile(site, z);
    if (Math.abs(x - profile.center) < profile.width) return site;
  }
  return null;
}
/** Both long edges and the closed underside share this longitudinal altitude. */
export function tileBottom(x: number) {
  let bottom = routeHeight(x) + .12 - TERRAIN_BASE_THICKNESS;
  for (const site of riverSites(Math.max(0, Math.floor(x / LENGTH)))) if (Math.abs(x - site.x) < 5) bottom = Math.min(bottom, site.y - .9);
  return bottom;
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
  const pool = ["plaine", "foret", "marais", "lac", "taverne"].includes(biome) && !riverSites(Math.max(0, Math.floor(center / LENGTH))).some(r => Math.abs(r.x - center) < 7)
    ? { x: center, z: Math.max(6.8, routeZ(center) + 4.4), y: routeHeight(center) - 0.1, rx: 2.6, rz: 1.45 }
    : null;
  if (pools.size >= 64) pools.delete(pools.keys().next().value!);
  pools.set(segment, pool);
  return pool;
}
export function poolRadius(pool: ForegroundPool, x: number, z: number) {
  return Math.hypot((x - pool.x) / pool.rx, (z - pool.z) / pool.rz);
}
const lavaPools = new Map<number, ForegroundPool[]>();
/** Small irregular lava basins, separated from the walking lane and dragon nest. */
export function volcanoPools(lap: number): ForegroundPool[] {
  const cached = lavaPools.get(lap); if (cached) return cached;
  const sites = [[.814, 7.4, 2.8, 1.7], [.839, 9.1, 3.3, 2], [.809, -5.8, 2.7, 1.5]].map(([ratio, z, rx, rz]) => {
    const x = (lap + ratio) * LENGTH;
    return { x, z, rx, rz, y: Math.floor((routeHeight(x) - .35) * 4) / 4 + .12 };
  });
  if (lavaPools.size > 16) lavaPools.clear();
  lavaPools.set(lap, sites); return sites;
}
export function lavaRadius(pool: ForegroundPool, x: number, z: number) {
  const dx = (x - pool.x) / pool.rx, dz = (z - pool.z) / pool.rz, angle = Math.atan2(dz, dx);
  return Math.hypot(dx, dz) / (1 + .12 * Math.sin(angle * 3) + .07 * Math.cos(angle * 5));
}
export function lavaAt(x: number, z: number) {
  if (biomeWeights(x).a.id !== "volcan") return null;
  return volcanoPools(Math.max(0, Math.floor(x / LENGTH))).find(p => lavaRadius(p, x, z) < 1) ?? null;
}
function volcanicHeight(x: number, z: number) {
  const lap = Math.max(0, Math.floor(x / LENGTH)), base = routeHeight(x), depth = routeZ(x) - z;
  const center = (lap + .835) * LENGTH;
  // One broad terraced ridge, rather than adding a cone on top of a sheer bank.
  const ridge = smooth((depth - 2.8) / 15) * (5 + noise(x, z) * .7);
  const summit = 3.5 * smooth(1 - Math.hypot((x - center) / 15, (z + 15) / 12)) * smooth((depth - 4) / 8);
  const front = smooth((-depth - 2.5) / 3) * (.55 + .35 * Math.sin(x * .32 + z * .4) + .25 * Math.cos(z * .7 - x * .15));
  let y = base + ridge + summit + front;
  // The forge sits on a broad graded terrace, not on a foundation tower.
  const forgeX = (lap + .822) * LENGTH, terrace = Math.max(Math.abs(x - forgeX) / 2, Math.abs(z + 11) / 1.8);
  if (terrace < 2.3) y += (routeHeight(forgeX) + 2 - y) * (1 - smooth((terrace - 1) / 1.3));
  // An open shelf keeps the resident dragon readable and away from the hillside.
  const nestZ = routeZ(center) - 4, nest = Math.max(Math.abs(x - center) / 3.5, Math.abs(z - nestZ) / 1.7);
  if (nest < 1.8) y += (base - y) * (1 - smooth((nest - 1) / .8));
  for (const pool of volcanoPools(lap)) {
    const radius = lavaRadius(pool, x, z);
    if (radius < 1) return pool.y - .28;
    if (radius < 2.4) y += (pool.y - .28 - y) * smooth((2.4 - radius) / 1.4);
  }
  // Quantize in world space: a terrace has one altitude along its full width.
  // Quantizing relative to the undulating road created thousands of dark slivers.
  return Math.max(tileBottom(x) + .5, Math.floor(y * 4) / 4 + .12);
}
function naturalTerrainHeight(x: number, z: number) {
  if (villagePond(x, z))
    return routeHeight(Math.floor(Math.max(0, x) / LENGTH) * LENGTH + 4) - 0.25;
  const { a, b, t } = biomeWeights(x);
  if (a.id === "volcan") {
    const volcanic = volcanicHeight(x, z);
    if (t === 0) return volcanic;
    const next = routeHeight(x) + .12 + Math.floor((noise(x, z) * .45 + .85) * .65 * smooth((routeZ(x) - z - 2.8) / 4.5) * 4) / 4;
    return volcanic + (next - volcanic) * t;
  }
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
  const shoulder = smooth((routeZ(x) - z - 2.8) / (4.5 + Math.max(0, amount - 1) * .7));
  const base = routeHeight(x);
  // Back hills rise above the road rather than disappearing below a floating platform.
  const broken = (Math.sin(x * .81 + Math.sin(z * .47)) * Math.cos(z * .63) + Math.sin(x * .39 - z * .81)) * .5;
  let y = base + (noise(x, z) * .45 + .85) * amount * shoulder + broken * Math.min(1.8, Math.max(0, amount - 2) * .3) * shoulder;
  const depth = z - routeZ(x);
  if (
    ["lac", "marais", "cascade"].includes(a.id) &&
    t < 0.85 &&
    depth < -1.6 &&
    depth > -5.1
  ) {
    y = Math.min(
      y,
      routeHeight(x) - (a.id === "cascade" ? 2.8 : 1),
    );
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
  const lap = Math.max(0, Math.floor(x / LENGTH)), tearsX = lap * LENGTH + TEARS_MONUMENT_X / WORLD_SCALE;
  if (Math.abs(x - tearsX) < 7 && Math.abs(z - TEARS_Z) < 5.5) {
    const radius = Math.max(Math.abs(x - tearsX) / 5.2, Math.abs(z - TEARS_Z) / 4.15), plateau = tearsPlateau(lap);
    if (radius < 1) return plateau;
    if (radius < 1.3) y += (plateau - y) * smooth((1.3 - radius) / 0.3);
  }
  const step = amount > 3 ? .5 : .25;
  const terraced = depth < -2.8 ? Math.floor(y / step) * step + .12 : base + .12 + Math.floor((y - base) * 4) / 4;
  const standard = Math.max(tileBottom(x) + .5, terraced);
  return b.id === "volcan" && t > 0 ? standard + (volcanicHeight(x, z) - standard) * t : standard;
}
function unpaddedHeight(x: number, z: number) {
  const natural = naturalTerrainHeight(x, z);
  for (const site of riverSites(Math.max(0, Math.floor(x / LENGTH)))) {
    if (Math.abs(x - site.x) > 12) continue;
    const { center, width } = riverProfile(site, z), distance = Math.abs(x - center);
    if (distance < width) return Math.max(tileBottom(x) + .2, site.y - .35);
    const bank = Math.max(2.2, Math.min(5.5, (natural - site.y) * .7 + 2));
    if (distance < width + bank) return Math.max(tileBottom(x) + .2, site.y + .025 + (natural - site.y - .025) * smooth((distance - width) / bank));
  }
  return natural;
}
const padLevels = new Map<string, number>();
export function terrainHeight(x: number, z: number) {
  let y = unpaddedHeight(x, z);
  // Preserve the complete playable lane, including bridge and door approaches.
  const clearance = smooth((Math.abs(z - routeZ(x)) - 1.6) / 1.3);
  if (clearance === 0) return y;
  let nearest: ReturnType<typeof buildingPadsNear>[number] | undefined, distance = 4.5;
  for (const pad of buildingPadsNear(x)) {
    const d = Math.hypot(Math.max(0, Math.abs(x - pad.x) - pad.rx), Math.max(0, Math.abs(z - pad.z) - pad.rz));
    if (d < distance && d < (pad.id.startsWith("portal-pad:") ? 2 : 4.5)) { nearest = pad; distance = d; }
  }
  if (nearest) {
    const pad = nearest;
    let level = padLevels.get(pad.id);
    if (level === undefined) {
      level = Math.round(Math.max(unpaddedHeight(pad.x, pad.z), routeHeight(pad.x - pad.rx) - .8, routeHeight(pad.x + pad.rx) - .8) * 4) / 4;
      if (padLevels.size > 256) padLevels.clear(); padLevels.set(pad.id, level);
    }
    y += (level - y) * (1 - smooth(distance / (pad.id.startsWith("portal-pad:") ? 2 : 4.5))) * clearance;
  }
  return Math.max(tileBottom(x) + .2, y);
}
/** The visual shoulder starts at the exact edge-column height, then eases to the
 * landscape base. It never changes the saved road or the playable terrain. */
export function continuationHeight(x: number, z: number) {
  const edge = z < 0 ? -BACKGROUND_DEPTH : FOREGROUND_DEPTH;
  const boundary = (terrainHeight(x, edge - .25) + terrainHeight(x, edge + .25)) / 2, base = routeHeight(x) + .12;
  const d = Math.abs(z - edge);
  const ash = z > FOREGROUND_DEPTH && biomeWeights(x).a.id === "volcan" ? .55 * Math.sin(x * .27 + z * .35) * smooth(d / 4) * (1 - smooth(d / 18)) : 0;
  return boundary + (base - boundary) * smooth(d / 16) + ash;
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

/** Exact triangle sample of the shoulder, including river banks, for grounded props. */
export function continuationSurface(x: number, z: number) {
  const gx = Math.floor(x * 2) / 2, side = z < 0 ? -1 : 1, edge = side < 0 ? -BACKGROUND_DEPTH : FOREGROUND_DEPTH;
  const row = Math.floor(Math.abs(z - edge) / 2), z0 = edge + side * row * 2, z1 = z0 + side * 2, a = Math.min(z0, z1), b = Math.max(z0, z1);
  const height = (xx: number, zz: number) => riverAt(xx, zz)?.y ?? continuationHeight(xx, zz);
  const node = (xx: number, zz: number) => (height(xx - .25, zz) + height(xx + .25, zz)) / 2;
  const u = (x - gx) * 2, v = (z - a) / 2, lo = node(gx, a), hi = node(gx + .5, b);
  return v >= u ? (1 - v) * lo + (v - u) * node(gx, b) + u * hi : (1 - u) * lo + v * hi + (u - v) * node(gx + .5, a);
}

// Reuse exact half-metre corner heights for moving feet and contact shadows.
// Twelve spatial buckets bound memory to ~168 KiB, independently of journey length.
const surfaceNodes = new Map<number, Float64Array>();
const SURFACE_ROWS = (BACKGROUND_DEPTH + FOREGROUND_DEPTH) * 2 + 2;
function surfaceNode(x: number, z: number) {
  const chunk = Math.floor(x / CHUNK_SIZE);
  let nodes = surfaceNodes.get(chunk);
  if (!nodes) {
    if (surfaceNodes.size >= 12) surfaceNodes.delete(surfaceNodes.keys().next().value!);
    nodes = new Float64Array(CHUNK_SIZE * 2 * SURFACE_ROWS).fill(NaN); surfaceNodes.set(chunk, nodes);
  }
  const index = Math.round((x - chunk * CHUNK_SIZE) * 2) * SURFACE_ROWS + Math.round((z + BACKGROUND_DEPTH) * 2);
  let value = nodes[index];
  if (Number.isNaN(value)) {
    const height = (xx: number, zz: number) => outdoorPathAt(xx, zz) && !riverAt(xx, zz) ? routeHeight(xx) + .17 : terrainHeight(xx, zz);
    value = (height(x - .25, z - .25) + height(x + .25, z - .25) + height(x - .25, z + .25) + height(x + .25, z + .25)) / 4;
    nodes[index] = value;
  }
  return value;
}
/** Rendered half-metre height-field surface. Four shared corner samples remove
 * contour-like risers while props still touch the actual terrain triangles. */
export function terrainSurface(x: number, z: number) {
  if (z < -BACKGROUND_DEPTH || z > FOREGROUND_DEPTH) return continuationSurface(x, z);
  const gx = Math.floor(x * 2) / 2, gz = Math.floor(z * 2) / 2;
  const node = surfaceNode;
  const u = (x - gx) * 2, v = (z - gz) * 2, a = node(gx, gz), c = node(gx + .5, gz + .5);
  return v >= u ? (1 - v) * a + (v - u) * node(gx, gz + .5) + u * c : (1 - u) * a + v * c + (u - v) * node(gx + .5, gz);
}
