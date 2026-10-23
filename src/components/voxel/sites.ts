import { decorForLap, interiorsInRange, interiorAt } from "@/lib/game/decor";
import type { RoomLocation } from "@/lib/game/doors";
import { BIOMES } from "@/lib/game/world";
import { TEARS_MONUMENT_X } from "@/lib/game/tears";
import { WORLD_METRES, WORLD_SCALE, MILL_Z, TEARS_Z, tearsPlateau, riverSites, riverProfile, foregroundPool, routeZ } from "./world";

/** Keep narrative setpieces on a dry bank; planting uses this exact same site.
 * Layout remains independent of terrain heights to avoid recursive pad grading. */
export function narrativeSite(anchor: number) {
  const lap = Math.max(0, Math.floor(anchor / WORLD_METRES));
  const rivers = [lap - 1, lap, lap + 1].filter(l => l >= 0).flatMap(riverSites);
  for (const shift of [0, -6, 6, -9, 9, -12, 12]) {
    const x = anchor + shift, z = routeZ(x) - 7;
    if (rivers.some(r => [-2.8, 0, 2.8].some(dz => {
      const p = riverProfile(r, z + dz);
      return Math.abs(x - p.center) < p.width + 4.4;
    }))) continue;
    return { x, z };
  }
  return { x: anchor, z: routeZ(anchor) - 7 };
}

export const START_MARKET_X = -5.5;
export function startingMarketSite(): Footprint { return { id: "starting-market", x: START_MARKET_X - 1.3, z: routeZ(START_MARKET_X) - 1.1, rx: 3.6, rz: 3.9 }; }
export function millSite(lap: number) { return { x: lap * WORLD_METRES + 21, z: MILL_Z }; }
export function villageSites(lap: number) {
  return [-8, 1, 10].map((offset, i) => { const x = lap * WORLD_METRES + offset; return { x, z: routeZ(x) - 7 - (i === 1 ? 1 : 0), title: ["BUREAU DES POSSIBLES", "AUBERGE DU PREMIER PAS", "LA POSTE DES CANDIDATS"][i], roof: [0x94633f, 0x718653, 0x8a665d][i] }; }).filter(site => !interiorsInRange((site.x - 12) * WORLD_SCALE, (site.x + 12) * WORLD_SCALE).some(room => [0, 1].some(end => {
    const p = portalFootprint(room, end as 0 | 1);
    return Math.abs(p.x - site.x) < p.rx + 3.1 + .7 && Math.abs(p.z - site.z) < p.rz + 2.8 + .7;
  })));
}
export function portalFootprint(room: RoomLocation, end: 0 | 1) {
  const boundary = (end ? room.to : room.from) / WORLD_SCALE;
  const x = boundary + (end ? 2.5 : -2.5), z = routeZ(boundary) - 4.8;
  return { x, z, doorZ: z + 3.1, boundary, rx: 4.8, rz: 3.6 };
}
export const PORTAL_APPROACH = 8;
const eased = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
export function portalApproachXZ(room: RoomLocation, end: 0 | 1, sourceX: number) {
  const p = portalFootprint(room, end), d = end ? sourceX - p.boundary : p.boundary - sourceX, u = eased(1 - d / PORTAL_APPROACH);
  return { x: sourceX + (end ? 2.5 : -2.5) * u, z: routeZ(sourceX) * (1 - u) + p.doorZ * u, u };
}
/** Invert the monotonic approach curve to reserve a grass-free paved strip. */
export function onPortalApproach(x: number, z: number) {
  if (Math.abs(z - routeZ(x)) > 4.5) return false;
  for (const room of interiorsInRange((x - 9) * WORLD_SCALE, (x + 9) * WORLD_SCALE)) for (const end of [0, 1] as const) {
    const p = portalFootprint(room, end), sign = end ? 1 : -1;
    if ((x - p.boundary) * sign < 2.3 || (x - p.boundary) * sign > PORTAL_APPROACH + .3) continue;
    let source = x;
    for (let i = 0; i < 8; i++) source = x - sign * 2.5 * portalApproachXZ(room, end, source).u;
    const center = portalApproachXZ(room, end, source);
    if (Math.abs(z - center.z) < 1.6) return true;
  }
  return false;
}
/** The road ends at the doorstep, rather than bypassing a virtual interior. */
export function outsideRoadVisible(x: number) {
  if (x < START_MARKET_X - .75) return false;
  const legacyX = x * WORLD_SCALE;
  if (interiorAt(legacyX)) return false;
  return !interiorsInRange(legacyX - PORTAL_APPROACH * WORLD_SCALE, legacyX + PORTAL_APPROACH * WORLD_SCALE)
    .some(r => Math.abs(x - r.from / WORLD_SCALE) < PORTAL_APPROACH || Math.abs(x - r.to / WORLD_SCALE) < PORTAL_APPROACH);
}
export function roomRouteZ(room: RoomLocation) { return routeZ((room.from + room.to) / (2 * WORLD_SCALE)); }
export function tearsSite(lap: number) { return { id: `tears:${lap}`, x: lap * WORLD_METRES + TEARS_MONUMENT_X / WORLD_SCALE, z: TEARS_Z, y: tearsPlateau(lap), rx: 5, rz: 4 }; }
export type Footprint = { id: string; x: number; z: number; rx: number; rz: number };
/** The same sites reserve planting space and place the actual models. */
function baseFootprints(left: number, right: number): Footprint[] {
  const result: Footprint[] = [startingMarketSite()];
  for (let lap = Math.max(0, Math.floor((left - 24) / WORLD_METRES)); lap <= Math.max(0, Math.floor((right + 12) / WORLD_METRES)); lap++) {
    villageSites(lap).forEach((site, i) => result.push({ ...site, id: `village:${lap}:${i}`, rx: 3.1, rz: 2.8 }));
    result.push({ ...millSite(lap), id: `mill:${lap}`, rx: 3, rz: 2.3 });
    const campX = lap * WORLD_METRES + 4;
    result.push({ id: `camp:${lap}`, x: campX, z: routeZ(campX) - 4, rx: 2.6, rz: 2.2 });
    result.push(tearsSite(lap));
    riverSites(lap).forEach(r => result.push({ id: r.id, x: r.x, z: -1.5, rx: 4, rz: 13.5 }));
    for (const site of decorForLap(lap)) if (site.setpiece) result.push({ id: `landmark:${site.id}`, ...narrativeSite(site.x / WORLD_SCALE), rx: 3.4, rz: 2.8 });
  }
  for (const room of interiorsInRange(left * WORLD_SCALE - 500, right * WORLD_SCALE + 500))
      for (const end of [0, 1] as const) result.push({ ...portalFootprint(room, end), id: `facade:${room.from}:${end}` });
  return result.filter(s => s.x + s.rx + 3 >= left && s.x - s.rx - 3 <= right);
}
export type LandscapeKind = "paddock" | "cabin" | "hamlet" | "mangrove" | "mushrooms" | "stilt-house" | "harbour" | "fishing-huts" | "ruins" | "alpine-hamlet" | "goat-pen" | "oasis" | "forge" | "obsidian" | "vineyard";
export type LandscapePlot = Footprint & { kind: LandscapeKind; biome: string };
const plots = new Map<number, LandscapePlot[]>();
export function landscapePlots(lap: number): LandscapePlot[] {
  const cached = plots.get(lap); if (cached) return cached;
  const definitions: [LandscapeKind, number, number, number, number][] = [
    ["paddock", .032, 7.8, 4, 2.1], ["cabin", .125, -10.5, 3.2, 2.7], ["hamlet", .215, -10.8, 5.6, 3.6],
    ["mangrove", .27, -10.5, 4.2, 3], ["mushrooms", .33, -10.8, 4, 3], ["stilt-house", .355, -10.5, 3, 2.6],
    ["harbour", .385, -10.5, 4.4, 2.8], ["fishing-huts", .475, -10.8, 4.8, 3.4],
    ["ruins", .51, -10.8, 4.5, 3], ["hamlet", .58, -10.8, 5.6, 3.6],
    ["alpine-hamlet", .64, -10.8, 5.6, 3.6], ["goat-pen", .695, -10.4, 4, 2.4],
    ["oasis", .755, -10.5, 4.8, 3], ["ruins", .785, -10.5, 4.4, 3],
    ["forge", .822, -10.5, 3.5, 3], ["obsidian", .855, -10.5, 3.5, 3],
    ["hamlet", .892, -10.8, 5.6, 3.6], ["vineyard", .916, -10.5, 4.5, 3],
  ];
  const base = baseFootprints(lap * WORLD_METRES - 12, (lap + 1) * WORLD_METRES + 12), result: LandscapePlot[] = [];
  for (const [index, [kind, ratio, z, rx, rz]] of definitions.entries()) {
    const anchor = lap * WORLD_METRES + ratio * WORLD_METRES;
    const biome = BIOMES.find(b => ratio >= b.from && ratio < b.to)!;
    const shifts = [0, -4, 4, -8, 8, -12, 12];
    if (biome.id === "foret") shifts.push(-16, 16, -20, 20, -24, 24, -28, 28, -32, 32, -40, 40, -48, 48, -56, 56);
    for (const shift of shifts) {
      const x = anchor + shift;
      if (x - rx < (lap + biome.from) * WORLD_METRES + 1 || x + rx > (lap + biome.to) * WORLD_METRES - 1) continue;
      const zz = kind === "harbour" ? routeZ(x) - 5.5 : z;
      if ([...base, ...result].some(s => Math.abs(s.x - x) < s.rx + rx + 0.7 && Math.abs(s.z - zz) < s.rz + rz + 0.7)) continue;
      // Paddocks cannot flood the small foreground ponds.
      if (z > 0 && foregroundPool(x) && Math.abs(foregroundPool(x)!.x - x) < rx + 3) continue;
      result.push({ id: `landscape:${lap}:${index}`, kind, x, z: zz, rx, rz, biome: biome.id }); break;
    }
  }
  if (plots.size > 16) plots.delete(plots.keys().next().value!);
  plots.set(lap, result); return result;
}
export function sceneryFootprints(left: number, right: number): Footprint[] {
  const result = baseFootprints(left, right);
  for (let lap = Math.max(0, Math.floor((left - 24) / WORLD_METRES)); lap <= Math.max(0, Math.floor((right + 12) / WORLD_METRES)); lap++)
    for (const p of landscapePlots(lap)) if (p.x + p.rx + 3 >= left && p.x - p.rx - 3 <= right) result.push(p);
  return result;
}
export function foregroundPlots(lap: number) {
  return [.21, .285, .565, .675, .77, .84, .9].map((ratio, i) => {
    const x = (lap + ratio) * WORLD_METRES, biome = BIOMES.find(b => ratio >= b.from && ratio < b.to)!.id;
    return { id: `foreground:${lap}:${i}`, x, z: Math.max(5.5, Math.min(9, routeZ(x) + 4.2)), biome, rx: 3, rz: 2.7 };
  });
}
export function treeFits(x: number, z: number, size: number, sites: Footprint[]) {
  const canopy = size * 1.55 + 0.3;
  return !sites.some(s => {
    if (Math.abs(x - s.x) < s.rx + canopy && Math.abs(z - s.z) < s.rz + canopy) return true;
    const dz = z - s.z;
    return s.id.startsWith("mill:") && dz > 0 && dz < 9 && Math.abs(x - s.x - dz * Math.tan(0.62)) < 2.1 + canopy * 0.6;
  });
}

const pads = new Map<number, Footprint[]>();
/** Ground-bearing houses only. Fishing huts retain their intentional stilts. */
export function buildingPads(lap: number): Footprint[] {
  const cached = pads.get(lap); if (cached) return cached;
  const result: Footprint[] = villageSites(lap).map((s, i) => ({ id: `village-pad:${lap}:${i}`, x: s.x, z: s.z, rx: 2.45, rz: 1.85 }));
  for (const room of interiorsInRange(lap * WORLD_METRES * WORLD_SCALE - 500, (lap + 1) * WORLD_METRES * WORLD_SCALE + 500))
    for (const end of [0, 1] as const) {
      const site = portalFootprint(room, end);
      if (site.x < lap * WORLD_METRES || site.x >= (lap + 1) * WORLD_METRES) continue;
      result.push({ ...site, id: `portal-pad:${room.from}:${end}`, rx: 4.5, rz: 3.2 });
    }
  for (const plot of landscapePlots(lap)) {
    const houses = plot.kind === "hamlet" || plot.kind === "alpine-hamlet" ? [[-3.65, -.35], [3.65, -.35]] : plot.kind === "cabin" ? [[0, 0]] : plot.kind === "forge" ? [[0, -.5]] : [];
    houses.forEach(([dx, dz], i) => result.push({ id: `${plot.id}:pad:${i}`, x: plot.x + dx, z: plot.z + dz, rx: 1.65, rz: 1.45 }));
  }
  if (pads.size > 16) pads.delete(pads.keys().next().value!);
  pads.set(lap, result); return result;
}

const nearbyPads = new Map<number, Footprint[]>();
export function buildingPadsNear(x: number) {
  const cell = Math.floor(x / 8), cached = nearbyPads.get(cell); if (cached) return cached;
  const center = cell * 8 + 4, lap = Math.max(0, Math.floor(x / WORLD_METRES));
  const result = [lap - 1, lap, lap + 1].filter(l => l >= 0).flatMap(buildingPads).filter(p => Math.abs(p.x - center) < p.rx + 9);
  if (nearbyPads.size > 256) nearbyPads.clear(); nearbyPads.set(cell, result); return result;
}
