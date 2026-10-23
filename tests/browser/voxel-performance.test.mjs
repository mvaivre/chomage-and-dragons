import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.env.GAME_TEST_URL ?? "http://localhost:3000";
test("voxel transitions keep bounded draw, shader and mobile budgets without changing the save", { timeout: 180000 }, async (t) => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
  });
  t.after(() => browser.close());
  for (const mobile of [false, true]) {
    await t.test(mobile ? "mobile starts light before rendering" : "desktop volcano/forest round trips", async () => {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 },
        isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
      try {
        const page = await context.newPage(), errors = [];
        page.on("pageerror", e => errors.push(e.message));
        page.on("console", e => { if (e.type() === "error") errors.push(e.text()); });
        await page.addInitScript(() => {
          const at = new Date().toISOString();
          localStorage.setItem("chomage:welcome:rites-v2:local%3Atest", "seen");
          localStorage.setItem("louchomage:moi:v1", "test");
          localStorage.setItem("louchomage:v2", JSON.stringify({ players: [{ id: "test", name: "Mika", characterId: "sorciere", joinedAt: at }], events: [], casts: [] }));
        });
        await page.goto(`${url}/local?debug&profile&hour=12`);
        await page.waitForFunction(() => window.__voxelWorld?.ready && !document.querySelector(".action-button--candidature")?.disabled);
        const before = await page.evaluate(() => localStorage.getItem("louchomage:v2"));
        const initial = await page.evaluate(() => window.__voxelWorld.performance);
        assert.equal(initial.antialias, "msaa");
        assert.ok([2, 4].includes(initial.sourceSamples), "scene edges are antialiased before postprocessing");
        if (mobile) {
          assert.equal(initial.bloom, false);
          assert.equal(initial.miniature, true);
          assert.deepEqual(initial.blurSize, [98, 211], "mobile focus buffers are quarter resolution");
          assert.ok(initial.pixelRatio <= 1);
          assert.equal(initial.lightSlots, 2);
          assert.equal(initial.shadowSize, 0);
          assert.equal(initial.shadowMapAllocated, false);
          assert.ok(initial.contactShadows > 0);
          assert.equal(initial.terrainStripWidth, 4);
        }
        await page.getByRole("button", { name: /Explorer le monde/ }).click();
        let warmShaders = 0;
        for (const [i, x] of [25100, 4000, 27500, 29500, 27500, 4000].entries()) {
          await page.bringToFront();
          await page.getByLabel("Position de test").fill(String(x));
          await page.waitForFunction(x => Math.abs(window.__voxelWorld.focus * 50 - x) < 2 && window.__voxelWorld.chunks === 5, x);
          const stats = await page.evaluate(() => new Promise(resolve => {
            const samples = []; const start = performance.now();
            function sample() {
              const w = window.__voxelWorld;
              samples.push({ calls: w.calls, triangles: w.triangles, geometries: w.geometries, perf: w.performance });
              if (performance.now() - start < 700) setTimeout(sample, 16); else resolve(samples);
            } sample();
          }));
          assert.ok(Math.max(...stats.map(s => s.calls)) < (mobile ? 200 : 450), "bounded draw calls, including shadow frames");
          assert.ok(Math.max(...stats.map(s => s.triangles)) < 500000, "bounded triangles, including shadow frames");
          if (mobile) {
            assert.ok(Math.max(...stats.map(s => s.triangles)) < 150000, "mobile peak stays under 150k, including tavern and contacts");
            assert.ok(stats.every(s => s.perf.shadowSize === 0 && !s.perf.shadowMapAllocated));
            assert.ok(stats.every(s => s.perf.quality === "low" ? !s.perf.miniature && s.perf.blurSize.every(n => n === 1) : s.perf.miniature && s.perf.blurSize[0] <= 98 && s.perf.blurSize[1] <= 211));
            assert.ok(stats.every(s => s.perf.contactShadows > 0));
            const costs = await page.evaluate(() => window.__voxelWorld.mainGeometry);
            for (const [id, triangles] of costs) {
              if (id.startsWith("facade:")) assert.ok(triangles < 3000, `${id}: compact facade`);
              if (id === "room:28400") assert.ok(triangles < 11000, "compact tavern shell keeps its furniture");
            }
          }
          assert.ok(stats.every(s => s.geometries < 150));
          assert.ok(stats.every(s => s.perf.activeLights <= (mobile ? 2 : 4)));
          const shaders = stats.at(-1).perf.shaders;
          if (i === 3) warmShaders = shaders;
          if (i > 3) assert.ok(shaders <= warmShaders + 2, "repeat travel does not accumulate shader variants");
        }
        assert.equal(await page.evaluate(() => localStorage.getItem("louchomage:v2")), before);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
  }
});
