"use client";

import { memo, useRef } from "react";
import { Sprite, type Container, type Graphics } from "pixi.js";
import { useSceneTick as useTick } from "./useSceneTick";
import { fxQueue, fxTexture, PRESETS, type BoltRequest, type BurstRequest, type Preset } from "./fx";
import { markMotion, scene, worldDelta } from "./scene";
import { interiorAt } from "@/lib/game/decor";

interface Particle {
  sprite: Sprite;
  preset: Preset;
  vx: number;
  vy: number;
  age: number;
  life: number;
  spin: number;
  phase: number;
  power: number;
  delay: number;
  ambient: boolean;
}

interface Bolt extends BoltRequest {
  age: number;
  points: Array<[number, number]>;
  branch: Array<[number, number]>;
}

const MAX_PARTICLES = 520;
const MAX_AMBIENT = 60;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

function jagged(x0: number, y0: number, x1: number, y1: number, segments: number, wander: number): Array<[number, number]> {
  const points: Array<[number, number]> = [[x0, y0]];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    points.push([x0 + (x1 - x0) * t + rand(-wander, wander), y0 + (y1 - y0) * t]);
  }
  points.push([x1, y1]);
  return points;
}

/**
 * Pooled particles and lightning, in world space above the heroes. Nothing is
 * allocated per frame once the pool is warm; the layer is idle and costs
 * nothing when no effect is running.
 */
function FxLayerImpl() {
  const root = useRef<Container>(null);
  const bolts = useRef<Graphics>(null);
  const particles = useRef<Particle[]>([]);
  const pool = useRef<Sprite[]>([]);
  const pending = useRef<Array<BurstRequest & { wait: number }>>([]);
  const liveBolts = useRef<Bolt[]>([]);
  const ambient = useRef(0);

  const spawn = (request: BurstRequest) => {
    const container = root.current;
    if (!container) return;
    const preset: Preset = PRESETS[request.preset];
    const power = request.power ?? 1;
    const count = scene.reducedMotion ? Math.ceil(request.count / 4) : request.count;
    if (request.ambient && ambient.current + count > MAX_AMBIENT) return;
    for (let i = 0; i < count && particles.current.length < MAX_PARTICLES; i++) {
      if (request.ambient) ambient.current += 1;
      const sprite = pool.current.pop() ?? new Sprite();
      sprite.texture = fxTexture(preset.texture);
      sprite.anchor.set(0.5);
      sprite.blendMode = preset.additive ? "add" : "normal";
      const colors = request.colors ?? preset.colors;
      sprite.tint = colors[Math.floor(Math.random() * colors.length)];
      sprite.visible = true;
      sprite.alpha = 0;
      sprite.x = request.x + rand(-1, 1) * (request.spreadX ?? 0);
      sprite.y = request.y + rand(-1, 1) * (request.spreadY ?? 0);
      if (!sprite.parent) container.addChild(sprite);
      const angle = (request.angle ?? preset.angle) + rand(-preset.spread, preset.spread);
      sprite.rotation = preset.align ? angle : rand(0, Math.PI * 2);
      const speed = rand(preset.speed[0], preset.speed[1]) * power;
      particles.current.push({
        sprite, preset, power,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: rand(preset.life[0], preset.life[1]),
        spin: rand(-preset.spin, preset.spin),
        phase: rand(0, Math.PI * 2),
        delay: 0,
        ambient: Boolean(request.ambient),
      });
    }
  };

  useTick((ticker) => {
    const dt = Math.min(0.05, worldDelta(ticker.elapsedMS));
    // Requests, including delayed ones.
    for (const request of fxQueue.bursts.splice(0)) pending.current.push({ ...request, wait: request.delay ?? 0 });
    for (const request of fxQueue.bolts.splice(0)) {
      liveBolts.current.push({ ...request, age: -(request.delay ?? 0), points: [], branch: [] });
    }
    if (pending.current.length) {
      const still: typeof pending.current = [];
      for (const request of pending.current) {
        request.wait -= dt;
        if (request.wait <= 0) spawn(request); else still.push(request);
      }
      pending.current = still;
    }

    const live = particles.current;
    // Ambient life breathes at the calm frame rate; only effects demand full speed.
    if (live.length - ambient.current > 0 || liveBolts.current.length || pending.current.some((request) => !request.ambient)) markMotion();
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        if (p.ambient) ambient.current -= 1;
        p.sprite.visible = false;
        pool.current.push(p.sprite);
        live[i] = live[live.length - 1];
        live.pop();
        continue;
      }
      const keep = Math.pow(p.preset.drag, dt);
      p.vx *= keep;
      p.vy = p.vy * keep + p.preset.gravity * dt;
      p.sprite.x += p.vx * dt + (p.preset.flutter ? Math.sin(p.age * 6 + p.phase) * p.preset.flutter * dt : 0);
      p.sprite.y += p.vy * dt;
      if (p.ambient) p.sprite.visible = !scene.reducedMotion && !interiorAt(p.sprite.x);
      p.sprite.rotation += p.spin * dt;
      const size = (p.preset.size[0] + (p.preset.size[1] - p.preset.size[0]) * t) * p.power;
      const aspect = p.preset.aspect ?? 1;
      const texture = p.sprite.texture;
      p.sprite.scale.set((size * aspect) / texture.width, size / texture.height);
      // Confetti twirl: flip the width with the rotation phase.
      if (p.preset.flutter && p.preset.texture === "square") p.sprite.scale.x *= Math.cos(p.age * 9 + p.phase);
      const fadeIn = Math.min(1, p.age / 0.06);
      p.sprite.alpha = fadeIn * (p.preset.alpha[0] + (p.preset.alpha[1] - p.preset.alpha[0]) * t) * (t > 0.85 ? (1 - t) / 0.15 : 1)
        * (p.preset.blink ? 0.35 + 0.65 * Math.abs(Math.sin(p.age * 2.2 + p.phase)) : 1);
    }

    const g = bolts.current;
    if (g) {
      g.clear();
      liveBolts.current = liveBolts.current.filter((bolt) => {
        bolt.age += dt;
        if (bolt.age < 0) return true;
        // Three strikes, a fresh path each time, like a real flicker.
        const flicker = bolt.age < 0.09 || (bolt.age > 0.14 && bolt.age < 0.21) || (bolt.age > 0.27 && bolt.age < 0.33);
        if (flicker) {
          if (!bolt.points.length || Math.random() < 0.5) {
            bolt.points = jagged(bolt.x + rand(-60, 60), bolt.top, bolt.x, bolt.y, 11, 38);
            const from = bolt.points[Math.floor(bolt.points.length * 0.45)];
            bolt.branch = jagged(from[0], from[1], from[0] + rand(-140, 140), from[1] + rand(80, 160), 5, 18);
          }
          for (const [path, width] of [[bolt.points, 1], [bolt.branch, 0.55]] as const) {
            g.moveTo(path[0][0], path[0][1]);
            for (const [px, py] of path.slice(1)) g.lineTo(px, py);
            g.stroke({ width: 30 * width, color: bolt.color ?? 0x9fd4ff, alpha: 0.22 });
            g.moveTo(path[0][0], path[0][1]);
            for (const [px, py] of path.slice(1)) g.lineTo(px, py);
            g.stroke({ width: 8 * width, color: 0xffffff, alpha: 1 });
          }
        }
        return bolt.age < 0.4;
      });
    }
  });

  return <pixiContainer eventMode="none">
    <pixiGraphics ref={bolts} draw={() => {}} />
    <pixiContainer ref={root} />
  </pixiContainer>;
}

export const FxLayer = memo(FxLayerImpl);
