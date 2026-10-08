"use client";

import { useEffect, useState } from "react";
import { CanvasSource, Texture } from "pixi.js";
import type { DecorKind } from "@/lib/game/decor";
import signs from "../../../public/art/world-v3/decor/signs.json";

interface Painted { texture: Texture; canvas: HTMLCanvasElement; users: number; timer?: ReturnType<typeof setTimeout> }
/** A bake waits for idle time; nobody waiting any more by then cancels it. */
interface Job { key: string; pending: Promise<Painted | null>; waiting: number }
let fonts: Promise<{ title: string; body: string }> | undefined;
let signImage: Promise<HTMLImageElement | null> | undefined;
let treeBoardImage: Promise<HTMLImageElement | null> | undefined;
function loadTreeBoard() {
  return treeBoardImage ??= new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = "/art/world-v3/runtime/tree-notice-board.webp";
  });
}
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
  return fonts ??= document.fonts.ready.then(async () => {
    // next/font supplies generated family names; the literal CSS variable isn't a canvas font.
    const styles = getComputedStyle(document.body);
    const families = { title: styles.getPropertyValue("--font-pirata").trim() || "serif", body: styles.getPropertyValue("--font-garamond").trim() || "serif" };
    // A face no element has used yet is not loaded by `ready`: a bake would keep the fallback.
    await Promise.all([document.fonts.load(`23px ${families.title}`), document.fonts.load(`600 31px ${families.body}`)]).catch(() => {});
    return families;
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

/**
 * Lay a small text canvas over the measured corners of the painted board. The
 * measured quads are parallelograms within two source pixels, so one affine
 * transform follows their slant and perspective.
 */
function quadLetters(c: CanvasRenderingContext2D, text: string, quad: number[][], family: string, maximum: number, density: number) {
  const [p0, p1, , p3] = quad;
  const width = Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]));
  const height = Math.ceil(Math.hypot(p3[0] - p0[0], p3[1] - p0[1]));
  const ink = document.createElement("canvas"); ink.width = width * density; ink.height = height * density;
  const source = ink.getContext("2d")!; source.scale(density, density); source.fillStyle = c.fillStyle;
  fitLetters(source, text, [0, 0, width, height], family, maximum);
  c.save();
  c.transform((p1[0] - p0[0]) / ink.width, (p1[1] - p0[1]) / ink.width, (p3[0] - p0[0]) / ink.height, (p3[1] - p0[1]) / ink.height, p0[0], p0[1]);
  c.drawImage(ink, 0, 0);
  c.restore();
  ink.width = 0;
}

/**
 * Painted boards are shown at a fifth to half of their art size: one canvas pixel per
 * unit is already finer than any screen sees. Small text-only labels keep two.
 */
function densityFor(textOnly: boolean | "tree") {
  return textOnly === true ? 2 : 1;
}

/** All ink, including letters, is baked once; no Text objects rasterise during travel. */
async function paint(text: string, kind: DecorKind, textOnly: boolean | "tree", width: number, height: number, ink: string): Promise<Omit<Painted, "users">> {
  const family = await gameFonts();
  const density = densityFor(textOnly);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * density); canvas.height = Math.ceil(height * density);
  const c = canvas.getContext("2d")!;
  c.scale(density, density);
  // The texture keeps the size of a double-density bake, so every sprite scale stays valid.
  const done = () => ({ canvas, texture: new Texture({ source: new CanvasSource({ resource: canvas, resolution: density / 2 }) }) });
  if (textOnly === "tree") {
    const board = await loadTreeBoard();
    if (board) {
      c.drawImage(board, 0, 0, width, height);
      c.fillStyle = ink;
      // Keep the lettering inside the boards, clear of their nails and uneven edges.
      fitLetters(c, text, [width * .14, height * .18, width * .72, height * .64], family.body, height * .29);
    }
    return done();
  }
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
    if (quad) quadLetters(c, text, quad.map(([x, y]) => [left + (x - cx) * artWidth / cw, top + (y - cy) * height / ch]), face, 31, density * 2);
    else fitLetters(c, text, [left + (rect[0] - cx) * artWidth / cw, top + (rect[1] - cy) * height / ch, rect[2] * artWidth / cw, rect[3] * height / ch], face, 31);
    return done();
  }
  if (textOnly) {
    c.fillStyle = ink;
    c.shadowColor = "#20170df0"; c.shadowOffsetX = 1; c.shadowOffsetY = 1;
    const inset = Math.min(4, width * 0.06, height * 0.08);
    fitLetters(c, text, [inset, inset, width - inset * 2, height - inset * 2], family.body, Math.min(64, height * 0.7));
    return done();
  }
  // Fallback board, drawn only if the sign atlas cannot load.
  c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = "#292620"; c.lineWidth = 3.5;
  const grave = kind === "grave" || kind === "epitaph";
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
  return done();
}

const jobs = new Map<string, Job>();
function acquire(text: string, kind: DecorKind, textOnly: boolean | "tree", width: number, height: number, ink: string): Job {
  const key = JSON.stringify([text, kind, textOnly, width, height, ink]);
  let job = jobs.get(key);
  if (!job) {
    const created: Job = { key, waiting: 0, pending: Promise.resolve(null) };
    created.pending = new Promise<Painted | null>(resolve => {
      const run = () => {
        // A fast pan mounts and drops many signs: only bake what is still wanted.
        if (created.waiting <= 0) { if (jobs.get(key) === created) jobs.delete(key); resolve(null); return; }
        void paint(text, kind, textOnly, width, height, ink).then(painted => resolve({ ...painted, users: 0 }));
      };
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: 600 });
      else window.setTimeout(run, 40);
    });
    jobs.set(key, created);
    job = created;
  }
  return job;
}

/**
 * Ref-counted and evicted after travel, so an endless journey never accumulates text
 * textures. A null text bakes nothing.
 */
export function useSignTexture(text: string | null, kind: DecorKind, textOnly: boolean | "tree" = false, width = 320, height = 280, ink = "#292620"): Texture | null {
  const [value, setValue] = useState<{ key: string; texture: Texture } | null>(null);
  const key = JSON.stringify([text, kind, textOnly, width, height, ink]);
  useEffect(() => {
    if (text === null) return;
    let alive = true, settled = false;
    const job = acquire(text, kind, textOnly, width, height, ink);
    job.waiting++;
    let owned: Painted | undefined;
    const release = (entry: Painted) => {
      entry.users--;
      if (entry.users === 0) entry.timer = setTimeout(() => {
        if (entry.users > 0) return;
        entry.texture.destroy(true);
        // Safari keeps canvas memory until the element shrinks.
        entry.canvas.width = 0; entry.canvas.height = 0;
        if (jobs.get(job.key) === job) jobs.delete(job.key);
      }, 8000);
    };
    void job.pending.then(entry => {
      settled = true;
      if (alive) job.waiting--;
      if (!entry) return;
      clearTimeout(entry.timer); entry.users++;
      if (!alive) { release(entry); return; }
      owned = entry; setValue({ key: job.key, texture: entry.texture });
    });
    return () => { alive = false; if (!settled) job.waiting--; if (owned) release(owned); };
  }, [text, kind, textOnly, width, height, ink]);
  return value?.key === key && !value.texture.destroyed ? value.texture : null;
}
