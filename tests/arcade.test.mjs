import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  if (context.parentURL?.endsWith('.ts') && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const arcade = await import('../src/lib/game/arcade.ts');
const { SCORE_CAPS, clampScore } = await import('../src/lib/game/scores.ts');
const { MINI_GAMES, miniGameForAction } = await import('../src/lib/game/mini-games.ts');
const { DAILY_GAMES, LEGACY_DAILY_GAMES, ARCADE_DAILY_FROM, dailyChallenge } = await import('../src/lib/game/daily.ts');
const { seedFrom, mulberry32 } = await import('../src/lib/game/random.ts');
const {
  RACE, CUT, SNAKE, MAZE, STACK, PONG, MAZE_MAP,
  createRace, boostRace, steerRace, stepRace, racePosition,
  createCut, slicePapers, stepCut, segmentDistance,
  createSnake, turnSnake, stepSnake,
  createMaze, turnMaze, stepMaze, mazeWalkable,
  createStack, stackFits, moveStack, rotateStack, dropStack, stepStack,
  createPong, movePong, stepPong, createArcade, stepArcade, arcadeScore,
} = arcade;
const kinds = ['pigeonRace', 'paperCut', 'snake', 'maze', 'stack', 'pong'];
const snapshot = sim => JSON.parse(JSON.stringify(sim));
function advance(step, sim, duration, dt = 1 / 60) {
  for (let t = 0; t < duration && sim.status === 'running'; t += dt) step(sim, dt);
}

test('all six challenges have deterministic courses, score limits, action rotations and daily access', () => {
  for (const kind of kinds) {
    const a = createArcade(kind, 812), b = createArcade(kind, 812);
    assert.deepEqual(snapshot(a), snapshot(b), kind);
    advance(stepArcade, a, 1); advance(stepArcade, b, 1);
    assert.deepEqual(snapshot(a), snapshot(b), `${kind} advances deterministically`);
    assert.ok(MINI_GAMES[kind].title.length > 0);
    assert.ok(DAILY_GAMES.includes(kind));
    assert.ok(arcadeScore(a) >= 0 && arcadeScore(a) <= SCORE_CAPS[kind]);
    assert.equal(clampScore(kind, 1e12), SCORE_CAPS[kind]);
  }
  assert.deepEqual(Array.from({ length: 5 }, (_, i) => miniGameForAction('candidature', i)), ['pigeon', 'keywords', 'dragon', 'pigeonRace', 'paperCut']);
  assert.deepEqual(Array.from({ length: 2 }, (_, i) => miniGameForAction('refus', i)), ['stamp', 'stack']);
  assert.deepEqual(Array.from({ length: 2 }, (_, i) => miniGameForAction('entretien', i)), ['quiz', 'pong']);
  assert.deepEqual(Array.from({ length: 3 }, (_, i) => miniGameForAction('rejetApresEntretien', i)), ['ghosting', 'snake', 'maze']);
  const selected = new Set(Array.from({ length: 365 }, (_, i) => dailyChallenge(`2027-${i}`, 'friends').kind));
  assert.ok(kinds.every(kind => selected.has(kind)));
});

test('expanding daily games preserves every legacy day and the already played launch day', () => {
  assert.equal(ARCADE_DAILY_FROM, '2026-10-09');
  for (const day of ['2026-01-01', '2026-09-30', '2026-10-07', '2026-10-08']) for (const group of ['groupe', 'friends', 'ma-compagnie']) {
    const random = mulberry32(seedFrom(`daily:${group}:${day}`));
    const legacy = LEGACY_DAILY_GAMES[Math.floor(random() * LEGACY_DAILY_GAMES.length)];
    assert.equal(dailyChallenge(day, group).kind, legacy);
  }
});

test('pigeon races are winnable at mobile and desktop speeds by changing lanes and timing turbo', () => {
  for (let seed = 0; seed < 30; seed++) for (const dt of [1 / 20, 1 / 60]) {
    const sim = createRace(seed);
    for (let frames = 0; frames < 2000 && sim.status === 'running'; frames++) {
      const hazards = sim.hazards.filter(h => !h.hit && h.x >= sim.distance && h.x - sim.distance < 55);
      const safe = [sim.lane, 0, 1, 2].find(lane => !hazards.some(h => h.lane === lane));
      if (safe !== undefined) steerRace(sim, safe - sim.lane);
      boostRace(sim); stepRace(sim, dt);
    }
    assert.equal(sim.status, 'won', `seed ${seed}, ${dt}`);
    assert.equal(racePosition(sim), 1); assert.equal(sim.distance, RACE.length);
    assert.ok(arcadeScore(sim) <= SCORE_CAPS.pigeonRace);
  }
  const idle = createRace(8); advance(stepRace, idle, 30);
  assert.equal(idle.status, 'lost');
});

test('race collisions consume feathers, turbo has a cooldown, and lane controls remain bounded', () => {
  const sim = createRace(1);
  assert.equal(boostRace(sim), true); assert.equal(boostRace(sim), false);
  for (let i = 0; i < 8; i++) steerRace(sim, -1); assert.equal(sim.lane, 0);
  sim.hazards = [{ x: 5, lane: 0, hit: false }]; stepRace(sim, .1);
  assert.equal(sim.lives, RACE.lives - 1); assert.ok(sim.slow > 0);
  sim.lives = 1; sim.hazards.push({ x: sim.distance + 1, lane: 0, hit: false }); stepRace(sim, .1);
  assert.equal(sim.status, 'lost'); const before = snapshot(sim);
  steerRace(sim, 1); boostRace(sim); stepRace(sim, .1); assert.deepEqual(snapshot(sim), before);
});

test('paper slicing uses continuous swipe collision, rejects repeat cuts and penalizes red seals', () => {
  assert.equal(segmentDistance({ x: 80, y: 60 }, { x: 0, y: 60 }, { x: 160, y: 60 }), 0);
  const sim = createCut(4);
  sim.papers = [{ id: 1, x: 100, y: 90, vx: 0, vy: 0, rotation: 0, bomb: false, cut: false }];
  assert.equal(slicePapers(sim, { x: 0, y: 90 }, { x: 200, y: 90 }), 1);
  assert.equal(slicePapers(sim, { x: 0, y: 90 }, { x: 200, y: 90 }), 0);
  assert.equal(sim.cut, 1);
  sim.papers.push({ id: 2, x: 240, y: 90, vx: 0, vy: 0, rotation: 0, bomb: true, cut: false });
  slicePapers(sim, { x: 240, y: 80 }, { x: 240, y: 100 });
  assert.equal(sim.lives, CUT.lives - 2);
  sim.papers.push({ id: 3, x: 240, y: 335, vx: 0, vy: 20, rotation: 0, bomb: false, cut: false }); stepCut(sim, .05);
  assert.equal(sim.lives, CUT.lives - 3, 'missed papers cost a life');
});

test('paper challenges can be completed with real swipe inputs across varied seeds', () => {
  for (let seed = 0; seed < 20; seed++) {
    const sim = createCut(seed);
    for (let frame = 0; frame < 2000 && sim.status === 'running'; frame++) {
      stepCut(sim, 1 / 30);
      for (const paper of sim.papers.filter(p => !p.bomb && !p.cut && p.y < 240 && p.y > 35)) {
        if (sim.papers.some(p => p.bomb && !p.cut && Math.hypot(p.x - paper.x, p.y - paper.y) < 48)) continue;
        slicePapers(sim, { x: paper.x - 9, y: paper.y }, { x: paper.x + 9, y: paper.y });
      }
    }
    assert.equal(sim.status, 'won', `seed ${seed}`); assert.ok(sim.cut >= CUT.target);
    assert.ok(arcadeScore(sim) <= SCORE_CAPS.paperCut);
  }
});

test('snake forbids reverse turns, grows on food, wins and collides with its own body or walls', () => {
  const sim = createSnake(2);
  turnSnake(sim, 'left'); assert.equal(sim.queued, 'right');
  turnSnake(sim, 'up'); turnSnake(sim, 'left'); assert.equal(sim.queued, 'up', 'two keypresses cannot reverse before one step');
  turnSnake(sim, 'right');
  for (let i = 0; i < SNAKE.target; i++) { sim.food = { x: sim.body[0].x + 1, y: sim.body[0].y }; advance(stepSnake, sim, .18); }
  assert.equal(sim.status, 'won'); assert.equal(sim.body.length, SNAKE.target + 3);
  const idle = createSnake(5); advance(stepSnake, idle, 5); assert.equal(idle.status, 'lost');
  const tangled = createSnake(6);
  tangled.body = [{ x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 2 }, { x: 1, y: 2 }];
  tangled.direction = 'up'; turnSnake(tangled, 'left'); advance(stepSnake, tangled, .2); assert.equal(tangled.status, 'lost');
});

test('snake food always appears on a free cell and moving into a departing tail is legal', () => {
  for (let seed = 0; seed < 200; seed++) { const sim = createSnake(seed); assert.ok(!sim.body.some(p => p.x === sim.food.x && p.y === sim.food.y)); }
  const sim = createSnake(0);
  sim.body = [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 2 }]; sim.direction = 'up'; sim.food = { x: 17, y: 12 };
  turnSnake(sim, 'left'); advance(stepSnake, sim, .18); assert.equal(sim.status, 'running'); assert.deepEqual(sim.body[0], { x: 1, y: 2 });
});

test('ten real seeded snake letters can be collected comfortably within the timer', () => {
  for (let seed = 0; seed < 50; seed++) {
    const sim = createSnake(seed);
    while (sim.status === 'running') {
      const queue = [{ ...sim.body[0], first: null }], seen = new Set([`${sim.body[0].x}:${sim.body[0].y}`]);
      let direction;
      for (let i = 0; i < queue.length; i++) {
        const cell = queue[i];
        if (cell.x === sim.food.x && cell.y === sim.food.y) { direction = cell.first; break; }
        for (const [dir, [dx, dy]] of Object.entries(dirVectors)) {
          const next = { x: cell.x + dx, y: cell.y + dy }, key = `${next.x}:${next.y}`;
          if (next.x < 0 || next.x >= SNAKE.columns || next.y < 0 || next.y >= SNAKE.rows || seen.has(key) || sim.body.slice(0, -1).some(p => p.x === next.x && p.y === next.y)) continue;
          seen.add(key); queue.push({ ...next, first: cell.first ?? dir });
        }
      }
      assert.ok(direction, `food is reachable for seed ${seed}`); turnSnake(sim, direction);
      const previous = sim.body[0]; while (sim.status === 'running' && sim.body[0] === previous) stepSnake(sim, .02);
    }
    assert.equal(sim.status, 'won', `seed ${seed}`); assert.ok(sim.t < 30, `seed ${seed} needs ${sim.t}s`);
  }
});

const dirVectors = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
function mazePath(start, goal) {
  const queue = [{ ...start, path: [] }], seen = new Set([`${start.x}:${start.y}`]);
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i]; if (cell.x === goal.x && cell.y === goal.y) return cell.path;
    for (const [dir, [dx, dy]] of Object.entries(dirVectors)) {
      const next = { x: cell.x + dx, y: cell.y + dy }, key = `${next.x}:${next.y}`;
      if (mazeWalkable(next) && !seen.has(key)) { seen.add(key); queue.push({ ...next, path: [...cell.path, dir] }); }
    }
  }
  return null;
}
test('the maze has no unreachable treasures and collecting every corridor completes it', () => {
  assert.ok(MAZE_MAP.every(row => row.length === MAZE.columns));
  const sim = createMaze(11); sim.ghosts = [];
  for (const pellet of [...sim.pellets, ...sim.powers]) assert.ok(mazePath(sim.player, pellet), `unreachable ${JSON.stringify(pellet)}`);
  while (sim.status === 'running') {
    const target = [...sim.pellets, ...sim.powers].sort((a, b) => mazePath(sim.player, a).length - mazePath(sim.player, b).length)[0];
    if (!target) break;
    for (const dir of mazePath(sim.player, target)) { turnMaze(sim, dir); stepMaze(sim, .075); stepMaze(sim, .075); }
  }
  assert.equal(sim.status, 'won'); assert.equal(sim.eaten, sim.target); assert.ok(sim.t < MAZE.duration);
});

test('maze walls block movement, ghost collisions cost one life, and potions reverse the hunt', () => {
  const sim = createMaze(4); turnMaze(sim, 'up'); advance(stepMaze, sim, .15);
  assert.notEqual(MAZE_MAP[sim.player.y][sim.player.x], '#');
  sim.player = { x: 1, y: 1 }; sim.direction = 'up'; sim.queued = 'up'; sim.immune = 0; sim.ghosts = [{ x: 1, y: 1 }];
  advance(stepMaze, sim, .15); assert.equal(sim.lives, MAZE.lives - 1); assert.ok(sim.immune > 0);
  advance(stepMaze, sim, .15); assert.equal(sim.lives, MAZE.lives - 1, 'respawn immunity avoids repeated damage');
  sim.player = { x: 1, y: 3 }; sim.direction = 'left'; sim.queued = 'left'; sim.ghosts = []; advance(stepMaze, sim, .15);
  assert.ok(sim.powered > 0);
  sim.ghosts = [{ ...sim.player }]; sim.immune = 0; advance(stepMaze, sim, .15);
  assert.equal(sim.lives, MAZE.lives - 1); assert.deepEqual(sim.ghosts[0], { x: 13, y: 9 });
});

test('the real maze ghosts can be beaten by collecting potions and avoiding their corridors', () => {
  function nearest(sim, safe, onlyPower = false) {
    const targets = new Set((onlyPower ? sim.powers : [...sim.pellets, ...sim.powers]).map(p => `${p.x}:${p.y}`));
    const queue = [{ ...sim.player, path: [] }], seen = new Set([`${sim.player.x}:${sim.player.y}`]);
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i]; if (cell.path.length && targets.has(`${cell.x}:${cell.y}`)) return cell.path;
      for (const [dir, [dx, dy]] of Object.entries(dirVectors)) {
        const next = { x: cell.x + dx, y: cell.y + dy }, key = `${next.x}:${next.y}`;
        if (!mazeWalkable(next) || seen.has(key)) continue;
        if (safe && sim.powered <= 0 && sim.immune <= 0 && sim.ghosts.some(g => Math.abs(g.x - next.x) + Math.abs(g.y - next.y) <= 1)) continue;
        seen.add(key); queue.push({ ...next, path: [...cell.path, dir] });
      }
    }
    return null;
  }
  let wins = 0;
  for (let seed = 0; seed < 30; seed++) {
    const sim = createMaze(seed);
    while (sim.status === 'running') {
      const power = sim.powered < 1.5 ? nearest(sim, true, true) : null;
      const path = power && power.length < 12 ? power : nearest(sim, true) ?? nearest(sim, false);
      if (path?.[0]) turnMaze(sim, path[0]);
      stepMaze(sim, .075); stepMaze(sim, .075);
    }
    if (sim.status === 'won') { wins++; assert.ok(sim.t < MAZE.duration); }
  }
  assert.ok(wins >= 27, `a simple potion strategy wins ${wins}/30 real mazes`);
});

test('falling dossiers use a seeded seven-piece bag, wall bounds, rotation and hard drop', () => {
  const sim = createStack(36), types = [sim.piece.type, sim.next];
  for (let i = 0; i < 5; i++) { dropStack(sim); types.push(sim.next); }
  assert.equal(new Set(types).size, 7);
  const left = createStack(7); for (let i = 0; i < 20; i++) moveStack(left, -1);
  assert.ok(stackFits(left, left.piece)); assert.equal(moveStack(left, -1), false);
  for (let i = 0; i < 4; i++) rotateStack(left); assert.ok(stackFits(left, left.piece));
  dropStack(left); assert.equal(left.pieces, 1); assert.equal(left.board.flat().filter(Boolean).length, 4);
});

test('four completed dossier lines clear together, score, and end the challenge', () => {
  const sim = createStack(5);
  for (let y = STACK.rows - 4; y < STACK.rows; y++) sim.board[y] = Array.from({ length: STACK.columns }, (_, x) => x === 4 ? 0 : 1);
  sim.piece = { type: 0, x: 4, y: 0, cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }] };
  dropStack(sim);
  assert.equal(sim.status, 'won'); assert.equal(sim.lines, 4); assert.ok(sim.points >= 800);
  assert.equal(sim.board.flat().filter(Boolean).length, 0); assert.ok(arcadeScore(sim) <= SCORE_CAPS.stack);
  const before = snapshot(sim); dropStack(sim); rotateStack(sim); stepStack(sim, .1); assert.deepEqual(snapshot(sim), before);
  const full = createStack(6);
  full.piece = { type: 1, x: 0, y: 0, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] };
  full.next = 0; full.board[2][0] = 1; full.board[2][1] = 1;
  for (let x = 3; x <= 6; x++) full.board[1][x] = 1;
  dropStack(full);
  assert.equal(full.status, 'lost');
});

test('pong bounces off walls and paddle edges; missing the paddle awards a point exactly once', () => {
  const sim = createPong(0); sim.serve = 0; sim.ball = { x: 348, y: 140 }; sim.vx = 200; sim.vy = 100; stepPong(sim, .05);
  assert.ok(sim.vx < 0); assert.ok(sim.ball.x <= 350);
  sim.ball = { x: sim.player + 25, y: PONG.playerY - 10 }; sim.vx = 0; sim.vy = 250; stepPong(sim, .05);
  assert.ok(sim.vy < 0); assert.ok(sim.vx > 0); assert.equal(sim.rallies, 1);
  sim.ball = { x: 10, y: 285 }; sim.vx = 0; sim.vy = 200; stepPong(sim, .1);
  assert.equal(sim.opponentPoints, 1); assert.ok(sim.serve > 0); stepPong(sim, .1); assert.equal(sim.opponentPoints, 1);
  movePong(sim, -1000); assert.ok(sim.player >= PONG.paddleWidth / 2);
  movePong(sim, 1000); assert.ok(sim.player <= 360 - PONG.paddleWidth / 2);
});

test('pong ends at five points or on the clock, with a frozen terminal score', () => {
  const sim = createPong(7); sim.serve = 0; sim.playerPoints = 4; sim.ball = { x: 10, y: -8 }; sim.vx = 0; sim.vy = -200;
  stepPong(sim, .1); assert.equal(sim.playerPoints, 5); assert.equal(sim.status, 'won');
  const before = snapshot(sim); stepPong(sim, .1); movePong(sim, 20); assert.deepEqual(snapshot(sim), before);
  const timed = createPong(1); timed.t = PONG.duration - .05; timed.playerPoints = 1; timed.opponentPoints = 0;
  stepPong(timed, .1); assert.equal(timed.status, 'won');
  assert.ok(arcadeScore(sim) <= SCORE_CAPS.pong);
});

test('aiming pong returns off paddle edges can beat the real opponent at varied frame rates', () => {
  for (let seed = 0; seed < 30; seed++) for (const dt of [1 / 20, 1 / 60]) {
    const sim = createPong(seed);
    while (sim.status === 'running') {
      // Move through the public pointer input; aim away from the opponent at impact.
      const offset = sim.opponent < 180 ? 28 : -28;
      movePong(sim, sim.ball.x - offset); stepPong(sim, dt);
    }
    assert.equal(sim.status, 'won', `seed ${seed}, ${dt}`);
  }
});

test('every unattended challenge terminates, and malformed time cannot corrupt a run', () => {
  for (const kind of kinds) {
    const sim = createArcade(kind, 93); const before = sim.t;
    stepArcade(sim, NaN); stepArcade(sim, -100); assert.equal(sim.t, before);
    advance(stepArcade, sim, 90, .1); assert.notEqual(sim.status, 'running', kind);
    const ended = snapshot(sim); stepArcade(sim, .1); assert.deepEqual(snapshot(sim), ended);
  }
});
