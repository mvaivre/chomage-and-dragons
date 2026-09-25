"use client";

import { useEffect, useState } from "react";
import { Texture } from "pixi.js";
import type { DecorKind } from "@/lib/game/decor";
import signs from "../../../public/art/world-v3/decor/signs.json";

interface Painted { texture: Texture; users: number; timer?: ReturnType<typeof setTimeout> }
const cache = new Map<string, Painted>();
let fonts: Promise<{ title: string; body: string }> | undefined;
let signImage: Promise<HTMLImageElement | null> | undefined;
function loadSigns() {
  return signImage ??= new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = "/art/world-v3/decor/signs.webp";
  });
}

function fitLetters(c: CanvasRenderingContext2D, text: string, rect: number[], family: string, maximum: number) {
  const [x, y, w, h] = rect;
  let size = Math.max(4, Math.floor(maximum)), lines: string[] = [];
  for (; size >= 4; size--) {
    c.font = `600 ${size}px ${family}`;
    lines = wrapText(c, text, w);
    if (lines.length * size * 1.04 <= h || size === 4) break;
  }
  c.textAlign = "center"; c.textBaseline = "middle";
  lines.forEach((line, i) => c.fillText(line, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * size * 1.04, w));
}

function gameFonts() {
  return fonts ??= document.fonts.ready.then(() => {
    // next/font supplies generated family names; the literal CSS variable isn't a canvas font.
    const styles = getComputedStyle(document.body);
    return { title: styles.getPropertyValue("--font-pirata").trim() || "serif", body: styles.getPropertyValue("--font-garamond").trim() || "serif" };
  });
}

export function wrapText(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > width) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Warp a small text canvas over the measured four corners of the painted board. */
function quadLetters(c: CanvasRenderingContext2D, text: string, quad: number[][], family: string, maximum: number) {
  const width = Math.ceil(Math.hypot(quad[1][0]-quad[0][0],quad[1][1]-quad[0][1]));
  const height = Math.ceil(Math.hypot(quad[3][0]-quad[0][0],quad[3][1]-quad[0][1]));
  const ink = document.createElement("canvas"); ink.width = width*2; ink.height = height*2;
  const source = ink.getContext("2d")!; source.scale(2,2); source.fillStyle = c.fillStyle;
  fitLetters(source,text,[0,0,width,height],family,maximum);
  const point=(u:number,v:number)=>[0,1].map(axis=>(1-v)*((1-u)*quad[0][axis]+u*quad[1][axis])+v*((1-u)*quad[3][axis]+u*quad[2][axis]));
  // Affine triangles over a bilinear grid: straight baselines follow the board's perspective.
  for(let row=0;row<4;row++)for(let col=0;col<8;col++) {
    const a=[col/8,row/4], b=[(col+1)/8,row/4], d=[col/8,(row+1)/4], e=[(col+1)/8,(row+1)/4];
    for(const uv of [[a,b,d],[e,d,b]]) {
      const [p0,p1,p2]=uv.map(([u,v])=>point(u,v));
      const [s0,s1,s2]=uv.map(([u,v])=>[u*ink.width,v*ink.height]);
      const dx1=s1[0]-s0[0],dy1=s1[1]-s0[1],dx2=s2[0]-s0[0],dy2=s2[1]-s0[1],det=dx1*dy2-dx2*dy1;
      const ax=((p1[0]-p0[0])*dy2-(p2[0]-p0[0])*dy1)/det;
      const bx=((p1[1]-p0[1])*dy2-(p2[1]-p0[1])*dy1)/det;
      const cy=((p2[0]-p0[0])*dx1-(p1[0]-p0[0])*dx2)/det;
      const dy=((p2[1]-p0[1])*dx1-(p1[1]-p0[1])*dx2)/det;
      c.save();c.beginPath();c.moveTo(...p0 as [number,number]);c.lineTo(...p1 as [number,number]);c.lineTo(...p2 as [number,number]);c.closePath();c.clip();
      c.transform(ax,bx,cy,dy,p0[0]-ax*s0[0]-cy*s0[1],p0[1]-bx*s0[0]-dy*s0[1]);c.drawImage(ink,0,0);c.restore();
    }
  }
}

/** All ink, including letters, is baked once; no Text objects rasterise during travel. */
async function paint(text: string, kind: DecorKind, textOnly: boolean, width: number, height: number, ink: string): Promise<Texture> {
  const family = await gameFonts();
  const canvas = document.createElement("canvas");
  canvas.width = width * 2; canvas.height = height * 2;
  const c = canvas.getContext("2d")!;
  c.scale(2, 2);
  const image = textOnly ? null : await loadSigns();
  if (image) {
    const frame = kind === "grave" || kind === "epitaph" ? 7 : kind === "wanted" || kind === "offer" ? 5 : 9;
    // Trim the transparent gutter, keeping the measured lettering rectangle in image space.
    const crop = frame === 7 ? [102, 98, 206, 274] : frame === 5 ? [95, 23, 200, 349] : [64, 10, 260, 362];
    const [cx, cy, cw, ch] = crop;
    const height = frame === 7 ? 198 : 260, top = 272 - height;
    const artWidth = frame === 7 ? 220 : 320, left = (320 - artWidth) / 2;
    c.drawImage(image, frame % 4 * 384 + cx, Math.floor(frame / 4) * 384 + cy, cw, ch, left, top, artWidth, height);
    const rect = signs.frames[frame].text as number[];
    c.fillStyle = "#292620";
    const face = kind === "daily" || kind === "crown" ? family.title : family.body;
    const quad = signs.frames[frame].textQuad;
    if (quad) quadLetters(c,text,quad.map(([x,y])=>[left+(x-cx)*artWidth/cw,top+(y-cy)*height/ch]),face,31);
    else fitLetters(c, text, [left + (rect[0] - cx) * artWidth / cw, top + (rect[1] - cy) * height / ch, rect[2] * artWidth / cw, rect[3] * height / ch], face, 31);
    return Texture.from(canvas);
  }
  if (textOnly) {
    c.fillStyle = ink;
    const inset = Math.min(4, width * 0.06, height * 0.08);
    fitLetters(c, text, [inset, inset, width - inset * 2, height - inset * 2], family.title, Math.min(64, height * 0.7));
    return Texture.from(canvas);
  }
  c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = "#292620"; c.lineWidth = 3.5;
  const grave = kind === "grave" || kind === "epitaph";
  if (!textOnly) {
    c.fillStyle = grave ? "#b0afa0" : "#8a6742";
    c.beginPath();
    if (grave) { c.roundRect(32, 4, 256, 268, [65, 65, 6, 6]); }
    else { c.moveTo(150, 128); c.lineTo(169, 125); c.lineTo(164, 272); c.lineTo(148, 272); c.closePath(); }
    c.fill(); c.stroke();
    if (!grave) {
      c.fillStyle = kind === "wanted" || kind === "offer" ? "#f3e5bc" : "#e7d2a1";
      c.beginPath(); c.moveTo(10, 9); c.lineTo(306, 4); c.lineTo(310, 169); c.lineTo(14, 173); c.closePath(); c.fill(); c.stroke();
      c.lineWidth = 1; c.strokeStyle = "#977952";
      c.beginPath(); c.moveTo(19, 17); c.lineTo(297, 14); c.moveTo(22, 161); c.lineTo(300, 160); c.stroke();
      c.fillStyle = "#423e32";
      for (const x of [24, 295]) { c.beginPath(); c.arc(x, 28, 2.2, 0, Math.PI * 2); c.fill(); }
    }
  }
  const title = kind === "crown" ? "Couronne du mois" : kind === "daily" ? "Défi du jour" : kind === "grave" ? "Candidature" : kind === "offer" ? "On recrute" : kind === "hired" ? "Engagé·es" : kind === "crowd" ? "Le vivier" : "Bureau des refus";
  c.fillStyle = "#514434"; c.textAlign = "center"; c.textBaseline = "middle";
  c.font = `23px ${family.title}`;
  c.fillText(title, 160, 31, 266);
  let size = 31;
  c.font = `600 ${size}px ${family.body}`;
  let lines = wrapText(c, text, 266);
  while (lines.length > 3 && size > 24) { size--; c.font = `600 ${size}px ${family.body}`; lines = wrapText(c, text, 266); }
  c.fillStyle = "#292620";
  lines.forEach((line, i) => c.fillText(line, 160, 80 + (i - (lines.length - 1) / 2) * (size + 1), 270));
  return Texture.from(canvas);
}

const jobs = new Map<string, Promise<Painted>>();
function acquire(text: string, kind: DecorKind, textOnly: boolean, width: number, height: number, ink: string) {
  const key = JSON.stringify([text, kind, textOnly, width, height, ink]);
  let pending = jobs.get(key);
  if (!pending) {
    pending = new Promise<Painted>(resolve => {
      const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 40));
      idle(() => { void paint(text, kind, textOnly, width, height, ink).then(texture => {
        const entry = { texture, users: 0 }; cache.set(key, entry); resolve(entry);
      }); });
    });
    jobs.set(key, pending);
  }
  return { key, pending };
}

/** Ref-counted and evicted after travel, so an endless journey never accumulates text textures. */
export function useSignTexture(text: string, kind: DecorKind, textOnly = false, width = 320, height = 280, ink = "#292620"): Texture | null {
  const [value, setValue] = useState<{ key: string; texture: Texture } | null>(null);
  const key = JSON.stringify([text, kind, textOnly, width, height, ink]);
  useEffect(() => {
    let alive = true;
    const job = acquire(text, kind, textOnly, width, height, ink);
    let owned: Painted | undefined;
    const release = (entry: Painted) => {
      entry.users--;
      if (entry.users === 0) entry.timer = setTimeout(() => {
        if (entry.users > 0) return;
        entry.texture.destroy(true); cache.delete(job.key); jobs.delete(job.key);
      }, 8000);
    };
    void job.pending.then(entry => {
      clearTimeout(entry.timer); entry.users++;
      if (!alive) { release(entry); return; }
      owned = entry; setValue({ key: job.key, texture: entry.texture });
    });
    return () => { alive = false; if (owned) release(owned); };
  }, [text, kind, textOnly, width, height, ink]);
  return value?.key === key && !value.texture.destroyed ? value.texture : null;
}
