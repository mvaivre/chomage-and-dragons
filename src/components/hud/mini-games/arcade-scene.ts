import {
  ARCADE,
  CUT,
  MAZE_MAP,
  PONG,
  RACE,
  SNAKE,
  STACK,
  stackGhostY,
  racePosition,
  type ArcadeSim,
} from "@/lib/game/arcade";
import type { VoxelPainter } from "@/components/voxel/arena";
const GOLD = 0xe2bd75,
  TEAL = 0x86baa2,
  CREAM = 0xe7d9b8;
const COLORS = [
  0x7db3ab, 0xd4b174, 0xa99cba, 0x8eb58a, 0xc58e84, 0x84a3b4, 0xd3a277,
];
export function drawArcade(
  ctx: VoxelPainter,
  sim: ArcadeSim,
  now: number,
  calm: boolean,
) {
  ctx.background(ARCADE.width, ARCADE.height);
  const t = calm ? 0 : now;
  switch (sim.kind) {
    case "pigeonRace": {
      for (let lane = 0; lane < 3; lane++) {
        ctx.block(
          lane === sim.lane ? 0x466a5a : 0x344e45,
          180,
          106 + lane * 61,
          335,
          45,
          5,
          -5,
        );
        for (let i = 0; i < 12; i++)
          ctx.block(
            0x9caa7c,
            (i * 36 - sim.distance * 0.15) % 400,
            130 + lane * 61,
            11,
            1,
            2,
            0,
          );
      }
      sim.rivals.forEach((distance, i) =>
        ctx.bird(
          Math.max(28, Math.min(328, 90 + (distance - sim.distance) * 0.36)),
          105 + i * 122,
          0.72,
          i ? 0xae95b4 : 0x9caea1,
          t,
        ),
      );
      for (const hazard of sim.hazards) {
        const x = 90 + (hazard.x - sim.distance) * 0.48;
        if (x < -40 || x > 400) continue;
        ctx.block(0x9b6754, x, 106 + hazard.lane * 61, 30, 46, 19, 5);
        ctx.text("!", x, 106 + hazard.lane * 61, 24);
      }
      const finishX = 90 + (RACE.length - sim.distance) * 0.48;
      if (finishX < 380)
        for (let y = 77; y < 265; y += 12)
          for (let x = 0; x < 2; x++)
            ctx.block(
              ((y - 77) / 12 + x) % 2 ? CREAM : 0x2c4137,
              finishX + x * 9,
              y,
              9,
              12,
              3,
              4,
            );
      ctx.bird(
        90,
        106 + sim.lane * 61,
        1.05,
        sim.slow > 0 ? 0xd18d80 : CREAM,
        t,
      );
      if (sim.boost > 0)
        for (let i = 0; i < 3; i++)
          ctx.line(
            119,
            98 + sim.lane * 61 + i * 7,
            150,
            98 + sim.lane * 61 + i * 7,
            GOLD,
            2,
          );
      ctx.text("POSTE AÉRIENNE · SENS INTERDIT", 180, 23, 10);
      break;
    }
    case "paperCut": {
      ctx.text("SERVICE DE DESTRUCTION DES DOSSIERS", 180, 23, 10);
      for (const paper of sim.papers) {
        if (paper.cut) continue;
        if (paper.bomb) {
          ctx.coin(paper.x, paper.y, 19, 0xb67670);
          ctx.text("ORP", paper.x, paper.y, 10);
        } else ctx.paper(paper.x, paper.y, 34, 46);
      }
      for (let i = 1; i < sim.trail.length; i++)
        ctx.line(
          sim.trail[i - 1].x,
          sim.trail[i - 1].y,
          sim.trail[i].x,
          sim.trail[i].y,
          TEAL,
          3,
          13,
        );
      ctx.line(
        sim.blade.x - 12,
        sim.blade.y,
        sim.blade.x + 12,
        sim.blade.y,
        GOLD,
        2,
        15,
      );
      ctx.line(
        sim.blade.x,
        sim.blade.y - 12,
        sim.blade.x,
        sim.blade.y + 12,
        GOLD,
        2,
        15,
      );
      if (sim.combo > 1) ctx.text(`COMBO ×${sim.combo}`, 180, 47, 15);
      break;
    }
    case "snake": {
      const size = 18,
        ox = 18,
        oy = 26;
      ctx.text("LA FILE D’ATTENTE S’ALLONGE", 180, 12, 10);
      for (let y = 0; y < SNAKE.rows; y++)
        for (let x = 0; x < SNAKE.columns; x++)
          ctx.block(
            (x + y) % 2 ? 0x385447 : 0x3d594b,
            ox + x * size + 9,
            oy + y * size + 9,
            17.5,
            17.5,
            3,
            -2,
          );
      ctx.paper(
        ox + sim.food.x * size + 9,
        oy + sim.food.y * size + 9,
        14,
        11,
        GOLD,
      );
      [...sim.body].reverse().forEach((cell, i) => {
        const head = i === sim.body.length - 1;
        ctx.block(
          head ? CREAM : TEAL,
          ox + cell.x * size + 9,
          oy + cell.y * size + 9,
          16,
          16,
          head ? 13 : 9,
          5,
        );
        if (head) {
          ctx.block(
            0x2d4337,
            ox + cell.x * size + 5,
            oy + cell.y * size + 5,
            3,
            3,
            2,
            13,
          );
          ctx.block(
            0x2d4337,
            ox + cell.x * size + 12,
            oy + cell.y * size + 5,
            3,
            3,
            2,
            13,
          );
        }
      });
      break;
    }
    case "maze": {
      const size = 23,
        ox = 7.5,
        oy = 13.5;
      MAZE_MAP.forEach((row, y) =>
        [...row].forEach((tile, x) => {
          if (tile === "#") {
            ctx.block(
              0x6b7c68,
              ox + (x + 0.5) * size,
              oy + (y + 0.5) * size,
              22,
              22,
              15,
              3,
            );
            ctx.block(
              0x899678,
              ox + (x + 0.5) * size,
              oy + (y + 0.5) * size,
              18,
              18,
              2,
              11,
            );
          }
        }),
      );
      for (const p of sim.pellets)
        ctx.coin(ox + (p.x + 0.5) * size, oy + (p.y + 0.5) * size, 2.5);
      for (const p of sim.powers)
        ctx.coin(ox + (p.x + 0.5) * size, oy + (p.y + 0.5) * size, 6, TEAL);
      sim.ghosts.forEach((ghost, i) => {
        const x = ox + (ghost.x + 0.5) * size,
          y = oy + (ghost.y + 0.5) * size;
        ctx.block(
          sim.powered > 0 ? 0x7b9cad : i ? 0xb98c9d : 0xa89bbb,
          x,
          y,
          16,
          18,
          12,
          8,
        );
        for (const dx of [-4, 4]) ctx.block(CREAM, x + dx, y - 2, 4, 5, 2, 15);
      });
      ctx.block(
        sim.powered > 0 ? TEAL : GOLD,
        ox + (sim.player.x + 0.5) * size,
        oy + (sim.player.y + 0.5) * size,
        17,
        17,
        13,
        9,
      );
      break;
    }
    case "stack": {
      ctx.block(0x193b32, 138, 140, 166, 262, 9, -4);
      sim.board.forEach((row, y) =>
        row.forEach((cell, x) => {
          ctx.block(
            cell ? COLORS[cell - 1] : 0x2d4e40,
            66 + x * 16,
            20 + y * 16,
            14.8,
            14.8,
            cell ? 10 : 2,
            cell ? 5 : 0,
          );
        }),
      );
      const draw = (y: number, ghost: boolean) =>
        sim.piece.cells.forEach((p) =>
          ctx.block(
            ghost ? 0x6a8268 : COLORS[sim.piece.type],
            66 + (p.x + sim.piece.x) * 16,
            20 + (p.y + y) * 16,
            ghost ? 10 : 14.8,
            ghost ? 10 : 14.8,
            ghost ? 2 : 11,
            ghost ? 1 : 9,
          ),
        );
      draw(stackGhostY(sim), true);
      draw(sim.piece.y, false);
      ctx.text("SUIVANT", 281, 37, 10);
      ctx.text(`${sim.lines} / ${STACK.target}`, 281, 132, 24);
      ctx.text("LIGNES", 281, 157, 10);
      break;
    }
    case "pong": {
      ctx.line(14, 140, 346, 140, 0x6c8b74, 1);
      ctx.block(0x7f9275, 5, 140, 4, 250, 12, 0);
      ctx.block(0x7f9275, 355, 140, 4, 250, 12, 0);
      ctx.text(String(sim.opponentPoints), 180, 96, 40, "#91a18a");
      ctx.text(String(sim.playerPoints), 180, 185, 40, "#91a18a");
      ctx.block(0xb79cac, sim.opponent, PONG.opponentY - 4, 70, 8, 15, 7);
      ctx.block(TEAL, sim.player, PONG.playerY + 4, 70, 8, 15, 7);
      ctx.paper(sim.ball.x, sim.ball.y, 12, 12, GOLD);
      ctx.text("RECRUTEUR", 180, 10, 8);
      ctx.text("TOI", 180, 272, 8);
      break;
    }
  }
}

export function arcadeHud(sim: ArcadeSim): string {
  switch (sim.kind) {
    case "pigeonRace":
      return `#${racePosition(sim)} · ${Math.round((sim.distance / RACE.length) * 100)} % · ${Math.max(0, sim.lives)} plumes`;
    case "paperCut":
      return `${sim.cut}/${CUT.target} dossiers · ${Math.max(0, sim.lives)} vies`;
    case "snake":
      return `${sim.eaten}/${SNAKE.target} lettres · ${sim.body.length} maillons`;
    case "maze":
      return `${sim.eaten}/${sim.target} pièces · ${Math.max(0, sim.lives)} vies${sim.powered > 0 ? " · Potion !" : ""}`;
    case "stack":
      return `${sim.lines}/${STACK.target} lignes · ${sim.points} points`;
    case "pong":
      return `Toi ${sim.playerPoints} — ${sim.opponentPoints} Recruteur`;
  }
}
