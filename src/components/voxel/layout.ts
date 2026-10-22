import { decorForLap, interiorsInRange, interiorAt } from "@/lib/game/decor";
import type { RoomLocation } from "@/lib/game/doors";
import { TEARS_MONUMENT_X } from "@/lib/game/tears";
import { WORLD_METRES, WORLD_SCALE, MILL_Z, routeZ, routeHeight, terrainHeight } from "./world";

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
export function sceneryFootprints(left: number, right: number): Footprint[] {
  const result: Footprint[] = [];
  for (let lap = Math.max(0, Math.floor((left - 24) / WORLD_METRES)); lap <= Math.max(0, Math.floor((right + 12) / WORLD_METRES)); lap++) {
    villageSites(lap).forEach((site, i) => result.push({ ...site, id: `village:${lap}:${i}`, rx: 3.1, rz: 2.8 }));
    result.push({ ...millSite(lap), id: `mill:${lap}`, rx: 3, rz: 2.3 });
    const campX = lap * WORLD_METRES + 4;
    result.push({ id: `camp:${lap}`, x: campX, z: routeZ(campX) - 4, rx: 2.6, rz: 2.2 });
    const tearsX = lap * WORLD_METRES + TEARS_MONUMENT_X / WORLD_SCALE;
    result.push({ id: `tears:${lap}`, x: tearsX, z: routeZ(tearsX) - 6, rx: 2.3, rz: 2.6 });
    for (const site of decorForLap(lap)) if (site.setpiece) result.push({ id: `landmark:${site.id}`, x: site.x / WORLD_SCALE, z: routeZ(site.x / WORLD_SCALE) - 7, rx: 3.4, rz: 2.8 });
  }
  for (const room of interiorsInRange(left * WORLD_SCALE - 500, right * WORLD_SCALE + 500))
    for (const end of [0, 1] as const) result.push({ ...portalSite(room, end), id: `facade:${room.from}:${end}`, rx: 3.1, rz: 2.8 });
  return result.filter(s => s.x + s.rx + 3 >= left && s.x - s.rx - 3 <= right);
}
export function treeFits(x: number, z: number, size: number, sites: Footprint[]) {
  const canopy = size * 1.55 + 0.3;
  return !sites.some(s => {
    if (Math.abs(x - s.x) < s.rx + canopy && Math.abs(z - s.z) < s.rz + canopy) return true;
    const dz = z - s.z;
    return s.id.startsWith("mill:") && dz > 0 && dz < 9 && Math.abs(x - s.x - dz * Math.tan(0.62)) < 2.1 + canopy * 0.6;
  });
}
