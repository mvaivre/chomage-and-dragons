import {
  ARCADE, CUT, MAZE_MAP, PONG, RACE, SNAKE, STACK, STACK_SHAPES, racePosition, stackGhostY,
  type ArcadeSim, type FallingPiece,
} from "@/lib/game/arcade";

const GOLD = "#f1c66c", INK = "#0a1822", CREAM = "#fff1cf", TEAL = "#81dbcf";
const BLOCKS = ["#77ceca", "#e4bf70", "#a998dc", "#8dcb8c", "#df8a85", "#82aadd", "#e7a873"];
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size = 12, color = CREAM, align: CanvasTextAlign = "center") {
  ctx.fillStyle = color; ctx.font = `bold ${size}px monospace`; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(value, x, y);
}
function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, radius = 4) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}
function background(ctx: CanvasRenderingContext2D, now: number, calm: boolean) {
  const gradient = ctx.createLinearGradient(0, 0, 360, 280); gradient.addColorStop(0, "#152c3b"); gradient.addColorStop(1, "#100e25");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, ARCADE.width, ARCADE.height);
  for (let i = 0; i < 24; i++) { ctx.globalAlpha = calm ? .22 : .17 + .1 * Math.sin(now / 1700 + i); box(ctx, (i * 79 + 13) % 360, (i * 47 + 19) % 280, 2, 2, GOLD, 0); }
  ctx.globalAlpha = 1;
}
function bird(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, now: number, inverted = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size, inverted ? -size : size);
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, 18, 11, -.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-13, -7, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(-20, -10); ctx.lineTo(-29, -5); ctx.lineTo(-20, -3); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-16, -9, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#476b86"; ctx.beginPath(); ctx.ellipse(4, -4, 15, 6 + Math.sin(now / 100) * 3, -.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(15, 2); ctx.lineTo(29, -8); ctx.lineTo(27, 9); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, 8); ctx.lineTo(-5, 18); ctx.moveTo(6, 8); ctx.lineTo(4, 18); ctx.stroke();
  ctx.restore();
}
function drawRace(ctx: CanvasRenderingContext2D, sim: Extract<ArcadeSim, { kind: "pigeonRace" }>, now: number) {
  // Clouds and distant rooftops remain behind the course and the rider.
  for (let i = 0; i < 7; i++) {
    const x = ((i * 93 - sim.distance * .08) % 480 + 480) % 480 - 60;
    box(ctx, x, 35 + (i % 3) * 14, 65, 14, "#ffffff0c", 12);
    box(ctx, x + 25, 26 + (i % 3) * 14, 30, 16, "#ffffff0c", 12);
  }
  for (let lane = 0; lane < 3; lane++) { box(ctx, 10, 82 + lane * 61, 340, 50, lane === sim.lane ? "#81dbcf12" : "#ffffff04", 8); ctx.setLineDash([4, 8]); ctx.strokeStyle = "#ffffff15"; ctx.beginPath(); ctx.moveTo(15, 137 + lane * 61); ctx.lineTo(345, 137 + lane * 61); ctx.stroke(); ctx.setLineDash([]); }
  sim.rivals.forEach((distance, index) => { const x = Math.max(28, Math.min(328, 90 + (distance - sim.distance) * .36)); bird(ctx, x, 105 + index * 122, .72, index ? "#ae95c4" : "#9caba9", now + index * 80, true); text(ctx, String(index + 2), x, 74 + index * 122, 9, "#ccd3d7"); });
  for (const hazard of sim.hazards) {
    const x = 90 + (hazard.x - sim.distance) * .48; if (x < -40 || x > 400) continue;
    const y = 106 + hazard.lane * 61;
    box(ctx, x - 15, y - 23, 30, 46, "#7c343e", 3); ctx.strokeStyle = "#e59c83"; ctx.lineWidth = 2; ctx.strokeRect(x - 11, y - 18, 22, 36);
    text(ctx, "!", x, y, 22, "#ffceb4");
  }
  const finishX = 90 + (RACE.length - sim.distance) * .48;
  if (finishX < 380) for (let y = 77; y < 265; y += 12) for (let x = 0; x < 2; x++) box(ctx, finishX + x * 9, y, 9, 12, ((y - 77) / 12 + x) % 2 ? CREAM : INK, 0);
  if (sim.boost > 0) { ctx.strokeStyle = GOLD; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(110, 97 + sim.lane * 61 + i * 8); ctx.lineTo(145 + i * 5, 97 + sim.lane * 61 + i * 8); ctx.stroke(); } }
  bird(ctx, 90, 106 + sim.lane * 61, 1.05, sim.slow > 0 ? "#db8b84" : "#e5ece8", now, true);
  text(ctx, "POSTE AÉRIENNE · SENS INTERDIT", 180, 22, 10, GOLD);
  text(ctx, `${Math.round(sim.distance / RACE.length * 100)} %`, 324, 259, 10, TEAL);
  text(ctx, `#${racePosition(sim)}`, 34, 259, 12, GOLD);
}
function drawCut(ctx: CanvasRenderingContext2D, sim: Extract<ArcadeSim, { kind: "paperCut" }>) {
  text(ctx, "SERVICE DE DESTRUCTION DES DOSSIERS", 180, 24, 10, GOLD);
  ctx.fillStyle = "#080d1799"; ctx.fillRect(0, 260, 360, 20);
  for (const paper of sim.papers) {
    ctx.save(); ctx.translate(paper.x, paper.y); ctx.rotate(paper.rotation);
    ctx.globalAlpha = paper.cut ? .22 : 1;
    if (paper.bomb) {
      ctx.fillStyle = "#aa4055"; ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#f3918b"; ctx.lineWidth = 2; ctx.stroke(); text(ctx, "ORP", 0, 0, 11);
      text(ctx, "×", 0, -24, 12, "#ff9d8b");
    } else {
      box(ctx, -17, -23, 34, 46, paper.cut ? "#acccbf" : "#efddbb", 2);
      box(ctx, -11, -13, 14, 4, "#6c7780", 0);
      for (let i = 0; i < 4; i++) box(ctx, -11, -3 + i * 6, 22 - (i % 2) * 5, 2, "#8e948b", 0);
      if (paper.cut) { ctx.strokeStyle = TEAL; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-24, 19); ctx.lineTo(24, -19); ctx.stroke(); }
    }
    ctx.restore();
  }
  if (sim.trail.length > 1) {
    ctx.strokeStyle = TEAL; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath();
    sim.trail.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.stroke();
  }
  ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sim.blade.x, sim.blade.y, 12, 0, Math.PI * 2); ctx.moveTo(sim.blade.x - 17, sim.blade.y); ctx.lineTo(sim.blade.x + 17, sim.blade.y); ctx.moveTo(sim.blade.x, sim.blade.y - 17); ctx.lineTo(sim.blade.x, sim.blade.y + 17); ctx.stroke();
  if (sim.combo > 1 && sim.t - sim.lastCut < 1) text(ctx, `COMBO ×${sim.combo}`, 180, 52, 16, TEAL);
}
function drawSnake(ctx: CanvasRenderingContext2D, sim: Extract<ArcadeSim, { kind: "snake" }>) {
  const size = 18, ox = 18, oy = 26;
  text(ctx, "LA FILE D’ATTENTE S’ALLONGE", 180, 12, 10, GOLD);
  box(ctx, ox - 3, oy - 3, SNAKE.columns * size + 6, SNAKE.rows * size + 6, "#71b1b32c", 3);
  for (let y = 0; y < SNAKE.rows; y++) for (let x = 0; x < SNAKE.columns; x++) box(ctx, ox + x * size, oy + y * size, size - 1, size - 1, (x + y) % 2 ? "#101e27" : "#12222d", 0);
  const fx = ox + sim.food.x * size, fy = oy + sim.food.y * size;
  box(ctx, fx + 2, fy + 3, 14, 11, GOLD, 2); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(fx + 3, fy + 4); ctx.lineTo(fx + 9, fy + 9); ctx.lineTo(fx + 15, fy + 4); ctx.stroke();
  [...sim.body].reverse().forEach((cell, i) => { const head = i === sim.body.length - 1; box(ctx, ox + cell.x * size + 1, oy + cell.y * size + 1, size - 2, size - 2, head ? CREAM : TEAL, head ? 5 : 3); if (head) { const dir = sim.direction; box(ctx, ox + cell.x * size + (dir === "left" ? 3 : 11), oy + cell.y * size + (dir === "up" ? 3 : 9), 3, 3, INK, 1); } });
}
function drawMaze(ctx: CanvasRenderingContext2D, sim: Extract<ArcadeSim, { kind: "maze" }>, now: number) {
  const size = 23, ox = 7.5, oy = 13.5;
  MAZE_MAP.forEach((row, y) => [...row].forEach((tile, x) => { if (tile !== "#") return; box(ctx, ox + x * size + 1, oy + y * size + 1, size - 2, size - 2, "#294453", 3); box(ctx, ox + x * size + 4, oy + y * size + 4, size - 8, 2, "#436575", 1); }));
  for (const p of sim.pellets) { ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(ox + (p.x + .5) * size, oy + (p.y + .5) * size, 2.5, 0, Math.PI * 2); ctx.fill(); }
  for (const p of sim.powers) { ctx.fillStyle = TEAL; ctx.beginPath(); ctx.arc(ox + (p.x + .5) * size, oy + (p.y + .5) * size, 7, 0, Math.PI * 2); ctx.fill(); text(ctx, "!", ox + (p.x + .5) * size, oy + (p.y + .5) * size, 9, INK); }
  sim.ghosts.forEach((ghost, i) => {
    const x = ox + (ghost.x + .5) * size, y = oy + (ghost.y + .5) * size;
    box(ctx, x - 8, y - 9, 16, 18, sim.powered > 0 ? "#708cbd" : i ? "#d6819a" : "#b39ae0", 7);
    box(ctx, x - 5, y - 3, 4, 5, CREAM, 1); box(ctx, x + 2, y - 3, 4, 5, CREAM, 1); box(ctx, x - 4, y - 1, 2, 3, INK, 0); box(ctx, x + 3, y - 1, 2, 3, INK, 0);
  });
  if (sim.immune > 0 && Math.floor(now / 130) % 2) ctx.globalAlpha = .45;
  const x = ox + (sim.player.x + .5) * size, y = oy + (sim.player.y + .5) * size;
  ctx.save(); ctx.translate(x, y); ctx.rotate(({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 })[sim.direction]);
  ctx.fillStyle = sim.powered > 0 ? TEAL : GOLD; ctx.beginPath(); const mouth = .15 + Math.abs(Math.sin(now / 80)) * .35; ctx.moveTo(0, 0); ctx.arc(0, 0, 9, mouth, Math.PI * 2 - mouth); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
}
function block(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, ghost = false) {
  if (ghost) { ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(x + 2, y + 2, 11, 11); return; }
  box(ctx, x + 1, y + 1, 14, 14, color, 2); box(ctx, x + 3, y + 3, 10, 2, "#ffffff55", 1); box(ctx, x + 3, y + 11, 10, 2, "#00000022", 1);
}
function drawStackPiece(ctx: CanvasRenderingContext2D, piece: FallingPiece, y: number, ghost = false) {
  piece.cells.forEach(p => block(ctx, 58 + (p.x + piece.x) * 16, 12 + (p.y + y) * 16, BLOCKS[piece.type], ghost));
}
function drawStack(ctx: CanvasRenderingContext2D, sim: Extract<ArcadeSim, { kind: "stack" }>) {
  box(ctx, 55, 9, 166, 262, "#689cb542", 4);
  box(ctx, 58, 12, 160, 256, "#07131d", 0);
  sim.board.forEach((row, y) => row.forEach((cell, x) => { if (cell) block(ctx, 58 + x * 16, 12 + y * 16, BLOCKS[cell - 1]); else { ctx.fillStyle = "#ffffff07"; ctx.fillRect(58 + x * 16, 12 + y * 16, 15, 15); } }));
  drawStackPiece(ctx, sim.piece, stackGhostY(sim), true); drawStackPiece(ctx, sim.piece, sim.piece.y);
  text(ctx, "SUIVANT", 281, 37, 10, GOLD);
  STACK_SHAPES[sim.next].forEach(p => block(ctx, 250 + p.x * 16, 56 + p.y * 16, BLOCKS[sim.next]));
  text(ctx, `${sim.lines} / ${STACK.target}`, 281, 132, 24, CREAM); text(ctx, "LIGNES", 281, 156, 10, GOLD);
  text(ctx, "CLASSEMENT", 281, 209, 9, "#a8b8bb"); text(ctx, "VERTICAL", 281, 225, 9, "#a8b8bb");
}
function drawPong(ctx: CanvasRenderingContext2D, sim: Extract<ArcadeSim, { kind: "pong" }>) {
  ctx.strokeStyle = "#88c1c735"; ctx.lineWidth = 2; ctx.setLineDash([4, 9]); ctx.beginPath(); ctx.moveTo(14, 140); ctx.lineTo(346, 140); ctx.stroke(); ctx.setLineDash([]);
  box(ctx, 4, 15, 3, 250, "#729eaa55", 0); box(ctx, 353, 15, 3, 250, "#729eaa55", 0);
  text(ctx, String(sim.opponentPoints), 180, 96, 42, "#c09bdb55"); text(ctx, String(sim.playerPoints), 180, 185, 42, "#81dbcf55");
  box(ctx, sim.opponent - 35, PONG.opponentY - 8, 70, 8, "#bd9bda", 4); box(ctx, sim.opponent - 31, PONG.opponentY - 7, 62, 2, "#ffffff55", 1);
  box(ctx, sim.player - 35, PONG.playerY, 70, 8, TEAL, 4); box(ctx, sim.player - 31, PONG.playerY + 1, 62, 2, "#ffffff77", 1);
  ctx.save(); ctx.translate(sim.ball.x, sim.ball.y); ctx.rotate(sim.t * 2); box(ctx, -6, -6, 12, 12, GOLD, 2); box(ctx, -3, -3, 6, 2, INK, 0); ctx.restore();
  text(ctx, "RECRUTEUR", 180, 9, 8, "#c5b1d8"); text(ctx, "TOI", 180, 272, 8, TEAL);
}
export function drawArcade(ctx: CanvasRenderingContext2D, sim: ArcadeSim, now: number, calm: boolean) {
  // Also clear the letterbox margins, preserving a continuous dark arena on tall screens.
  ctx.fillStyle = "#0d1824"; ctx.fillRect(-500, -500, 1360, 1280); background(ctx, now, calm);
  const motionTime = calm ? 0 : now;
  switch (sim.kind) {
    case "pigeonRace": drawRace(ctx, sim, motionTime); break;
    case "paperCut": drawCut(ctx, sim); break;
    case "snake": drawSnake(ctx, sim); break;
    case "maze": drawMaze(ctx, sim, motionTime); break;
    case "stack": drawStack(ctx, sim); break;
    case "pong": drawPong(ctx, sim); break;
  }
}

export function arcadeHud(sim: ArcadeSim): string {
  switch (sim.kind) {
    case "pigeonRace": return `#${racePosition(sim)} · ${Math.round(sim.distance / RACE.length * 100)} % · ${Math.max(0, sim.lives)} plumes`;
    case "paperCut": return `${sim.cut}/${CUT.target} dossiers · ${Math.max(0, sim.lives)} vies`;
    case "snake": return `${sim.eaten}/${SNAKE.target} lettres · ${sim.body.length} maillons`;
    case "maze": return `${sim.eaten}/${sim.target} pièces · ${Math.max(0, sim.lives)} vies${sim.powered > 0 ? " · Potion !" : ""}`;
    case "stack": return `${sim.lines}/${STACK.target} lignes · ${sim.points} points`;
    case "pong": return `Toi ${sim.playerPoints} — ${sim.opponentPoints} Recruteur`;
  }
}
