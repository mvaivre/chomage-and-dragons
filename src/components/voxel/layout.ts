import { decorForLap, interiorsInRange, interiorAt } from "@/lib/game/decor";
import type { RoomLocation } from "@/lib/game/doors";
import { BIOMES } from "@/lib/game/world";
import { TEARS_MONUMENT_X } from "@/lib/game/tears";
import { WORLD_METRES, WORLD_SCALE, MILL_Z, TEARS_Z, tearsPlateau, riverSites, foregroundPool, routeZ, routeHeight, terrainHeight } from "./world";

export function millSite(lap: number) { return { x: lap * WORLD_METRES + 21, z: MILL_Z }; }
export function villageSites(lap: number) {
  return [-8, 1, 10].map((offset, i) => { const x = lap * WORLD_METRES + offset; return { x, z: routeZ(x) - 7 - (i === 1 ? 1 : 0), title: ["BUREAU DES POSSIBLES", "AUBERGE DU PREMIER PAS", "LA POSTE DES CANDIDATS"][i], roof: [0x94633f, 0x718653, 0x8a665d][i] }; });
}
export function portalSite(room: RoomLocation, end: 0 | 1) {
  const boundary = (end ? room.to : room.from) / WORLD_SCALE;
  const x = boundary + (end ? 2.5 : -2.5), z = routeZ(boundary) - 4;
  return { x, z, y: terrainHeight(x, z), doorZ: z + 1.75, boundary };
}
export function roomRouteZ(room: RoomLocation) { return routeZ((room.from + room.to) / (2 * WORLD_SCALE)); }
export function tearsSite(lap: number) { return { id: `tears:${lap}`, x: lap * WORLD_METRES + TEARS_MONUMENT_X / WORLD_SCALE, z: TEARS_Z, y: tearsPlateau(lap), rx: 5, rz: 4 }; }
const smooth = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
/** Render-only path: the saved distance never changes when entering a dedicated room. */
export function journeyPoint(legacyX: number, lane = 0) {
  const x = legacyX / WORLD_SCALE, room = interiorAt(legacyX);
  if (room) return { x, y: routeHeight(x) + 0.18, z: roomRouteZ(room) + lane };
  for (const r of interiorsInRange(legacyX - 360, legacyX + 360)) {
    for (const end of [0, 1] as const) {
      const door = portalSite(r, end), d = end ? x - door.boundary : door.boundary - x;
      if (d < 0 || d > 7) continue;
      const u = smooth(1 - d / 7);
      return { x: x + (end ? 2.5 : -2.5) * u, y: (routeHeight(x) + 0.18) * (1 - u) + (door.y + 0.36) * u, z: routeZ(x) * (1 - u) + door.doorZ * u + lane * (1 - u) };
    }
  }
  return { x, y: routeHeight(x) + 0.18, z: routeZ(x) + lane };
}
export type Footprint = { id: string; x: number; z: number; rx: number; rz: number };
/** The same sites reserve planting space and place the actual models. */
function baseFootprints(left: number, right: number): Footprint[] {
  const result: Footprint[] = [];
  for (let lap = Math.max(0, Math.floor((left - 24) / WORLD_METRES)); lap <= Math.max(0, Math.floor((right + 12) / WORLD_METRES)); lap++) {
    villageSites(lap).forEach((site, i) => result.push({ ...site, id: `village:${lap}:${i}`, rx: 3.1, rz: 2.8 }));
    result.push({ ...millSite(lap), id: `mill:${lap}`, rx: 3, rz: 2.3 });
    const campX = lap * WORLD_METRES + 4;
    result.push({ id: `camp:${lap}`, x: campX, z: routeZ(campX) - 4, rx: 2.6, rz: 2.2 });
    result.push(tearsSite(lap));
    riverSites(lap).forEach(r => result.push({ id: r.id, x: r.x, z: -1.5, rx: 4, rz: 13.5 }));
    for (const site of decorForLap(lap)) if (site.setpiece) result.push({ id: `landmark:${site.id}`, x: site.x / WORLD_SCALE, z: routeZ(site.x / WORLD_SCALE) - 7, rx: 3.4, rz: 2.8 });
  }
  for (const room of interiorsInRange(left * WORLD_SCALE - 500, right * WORLD_SCALE + 500))
    for (const end of [0, 1] as const) result.push({ ...portalSite(room, end), id: `facade:${room.from}:${end}`, rx: 3.1, rz: 2.8 });
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
    for (const shift of [0, -4, 4, -8, 8, -12, 12]) {
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
const views = new Map<string, { lift: number; zoom: number }>();
/** Frame tall background vignettes together with the hero, without changing the route. */
export function landscapeView(x: number) {
  let strength = 0, lift = 0, zoom = 1;
  for (const plot of landscapePlots(Math.max(0, Math.floor(x / WORLD_METRES)))) {
    if (["paddock", "goat-pen", "harbour", "vineyard"].includes(plot.kind)) continue;
    const weight = smooth(1 - Math.abs(plot.x - x) / 19);
    if (weight <= strength) continue;
    let view = views.get(plot.id);
    if (!view) {
      const roof = Math.max(...[-plot.rx, 0, plot.rx].flatMap(dx => [-plot.rz, 0, plot.rz].map(dz => terrainHeight(plot.x + dx, plot.z + dz)))) + 4;
      const rise = Math.max(0, roof - routeHeight(plot.x)), lift = Math.min(11, Math.max(1.8, (rise - 2) * .55));
      const top = (rise - 1.1 - lift) * Math.cos(.74) + Math.sin(.74) * Math.hypot(plot.rx, routeZ(plot.x) - plot.z + plot.rz);
      view = { lift, zoom: Math.max(.42, Math.min(.78, 7.9 / Math.max(1, top))) };
      if (views.size > 256) views.clear();
      views.set(plot.id, view);
    }
    strength = weight; lift = view.lift * weight; zoom = 1 - (1 - view.zoom) * weight;
  }
  return { lift, zoom };
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
