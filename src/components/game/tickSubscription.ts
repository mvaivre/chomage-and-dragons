import type { Ticker } from "pixi.js";

/** React can clean children after Pixi has already destroyed its ticker during HMR. */
export function subscribeTick(ticker: Ticker, callback: (ticker: Ticker) => void, priority = 0) {
  ticker.add(callback, undefined, priority);
  return () => {
    // Public count is zero on a destroyed ticker; remove() itself is not destruction-safe.
    if (ticker.count > 0) ticker.remove(callback);
  };
}
