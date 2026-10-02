"use client";

import { Texture } from "pixi.js";

interface AtmosphereTextures { fog: Texture; ray: Texture; shade: Texture; glow: Texture; }
let cached: AtmosphereTextures | null = null;

/** Soft optical masks, rasterized once. No per-frame canvas, blur filter or framebuffer. */
function opticalTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  paint(canvas.getContext("2d")!);
  return Texture.from(canvas);
}

export function atmosphereTextures(): AtmosphereTextures {
  if (cached && !cached.fog.destroyed && cached.fog.source && !cached.fog.source.destroyed) return cached;
  cached = {
    fog: opticalTexture(512, 192, ctx => {
      for (let i = 0; i < 7; i++) {
        const x = 90 + i * 54, y = 88 + Math.sin(i * 2.3) * 16;
        ctx.save(); ctx.translate(x, y); ctx.scale(2.1, .75);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 58);
        g.addColorStop(0, "rgba(255,255,255,.26)"); g.addColorStop(.45, "rgba(255,255,255,.13)"); g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g; ctx.fillRect(-58, -58, 116, 116); ctx.restore();
      }
    }),
    ray: opticalTexture(128, 512, ctx => {
      const image = ctx.createImageData(128, 512);
      for (let y = 0; y < 512; y++) for (let x = 0; x < 128; x++) {
        const across = Math.exp(-Math.pow((x - 64) / 29, 2) * 2);
        const down = Math.pow(Math.sin(y / 511 * Math.PI), .8);
        const i = (y * 128 + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
        image.data[i + 3] = Math.round(across * down * 255);
      }
      ctx.putImageData(image, 0, 0);
    }),
    shade: opticalTexture(256, 128, ctx => {
      for (let i = 0; i < 28; i++) {
        const x = 34 + (i * 47 % 189), y = 26 + (i * 23 % 75);
        ctx.save(); ctx.translate(x, y); ctx.rotate(i * 1.7); ctx.scale(1.6, .65);
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 20);
        g.addColorStop(0, "rgba(255,255,255,.55)"); g.addColorStop(.48, "rgba(255,255,255,.3)"); g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g; ctx.fillRect(-20, -20, 40, 40); ctx.restore();
      }
    }),
    glow: opticalTexture(128, 128, ctx => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,255,255,.8)"); g.addColorStop(.18, "rgba(255,255,255,.45)"); g.addColorStop(.5, "rgba(255,255,255,.14)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    }),
  };
  return cached;
}
