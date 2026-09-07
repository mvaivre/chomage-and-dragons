"use client";

import { useLayoutEffect, useRef } from "react";
import { useApplication } from "@pixi/react";
import type { Ticker } from "pixi.js";
import { subscribeTick } from "./tickSubscription";

/** One subscription per component, with current props and safe canvas teardown. */
export function useSceneTick(options: ((ticker: Ticker) => void) | {
  callback: (ticker: Ticker) => void; priority?: number;
}) {
  const { app, isInitialised } = useApplication();
  const callback = typeof options === "function" ? options : options.callback;
  const priority = typeof options === "function" ? 0 : options.priority ?? 0;
  const latest = useRef(callback);
  useLayoutEffect(() => { latest.current = callback; });
  useLayoutEffect(() => {
    if (!isInitialised || !app?.ticker) return;
    return subscribeTick(app.ticker, ticker => latest.current(ticker), priority);
  }, [app, isInitialised, priority]);
}
