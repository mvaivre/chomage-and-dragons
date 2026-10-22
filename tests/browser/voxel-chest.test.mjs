import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { registerHooks } from "node:module";
registerHooks({ resolve(s, c, n) {
  if (s.startsWith("@/")) return n(new URL(`../../src/${s.slice(2)}.ts`, import.meta.url).href, c);
  if (c.parentURL?.endsWith(".ts") && s.startsWith(".") && !/\.[a-z]+$/i.test(s)) return n(`${s}.ts`, c);
  return n(s, c);
} });
const { journeyPoint } = await import("../../src/components/voxel/layout.ts");
const url = process.env.GAME_TEST_URL ?? "http://localhost:3000";

test(
  "road chests are collected at their milestone before opening and displaying their loot",
  { timeout: 100000 },
  async (t) => {
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
    });
    t.after(() => browser.close());
    async function fixture(
      steps = 8,
      mobile = false,
      reducedMotion = "no-preference",
      variant = "sealedLetter",
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
      await page.addInitScript((steps) => {
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
            events: Array.from({ length: steps / 2 }, (_, i) => ({
              id: `event-${i}`,
              playerId: "test",
              kind: "candidature",
              at,
            })),
            casts: [],
          }),
        );
      }, steps);
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
        `a stopped hero collects a closed chest, opens its lid and receives one loot card on ${mobile ? "mobile" : "desktop"}`,
        async () => {
          const { context, page, errors } = await fixture(8, mobile);
          try {
            const chest = await page.evaluate(() =>
              window.__voxelWorld.chests.find((c) => c.id === "chest:10"),
            );
            assert.ok(chest.visible);
            const point = journeyPoint(1512);
            assert.ok(
              Math.abs(
                chest.position[2] -
                  point.z,
              ) < 0.00001,
            );
            await page.locator(".action-button--candidature").click();
            await page.waitForFunction(() =>
              window.__voxelWorld.reactions.some(
                (r) => r.kind === "chest" && r.elapsed > 0.2,
              ),
            );
            const closed = await page.evaluate(() =>
              window.__voxelWorld.reactions.find((r) => r.kind === "chest"),
            );
            assert.equal(closed.pickup.opening, 0);
            assert.equal(Math.abs(closed.pickup.lidAngle), 0);
            assert.ok(Math.abs(closed.position[0] - point.x) < 0.00001);
            assert.equal(await page.locator(".reward-modal").count(), 0);
            assert.equal(await page.locator(".mini-game-invite").count(), 0);
            const stopped = await page.evaluate(
              () => window.__voxelWorld.actors[0].x,
            );
            await page.waitForTimeout(300);
            assert.equal(
              await page.evaluate(() => window.__voxelWorld.actors[0].x),
              stopped,
            );
            await page.waitForFunction(() =>
              window.__voxelWorld.reactions.some(
                (r) =>
                  r.kind === "chest" &&
                  r.pickup.lift > 0.5 &&
                  r.pickup.opening === 0,
              ),
            );
            await page.waitForFunction(() =>
              window.__voxelWorld.reactions.some(
                (r) => r.kind === "chest" && r.pickup.lidAngle < -1,
              ),
            );
            await page
              .getByRole("button", { name: "Ranger le butin" })
              .waitFor();
            assert.equal(await page.locator(".reward-modal--chest").count(), 1);
            const state = await page.evaluate(() => ({
              hero: window.__voxelWorld.actors[0],
              chest: window.__voxelWorld.chests.find(
                (c) => c.id === "chest:10",
              ),
              save: JSON.parse(localStorage.getItem("louchomage:v2")),
            }));
            assert.ok(Math.abs(state.hero.x - 1512) < 0.01);
            assert.equal(state.hero.moving, false);
            assert.equal(state.chest.visible, false);
            assert.equal(state.save.events.length, 5);
            await page.getByRole("button", { name: "Ranger le butin" }).click();
            for (let i = 0; i < 2; i++) {
              await page.locator(".mini-game-invite").waitFor();
              await page.locator(".mini-game-invite__pass").click();
            }
            await page.waitForFunction(
              () => !document.querySelector(".action-undo").disabled,
            );
            await page.locator(".action-undo").click();
            await page.waitForFunction(
              () =>
                !document.querySelector(".action-button--candidature")
                  .disabled &&
                window.__voxelWorld.chests.find((c) => c.id === "chest:10")
                  ?.visible,
            );
            assert.deepEqual(errors, []);
          } finally {
            await context.close();
          }
        },
      );
    await t.test(
      "an overshooting rejection finishes its stamp, collects the chest, then resumes to its saved destination",
      async () => {
        const { context, page, errors } = await fixture(
          8,
          false,
          "no-preference",
          "legendary",
        );
        try {
          await page.locator(".action-button--rejetApresEntretien").click();
          await page.waitForFunction(() =>
            window.__voxelWorld.reactions.some((r) => r.kind === "chest"),
          );
          const start = await page.evaluate(() => window.__voxelWorld);
          assert.deepEqual(start.actors[0].scale, [1, 1, 1]);
          assert.equal(
            start.reactions.some((r) => r.stampCrush),
            false,
          );
          await page.getByRole("button", { name: "Ranger le butin" }).waitFor();
          const hero = await page.evaluate(() => window.__voxelWorld.actors[0]);
          assert.ok(Math.abs(hero.x - 2116.8) < 0.01);
          assert.equal(hero.moving, false);
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      },
    );
    await t.test(
      "a chest collected on a steep slope stays just above the hero's head",
      async () => {
        const { context, page, errors } = await fixture(118);
        try {
          await page.locator(".action-button--candidature").click();
          await page.waitForFunction(() =>
            window.__voxelWorld.reactions.some(
              (r) =>
                r.kind === "chest" &&
                r.pickup.lift === 1 &&
                r.pickup.opening === 0,
            ),
          );
          const state = await page.evaluate(() => ({
            hero: window.__voxelWorld.actors[0],
            effect: window.__voxelWorld.reactions.find(
              (r) => r.kind === "chest",
            ),
          }));
          const height =
            state.effect.position[1] + state.effect.pickup.chestPosition[1];
          assert.ok(
            Math.abs(height - state.hero.y - state.hero.height - 0.27) < 0.001,
          );
          await page.getByRole("button", { name: "Ranger le butin" }).waitFor();
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      },
    );
    await t.test(
      "interior chests stay visible on the path and reduced motion still finishes their collection",
      async () => {
        const { context, page, errors } = await fixture(18, false, "reduce");
        try {
          assert.equal(
            await page.evaluate(() => window.__voxelWorld.room),
            "orp",
          );
          assert.ok(
            await page.evaluate(
              () =>
                window.__voxelWorld.chests.find((c) => c.id === "chest:20")
                  ?.visible,
            ),
          );
          await page.locator(".action-button--candidature").click();
          await page.waitForFunction(() =>
            window.__voxelWorld.reactions.some(
              (r) => r.kind === "chest" && r.pickup.opening > 0,
            ),
          );
          assert.equal(await page.locator(".reward-modal").count(), 0);
          await page.getByRole("button", { name: "Ranger le butin" }).waitFor();
          assert.equal(
            await page.evaluate(() => window.__voxelWorld.room),
            "orp",
          );
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      },
    );
  },
);
