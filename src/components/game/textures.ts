"use client";

import { useEffect, useState } from "react";
import { Assets, Rectangle, Texture } from "pixi.js";

const references = new Map<string, number>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Shared alpha assets: no image processing or duplicate GPU source in the game. */
export function useDirectTexture(url: string): Texture | null {
  const [result, setResult] = useState<{ url: string; texture: Texture } | null>(null);

  useEffect(() => {
    let alive = true;
    clearTimeout(timers.get(url));
    timers.delete(url);
    references.set(url, (references.get(url) ?? 0) + 1);
    const pending = Assets.load<Texture>(url);
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
          await Assets.unload(url);
        }).catch(() => {});
      }, 8000));
    };
  }, [url]);

  return result?.url === url && !result.texture.destroyed ? result.texture : null;
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
