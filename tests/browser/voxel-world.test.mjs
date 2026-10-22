import test from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { registerHooks } from "node:module";
import { chromium } from "playwright";
registerHooks({
  resolve(s, c, n) {
    return n(
      s.startsWith("@/")
        ? new URL(`../../src/${s.slice(2)}.ts`, import.meta.url).href
        : s,
      c,
    );
  },
});
const { BIOMES, WORLD_LENGTH } = await import("../../src/lib/game/world.ts");
const { HIDDEN_ITEMS } = await import("../../src/lib/game/hidden-objects.ts");
const { MINI_GAMES } = await import("../../src/lib/game/mini-games.ts");
const url = process.env.GAME_TEST_URL ?? "http://localhost:3000";
const ready = (p) =>
  p.waitForFunction(
    () =>
      window.__voxelWorld?.ready &&
      !document.querySelector(".action-button--refus")?.disabled,
  );
const saved = (p) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("louchomage:v2")));

test(
  "voxel world, collection, thirteen challenges and initiation keep the saved game intact",
  { timeout: 240000 },
  async (t) => {
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
    });
    t.after(() => browser.close());
    await mkdir(".qa/refonte-voxel", { recursive: true });
    async function fixture(initiation = false, steps = 0) {
      const context = await browser.newContext({
          viewport: { width: 1280, height: 800 },
          deviceScaleFactor: 2,
          reducedMotion: "reduce",
        }),
        page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(
        ({ initiation, steps }) => {
          if (localStorage.getItem("louchomage:v2")) return;
          const at = new Date().toISOString();
          if (!initiation)
            localStorage.setItem(
              "chomage:welcome:rites-v2:local%3Atest",
              "seen",
            );
          localStorage.setItem("louchomage:moi:v1", "test");
          localStorage.setItem(
            "louchomage:v2",
            JSON.stringify({
              players: [
                {
                  id: "test",
                  name: "Mika",
                  characterId: "skater",
                  joinedAt: at,
                },
                { id: "lou", name: "Lou", characterId: "barde", joinedAt: at },
              ],
              events: Array.from({ length: steps / 2 }, (_, i) => ({
                id: `seed-${i}`,
                playerId: "test",
                kind: "candidature",
                at,
              })),
              casts: [],
            }),
          );
        },
        { initiation, steps },
      );
      await page.goto(`${url}/local?debug&hour=12`);
      if (initiation) await page.locator(".initiation-card[open]").waitFor();
      else await ready(page);
      return { context, page, errors };
    }
    async function explore(page, x) {
      await page.getByLabel("Position de test").fill(String(x));
      await page.waitForFunction(
        (x) => Math.abs(window.__voxelWorld.focus * 50 - x) < 2,
        x,
      );
      await page.waitForFunction(() => window.__voxelWorld.chunks === 5);
    }
    await t.test(
      "biomes, altitude, dedicated interior rooms and 360 degree camera on desktop, mobile and wide screens",
      async () => {
        const { context, page, errors } = await fixture();
        try {
          const before = await saved(page);
          await page.getByRole("button", { name: /Explorer le monde/ }).click();
          for (const b of BIOMES) {
            await explore(page, ((b.from + b.to) / 2) * WORLD_LENGTH);
            const state = await page.evaluate(() => window.__voxelWorld);
            assert.equal(state.biome, b.id);
            assert.ok(state.geometries < 150, `${b.id}: bounded loaded meshes`);
            await page.screenshot({
              path: `.qa/refonte-voxel/biome-${b.id}.png`,
            });
          }
          for (const [x, room] of [
            [2200, "orp"],
            [4900, "factory"],
            [29500, "tavern"],
          ]) {
            await explore(page, x);
            const interior = await page.evaluate(() => window.__voxelWorld);
            assert.equal(interior.room, room);
            assert.equal(
              interior.visibleChunks,
              0,
              "outdoors are hidden in interiors",
            );
            assert.equal(interior.interiorOnly, true);
          }
          for (const viewport of [
            { width: 390, height: 844 },
            { width: 1920, height: 1080 },
            { width: 1280, height: 800 },
          ]) {
            await page.setViewportSize(viewport);
            await explore(page, 0);
            await page.getByRole("button", { name: /Caméra libre/ }).click();
            await page.waitForTimeout(500);
            await page.screenshot({
              path: `.qa/refonte-voxel/monde-${viewport.width}.png`,
            });
            const a = await page.evaluate(() => window.__voxelWorld.azimuth);
            await page
              .getByRole("button", { name: "Tourner la vue à droite" })
              .click();
            await page.waitForFunction(
              (a) => window.__voxelWorld.azimuth !== a,
              a,
            );
            assert.ok(
              await page
                .locator(".voxel-world canvas")
                .evaluate((c) => !!c.getContext("webgl2")),
            );
            await page
              .getByRole("button", { name: /Explorer le monde/ })
              .click();
          }
          assert.deepEqual(await saved(page), before);
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      },
    );
    await t.test(
      "walking into an interior, reloading and undoing restores the outdoor scene and original UI",
      async () => {
        const { context, page, errors } = await fixture(false, 10);
        try {
          assert.equal(
            await page.evaluate(() => window.__voxelWorld.room),
            null,
          );
          await page.locator(".action-button--refus").click();
          const invite = await page
            .locator(".mini-game-invite")
            .elementHandle();
          await page.locator(".mini-game-invite__pass").click();
          await invite.waitForElementState("hidden");
          await ready(page);
          await page.waitForFunction(
            () =>
              window.__voxelWorld.room === "orp" &&
              window.__voxelWorld.visibleChunks === 0,
          );
          assert.equal((await saved(page)).events.length, 6);
          await page.reload();
          await ready(page);
          assert.equal(
            await page.evaluate(() => window.__voxelWorld.room),
            "orp",
          );
          assert.match(
            await page.locator(".action-button--refus img").getAttribute("src"),
            /art\/world-v3\/ui\/action-refus/,
          );
          await page.locator(".action-undo").click();
          await ready(page);
          await page.waitForFunction(
            () =>
              window.__voxelWorld.room === null &&
              window.__voxelWorld.visibleChunks === 5,
          );
          assert.equal((await saved(page)).events.length, 5);
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      },
    );
    await t.test(
      "all nine hidden objects can be collected and survive reload",
      async () => {
        const { context, page, errors } = await fixture();
        try {
          await page.getByRole("button", { name: /Explorer le monde/ }).click();
          for (const [i, item] of HIDDEN_ITEMS.entries()) {
            await explore(page, item.x);
            const target = page.getByRole("button", {
              name: `Ramasser : ${item.name}`,
            });
            await target.click();
            await page.waitForFunction(
              (id) =>
                JSON.parse(
                  localStorage.getItem("louchomage:v2"),
                ).discoveries?.some((d) => d.itemId === id),
              item.id,
            );
            if (i === 0) {
              await page.waitForFunction(
                () => document.querySelector(".action-button--refus")?.disabled,
              );
              await page.keyboard.press("2");
              assert.equal((await saved(page)).events.length, 0);
            }
            await page
              .getByRole("button", {
                name: i === 0 ? "Continuer" : "J’ai compris",
                exact: true,
              })
              .click();
          }
          await page.reload();
          await ready(page);
          assert.equal((await saved(page)).discoveries.length, 9);
          assert.equal(await page.locator("[data-hidden-item]").count(), 0);
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      },
    );
    await t.test(
      "every challenge renders, starts, accepts input and closes without writing a practice attempt",
      async () => {
        const { context, page, errors } = await fixture();
        try {
          await page.setViewportSize({ width: 390, height: 844 });
          const before = await saved(page);
          await page.getByRole("button", { name: /Explorer le monde/ }).click();
          for (const kind of Object.keys(MINI_GAMES)) {
            await page.getByLabel("Tester un mini-jeu").selectOption(kind);
            const game = page.locator(`.mini-game--${kind}[open]`);
            await game.waitFor();
            if (await game.locator("canvas").count()) {
              assert.ok(await game.locator("canvas").evaluateAll(canvases => canvases.every(c => c.dataset.shadowMode === "none")),
                `${kind}: mobile minigames skip realtime shadows`);
            }
            if (await game.locator("canvas").count())
              assert.ok(
                await game
                  .locator("canvas")
                  .evaluate((c) => !!c.getContext("webgl2")),
              );
            const arenaBox = await game.locator(".mini-game__arena").boundingBox();
            const startBox = await game.locator(".mini-game__primary").boundingBox();
            assert.ok(Math.abs(startBox.x + startBox.width / 2 - arenaBox.x - arenaBox.width / 2) < 2, `${kind}: start horizontally centred on the arena`);
            assert.ok(Math.abs(startBox.y + startBox.height / 2 - arenaBox.y - arenaBox.height / 2) < 2, `${kind}: start vertically centred on the arena`);
            assert.equal(await game.locator("footer button").count(), 1, `${kind}: only skip remains below`);
            assert.equal(await game.locator("button button").count(), 0, "start controls are never nested inside an arena button");
            await game.locator(".mini-game__primary").click();
            await page.keyboard.press("ArrowRight");
            await page.keyboard.press("Space");
            await page.waitForTimeout(150);
            assert.ok(
              await game.evaluate((n) => {
                const r = n.getBoundingClientRect();
                return (
                  r.left >= 0 &&
                  r.right <= innerWidth + 1 &&
                  r.top >= 0 &&
                  r.bottom <= innerHeight + 1 &&
                  n.scrollWidth <= n.clientWidth
                );
              }),
              `${kind} fits mobile`,
            );
            await page.screenshot({
              path: `.qa/refonte-voxel/mini-${kind}-mobile.png`,
            });
            await page.keyboard.press("Escape");
            await game.waitFor({ state: "detached" });
            assert.deepEqual(await saved(page), before, kind);
          }
          assert.equal(
            await page
              .locator(".voxel-world canvas")
              .evaluate((c) => c.getContext("webgl2").isContextLost()),
            false,
          );
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      },
    );
    await t.test("the mobile character carnet keeps nested dialogs, focus and loot targeting usable", async () => {
      const { context, page, errors } = await fixture(false, 10);
      try {
        await page.setViewportSize({width:390, height:844});
        const portrait = page.getByRole("button", {name:/Ouvrir le carnet/});
        await portrait.click();
        await page.locator(".monthly-meetup__date").click();
        await page.locator(".meetup-editor[open]").waitFor();
        await page.keyboard.press("2");
        await page.keyboard.press("Escape");
        await page.locator(".meetup-editor").waitFor({state:"detached"});
        assert.equal(await page.locator(".adventure-menu[open]").count(), 1, "Escape only closes the nested editor");
        await page.keyboard.press("Escape");
        await page.locator(".adventure-menu").waitFor({state:"detached"});
        assert.equal(await portrait.evaluate(node=>node === document.activeElement), true);
        await portrait.click();
        await page.locator(".power-menu__trigger").click();
        await page.locator(".power-choice").first().click();
        await page.getByRole("button", {name:"Lou", exact:true}).click();
        await page.locator(".adventure-menu").waitFor({state:"detached"});
        const state = await saved(page);
        assert.equal(state.casts.length, 1);
        assert.equal(state.casts[0].targetPlayerId, "lou");
        assert.equal(state.events.length, 5, "menu shortcuts never declare an action");
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
    await t.test(
      "all three initiation rites teach their mechanics with voxel scenes",
      async () => {
        const { context, page, errors } = await fixture(true);
        try {
          await page.setViewportSize({ width: 390, height: 844 });
          const started = Date.now();
          for (const name of ["Essayer une candidature · +2 pas", "Découvrir les coffres →", "Ouvrir le coffre", "Essayer le pouvoir", "Voyager ensemble →", "Commencer le voyage"]) {
            await page.getByRole("button", {name, exact:true}).click();
          }
          assert.ok(Date.now() - started < 8000, "the complete introduction fits in six taps without a flight or quiz");
          await ready(page);
          assert.equal((await saved(page)).events.length, 0);
          assert.equal((await saved(page)).casts.length, 0);
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      },
    );
  },
);
