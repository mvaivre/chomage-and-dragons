"use client";

import { useLayoutEffect, type RefObject } from "react";
import type { Container } from "pixi.js";
import type { EnvironmentTarget } from "./environment-targets";

type NodeRef = RefObject<Container | null>;
export interface ViewportResident {
  id: string; kind: string; body: NodeRef; target?: RefObject<EnvironmentTarget>;
  shadow?: NodeRef; accent?: NodeRef;
}
export const viewportResidents = new Map<string, ViewportResident>();

/** Register the whole character, including contact shadow and reaction accents. */
export function useViewportResident(id: string, kind: string, body: NodeRef, target?: RefObject<EnvironmentTarget>, shadow?: NodeRef, accent?: NodeRef) {
  useLayoutEffect(() => {
    const resident = { id, kind, body, target, shadow, accent };
    viewportResidents.set(id, resident);
    return () => {
      if (viewportResidents.get(id) === resident) viewportResidents.delete(id);
      for (const ref of [body, shadow, accent]) if (ref?.current && !ref.current.destroyed) ref.current.renderable = true;
    };
  }, [id, kind, body, target, shadow, accent]);
}
