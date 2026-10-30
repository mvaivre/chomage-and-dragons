import type { ComponentType } from "react";
import type { GameCanvasProps } from "../game/GameCanvas";
export interface WorldProps extends GameCanvasProps {
  journeyRevision: string;
  initialExploreCenter?: number | null;
  onError?: (error: unknown) => void;
}
export interface WorldModule {
  default: ComponentType<WorldProps>;
  releaseWorld: () => Promise<void>;
  worldResources: () => Record<string, number>;
}
