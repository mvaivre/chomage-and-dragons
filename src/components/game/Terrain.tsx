"use client";

import { useMemo } from "react";
import { Rectangle, Texture, type Graphics } from "pixi.js";
import { biomeAt, biomeMix, mixColor, surfaceAt, VIEW } from "@/lib/game/world";
import { useDirectTexture } from "./textures";

const TINTS: Record<string, number> = { plaine: 0xffffff, foret: 0xa3b68b, marais: 0x789a75, lac: 0xc6b48e, cascade: 0x97c2c9, montagne: 0xbac5d4, desert: 0xffdf9c, taverne: 0xffd09b };
// Forest passed desktop, mobile and wide compositions before these materials were enabled.
const ENABLED = new Set(Object.keys(TINTS));
const tintFor = (id: string) => ENABLED.has(id) ? TINTS[id] : 0xffffff;

/** Shared crops preserve the original road seam; colour changes in small, blended steps. */
export function TerrainRoad({ indices, groundY }: { indices: number[]; groundY: number }) {
  const source = useDirectTexture("/art/world-v3/runtime/road-universal.webp");
  const segments = useMemo(() => source ? Array.from({ length: 16 }, (_, index) => new Texture({ source: source.source, frame: new Rectangle(index * source.width / 16, 0, source.width / 16, source.height) })) : [], [source]);
  if (!source) return null;
  const width = source.width / 16;
  return <pixiContainer>{indices.flatMap(index => {
    const start = -VIEW.width + index * source.width, mirrored = Math.abs(index % 2) === 1;
    return segments.map((texture, segment) => {
      const x = start + segment * width, { a, b, t } = biomeMix(x + width / 2);
      return <pixiSprite key={`${index}:${segment}`} texture={mirrored ? segments[15 - segment] : texture} x={x + (mirrored ? width : 0)} y={groundY} scale={{ x: mirrored ? -1 : 1, y: 1 }} tint={mixColor(tintFor(a.id), tintFor(b.id), t)} />;
    });
  })}</pixiContainer>;
}

const drawers = new Map<number, (g: Graphics) => void>();
function terrainDrawer(start: number) {
  if (drawers.has(start)) return drawers.get(start)!;
  const draw = (g: Graphics) => {
    g.clear();
    for (let x = 0; x < 512; x += 95) {
      const at = start + x, id = biomeAt(at).id;
      if (!ENABLED.has(id)) continue;
      const y = surfaceAt(at) + 9 + ((Math.abs(Math.floor(at)) * 13) % 60);
      if (id === "foret") {
        g.moveTo(x - 14, y + 6).bezierCurveTo(x + 4, y - 12, x + 17, y + 14, x + 40, y - 1).stroke({ color: 0x362e20, width: 4, alpha: 0.55 });
        g.moveTo(x - 14, y + 5).bezierCurveTo(x + 4, y - 13, x + 17, y + 13, x + 40, y - 2).stroke({ color: 0x756446, width: 1, alpha: 0.5 });
        g.ellipse(x + 8, y - 2, 7, 3).fill({ color: x % 3 ? 0x99a050 : 0x9e6a3a, alpha: 0.75 });
      } else if (id === "lac" || id === "taverne") {
        const floor = surfaceAt(at) - 4;
        g.rect(x, floor, 95, 72).fill({ color: id === "lac" ? 0x897447 : 0x725439, alpha: 0.86 });
        g.moveTo(x, floor).lineTo(x, floor + 72).stroke({ color: 0x30271c, width: 2, alpha: 0.7 });
        g.moveTo(x + 9, floor + 15).lineTo(x + 82, floor + 12).stroke({ color: 0xc1a577, width: 1, alpha: 0.4 });
        for (const ny of [floor + 7, floor + 62]) g.circle(x + 7, ny, 2).fill(0x3b3024);
      } else if (id === "marais" || id === "cascade") {
        g.ellipse(x + 12, y + 5, 18, 4).fill({ color: id === "marais" ? 0x4b654b : 0x82b7c0, alpha: 0.45 }).stroke({ color: 0xc6e4df, width: 1, alpha: 0.4 });
      } else if (id === "montagne") {
        g.poly([x, y, x + 7, y - 8, x + 22, y - 7, x + 27, y + 2]).fill({ color: 0xdbdfdf, alpha: 0.85 }).stroke({ color: 0x677981, width: 1 });
      } else if (id === "desert") {
        g.moveTo(x - 10, y).quadraticCurveTo(x + 10, y - 4, x + 33, y).stroke({ color: 0xd7b783, width: 2, alpha: 0.6 });
      }
    }
  };
  // The itinerary repeats: a bounded cache prevents indefinite exploration retaining drawers.
  if (drawers.size > 256) drawers.clear();
  drawers.set(start, draw);
  return draw;
}

export function TerrainDetails({ tiles }: { tiles: number[] }) {
  return <pixiContainer>{tiles.map(index => <pixiGraphics key={index} x={-VIEW.width + index * 512} draw={terrainDrawer(-VIEW.width + index * 512)} />)}</pixiContainer>;
}
