"use client";

/**
 * Warm-up of what the rare, rewarding moments need. An action happens a few
 * times a week, so every real action is a first display: without this, the art
 * of the reaction and the mini-game arrive late and stutter on decode.
 */

const images = new Map<string, Promise<HTMLImageElement>>();

/** A decoded image, shared by every canvas that draws it. */
export function decodedImage(url: string): Promise<HTMLImageElement> {
  let pending = images.get(url);
  if (!pending) {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    pending = image.decode().then(() => image, () => new Promise<HTMLImageElement>((resolve, reject) => {
      // decode() rejects on some detached or cached cases; fall back to the load event.
      if (image.complete && image.naturalWidth) resolve(image);
      else { image.onload = () => resolve(image); image.onerror = reject; }
    }));
    pending.catch(() => images.delete(url));
    images.set(url, pending);
  }
  return pending;
}

/** Calls back with the image as soon as it is decoded, from cache when warm. */
export function withImage(url: string, use: (image: HTMLImageElement) => void): void {
  void decodedImage(url).then(use).catch(() => {});
}

/** Runs once the browser is idle, or after a short delay where idle callbacks are missing. */
export function whenIdle(run: () => void, timeout = 3000): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(run, { timeout });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(run, 1200);
  return () => window.clearTimeout(handle);
}
