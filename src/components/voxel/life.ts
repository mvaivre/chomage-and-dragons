/** Cosmetic simulation only. Nothing here changes journeys, scores or saves. */
export type Point = { x: number; y: number; z: number };
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
