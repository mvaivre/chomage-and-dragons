import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const url = process.env.GAME_TEST_URL ?? "http://localhost:3000";
const ready = p => p.waitForFunction(() => window.__voxelWorld?.ready && !document.querySelector(".action-button--refus")?.disabled);
const intersects = (a, b) => a.min.every((n, i) => n <= b.max[i] && a.max[i] >= b.min[i]);

test("factory entrances, machines, flying CVs and stamping workers preserve journeys on desktop and mobile", { timeout: 120000 }, async t => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  t.after(() => browser.close());
  for (const mobile of [false, true]) await t.test(mobile ? "mobile entry and active line" : "desktop entry and active line", async () => {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 }), page = await context.newPage(), errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(() => { const at = new Date().toISOString(); localStorage.setItem("chomage:welcome:rites-v2:local%3Atest", "seen"); localStorage.setItem("louchomage:moi:v1", "test"); localStorage.setItem("louchomage:v2", JSON.stringify({ players: [{ id: "test", name: "Mika", characterId: "barde", joinedAt: at }], events: Array.from({ length: 14 }, (_, i) => ({ id: `seed-${i}`, playerId: "test", kind: "candidature", at })), casts: [] })); });
    await page.goto(`${url}/local?debug&profile&hour=12`); await ready(page);
    assert.equal(await page.evaluate(() => window.__voxelWorld.room), null);
    // Crossing the doorway, the chest milestone and the first press in one actual action.
    await page.locator(".action-button--refus").click();
    await page.waitForFunction(() => window.__voxelWorld.actors.find(a => a.id === "test").moving);
    const samples = await page.evaluate(() => new Promise((resolve, reject) => {
      const rows = [], start = performance.now();
      function sample() { const w = window.__voxelWorld, actor = w.actors.find(a => a.id === "test");
        if (w.room === "factory" && !actor.passage) rows.push({ bounds: actor.bounds, factory: w.factory, triangles: w.triangles, calls: w.calls, perf: w.performance });
        if (!actor.moving) resolve(rows); else if (performance.now() - start > 25000) reject(new Error("factory journey did not complete")); else setTimeout(sample, 40);
      } sample();
    }));
    assert.ok(samples.length > 10);
    for (const sample of samples) for (const machine of sample.factory.machines) assert.ok(!intersects(sample.bounds, machine), "actual animated hero never enters a press");
    const hero = await page.evaluate(() => window.__voxelWorld.actors.find(a => a.id === "test"));
    assert.ok(Math.abs(hero.x - 31 / 200 * 30240) < 0.01);
    await page.getByRole("button", { name: "Ranger le butin" }).click();
    for (let i = 0; i < 2; i++) { await page.locator(".mini-game-invite__pass").waitFor(); await page.locator(".mini-game-invite__pass").click(); }
    await ready(page);
    const before = await page.evaluate(() => ({ save: localStorage.getItem("louchomage:v2"), factory: window.__voxelWorld.factory, workers: window.__voxelWorld.inhabitants.filter(n => n.kind === "worker") }));
    await page.waitForTimeout(650);
    const after = await page.evaluate(() => ({ save: localStorage.getItem("louchomage:v2"), factory: window.__voxelWorld.factory, workers: window.__voxelWorld.inhabitants.filter(n => n.kind === "worker"), triangles: window.__voxelWorld.triangles, perf: window.__voxelWorld.performance }));
    assert.equal(after.save, before.save); assert.equal(after.factory.papers.length, 15); assert.equal(after.workers.length, 5);
    assert.notDeepEqual(after.factory.papers, before.factory.papers); assert.notDeepEqual(after.workers.map(w => w.stamp.lift), before.workers.map(w => w.stamp.lift));
    assert.notEqual(after.workers[0].stamp.phase, after.workers[1].stamp.phase, "staff work in staggered cycles");
    if (mobile) { assert.ok(after.triangles < 20000); assert.equal(after.perf.shadowSize, 0); assert.equal(after.perf.shadowMapAllocated, false); }
    console.log(JSON.stringify({ mobile, interiorTriangles: after.triangles, travelPeak: Math.max(...samples.map(s => s.triangles)), callsPeak: Math.max(...samples.map(s => s.calls)) }));
    await page.getByRole("button", { name: "Ouvrir le carnet de Mika" }).click();
    await page.getByRole("button", { name: "Fermer le carnet" }).waitFor();
    await page.waitForTimeout(150);
    const frozen = await page.evaluate(() => ({ papers: window.__voxelWorld.factory.papers, stamps: window.__voxelWorld.inhabitants.filter(n => n.kind === "worker").map(n => n.stamp) }));
    await page.waitForTimeout(400);
    assert.deepEqual(await page.evaluate(() => ({ papers: window.__voxelWorld.factory.papers, stamps: window.__voxelWorld.inhabitants.filter(n => n.kind === "worker").map(n => n.stamp) })), frozen);
    await page.getByRole("button", { name: "Fermer le carnet" }).click();
    await page.getByRole("button", { name: "Parler : Parler à l’ouvrier" }).first().click();
    await page.locator(".voxel-speech").waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("louchomage:v2")), before.save);
    await page.getByRole("button", { name: "Fermer le dialogue" }).click();
    assert.deepEqual(errors, []); await context.close();
  });
});
