import type { GameState } from "./types";

/**
 * Where a game lives. The prototype keeps it in the browser; the group version
 * keeps it on the server and hands the device a copy. Both hide behind this
 * contract so the interface never knows the difference.
 */
export interface GameStore {
  load(): GameState;
  save(state: GameState): void;
  reset(): GameState;
}
