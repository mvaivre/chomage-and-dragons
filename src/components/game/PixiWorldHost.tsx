"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import GameCanvas, { type GameCanvasProps } from "./GameCanvas";

/** Pixi owns a separate reconciler. Its Application destroys an already
 * initialised canvas during StrictMode's effect replay; a cached second launch
 * can initialise before that replay. Keep that renderer in its own React root,
 * with one explicit mount/unmount per world, in development and production. */
export function PixiWorldHost(props: GameCanvasProps) {
  const host = useRef<HTMLDivElement>(null), root = useRef<Root | null>(null);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
    root.current?.render(<GameCanvas {...props} />);
  });
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!host.current) return;
      const mounted = createRoot(host.current, { onUncaughtError: error => latest.current.onError?.(error) });
      root.current = mounted;
      mounted.render(<GameCanvas {...latest.current} />);
    });
    return () => {
      cancelAnimationFrame(frame);
      const old = root.current;
      root.current = null;
      // React must finish the outer commit before unmounting the renderer root.
      queueMicrotask(() => old?.unmount());
    };
  }, []);
  return <div className="relative h-full w-full" ref={host} />;
}
