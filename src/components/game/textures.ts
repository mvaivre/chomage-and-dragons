"use client";

import { useEffect, useState } from "react";
import { Assets, Rectangle, Texture } from "pixi.js";

const references = new Map<string, number>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Downloads share the connection in the order components mount, a few at a time, so
 * the nearest art arrives first. The player's own hero goes before all of them: it
 * unlocks the action bar, and on a slow phone forty scenery files would otherwise
 * share its bandwidth.
 */
const MAX_LOADS = 6;
let active = 0;
const waiting: Array<() => void> = [];
const loads = new Map<string, Promise<Texture>>();
let priority: Promise<unknown> = Promise.resolve();

function queued(url: string): Promise<Texture> {
  return new Promise<Texture>((resolve, reject) => {
    const start = () => {
      active += 1;
      Assets.load<Texture>(url).then(resolve, reject).finally(() => {
        active -= 1;
        waiting.shift()?.();
      });
    };
    if (active < MAX_LOADS) start(); else waiting.push(start);
  });
}

function load(url: string): Promise<Texture> {
  // Already decoded art never waits behind the queue.
  if (Assets.cache.has(url)) return Promise.resolve(Assets.get<Texture>(url));
  let pending = loads.get(url);
  if (!pending) {
    pending = priority.then(() => Assets.cache.has(url) ? Assets.get<Texture>(url) : queued(url));
    loads.set(url, pending);
    pending.catch(() => loads.delete(url));
  }
  return pending;
}

function retain(url: string) {
  clearTimeout(timers.get(url));
  timers.delete(url);
  references.set(url, (references.get(url) ?? 0) + 1);
}

/** Shared alpha assets: no image processing or duplicate GPU source in the game. */
export function useDirectTexture(url: string): Texture | null {
  const [result, setResult] = useState<{ url: string; texture: Texture } | null>(null);

  useEffect(() => {
    let alive = true;
    retain(url);
    const pending = load(url);
    void pending.then((texture) => {
      if (alive) setResult({ url, texture });
    }).catch((error: unknown) => console.error(`Unable to load ${url}`, error));

    return () => {
      alive = false;
      const count = (references.get(url) ?? 1) - 1;
      references.set(url, count);
      if (count > 0) return;
      timers.set(url, setTimeout(() => {
        timers.delete(url);
        // Wait for slow downloads before unloading; a new subscriber owns the source.
        void pending.then(async () => {
          if ((references.get(url) ?? 0) > 0) return;
          references.delete(url);
          loads.delete(url);
          await Assets.unload(url);
        }).catch(() => {});
      }, 8000));
    };
  }, [url]);

  return result?.url === url && !result.texture.destroyed ? result.texture : null;
}

/**
 * Load textures now and keep them for the session: the reaction art of the five
 * actions and the loot, which must be ready the instant an action happens.
 */
export function retainTextures(urls: readonly string[]): void {
  for (const url of urls) {
    retain(url);
    void load(url).catch(() => {});
  }
}

/**
 * The art that gates play loads at once and alone; every other texture waits for it,
 * three seconds at most. Retained for the session, like `retainTextures`.
 */
export function loadFirst(urls: readonly string[]): void {
  const first = Promise.all(urls.map((url) => {
    retain(url);
    return Assets.load<Texture>(url).catch(() => null);
  }));
  priority = Promise.race([first, new Promise((resolve) => setTimeout(resolve, 3000))]);
}

const frames = new WeakMap<Texture, Map<string, Texture[]>>();

/** Frames share the source and are constructed only once per loaded atlas. */
export function atlasFrames(base: Texture, columns: number, rows: number): Texture[] {
  let layouts = frames.get(base);
  if (!layouts) frames.set(base, layouts = new Map());
  const key = `${columns}:${rows}`;
  let result = layouts.get(key);
  if (!result) {
    const width = base.width / columns;
    const height = base.height / rows;
    result = Array.from({ length: columns * rows }, (_, index) => new Texture({
      source: base.source,
      frame: new Rectangle((index % columns) * width, Math.floor(index / columns) * height, width, height),
    }));
    layouts.set(key, result);
  }
  return result;
}
