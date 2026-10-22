import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import * as THREE from "three";
registerHooks({ resolve(s, c, n) {
  if (s.startsWith("@/")) return n(new URL(`../src/${s.slice(2)}.ts`, import.meta.url).href, c);
  if (c.parentURL?.endsWith(".ts") && s.startsWith(".") && !/\.[a-z]+$/i.test(s)) return n(`${s}.ts`, c);
  return n(s, c);
} });
const { factoryLine, factoryStations, factoryWorker, factoryCycle, factoryPaperPose, factoryPileTop, FACTORY_AISLE } = await import("../src/components/voxel/factory.ts");
const { VoxelResources } = await import("../src/components/voxel/resources.ts");
const { characterModel } = await import("../src/components/voxel/objects.ts");
const { CHARACTERS } = await import("../src/lib/game/characters.ts");
const { routeHeight, routeZ, WORLD_SCALE } = await import("../src/components/voxel/world.ts");
const { journeyPoint } = await import("../src/components/voxel/layout.ts");
const { INTERIORS } = await import("../src/lib/game/decor.ts");
const room = INTERIORS.find(r => r.id === "factory"), from = room.from / WORLD_SCALE, to = room.to / WORLD_SCALE, center = (from + to) / 2;
function fixture() {
  const r = new VoxelResources(), root = new THREE.Group(), line = factoryLine(r, from, to, routeZ(center));
  root.position.set(center, routeHeight(center), routeZ(center)); root.add(line); root.updateMatrixWorld(true);
  return { r, root, line };
}

test("factory hardware reserves a complete route for every hero, facing and walking pose, including both doorways", () => {
  const { r, root, line } = fixture();
  const hardware = line.children.filter(o => /^factory-(machine|desk|paper-heap):/.test(o.name)).map(o => new THREE.Box3().setFromObject(o));
  assert.equal(hardware.length, 15);
  for (const b of hardware) {
    assert.ok(b.min.x > from + 3 && b.max.x < to - 2, "entry and exit landings are clear");
    assert.ok(b.max.z < routeZ(center) - FACTORY_AISLE - 0.3 || b.min.z > routeZ(center) + FACTORY_AISLE + 0.3);
  }
  for (const character of CHARACTERS) {
    const hero = characterModel(r, character.id);
    for (let rotation = 0; rotation < Math.PI * 2; rotation += Math.PI / 4) for (const stride of [0, 1.1, 3.4]) {
      hero.rotation.y = rotation; hero.userData.animate(1, true, { blend: 1, stride });
      for (const lane of [-0.95, 0, 0.95]) for (let x = room.from + 0.1; x < room.to; x += 80) {
        const p = journeyPoint(x, lane); hero.position.set(p.x, p.y, p.z);
        const b = new THREE.Box3().setFromObject(hero);
        for (const machine of hardware) assert.ok(!b.intersectsBox(machine), `${character.id} at ${x}, lane ${lane}, rotation ${rotation}`);
      }
    }
    r.release(hero);
  }
  r.release(root); assert.equal(r.instances.size, 0); r.dispose();
});

test("CV flights are bounded, return to the piles and cross the aisle above head height", () => {
  const stations = factoryStations(from, to);
  for (const station of stations) for (let sheet = 0; sheet < 3; sheet++) for (let t = 0; t <= 5.4; t += 0.02) {
    const p = factoryPaperPose(t, station, sheet);
    assert.ok(Object.values(p).every(Number.isFinite));
    assert.ok(p.x > from + 3 && p.x < to - 3 && p.z >= -2.65 && p.z < 3.7);
    if (Math.abs(p.z) < FACTORY_AISLE) assert.ok(p.y > routeHeight(p.x) + 3.2, "flying CV clears the entire hero");
    if (p.phase >= 0.88) assert.ok(Math.abs(p.y - routeHeight(station.x - 1.05) - factoryPileTop(station.index, sheet) - 0.012) < 1e-9);
  }
  const { r, root, line } = fixture(), mesh = line.getObjectByName("factory-flying-cvs").children[0], initial = mesh.instanceMatrix.array.slice(), count = r.instances.size;
  assert.equal(mesh.count, stations.length * 3 * 4); assert.ok(mesh.count * 12 <= 720);
  for (let time = 0; time < 30; time += 0.1) line.userData.animate(time);
  assert.notDeepEqual(mesh.instanceMatrix.array, initial); assert.equal(r.instances.size, count);
  assert.equal(mesh.castShadow, false);
  r.release(root); assert.equal(r.instances.size, 0); r.dispose();
});

test("workers hold their stamps at desk height, lift between impacts and stop to talk", () => {
  const r = new VoxelResources();
  for (const station of factoryStations(from, to)) {
    const worker = factoryWorker(r, station.index); assert.ok(Math.abs(new THREE.Box3().setFromObject(worker).min.y) < 1e-8);
    let triangles = 0, draws = 0; worker.traverse(o => { if (o.isInstancedMesh) { triangles += o.count * 12; draws++; } });
    assert.ok(triangles < 400 && draws === 3);
    const lifts = [], stamped = [];
    for (let time = 0; time < 1.8; time += 0.01) { worker.userData.animate(time); const p = worker.userData.stamp; lifts.push(p.lift); stamped.push(p.stamped); assert.equal(p.stamped, factoryCycle(time, station.index).stamped); }
    assert.ok(Math.max(...lifts) > 0.47 && Math.min(...lifts) === 0); assert.ok(stamped.includes(true) && stamped.includes(false));
    worker.userData.animate(1, false, { motion: "send" }); assert.equal(worker.userData.stamp.stamped, false);
    worker.userData.animate(1, true); assert.equal(worker.userData.stamp.stamped, false);
    r.release(worker);
  }
  assert.equal(r.instances.size, 0); r.dispose();
});
