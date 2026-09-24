import { Texture } from "pixi.js";

/**
 * The world's special effects, requested from anywhere and drawn by FxLayer.
 * Everything is procedural: a few textures painted once on small canvases,
 * pooled sprites, and presets that describe how each kind of particle moves.
 */

export type TextureKind = "square" | "dot" | "spark" | "feather" | "letter" | "ring";

const textures = new Map<TextureKind, Texture>();

function paint(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d")!);
  return Texture.from(canvas);
}

export function fxTexture(kind: TextureKind): Texture {
  const cached = textures.get(kind);
  if (cached && !cached.destroyed) return cached;
  let texture: Texture;
  switch (kind) {
    case "square":
      texture = Texture.WHITE;
      break;
    case "dot":
      texture = paint(48, 48, (ctx) => {
        const g = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.45, "rgba(255,255,255,0.55)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 48, 48);
      });
      break;
    case "spark":
      texture = paint(40, 40, (ctx) => {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
          const radius = i % 2 === 0 ? 19 : 5;
          ctx.lineTo(20 + Math.cos(angle) * radius, 20 + Math.sin(angle) * radius);
        }
        ctx.closePath();
        ctx.fill();
      });
      break;
    case "feather":
      texture = paint(20, 48, (ctx) => {
        ctx.fillStyle = "#eceae2";
        ctx.strokeStyle = "#6c6f75";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(10, 24, 7, 21, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(10, 4);
        ctx.lineTo(10, 46);
        ctx.stroke();
      });
      break;
    case "letter":
      texture = paint(34, 24, (ctx) => {
        ctx.fillStyle = "#f5e8bd";
        ctx.strokeStyle = "#28241a";
        ctx.lineWidth = 2;
        ctx.fillRect(1, 1, 32, 22);
        ctx.strokeRect(1, 1, 32, 22);
        ctx.beginPath();
        ctx.moveTo(1, 1);
        ctx.lineTo(17, 13);
        ctx.lineTo(33, 1);
        ctx.stroke();
        ctx.fillStyle = "#ce4d48";
        ctx.beginPath();
        ctx.arc(17, 14, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    case "ring":
      texture = paint(96, 96, (ctx) => {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(48, 48, 42, 0, Math.PI * 2);
        ctx.stroke();
      });
      break;
  }
  textures.set(kind, texture);
  return texture;
}

export interface Preset {
  texture: TextureKind;
  /** Launch speed range, world units per second. */
  speed: [number, number];
  /** Launch direction and spread, radians; -π/2 is straight up. */
  angle: number;
  spread: number;
  gravity: number;
  /** Fraction of velocity kept per second. */
  drag: number;
  life: [number, number];
  /** Rendered size in world units, as [start, end]. */
  size: [number, number];
  /** Aspect of the sprite: width over height. */
  aspect?: number;
  alpha: [number, number];
  spin: number;
  /** Side-to-side sway, world units per second. */
  flutter?: number;
  colors: number[];
  additive?: boolean;
  /** Pulsing light, for fireflies and embers. */
  blink?: boolean;
  /** Point along the launch direction instead of a random angle, for speed lines. */
  align?: boolean;
}

export const PRESETS = {
  confetti: { texture: "square", speed: [260, 680], angle: -Math.PI / 2, spread: 1.0, gravity: 720, drag: 0.35, life: [1.6, 2.6], size: [11, 11], aspect: 0.6, alpha: [1, 1], spin: 9, flutter: 60, colors: [0xd94f4f, 0xe8b84b, 0x4fa3d1, 0x63b96a, 0xb96ac9, 0xf5e8bd] },
  goldRain: { texture: "square", speed: [30, 120], angle: Math.PI / 2, spread: 0.5, gravity: 260, drag: 0.5, life: [2.2, 3.4], size: [10, 10], aspect: 0.55, alpha: [1, 0.9], spin: 7, flutter: 70, colors: [0xefbd3c, 0xf5d163, 0xfff1bd, 0xd4a53f] },
  feathers: { texture: "feather", speed: [60, 220], angle: -Math.PI / 2, spread: 2.6, gravity: 70, drag: 0.4, life: [1.4, 2.2], size: [26, 20], aspect: 0.42, alpha: [1, 0.2], spin: 3, flutter: 90, colors: [0xffffff, 0xd8d6d0, 0xb9bcc2] },
  sparks: { texture: "spark", speed: [220, 560], angle: -Math.PI / 2, spread: Math.PI, gravity: 420, drag: 0.2, life: [0.45, 0.9], size: [22, 4], alpha: [1, 0.6], spin: 6, colors: [0xfff1bd, 0xffd76c, 0xffffff], additive: true },
  stars: { texture: "spark", speed: [90, 260], angle: -Math.PI / 2, spread: Math.PI, gravity: 60, drag: 0.3, life: [0.9, 1.6], size: [26, 6], alpha: [1, 0], spin: 2, colors: [0xffe07a, 0xfff6d6], additive: true },
  dust: { texture: "dot", speed: [70, 240], angle: -Math.PI / 2, spread: 2.9, gravity: -40, drag: 0.25, life: [0.7, 1.2], size: [30, 90], alpha: [0.75, 0], spin: 0, colors: [0xcdb68d, 0xb59b72, 0xe0cfa8] },
  smoke: { texture: "dot", speed: [20, 70], angle: -Math.PI / 2, spread: 1.2, gravity: -60, drag: 0.5, life: [1.2, 2.0], size: [40, 120], alpha: [0.5, 0], spin: 0, colors: [0x6b6660, 0x8a847c] },
  letters: { texture: "letter", speed: [180, 480], angle: -Math.PI / 2, spread: 1.4, gravity: 560, drag: 0.3, life: [1.8, 2.6], size: [34, 34], aspect: 1.4, alpha: [1, 1], spin: 6, flutter: 40, colors: [0xffffff] },
  letterRain: { texture: "letter", speed: [20, 90], angle: Math.PI / 2, spread: 0.6, gravity: 220, drag: 0.4, life: [2.4, 3.6], size: [36, 36], aspect: 1.4, alpha: [1, 1], spin: 3, flutter: 80, colors: [0xffffff] },
  firework: { texture: "spark", speed: [260, 520], angle: 0, spread: Math.PI, gravity: 180, drag: 0.8, life: [0.9, 1.5], size: [20, 6], alpha: [1, 0], spin: 4, colors: [0xffffff], additive: true },
  leaves: { texture: "feather", speed: [20, 60], angle: Math.PI / 2, spread: 0.6, gravity: 28, drag: 0.6, life: [5, 7], size: [18, 18], aspect: 0.45, alpha: [1, 1], spin: 2, flutter: 60, colors: [0x9fae52, 0xc9a13b, 0xb86a2e, 0x7c9a3a] },
  snow: { texture: "dot", speed: [20, 50], angle: Math.PI / 2, spread: 0.4, gravity: 18, drag: 0.7, life: [6, 8], size: [8, 8], alpha: [0.95, 0.9], spin: 0, flutter: 35, colors: [0xffffff, 0xeaf2ff] },
  pollen: { texture: "dot", speed: [5, 20], angle: -Math.PI / 2, spread: Math.PI, gravity: -3, drag: 0.8, life: [5, 8], size: [6, 6], alpha: [0.8, 0.8], spin: 0, flutter: 25, colors: [0xfff6c8, 0xffffff] },
  fireflies: { texture: "dot", speed: [8, 25], angle: -Math.PI / 2, spread: Math.PI, gravity: 0, drag: 0.85, life: [4, 7], size: [22, 22], alpha: [1, 1], spin: 0, flutter: 30, colors: [0xeaff9a, 0xfff6a8], additive: true, blink: true },
  sand: { texture: "dot", speed: [140, 220], angle: Math.PI, spread: 0.15, gravity: 10, drag: 0.95, life: [2.5, 4], size: [6, 6], alpha: [0.8, 0.5], spin: 0, colors: [0xe0c690, 0xcfae72] },
  embers: { texture: "spark", speed: [20, 60], angle: -Math.PI / 2, spread: 0.6, gravity: -20, drag: 0.8, life: [2, 3], size: [9, 3], alpha: [1, 0.4], spin: 2, flutter: 20, colors: [0xffb62f, 0xff6a3d], additive: true, blink: true },
  // Footfalls and travel: small, short-lived, tinted by the land underfoot.
  puff: { texture: "dot", speed: [30, 110], angle: -Math.PI / 2, spread: 2.2, gravity: -30, drag: 0.25, life: [0.35, 0.7], size: [14, 44], alpha: [0.6, 0], spin: 0, colors: [0xcdb68d, 0xb59b72, 0xe0cfa8] },
  splash: { texture: "dot", speed: [140, 300], angle: -Math.PI / 2, spread: 0.9, gravity: 1100, drag: 0.3, life: [0.3, 0.55], size: [9, 5], alpha: [0.95, 0.7], spin: 0, colors: [0xdff3ff, 0xa9d8f0, 0xffffff] },
  kickLeaves: { texture: "feather", speed: [80, 190], angle: -Math.PI / 2, spread: 1.4, gravity: 420, drag: 0.5, life: [0.6, 1.0], size: [14, 11], aspect: 0.45, alpha: [1, 0.8], spin: 8, colors: [0x9fae52, 0xc9a13b, 0xb86a2e, 0x7c9a3a] },
  rain: { texture: "square", speed: [620, 820], angle: Math.PI / 2 + 0.12, spread: 0.03, gravity: 500, drag: 1, life: [0.3, 0.5], size: [3.4, 3.4], aspect: 10, alpha: [0.95, 0.8], spin: 0, colors: [0x5d8cc0, 0x7fa9d6, 0x4a76a8], align: true },
  cloud: { texture: "dot", speed: [4, 16], angle: 0, spread: Math.PI, gravity: 0, drag: 0.5, life: [1.7, 2.0], size: [80, 96], alpha: [1, 0.7], spin: 0, colors: [0x6f7887, 0x5d6573, 0x828b99] },
  streak: { texture: "square", speed: [260, 420], angle: Math.PI, spread: 0.04, gravity: 0, drag: 0.2, life: [0.16, 0.3], size: [3, 2], aspect: 22, alpha: [0.7, 0], spin: 0, colors: [0xfff6de, 0xffffff], additive: true, align: true },
  glow: { texture: "dot", speed: [0, 0], angle: 0, spread: 0, gravity: 0, drag: 0, life: [0.5, 0.5], size: [60, 380], alpha: [0.9, 0], spin: 0, colors: [0xfff1bd], additive: true },
  shockwave: { texture: "ring", speed: [0, 0], angle: 0, spread: 0, gravity: 0, drag: 0, life: [0.55, 0.55], size: [30, 420], alpha: [0.95, 0], spin: 0, colors: [0xfff1bd] },
} satisfies Record<string, Preset>;

export type PresetName = keyof typeof PRESETS;

export interface BurstRequest {
  preset: PresetName;
  x: number;
  y: number;
  count: number;
  /** Horizontal and vertical spawn spread, for rains and walls of confetti. */
  spreadX?: number;
  spreadY?: number;
  /** Replace the preset colours, for fireworks of one hue. */
  colors?: number[];
  /** Multiply speeds and sizes. */
  power?: number;
  /** Replace the preset's launch direction, radians. */
  angle?: number;
  delay?: number;
  /** Background life: never forces full frame rate, capped in number. */
  ambient?: boolean;
}

export interface BoltRequest {
  x: number;
  /** Where it strikes, world coordinates. */
  y: number;
  /** Top of the bolt, world coordinates. */
  top: number;
  delay?: number;
  color?: number;
}

/** Requests are queued here and consumed by FxLayer on its next frame. */
export const fxQueue = { bursts: [] as BurstRequest[], bolts: [] as BoltRequest[] };

export const fx = {
  burst(request: BurstRequest): void {
    fxQueue.bursts.push(request);
  },
  bolt(request: BoltRequest): void {
    fxQueue.bolts.push(request);
  },
};
