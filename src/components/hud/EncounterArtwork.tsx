import { encounterBoxes, type EncounterModel } from "@/lib/game/encounter-models";

const project = (x: number, y: number, z: number) => [ .87 * (x - z), .35 * (x + z) - y ];
const shade = (hex: string, k: number) => "#" + [1,3,5].map(i => Math.min(255, Math.round(parseInt(hex.slice(i,i+2),16) * k)).toString(16).padStart(2,"0")).join("");
export function EncounterArtwork({ model, rare = false, className = "" }: { model: EncounterModel; rare?: boolean; className?: string }) {
  const faces: { p: number[][]; fill: string }[] = [];
  const detailLayer = (depth: number) => depth <= .12 ? 3 : depth <= .25 ? 2 : 0;
  for (const b of encounterBoxes(model, rare).sort((a,b) => detailLayer(a.d) - detailLayer(b.d) || a.x + a.z + a.y * .5 - b.x - b.z - b.y * .5)) {
    const x = b.x-b.w/2, X = b.x+b.w/2, y = b.y-b.h/2, Y = b.y+b.h/2, z = b.z-b.d/2, Z = b.z+b.d/2;
    for (const [points, factor] of [ [[[x,Y,Z],[X,Y,Z],[X,y,Z],[x,y,Z]],.9], [[[X,Y,Z],[X,Y,z],[X,y,z],[X,y,Z]],.7], [[[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]],1.12] ] as [number[][],number][]) faces.push({ p: points.map(p => project(p[0],p[1],p[2])), fill: shade(b.color,factor) });
  }
  const points = faces.flatMap(f => f.p), xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), scale = Math.min(112/(maxX-minX),112/(maxY-minY));
  return <svg viewBox="0 0 128 128" className={`encounter-artwork ${className}`} aria-hidden="true" focusable="false" data-encounter-model={model}>
    {faces.map((f,i) => <polygon key={i} fill={f.fill} stroke={f.fill} strokeWidth=".25" strokeLinejoin="round" points={f.p.map(([x,y]) => `${((x-(maxX+minX)/2)*scale+64).toFixed(2)},${((y-(maxY+minY)/2)*scale+64).toFixed(2)}`).join(" ")} />)}
  </svg>;
}
