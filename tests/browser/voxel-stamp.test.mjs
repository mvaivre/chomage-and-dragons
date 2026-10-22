import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const url = process.env.GAME_TEST_URL ?? "http://localhost:3000";

test(
  "post-interview rejections squash, drag and restore the hero before offering the mini-game",
  { timeout: 90000 },
  async (t) => {
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
    });
    t.after(() => browser.close());
    async function fixture(
      variant = "legendary",
      reducedMotion = "no-preference",
      mobile = false,
    ) {
      const context = await browser.newContext({
        viewport: mobile
          ? { width: 390, height: 844 }
          : { width: 1280, height: 800 },
        reducedMotion,
      });
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => {
        const at = new Date().toISOString();
        localStorage.setItem("chomage:welcome:rites-v2:local%3Atest", "seen");
        localStorage.setItem("louchomage:moi:v1", "test");
        localStorage.setItem(
          "louchomage:v2",
          JSON.stringify({
            players: [
              {
                id: "test",
                name: "Mika",
                characterId: "sorciere",
                joinedAt: at,
              },
            ],
            events: [],
            casts: [],
          }),
        );
      });
      await page.goto(`${url}/local?debug&hour=12&variant=${variant}`);
      await page.waitForFunction(
        () =>
          window.__voxelWorld?.ready &&
          !document.querySelector(".action-button--refus")?.disabled,
      );
      return { context, page, errors };
    }
    for (const mobile of [false, true])
      await t.test(
        `the real stamp slides a flattened hero and rebounds on ${mobile ? "mobile" : "desktop"}`,
        async () => {
          const { context, page, errors } = await fixture(
            "legendary",
            "no-preference",
            mobile,
          );
          try {
            await page.locator(".action-button--rejetApresEntretien").click();
            await page.waitForFunction(
              () => window.__voxelWorld.actors[0].scale[1] < 0.08,
            );
            const flat = await page.evaluate(
              () => window.__voxelWorld.actors[0],
            );
            await page.waitForFunction(
              (x) =>
                window.__voxelWorld.actors[0].scale[1] < 0.08 &&
                window.__voxelWorld.actors[0].x > x + 200,
              flat.x,
            );
            assert.equal(
              await page.locator(".mini-game-invite").count(),
              0,
              "the gag finishes before the mini-game",
            );
            await page.waitForFunction(
              () => window.__voxelWorld.actors[0].scale[1] > 1.2,
              null,
              { polling: 15 },
            );
            assert.equal(await page.locator(".mini-game-invite").count(), 0);
            await page.locator(".mini-game-invite").waitFor();
            const hero = await page.evaluate(
              () => window.__voxelWorld.actors[0],
            );
            assert.deepEqual(hero.scale, [1, 1, 1]);
            assert.ok(Math.abs(hero.x - 907.2) < 0.01);
            assert.equal(hero.moving, false);
            const state = await page.evaluate(() =>
              JSON.parse(localStorage.getItem("louchomage:v2")),
            );
            assert.deepEqual(
              state.events.map((e) => e.kind),
              ["rejetApresEntretien"],
            );
            assert.equal(state.events[0].journeyBonus, undefined);
            await page.keyboard.press("Escape");
            await page.waitForFunction(
              () => !document.querySelector(".action-undo").disabled,
            );
            await page.locator(".action-undo").click();
            await page.waitForFunction(
              () =>
                window.__voxelWorld.actors[0].x < 0.01 &&
                !window.__voxelWorld.actors[0].moving,
            );
            assert.deepEqual(
              await page.evaluate(() => window.__voxelWorld.actors[0].scale),
              [1, 1, 1],
            );
            assert.deepEqual(errors, []);
          } finally {
            await context.close();
          }
        },
      );
    await t.test(
      "all six saved rejection variants keep the stamp gag and reduced motion preserves normal proportions",
      async () => {
        for (const variant of [
          "legendary",
          "formLetter",
          "anvil",
          "meteor",
          "frogReader",
          "mythicRejection",
        ]) {
          const { context, page, errors } = await fixture(variant, "reduce");
          try {
            await page.locator(".action-button--rejetApresEntretien").click();
            await page.waitForFunction(() =>
              window.__voxelWorld.reactions.some((r) => r.stampCrush),
            );
            const reaction = await page.evaluate(() =>
              window.__voxelWorld.reactions.find((r) => r.stampCrush),
            );
            assert.equal(reaction.kind, variant);
            assert.deepEqual(
              await page.evaluate(() => window.__voxelWorld.actors[0].scale),
              [1, 1, 1],
            );
            await page.locator(".mini-game-invite").waitFor();
            assert.deepEqual(
              await page.evaluate(() => window.__voxelWorld.actors[0].scale),
              [1, 1, 1],
            );
            assert.deepEqual(errors, []);
          } finally {
            await context.close();
          }
        }
      },
    );
  },
);
