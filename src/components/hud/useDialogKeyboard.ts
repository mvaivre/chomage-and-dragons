"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/** Route an active modal's keys independently of which of its controls has focus. */
export function useDialogKeyboard(scope: RefObject<HTMLElement | null>, onKeyDown?: (event: KeyboardEvent) => void) {
  const handler = useRef(onKeyDown);
  useLayoutEffect(() => { handler.current = onKeyDown; });

  useLayoutEffect(() => {
    const route = (event: KeyboardEvent) => {
      const dialog = scope.current?.closest("dialog");
      if (!dialog?.open || dialog !== [...document.querySelectorAll("dialog[open]")].at(-1)) return;
      // A canvas, a disabled start button or the dialog itself may own focus. Listen
      // before React's element handlers so the first arrow still reaches the game.
      handler.current?.(event);
      event.stopPropagation();
    };
    window.addEventListener("keydown", route, true);
    return () => window.removeEventListener("keydown", route, true);
  }, [scope]);
}
