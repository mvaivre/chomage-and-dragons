import test from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const url = process.env.GAME_TEST_URL ?? "http://localhost:3100";
const output = "/tmp/louchomage-interiors";

test("all interiors have animated, bounded scenes that respect pause and reduced motion", { timeout: 180000 }, async t => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  t.after(() => browser.close());
  for (const mobile of [false, true]) for (const [room, count, population] of [["orp", 8, 12], ["factory", 17, 3], ["tavern", 97, 7]]) {
    await t.test(`${room} on ${mobile ? "mobile" : "desktop"}`, async () => {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.addInitScript(count => {
        const at = new Date().toISOString();
        localStorage.setItem("chomage:welcome:rites-v2:local%3Atest", "seen"); localStorage.setItem("louchomage:moi:v1", "test");
        localStorage.setItem("louchomage:v2", JSON.stringify({ players: [{ id: "test", name: "Mika", characterId: "barde", joinedAt: at }], events: Array.from({ length: count }, (_, i) => ({ id: `seed-${i}`, playerId: "test", kind: "candidature", at })), casts: [] }));
      }, count);
      await page.goto(`${url}/local?debug&profile&hour=12`);
      await page.waitForFunction(() => window.__voxelWorld?.ready && !document.querySelector(".action-button--refus")?.disabled);
      assert.equal(await page.evaluate(() => window.__voxelWorld.room), room);
      const before = await page.evaluate(() => ({ save: localStorage.getItem("louchomage:v2"), activity: window.__voxelWorld.interiorActivity }));
      await page.waitForTimeout(650);
      const after = await page.evaluate(() => ({ save: localStorage.getItem("louchomage:v2"), activity: window.__voxelWorld.interiorActivity, triangles: window.__voxelWorld.triangles, geometry: window.__voxelWorld.mainGeometry }));
      assert.equal(after.save, before.save); assert.equal(after.activity.residents.length, population);
      assert.notDeepEqual(after.activity.residents, before.activity.residents);
      assert.notDeepEqual(after.activity.tears, before.activity.tears);
      assert.equal(after.activity.boxes.length, before.activity.boxes.length);
      if (room === "orp") { assert.equal(after.activity.papers.length, 9); assert.notDeepEqual(after.activity.papers, before.activity.papers); }
      if (mobile && room === "factory") assert.ok(after.triangles < 20000);
      if (mobile && room === "tavern") assert.ok(after.geometry.find(([id]) => id === "room:28400")[1] < 11000);
      await page.screenshot({ path: `${output}/${room}-${mobile ? "mobile" : "desktop"}.png` });
      if (!mobile) {
        await page.getByRole("button", { name: "Éloigner la caméra", exact: true }).click({ clickCount: 2 });
        await page.waitForTimeout(350); await page.screenshot({ path: `${output}/${room}-wide.png` });
      } else {
        await page.getByRole("button", { name: "Rapprocher la caméra", exact: true }).click({ clickCount: 2 });
        await page.waitForTimeout(350); await page.screenshot({ path: `${output}/${room}-mobile-close.png` });
      }
      await page.getByRole("button", { name: "Ouvrir le carnet de Mika" }).click();
      await page.getByRole("button", { name: "Fermer le carnet" }).waitFor(); await page.waitForTimeout(150);
      const frozen = await page.evaluate(() => window.__voxelWorld.interiorActivity);
      await page.waitForTimeout(400);
      assert.deepEqual(await page.evaluate(() => window.__voxelWorld.interiorActivity), frozen);
      await page.getByRole("button", { name: "Fermer le carnet" }).click();
      await page.emulateMedia({ reducedMotion: "reduce" }); await page.waitForTimeout(150);
      const still = await page.evaluate(() => window.__voxelWorld.interiorActivity);
      await page.waitForTimeout(350);
      assert.deepEqual(await page.evaluate(() => window.__voxelWorld.interiorActivity), still);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ room, mobile, residents: population, triangles: after.triangles }));
      await context.close();
    });
  }
});
