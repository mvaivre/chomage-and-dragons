import type { VoxelPainter } from "@/components/voxel/arena";
import { COURSE, type PigeonSim } from "@/lib/game/pigeon-flight";

/**
 * Canvas drawing for the courier's obstacle course. The simulation owns the
 * rules; this module only turns its state, plus a few cosmetic timers, into
 * pixels. Every coordinate is in arena units (COURSE.height tall).
 */

export interface Particle {
  kind: "feather" | "spark" | "dust" | "trail";
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  spin: number;
  size: number;
}

export interface SceneFx {
  particles: Particle[];
  shakeUntil: number;
  flashUntil: number;
  /** Wall-clock instant of the crash or delivery, for the landing animation. */
  finishedAt: number;
  finalY: number;
}

export interface SceneView {
  /** Arena size in arena units; height always equals COURSE.height. */
  width: number;
  height: number;
  /** Where the pigeon sits on screen: further left on narrow arenas, for more warning. */
  pigeonX: number;
  now: number;
  reducedMotion: boolean;
}

export function pigeonScreenX(viewWidth: number): number {
  return Math.min(COURSE.pigeonX, Math.round(viewWidth * 0.26));
}

export const GROUND_Y = COURSE.height - COURSE.ground;

export function createFx(): SceneFx {
  return {
    particles: [],
    shakeUntil: 0,
    flashUntil: 0,
    finishedAt: 0,
    finalY: 0,
  };
}

export function spawnParticles(
  fx: SceneFx,
  kind: Particle["kind"],
  x: number,
  y: number,
  count: number,
) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const power =
      kind === "spark"
        ? 60 + Math.random() * 90
        : kind === "dust"
          ? 20 + Math.random() * 40
          : kind === "trail"
            ? 12
            : 30 + Math.random() * 50;
    fx.particles.push({
      kind,
      x,
      y,
      // Wing wash streams away behind the courier, which flies with its back forward.
      vx:
        Math.cos(angle) * power -
        (kind === "trail" ? 90 + Math.random() * 40 : 0),
      vy: Math.sin(angle) * power - (kind === "feather" ? 30 : 0),
      age: 0,
      life:
        kind === "spark"
          ? 500
          : kind === "dust"
            ? 600
            : kind === "trail"
              ? 350
              : 1400,
      spin: (Math.random() - 0.5) * 8,
      size:
        kind === "dust"
          ? 4 + Math.random() * 5
          : kind === "spark"
            ? 3 + Math.random() * 2
            : 5 + Math.random() * 3,
    });
  }
}

export function updateParticles(fx: SceneFx, dtMs: number, scroll: number) {
  const dt = dtMs / 1000;
  fx.particles = fx.particles.filter((p) => (p.age += dtMs) < p.life);
  for (const p of fx.particles) {
    p.x +=
      (p.vx - (p.kind === "feather" || p.kind === "dust" ? scroll : 0)) * dt;
    if (p.kind === "feather") {
      p.vy = Math.min(45, p.vy + 90 * dt);
      p.x += Math.sin(p.age / 120) * 25 * dt;
    } else if (p.kind === "spark") p.vy += 160 * dt;
    else if (p.kind === "dust") {
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    p.y += p.vy * dt;
  }
}

export function drawPigeonScene(
  ctx: VoxelPainter,
  sim: PigeonSim,
  fx: SceneFx,
  view: SceneView,
) {
  ctx.begin();
  ctx.background(view.width, view.height);
  ctx.block(
    0x78915a,
    view.width / 2,
    GROUND_Y + 15,
    view.width + 25,
    30,
    18,
    -5,
  );
  for (let i = 0; i < 9; i++) {
    const x =
      ((((i * 65 - sim.distance * 0.12) % (view.width + 100)) +
        view.width +
        100) %
        (view.width + 100)) -
      50;
    ctx.block(
      0x526c55,
      x,
      GROUND_Y - 20 - (i % 3) * 10,
      40,
      40 + (i % 3) * 20,
      20,
      -12,
    );
  }
  for (const tower of sim.towers) {
    const x = view.pigeonX + tower.x - sim.distance;
    if (x < -COURSE.towerWidth || x > view.width + COURSE.towerWidth) continue;
    const top = tower.gapY - tower.gapHeight / 2,
      bottom = top + tower.gapHeight;
    for (let y = 0; y < top; y += 12)
      ctx.block(
        (y / 12) % 2 ? 0x9d906f : 0xb0a17b,
        x + COURSE.towerWidth / 2,
        y + 5,
        COURSE.towerWidth,
        11,
        16,
        3,
      );
    for (let y = bottom; y < GROUND_Y; y += 12)
      ctx.block(
        (y / 12) % 2 ? 0x9d906f : 0xb0a17b,
        x + COURSE.towerWidth / 2,
        y + 5,
        COURSE.towerWidth,
        11,
        16,
        3,
      );
    ctx.block(
      0xd7bd7c,
      x + COURSE.towerWidth / 2,
      top - 3,
      COURSE.towerWidth + 8,
      7,
      20,
      5,
    );
    ctx.block(
      0xd7bd7c,
      x + COURSE.towerWidth / 2,
      bottom + 3,
      COURSE.towerWidth + 8,
      7,
      20,
      5,
    );
  }
  const mailbox = view.pigeonX + sim.mailboxX - sim.distance;
  if (mailbox < view.width + 30) {
    ctx.block(0x836b46, mailbox, GROUND_Y * 0.76, 8, GROUND_Y * 0.48, 8, 3);
    ctx.block(0xb58a4b, mailbox, GROUND_Y / 2, 43, 44, 24, 8);
    ctx.block(0x2d433b, mailbox, GROUND_Y / 2, 30, 10, 2, 22);
    ctx.text("×2", mailbox, GROUND_Y / 2 + 15, 12, "#f1d994", "center", 26);
  }
  const y =
    sim.status === "crashed"
      ? Math.min(GROUND_Y - 10, fx.finalY + (view.now - fx.finishedAt) * 0.12)
      : sim.y;
  ctx.bird(view.pigeonX, y, 1, 0xcbd1c8, view.reducedMotion ? 0 : view.now);
  for (const particle of fx.particles)
    ctx.block(
      particle.kind === "spark" ? 0xeacc7c : 0xc4d1c0,
      particle.x,
      particle.y,
      particle.size,
      particle.size * 0.6,
      3,
      14,
    );
  ctx.render();
}
