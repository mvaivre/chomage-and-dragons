/** Cosmetic simulation only. Nothing here changes journeys, scores or saves. */
export type Point = { x: number; y: number; z: number };
export type WalkingObstacle = Point & { radius?: number };
export type LifeBody = {
  home: Point;
  position: Point;
  velocity: Point;
  phase: number;
  mode: "walking" | "flying" | "recovering";
  age: number;
  cooldown: number;
  bounces: number;
  tumble: number;
  spin: number;
  hits: number;
  detour?: { obstacle: Point; side: number };
};
export const WALKERS = new Set([
  "hedgehog",
  "hen",
  "fox",
  "troll",
  "mushroom",
  "toad",
  "ghost",
  "otter",
  "heron",
  "goat",
  "yeti",
  "scarab",
  "skeleton",
  "innkeeper",
  "gnome",
  "crow",
  "spirit",
  "squirrel",
  "recruiter",
  "coach",
  "clerk",
  "worker",
  "traveller",
  "pigeon",
]);
export function createLifeBody(home: Point, phase: number): LifeBody {
  return {
    home: { ...home },
    position: { ...home },
    velocity: { x: 0, y: 0, z: 0 },
    phase,
    mode: "walking",
    age: 0,
    cooldown: 0,
    bounces: 0,
    tumble: 0,
    spin: 0,
    hits: 0,
  };
}
/** A slow loop with pauses at either end, rather than stationary marching. */
export function patrol(
  body: LifeBody,
  seconds: number,
  stationed = false,
  reduced = false,
): Point {
  if (reduced) return { ...body.home };
  const phase = seconds * (stationed ? 0.28 : 0.36) + body.phase;
  const turn = Math.sin(phase),
    ease = Math.sign(turn) * Math.min(1, Math.abs(turn) * 1.25);
  return {
    x: body.home.x + ease * (stationed ? 0.28 : 2.1),
    y: body.home.y,
    z:
      body.home.z +
      (stationed
        ? Math.sin(phase * 0.7) * 0.12
        : (0.5 + 0.5 * Math.sin(phase * 0.73 + 1.2)) * 3.5),
  };
}
export function segmentDistance(a: Point, b: Point, p: Point) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    l = dx * dx + dz * dz;
  const t = l
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l))
    : 0;
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}
/** First entry into a horizontal circle, as a fraction of the whole movement. */
function circleEntry(x: number, z: number, dx: number, dz: number, p: Point, radius: number) {
  const ox = x - p.x, oz = z - p.z, a = dx * dx + dz * dz;
  if (a < 1e-12) return Infinity;
  const b = ox * dx + oz * dz, c = ox * ox + oz * oz - radius * radius;
  if (c < -1e-8) return 0;
  if (b >= 0) return Infinity;
  const d = b * b - a * c;
  if (d <= 0) return Infinity;
  const t = (-b - Math.sqrt(d)) / a;
  return t >= 0 && t < 1 ? t : Infinity;
}
/** Local circle steering, not game-rule movement. Impact/launch is evaluated first
 * by the caller. A stable tangent side avoids jitter; a swept guard prevents
 * tunnelling at low FPS or into a second nearby hero. */
export function walkAround(body: LifeBody, goal: Point, dt: number, obstacles: readonly WalkingObstacle[], clearance = 1.1,
  minZ = -Infinity, maxZ = Infinity, immediate = false) {
  if (body.mode !== "walking" || dt <= 0) return;
  const p = body.position;
  let gx = goal.x, gz = Math.max(minZ, Math.min(maxZ, goal.z));
  // A spawn/landing may already overlap a hero. Resolve that once, with a finite
  // deterministic direction even when both centres are exactly identical.
  for (let pass = 0; pass < 3; pass++) for (const obstacle of obstacles) {
    if (Math.abs(p.y - obstacle.y) >= 1.1) continue;
    const radius = clearance + (obstacle.radius ?? 0) + .001;
    let nx = p.x - obstacle.x, nz = p.z - obstacle.z, distance = Math.hypot(nx, nz);
    if (distance >= radius) continue;
    if (distance < 1e-8) { nx = Math.cos(body.phase); nz = Math.sin(body.phase); distance = 1; }
    let z = obstacle.z + nz / distance * (radius + .001);
    z = Math.max(minZ, Math.min(maxZ, z));
    p.x = obstacle.x + (Math.sign(nx) || 1) * Math.sqrt(Math.max(0, (radius + .001) ** 2 - (z - obstacle.z) ** 2));
    p.z = z;
  }
  // Overlapping heroes can make radial projection bounce between two circles.
  // A monotone escape along X leaves their union without crossing the Z bounds.
  const escape = Math.sign(Math.cos(body.phase)) || 1;
  for (let pass = 0; pass < obstacles.length; pass++) {
    let changed = false;
    for (const obstacle of obstacles) {
      const radius = clearance + (obstacle.radius ?? 0) + .001;
      if (Math.abs(p.y - obstacle.y) >= 1.1 || Math.hypot(p.x - obstacle.x, p.z - obstacle.z) >= radius) continue;
      p.x = obstacle.x + escape * (Math.sqrt(Math.max(0, radius * radius - (p.z - obstacle.z) ** 2)) + .001);
      changed = true;
    }
    if (!changed) break;
  }
  // A patrol target inside a hero is temporarily parked on the near perimeter.
  for (const obstacle of obstacles) {
    const radius = clearance + (obstacle.radius ?? 0) + .001;
    if (Math.abs(p.y - obstacle.y) >= 1.1 || Math.hypot(gx - obstacle.x, gz - obstacle.z) >= radius) continue;
    const distance = Math.hypot(p.x - obstacle.x, p.z - obstacle.z);
    gx = obstacle.x + (p.x - obstacle.x) / distance * (radius + .001);
    gz = obstacle.z + (p.z - obstacle.z) / distance * (radius + .001);
  }
  const dx = gx - p.x, dz = gz - p.z, distance = Math.hypot(dx, dz);
  if (distance < 1e-8) return;
  let blocker: WalkingObstacle | undefined, first = Infinity;
  for (const obstacle of obstacles) {
    if (Math.abs(p.y - obstacle.y) >= 1.1) continue;
    const entry = circleEntry(p.x, p.z, dx, dz, obstacle, clearance + (obstacle.radius ?? 0) + .001);
    if (entry < first) { first = entry; blocker = obstacle; }
  }
  const amount = immediate ? 1 : 1 - Math.exp(-dt * 4);
  let mx = dx * amount, mz = dz * amount;
  if (blocker) {
    const radius = clearance + (blocker.radius ?? 0) + .001;
    const d = Math.max(radius, Math.hypot(blocker.x - p.x, blocker.z - p.z));
    const ex = (blocker.x - p.x) / d, ez = (blocker.z - p.z) / d;
    const cross = ex * dz - ez * dx;
    let side = body.detour?.obstacle === blocker ? body.detour.side : Math.abs(cross) > .001 ? Math.sign(cross) : Math.sign(Math.sin(body.phase)) || 1;
    // Close to a tile/room edge, use the side with enough space for the arc.
    if (Math.abs(ex) > .1) {
      if (blocker.z + radius > maxZ) side = -Math.sign(ex);
      else if (blocker.z - radius < minZ) side = Math.sign(ex);
    }
    if (body.detour?.obstacle !== blocker || body.detour.side !== side) body.detour = { obstacle: blocker, side };
    const sin = radius / d, cos = Math.sqrt(Math.max(0, 1 - sin * sin)), step = distance * amount;
    mx = (ex * cos - ez * sin * side) * step;
    mz = (ez * cos + ex * sin * side) * step;
  } else body.detour = undefined;
  mz = Math.max(minZ, Math.min(maxZ, p.z + mz)) - p.z;
  let allowed = 1;
  for (const obstacle of obstacles) {
    if (Math.abs(p.y - obstacle.y) >= 1.1) continue;
    const entry = circleEntry(p.x, p.z, mx, mz, obstacle, clearance + (obstacle.radius ?? 0));
    if (entry < allowed) allowed = Math.max(0, entry - .001 / Math.max(.001, Math.hypot(mx, mz)));
  }
  p.x += mx * allowed; p.z += mz * allowed;
}
export function launch(
  body: LifeBody,
  vx: number,
  vz: number,
  reduced = false,
) {
  if (body.mode !== "walking" || body.cooldown > 0) return false;
  const speed = Math.hypot(vx, vz);
  if (speed < 0.3) return false;
  body.mode = "flying";
  body.age = 0;
  body.bounces = 0;
  body.hits++;
  body.detour = undefined;
  const power = (reduced ? 0.2 : 1) * Math.min(11, 4 + speed * 0.45);
  body.velocity = {
    x: (vx / speed) * power,
    y: reduced ? 1.4 : 7.2 + Math.min(speed * 0.12, 2),
    z:
      (vz / speed) * power +
      (Math.sin(body.phase) > 0.0 ? 1 : -1) * (reduced ? 0.2 : 1.5),
  };
  body.spin = reduced ? 0 : Math.sign(vx || vz) * 6;
  body.cooldown = 3;
  return true;
}
/** Small fixed steps keep a fast hero's collision stable at low rendering rates. */
export function stepLife(
  body: LifeBody,
  dt: number,
  ground: (x: number, z: number) => number,
) {
  if (dt <= 0) return;
  body.cooldown = Math.max(0, body.cooldown - dt);
  if (body.mode === "walking") return;
  const steps = Math.ceil(dt / (1 / 90)),
    h = dt / steps;
  for (let i = 0; i < steps; i++) {
    if (body.mode === "walking") break;
    body.age += h;
    if (body.mode === "recovering") {
      body.tumble *= Math.exp(-h * 9);
      if (body.age > 0.7) {
        body.mode = "walking";
        body.age = 0;
        body.tumble = 0;
      }
      continue;
    }
    body.velocity.y -= 18 * h;
    body.position.x += body.velocity.x * h;
    body.position.y += body.velocity.y * h;
    body.position.z += body.velocity.z * h;
    body.velocity.x *= Math.exp(-h * 0.8);
    body.velocity.z *= Math.exp(-h * 0.8);
    body.tumble += body.spin * h;
    // The miniature's edge acts as a soft bumper; inhabitants never fall into the void.
    const maxOffset = 5.5;
    if (Math.abs(body.position.x - body.home.x) > maxOffset) {
      body.position.x =
        body.home.x + Math.sign(body.position.x - body.home.x) * maxOffset;
      body.velocity.x *= -0.25;
    }
    if (Math.abs(body.position.z - body.home.z) > maxOffset) {
      body.position.z =
        body.home.z + Math.sign(body.position.z - body.home.z) * maxOffset;
      body.velocity.z *= -0.25;
    }
    const floor = ground(body.position.x, body.position.z);
    if (body.position.y <= floor) {
      body.position.y = floor;
      if (body.bounces < 2 && Math.abs(body.velocity.y) > 1.7) {
        body.velocity.y = Math.abs(body.velocity.y) * 0.32;
        body.velocity.x *= 0.6;
        body.velocity.z *= 0.6;
        body.spin *= 0.45;
        body.bounces++;
      } else {
        body.mode = "recovering";
        body.age = 0;
        body.velocity = { x: 0, y: 0, z: 0 };
        body.tumble = Math.atan2(Math.sin(body.tumble), Math.cos(body.tumble));
      }
    }
  }
}
export function dampAngle(from: number, to: number, dt: number) {
  return (
    from +
    Math.atan2(Math.sin(to - from), Math.cos(to - from)) *
      (1 - Math.exp(-dt * 10))
  );
}
