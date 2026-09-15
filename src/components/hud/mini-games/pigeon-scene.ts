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

export interface SceneAssets {
  pigeon: HTMLImageElement | null;
  far: HTMLImageElement | null;
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
const SLOT_Y = GROUND_Y / 2;
const INK = "#28241a";
const STONE = "#d2b27a";
const STONE_DARK = "#a8895a";
const STONE_LINE = "#8c6f45";

export function createFx(): SceneFx {
  return { particles: [], shakeUntil: 0, flashUntil: 0, finishedAt: 0, finalY: 0 };
}

export function spawnParticles(fx: SceneFx, kind: Particle["kind"], x: number, y: number, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const power = kind === "spark" ? 60 + Math.random() * 90 : kind === "dust" ? 20 + Math.random() * 40 : kind === "trail" ? 12 : 30 + Math.random() * 50;
    fx.particles.push({
      kind, x, y,
      // Wing wash streams away behind the courier, which flies with its back forward.
      vx: Math.cos(angle) * power - (kind === "trail" ? 90 + Math.random() * 40 : 0),
      vy: Math.sin(angle) * power - (kind === "feather" ? 30 : 0),
      age: 0,
      life: kind === "spark" ? 500 : kind === "dust" ? 600 : kind === "trail" ? 350 : 1400,
      spin: (Math.random() - 0.5) * 8,
      size: kind === "dust" ? 4 + Math.random() * 5 : kind === "spark" ? 3 + Math.random() * 2 : 5 + Math.random() * 3,
    });
  }
}

export function updateParticles(fx: SceneFx, dtMs: number, scroll: number) {
  const dt = dtMs / 1000;
  fx.particles = fx.particles.filter(p => (p.age += dtMs) < p.life);
  for (const p of fx.particles) {
    p.x += (p.vx - (p.kind === "feather" || p.kind === "dust" ? scroll : 0)) * dt;
    if (p.kind === "feather") { p.vy = Math.min(45, p.vy + 90 * dt); p.x += Math.sin(p.age / 120) * 25 * dt; }
    else if (p.kind === "spark") p.vy += 160 * dt;
    else if (p.kind === "dust") { p.vx *= 0.96; p.vy *= 0.96; }
    p.y += p.vy * dt;
  }
}

/** Sprite tilt: beak up while climbing, nose-dive while falling. The art faces left. */
export function pigeonAngle(sim: PigeonSim): number {
  return Math.max(-0.55, Math.min(0.4, -sim.vy / 320));
}

function tileLayer(ctx: CanvasRenderingContext2D, image: HTMLImageElement, view: SceneView, offset: number, height: number, baseline: number, alpha: number) {
  const width = image.width / image.height * height;
  if (!(width > 0)) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const start = Math.floor(offset / width) - 1;
  const end = Math.ceil((offset + view.width) / width) + 1;
  for (let i = start; i <= end; i++) {
    const x = i * width - offset;
    if (x + width < 0 || x > view.width) continue;
    ctx.save();
    if (i % 2) { ctx.translate(x + width, 0); ctx.scale(-1, 1); ctx.drawImage(image, 0, baseline - height, width, height); }
    else ctx.drawImage(image, x, baseline - height, width, height);
    ctx.restore();
  }
  ctx.restore();
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = "rgb(250 244 225 / 0.85)";
  ctx.beginPath();
  ctx.ellipse(x, y, size * 1.6, size * 0.55, 0, 0, Math.PI * 2);
  ctx.ellipse(x - size * 0.6, y - size * 0.25, size * 0.7, size * 0.6, 0, 0, Math.PI * 2);
  ctx.ellipse(x + size * 0.45, y - size * 0.35, size * 0.8, size * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTowerBlock(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number, capAtTop: boolean) {
  const w = COURSE.towerWidth;
  const capH = 12;
  ctx.fillStyle = STONE;
  ctx.fillRect(x, top, w, bottom - top);
  // Shaded right side and mortar lines give the block some volume.
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(x + w - 9, top, 9, bottom - top);
  ctx.strokeStyle = STONE_LINE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let y = (capAtTop ? top + capH : top) + 7, row = 0; y < (capAtTop ? bottom : bottom - capH) - 3; y += 14, row++) {
    ctx.moveTo(x + 2, y); ctx.lineTo(x + w - 2, y);
    const bx = x + (row % 2 ? w * 0.36 : w * 0.66);
    ctx.moveTo(bx, y); ctx.lineTo(bx, Math.min(y + 14, capAtTop ? bottom : bottom - capH));
  }
  ctx.stroke();
  // Cap and merlons on the side that faces the gap.
  const capY = capAtTop ? top : bottom - capH;
  ctx.fillStyle = STONE;
  ctx.fillRect(x - 5, capY, w + 10, capH);
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(x + w - 4, capY, 9, capH);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 5, capY, w + 10, capH);
  const merlonY = capAtTop ? top - 7 : bottom;
  for (let i = 0; i < 3; i++) {
    const mx = x - 5 + 3 + i * ((w + 10 - 6 - 8) / 2);
    ctx.fillStyle = STONE;
    ctx.fillRect(mx, merlonY, 8, 7);
    ctx.strokeRect(mx, merlonY, 8, 7);
  }
  ctx.strokeRect(x, capAtTop ? top + capH : top, w, bottom - top - capH);
}

function drawTowers(ctx: CanvasRenderingContext2D, sim: PigeonSim, view: SceneView) {
  for (const tower of sim.towers) {
    const x = view.pigeonX + (tower.x - sim.distance);
    if (x + COURSE.towerWidth + 6 < 0 || x - 6 > view.width) continue;
    const top = tower.gapY - tower.gapHeight / 2;
    const bottom = tower.gapY + tower.gapHeight / 2;
    drawTowerBlock(ctx, x, -6, top, false);
    drawTowerBlock(ctx, x, bottom, GROUND_Y + 4, true);
    if (tower.passed && sim.t - sim.lastPassAt < 450 && !view.reducedMotion) {
      const u = (sim.t - sim.lastPassAt) / 450;
      ctx.strokeStyle = `rgb(255 224 120 / ${1 - u})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 5 - u * 8, top - u * 8, COURSE.towerWidth + 10 + u * 16, tower.gapHeight + u * 16);
    }
  }
}

function drawMailbox(ctx: CanvasRenderingContext2D, sim: PigeonSim, view: SceneView, delivered: number) {
  const x = view.pigeonX + (sim.mailboxX - sim.distance);
  if (x - 40 > view.width) return;
  const boxW = 52, boxH = 56;
  ctx.fillStyle = "#67462d";
  ctx.fillRect(x - 5, SLOT_Y, 10, GROUND_Y - SLOT_Y + 4);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.strokeRect(x - 5, SLOT_Y, 10, GROUND_Y - SLOT_Y + 4);
  ctx.fillStyle = delivered ? "#d4a53f" : "#ad7039";
  ctx.beginPath();
  ctx.roundRect(x - boxW / 2, SLOT_Y - boxH / 2, boxW, boxH, [10, 10, 2, 2]);
  ctx.fill();
  ctx.fillStyle = "#83502d";
  ctx.fillRect(x + boxW / 2 - 7, SLOT_Y - boxH / 2 + 6, 7, boxH - 8);
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#24231d";
  ctx.fillRect(x - boxW / 2 + 7, SLOT_Y - 9, boxW - 14, 16);
  ctx.strokeStyle = "#f5d163"; ctx.lineWidth = 2.5;
  ctx.strokeRect(x - boxW / 2 + 7, SLOT_Y - 9, boxW - 14, 16);
  ctx.fillStyle = "#f9e6b2";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("×2", x, SLOT_Y + boxH / 2 - 5);
  // The signal flag rises once the letter is in.
  const flag = Math.min(1, delivered);
  ctx.save();
  ctx.translate(x + boxW / 2 + 2, SLOT_Y - boxH / 2 + 4);
  ctx.rotate(-Math.PI / 2 * flag);
  ctx.fillStyle = "#ce4d48";
  ctx.fillRect(0, -4, 22, 8);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(0, -4, 22, 8);
  ctx.restore();
}

function drawPigeon(ctx: CanvasRenderingContext2D, sim: PigeonSim, fx: SceneFx, view: SceneView, assets: SceneAssets) {
  const size = 62;
  let x = view.pigeonX;
  let y = sim.y;
  let angle = pigeonAngle(sim);
  let scale = 1;
  let alpha = 1;
  if (sim.status === "ready") {
    y += view.reducedMotion ? 0 : Math.sin(sim.t / 260) * 5;
    angle = view.reducedMotion ? 0 : Math.sin(sim.t / 400) * 0.06;
  } else if (sim.status === "crashed") {
    const u = Math.min(1, (view.now - fx.finishedAt) / 700);
    const eased = u * u;
    y = fx.finalY + (GROUND_Y - 14 - fx.finalY) * eased;
    angle = -0.2 - 1.2 * u;
  } else if (sim.status === "delivered") {
    const u = Math.min(1, (view.now - fx.finishedAt) / 650);
    const eased = 1 - (1 - u) * (1 - u);
    x = view.pigeonX + (sim.mailboxX - sim.distance - 8) * eased;
    y = fx.finalY + (SLOT_Y - fx.finalY) * eased;
    angle = 0.1 * (1 - u);
    scale = 1 - 0.7 * eased;
    alpha = 1 - Math.max(0, u - 0.8) * 5;
  }
  if (sim.status === "flying" && sim.t < sim.invulnerableUntil && !view.reducedMotion) alpha = Math.floor(sim.t / 70) % 2 ? 0.35 : 0.95;
  const flapU = Math.min(1, (sim.t - sim.lastFlapAt) / 180);
  const squash = sim.status === "flying" && !view.reducedMotion ? Math.sin(flapU * Math.PI) : 0;

  // Contact shadow keeps the height readable against the ground.
  const height = Math.max(0, GROUND_Y - y);
  ctx.fillStyle = `rgb(30 30 20 / ${0.28 * Math.max(0, 1 - height / 220)})`;
  ctx.beginPath();
  ctx.ellipse(x, GROUND_Y + 3, 18 * Math.max(0.35, 1 - height / 300), 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(-scale * (1 + squash * 0.14), scale * (1 - squash * 0.2));
  if (assets.pigeon) ctx.drawImage(assets.pigeon, -size / 2 + 2, -size / 2 + 4, size, size);
  else {
    ctx.fillStyle = "#6f7378";
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, fx: SceneFx) {
  for (const p of fx.particles) {
    const life = 1 - p.age / p.life;
    ctx.save();
    ctx.globalAlpha = Math.min(1, life * 1.5);
    ctx.translate(p.x, p.y);
    if (p.kind === "feather") {
      ctx.rotate(p.age / 1000 * p.spin);
      ctx.fillStyle = "#e9e6dd";
      ctx.strokeStyle = "#5a5d63"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.4, 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (p.kind === "spark") {
      ctx.fillStyle = "#ffe07a";
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    } else if (p.kind === "dust") {
      ctx.fillStyle = "rgb(214 200 168 / 0.8)";
      ctx.beginPath(); ctx.arc(0, 0, p.size * (1 + (1 - life)), 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = "rgb(255 255 255 / 0.7)";
      ctx.fillRect(0, 0, 8 * life + 2, 2);
    }
    ctx.restore();
  }
}

export function drawPigeonScene(ctx: CanvasRenderingContext2D, sim: PigeonSim, fx: SceneFx, view: SceneView, assets: SceneAssets) {
  const { width, height, now } = view;
  const scroll = view.reducedMotion ? 0 : sim.distance;
  ctx.save();
  if (now < fx.shakeUntil && !view.reducedMotion) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#7fa4b5");
  sky.addColorStop(1, "#d6e3dd");
  ctx.fillStyle = sky;
  ctx.fillRect(-10, -10, width + 20, height + 20);

  const cloudDrift = view.reducedMotion ? 0 : now / 90;
  for (let i = 0; i < 4; i++) {
    const span = width + 160;
    const cx = (((i * 173 + 60) - cloudDrift * (0.6 + i * 0.15) - scroll * 0.05) % span + span) % span - 80;
    drawCloud(ctx, cx, 26 + i * 14, 12 + i * 3);
  }
  if (assets.far) tileLayer(ctx, assets.far, view, scroll * 0.18, 170, GROUND_Y + 6, 1);

  // Ground band with scrolling grass tufts and soil.
  ctx.fillStyle = "#6f8d3a";
  ctx.fillRect(-10, GROUND_Y, width + 20, COURSE.ground + 10);
  ctx.fillStyle = "#8a6a3d";
  ctx.fillRect(-10, GROUND_Y + 7, width + 20, COURSE.ground + 10);
  ctx.fillStyle = "#3d5a25";
  const tuft = ((scroll * 1.15) % 26 + 26) % 26;
  for (let x = -tuft; x < width + 26; x += 26) { ctx.fillRect(x, GROUND_Y, 3, 5); ctx.fillRect(x + 11, GROUND_Y + 1, 2, 3); }
  ctx.fillStyle = INK;
  ctx.fillRect(-10, GROUND_Y - 2, width + 20, 3);

  drawTowers(ctx, sim, view);
  drawMailbox(ctx, sim, view, sim.status === "delivered" ? Math.max(0, (now - fx.finishedAt - 500) / 300) : 0);
  drawParticles(ctx, fx);
  drawPigeon(ctx, sim, fx, view, assets);

  if (now < fx.flashUntil && !view.reducedMotion) {
    ctx.fillStyle = `rgb(206 77 72 / ${0.4 * (fx.flashUntil - now) / 160})`;
    ctx.fillRect(-10, -10, width + 20, height + 20);
  }
  ctx.restore();
}
