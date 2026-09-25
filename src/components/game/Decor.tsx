"use client";

import { memo, useMemo, useRef, useState } from "react";
import type { Container, Graphics, Sprite } from "pixi.js";
import { decorForLap, personaliseDecor, type DecorSite, type GroupDecor } from "@/lib/game/decor";
import { WALKABLE_GROUND_Y, WORLD_LENGTH } from "@/lib/game/world";
import { useSceneTick } from "./useSceneTick";
import { scene } from "./scene";
import { useSignTexture } from "./decor-textures";
import { CHARACTER_ANIMATIONS, characterFrame } from "./animation";
import { atlasFrames, useDirectTexture } from "./textures";
import { DecorNpc } from "./DecorNpc";
import { DecorSetpiece, type DecorLand } from "./DecorSetpiece";

const shadow = (g: Graphics) => { g.clear().ellipse(0, 0, 45, 5).fill({ color: 0x211b18, alpha: 0.2 }); };
const pedestal = (g: Graphics) => { g.clear().poly([-54, 0, -47, -45, 47, -45, 54, 0]).fill(0xaca590).stroke({ color: 0x302b27, width: 3 }).poly([-16, -180, -20, -198, -5, -190, 0, -204, 8, -190, 20, -198, 16, -180]).fill(0xd0ac54).stroke({ color: 0x302b27, width: 2 }); };

function WaitingHero({ id, x, statue = false }: { id: string; x: number; statue?: boolean }) {
  const sheet = CHARACTER_ANIMATIONS[id] ?? CHARACTER_ANIMATIONS.skater!;
  const source = useDirectTexture(sheet.url);
  const frames = source ? atlasFrames(source, sheet.columns, sheet.rows) : null;
  const sprite = useRef<Sprite>(null);
  const time = useRef(x % 17);
  useSceneTick(ticker => {
    if (!sprite.current || !frames) return;
    if (!scene.reducedMotion && !statue) time.current += ticker.elapsedMS / 1000;
    // Everyone, even the fairy, waits with their feet at rest here.
    sprite.current.texture = frames[statue || scene.reducedMotion ? 0 : characterFrame(id === "fee" ? "barde" : id, "idle", time.current)];
  });
  return frames ? <pixiSprite ref={sprite} texture={frames[0]} x={x} y={statue ? -44 : 0} anchor={{ x: 0.5, y: sheet.baseline / sheet.height }} scale={118 / sheet.referenceHeight} tint={statue ? 0xb3ac90 : 0xa6a799} /> : null;
}

function Sign({ site, group }: { site: DecorSite; group: GroupDecor }) {
  const illustrated = site.setpiece;
  const sceneOnly = illustrated && (site.biome === "lac" || site.biome === "taverne");
  const texture = useSignTexture(site.text, site.kind);
  const changed = useSignTexture(site.reaction === "change" ? "Finalement, le poste exige un dragon" : site.text, site.kind);
  const root = useRef<Container>(null);
  const sign = useRef<Sprite>(null);
  const react = useRef(0);
  const active = useRef(false);
  useSceneTick(ticker => {
    const node = root.current;
    if (!node) return;
    node.visible = site.x > scene.camera.x - 400 && site.x < scene.camera.x + scene.camera.viewW + 400;
    if (!node.visible || !sign.current) return;
    const safeTop = (scene.topInset + 12 - scene.camera.screenOffsetY) / scene.camera.scale + scene.camera.y;
    const baseScale = 0.5 * Math.min(1, scene.camera.viewW * 0.8 / 320, Math.max(0.55, (WALKABLE_GROUND_Y + 10 - safeTop) / 272));
    sign.current.scale.y = baseScale;
    sign.current.x = illustrated && site.biome === "desert" ? 230 : illustrated && scene.camera.viewW > 650 ? 105 : 0;
    const passing = performance.now() < scene.walkingUntil && [...scene.heroes.values()].some(hero => Math.abs(hero.x - site.x) < 155 && Math.abs(hero.x - scene.focus) < 360);
    if (passing && !active.current) react.current = 1;
    active.current = passing;
    if (scene.reducedMotion) { react.current = 0; sign.current.rotation = 0; sign.current.scale.x = baseScale; sign.current.texture = texture ?? sign.current.texture; return; }
    react.current = Math.max(0, react.current - ticker.elapsedMS / 2200);
    const amount = Math.sin(react.current * Math.PI);
    sign.current.rotation = site.reaction === "fall" ? amount * 0.38 : 0;
    sign.current.scale.x = baseScale * (site.reaction === "turn" ? 1 - amount * 0.65 : 1);
    if (site.reaction === "change") sign.current.texture = react.current > 0.1 && changed ? changed : texture ?? sign.current.texture;
  });
  return <pixiContainer ref={root} x={site.x} y={WALKABLE_GROUND_Y + 10} label={`decor:${site.id}:${site.kind}`}>
    <pixiGraphics draw={shadow} />
    {illustrated ? <DecorSetpiece land={site.biome as DecorLand} worldX={site.x} x={sceneOnly ? 0 : -160} caption={site.biome === "taverne" && site.kind === "hired" ? `Engagé·es · ${site.text}` : undefined} /> : null}
    {site.kind === "coach" || site.kind === "influencer" ? <DecorNpc sheet="hype" row={site.kind === "coach" ? 0 : 1} x={-175} worldX={site.x - 175} /> : null}
    {illustrated && site.biome === "foret" ? <DecorNpc sheet="recruiters" x={-240} worldX={site.x - 240} height={112} /> : null}
    {illustrated && site.biome === "marais" ? <DecorNpc sheet="afterlife" x={-240} worldX={site.x - 240} height={154} ghost /> : null}
    {illustrated && site.biome === "lac" ? <DecorNpc sheet="recruiters" row={1} x={-220} worldX={site.x - 220} height={152} /> : null}
    {illustrated && site.biome === "desert" ? <DecorNpc sheet="afterlife" row={1} x={-190} worldX={site.x - 190} height={130} /> : null}
    {illustrated && site.biome === "taverne" ? <DecorNpc sheet="hype" row={1} x={-250} worldX={site.x - 250} height={135} /> : null}
    {site.kind === "crowd" ? [-148, -98, 108, 158].map((x, i) => <WaitingHero key={x} id={["barde", "paladin", "sorciere", "skater"][i]} x={x} />) : null}
    {site.kind === "crown" ? <pixiContainer x={210}><pixiGraphics draw={pedestal} /><WaitingHero id={group.crown.characterId ?? "chevalier"} x={0} statue /></pixiContainer> : null}
    {texture && !sceneOnly ? <pixiSprite ref={sign} texture={texture} x={illustrated ? 105 : 0} anchor={{ x: 0.5, y: 272 / 280 }} scale={0.5} /> : null}
  </pixiContainer>;
}

/** React mounts only nearby stops; crossing a 400-unit bucket is the only camera update. */
function DecorLayer({ group }: { group: GroupDecor }) {
  const measure = () => `${Math.max(0, Math.floor((scene.camera.x - 600) / 400))}:${Math.ceil((scene.camera.x + scene.camera.viewW + 600) / 400)}`;
  const [range, setRange] = useState(measure);
  useSceneTick(() => { const next = measure(); if (next !== range) setRange(next); });
  const sites = useMemo(() => {
    const [left, right] = range.split(":").map(n => Number(n) * 400);
    const result: DecorSite[] = [];
    for (let lap = Math.floor(left / WORLD_LENGTH); lap <= Math.floor(right / WORLD_LENGTH); lap++) {
      result.push(...personaliseDecor(decorForLap(lap), group).filter(s => s.x >= left && s.x <= right));
    }
    return result;
  }, [range, group]);
  return <pixiContainer>{sites.map(site => <Sign key={site.id} site={site} group={group} />)}</pixiContainer>;
}

export const Decor = memo(DecorLayer);
