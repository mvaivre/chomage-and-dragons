"use client";

/** Runs once the browser is idle, or after a short delay where idle callbacks are missing. */
export function whenIdle(run: () => void, timeout = 3000): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(run, { timeout });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(run, 1200);
  return () => window.clearTimeout(handle);
}
