import { interiorsInRange, interiorAt } from "@/lib/game/decor";
import type { RoomLocation } from "@/lib/game/doors";
import { WORLD_METRES, WORLD_SCALE, routeZ, routeHeight, terrainHeight } from "./world";
import { landscapePlots, portalFootprint, roomRouteZ, PORTAL_APPROACH, portalApproachXZ } from "./sites";
export { villageSites, millSite, tearsSite, landscapePlots, sceneryFootprints, foregroundPlots, treeFits, roomRouteZ, narrativeSite } from "./sites";
export type { Footprint, LandscapeKind, LandscapePlot } from "./sites";

type PortalSite = ReturnType<typeof portalFootprint> & { y: number };
const portalSites = new Map<number, [PortalSite?, PortalSite?]>();
export function portalSite(room: RoomLocation, end: 0 | 1) {
  let cached = portalSites.get(room.from);
  if (cached?.[end]) return cached[end]!;
  const site = portalFootprint(room, end);
  const y = Math.max(terrainHeight(site.x, site.z), ...[-4.35, 0, 4.35].flatMap(dx => [-3, 3].map(dz => terrainHeight(site.x + dx, site.z + dz))));
  if (!cached) {
    if (portalSites.size >= 64) portalSites.delete(portalSites.keys().next().value!);
    cached = []; portalSites.set(room.from, cached);
  }
  return cached[end] = { ...site, y };
}
const smooth = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
/** Render-only path: the saved distance never changes when entering a dedicated room. */
export function journeyPoint(legacyX: number, lane = 0) {
  const x = legacyX / WORLD_SCALE, room = interiorAt(legacyX);
  if (room) return { x, y: routeHeight(x) + 0.18, z: roomRouteZ(room) + lane };
  for (const r of interiorsInRange(legacyX - PORTAL_APPROACH * WORLD_SCALE, legacyX + PORTAL_APPROACH * WORLD_SCALE)) {
    for (const end of [0, 1] as const) {
      const boundary = (end ? r.to : r.from) / WORLD_SCALE, d = end ? x - boundary : boundary - x;
      if (d < 0 || d > PORTAL_APPROACH) continue;
      const door = portalSite(r, end);
      const p = portalApproachXZ(r, end, x), u = p.u;
      return { x: p.x, y: Math.max(terrainHeight(p.x, p.z) + .18, (routeHeight(x) + 0.18) * (1 - u) + (door.y + 0.36) * u), z: p.z + lane * (1 - u) };
    }
  }
  return { x, y: routeHeight(x) + 0.18, z: routeZ(x) + lane };
}
const views = new Map<string, { lift: number; zoom: number }>();
/** Reveal the whole destination before its doorstep, including narrow phones. */
export function entranceViewZoom(x: number, mobile: boolean) {
  let zoom = 1;
  for (const room of interiorsInRange((x - 16) * WORLD_SCALE, (x + 16) * WORLD_SCALE)) for (const boundary of [room.from, room.to]) {
    const weight = smooth((16 - Math.abs(x - boundary / WORLD_SCALE)) / 6);
    zoom = Math.min(zoom, 1 - (mobile ? .28 : .14) * weight);
  }
  return zoom;
}
/** Fit background vignettes by zooming out; the road remains the camera anchor. */
export function landscapeView(x: number) {
  let strength = 0, zoom = 1;
  for (const plot of landscapePlots(Math.max(0, Math.floor(x / WORLD_METRES)))) {
    if (["paddock", "goat-pen", "harbour", "vineyard"].includes(plot.kind)) continue;
    const weight = smooth(1 - Math.abs(plot.x - x) / 19);
    if (weight <= strength) continue;
    let view = views.get(plot.id);
    if (!view) {
      const roof = Math.max(...[-plot.rx, 0, plot.rx].flatMap(dx => [-plot.rz, 0, plot.rz].map(dz => terrainHeight(plot.x + dx, plot.z + dz)))) + 4;
      const rise = Math.max(0, roof - routeHeight(plot.x));
      const top = (rise - .18) * Math.cos(.74) + Math.sin(.74) * Math.hypot(plot.rx, routeZ(plot.x) - plot.z + plot.rz);
      view = { lift: 0, zoom: Math.max(.28, Math.min(.85, 6.8 / Math.max(1, top))) };
      if (views.size > 256) views.clear();
      views.set(plot.id, view);
    }
    strength = weight; zoom = 1 - (1 - view.zoom) * weight;
  }
  return { lift: 0, zoom };
}
