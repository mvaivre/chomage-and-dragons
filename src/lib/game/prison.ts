import { mulberry32, seedFrom } from "@/lib/game/random";

export const PRISON_SIZE = 13;
const START = PRISON_SIZE + 1;
const LAST = PRISON_SIZE - 2;
const EXIT = LAST * PRISON_SIZE + LAST;
const KEYS = [PRISON_SIZE + LAST, LAST * PRISON_SIZE + 1];
export const PRISON_KEYS = KEYS.length;
export const PRISON_PATH_LIMIT = 4096;
export const PRISON_DIRECTIONS = { u: [0, -1], l: [-1, 0], d: [0, 1], r: [1, 0] } as const;
export type PrisonDirection = keyof typeof PRISON_DIRECTIONS;

export interface PrisonMaze {
  open: boolean[];
  exit: number;
  keys: number[];
}

export interface PrisonRun {
  cell: number;
  keys: number;
}

export const prisonStart = (): PrisonRun => ({ cell: START, keys: 0 });

function neighbor(cell: number, dx: number, dy: number, distance: number) {
  const x = cell % PRISON_SIZE + dx * distance;
  const y = Math.floor(cell / PRISON_SIZE) + dy * distance;
  return x < 1 || y < 1 || x > LAST || y > LAST ? -1 : y * PRISON_SIZE + x;
}

/** Carve a fresh maze for each cast. Both keys and the exit are always reachable. */
export function prisonMaze(castId: string): PrisonMaze {
  const random = mulberry32(seedFrom(`prison:${castId}`));
  const open = Array<boolean>(PRISON_SIZE ** 2).fill(false);
  const stack = [START];
  open[START] = true;
  while (stack.length) {
    const current = stack[stack.length - 1];
    const choices = Object.values(PRISON_DIRECTIONS).filter(([dx, dy]) => {
      const cell = neighbor(current, dx, dy, 2);
      return cell >= 0 && !open[cell];
    });
    if (!choices.length) {
      stack.pop();
      continue;
    }
    const [dx, dy] = choices[Math.floor(random() * choices.length)];
    const next = neighbor(current, dx, dy, 2);
    open[neighbor(current, dx, dy, 1)] = true;
    open[next] = true;
    stack.push(next);
  }
  return { open, exit: EXIT, keys: KEYS };
}

export function prisonMove(maze: PrisonMaze, run: PrisonRun, direction: PrisonDirection): PrisonRun {
  const [dx, dy] = PRISON_DIRECTIONS[direction];
  const cell = neighbor(run.cell, dx, dy, 1);
  if (!maze.open[cell]) return run;
  const key = maze.keys.indexOf(cell);
  return { cell, keys: key === -1 ? run.keys : run.keys | (1 << key) };
}

export function prisonWon(maze: PrisonMaze, run: PrisonRun) {
  return run.cell === maze.exit && run.keys === (1 << maze.keys.length) - 1;
}

/** Replay the submitted moves on the server before opening the cage. */
export function solvedPrison(castId: string, path: unknown) {
  if (typeof path !== "string" || path.length > PRISON_PATH_LIMIT || !/^[uldr]+$/.test(path)) return false;
  const maze = prisonMaze(castId);
  let run = prisonStart();
  for (const direction of path) {
    const next = prisonMove(maze, run, direction as PrisonDirection);
    if (next === run) return false;
    run = next;
  }
  return prisonWon(maze, run);
}
