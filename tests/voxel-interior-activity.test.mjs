import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
registerHooks({ resolve(s, c, next) {
  if (s.startsWith("@/")) return next(new URL(`../src/${s.slice(2)}.ts`, import.meta.url).href, c);
  if (c.parentURL?.endsWith(".ts") && s.startsWith(".") && !/\.[a-z]+$/i.test(s)) return next(`${s}.ts`, c);
  return next(s, c);
} });
const { interiorActivity, officePaperPose } = await import("../src/components/voxel/interior-activity.ts");
const { VoxelResources } = await import("../src/components/voxel/resources.ts");
const { factoryStations } = await import("../src/components/voxel/factory.ts");
const { INTERIORS } = await import("../src/lib/game/decor.ts");

test("interior scenes stay outside the entire walking lane and reuse their resources", () => {
  for (const room of INTERIORS) {
    const r = new VoxelResources(), from = room.from / 50, to = room.to / 50;
    const stations = room.id === "factory" ? factoryStations(from, to).map(s => s.x) : Array.from({ length: Math.ceil((to - from - 4) / 6) }, (_, i) => from + 3 + i * 6);
    const root = interiorActivity(r, room.id, from, to, stations), mesh = root.children[0];
    assert.equal(r.instances.size, 1); assert.ok(mesh.count * 12 < 6000);
    for (let time = 0; time < 12; time += 0.13) {
      root.userData.animate(time);
      for (const b of root.userData.snapshot().boxes) {
        assert.ok([...b.min, ...b.max].every(Number.isFinite));
        assert.ok(b.max[2] < -2.2 || b.min[2] > 2.2, `${room.id}: aisle stays clear at ${time}: ${JSON.stringify(b)}`);
        assert.ok(b.min[0] > from - (from + to) / 2 + 1.5 && b.max[0] < to - (from + to) / 2 - 1.5, "door landings stay clear");
      }
    }
    const before = root.userData.snapshot(); root.userData.animate(12.6);
    assert.notDeepEqual(root.userData.snapshot().residents, before.residents);
    assert.notDeepEqual(root.userData.snapshot().tears, before.tears);
    assert.equal(r.instances.size, 1);
    r.release(root); assert.equal(r.instances.size, 0); r.dispose();
  }
});

test("the office paper shower settles on the stack and loops without growing", () => {
  for (let i = 0; i < 9; i++) for (let time = 0; time < 15; time += 0.04) {
    const p = officePaperPose(time, i);
    assert.ok(p.y >= 1.67 && p.y <= 4.97);
    assert.ok(Math.abs(p.x) < 0.57 && Math.abs(p.z) <= 0.23);
    if (p.phase >= 0.78) { assert.equal(p.y, 1.67); assert.ok(p.rotation === 0); }
    const next = officePaperPose(time + 3.6, i);
    assert.ok(Math.abs(next.y - p.y) < 1e-10);
  }
});
