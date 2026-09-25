"use client";

import { useEffect, useState } from "react";
import { Texture } from "pixi.js";
import type { DecorKind } from "@/lib/game/decor";

interface Painted { texture: Texture; users: number; timer?: ReturnType<typeof setTimeout> }
const cache = new Map<string, Painted>();
let fonts: Promise<{ title: string; body: string }> | undefined;

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

/** All ink, including letters, is baked once; no Text objects rasterise during travel. */
async function paint(text: string, kind: DecorKind, textOnly: boolean): Promise<Texture> {
  const family = await gameFonts();
  const canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = 560;
  const c = canvas.getContext("2d")!;
  c.scale(2, 2);
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
function acquire(text: string, kind: DecorKind, textOnly: boolean) {
  const key = JSON.stringify([text, kind, textOnly]);
  let pending = jobs.get(key);
  if (!pending) {
    pending = new Promise<Painted>(resolve => {
      const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 40));
      idle(() => { void paint(text, kind, textOnly).then(texture => {
        const entry = { texture, users: 0 }; cache.set(key, entry); resolve(entry);
      }); });
    });
    jobs.set(key, pending);
  }
  return { key, pending };
}

/** Ref-counted and evicted after travel, so an endless journey never accumulates text textures. */
export function useSignTexture(text: string, kind: DecorKind, textOnly = false): Texture | null {
  const [value, setValue] = useState<{ key: string; texture: Texture } | null>(null);
  const key = JSON.stringify([text, kind, textOnly]);
  useEffect(() => {
    let alive = true;
    const job = acquire(text, kind, textOnly);
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
  }, [text, kind, textOnly]);
  return value?.key === key && !value.texture.destroyed ? value.texture : null;
}
