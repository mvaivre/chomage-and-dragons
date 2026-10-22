import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const url = process.env.GAME_TEST_URL ?? "http://localhost:3000";
test("heroes approach open facades, change rooms under a short fade, and exit along a clear aisle", { timeout: 100000 }, async t => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  t.after(() => browser.close());
  for (const [steps, source, destination, boundary] of [[10, null, "orp", 1600], [20, "orp", null, 3263.2], [28, null, "factory", 4300], [38, "factory", null, 5963.2]]) {
    await t.test(`${source ?? "outside"} → ${destination ?? "outside"} and undo`, async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await context.newPage(), errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.addInitScript(steps => { const at = new Date().toISOString(); localStorage.setItem("chomage:welcome:rites-v2:local%3Atest", "seen"); localStorage.setItem("louchomage:moi:v1", "test"); localStorage.setItem("louchomage:v2", JSON.stringify({ players: [{ id: "test", name: "Mika", characterId: "barde", joinedAt: at }], events: Array.from({ length: steps / 2 }, (_, i) => ({ id: `seed-${i}`, playerId: "test", kind: "candidature", at })), casts: [] })); }, steps);
      await page.goto(`${url}/local?debug&profile&hour=12`);
      await page.waitForFunction(() => window.__voxelWorld?.ready && !document.querySelector(".action-button--candidature")?.disabled);
      assert.equal(await page.evaluate(() => window.__voxelWorld.room), source);
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem("louchomage:v2")).events.length);
      await page.locator(".action-button--candidature").click();
      await page.waitForFunction(() => !!window.__voxelWorld.actors.find(a => a.id === "test")?.passage);
      const approach = await page.evaluate(() => { const w = window.__voxelWorld; return { actor: w.actors.find(a => a.id === "test"), scenery: w.scenery, room: w.room }; });
      assert.equal(approach.actor.passage.boundary, boundary);
      assert.equal(approach.room, source);
      if (source === null) assert.ok(approach.scenery.some(s => s.id.startsWith("facade:") && s.visible && s.door < -0.5), "nearby facade opens its door");
      await page.waitForFunction(destination => window.__voxelWorld.room === destination, destination);
      assert.ok(await page.locator(".voxel-door-fade").evaluate(el => Number(el.style.opacity)) > 0.85, "scene swaps while the world is covered");
      await page.waitForFunction(() => !window.__voxelWorld.actors.find(a => a.id === "test").moving);
      const end = await page.evaluate(() => { const w = window.__voxelWorld; return { actor: w.actors.find(a => a.id === "test"), room: w.room }; });
      assert.equal(end.room, destination);
      assert.ok(Math.abs(end.actor.x - (steps + 2) / 200 * 30240) < 0.01);
      assert.equal(await page.locator(".voxel-door-fade").evaluate(el => el.style.opacity), "0");
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("louchomage:v2")).events.length), before + 1);
      // Dismiss an optional challenge before reversing the same trip.
      await page.waitForTimeout(800);
      if (await page.getByRole("button", { name: "Ranger le butin" }).isVisible()) {
        await page.getByRole("button", { name: "Ranger le butin" }).click();
        for (let i = 0; i < 2; i++) { await page.locator(".mini-game-invite__pass").waitFor(); await page.locator(".mini-game-invite__pass").click(); }
      } else if (await page.locator(".mini-game-invite__pass").isVisible()) await page.locator(".mini-game-invite__pass").click();
      await page.getByRole("button", { name: /Annuler/ }).click();
      await page.waitForFunction(source => window.__voxelWorld.room === source && !window.__voxelWorld.actors.find(a => a.id === "test").moving, source);
      const reverse = await page.evaluate(() => window.__voxelWorld.actors.find(a => a.id === "test"));
      assert.ok(Math.abs(reverse.x - steps / 200 * 30240) < 0.01);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("louchomage:v2")).events.length), before);
      assert.deepEqual(errors, []); await context.close();
    });
  }
});
