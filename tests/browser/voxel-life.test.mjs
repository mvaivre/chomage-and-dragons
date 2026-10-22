import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { registerHooks } from "node:module";
registerHooks({
  resolve(s, c, n) {
    if (s.startsWith("@/"))
      return n(new URL(`../../src/${s.slice(2)}.ts`, import.meta.url).href, c);
    return n(s, c);
  },
});
const { PUNCHLINES } = await import("../../src/lib/game/punchlines.ts");
const url = process.env.GAME_TEST_URL ?? "http://localhost:3000";
const ready = (p) =>
  p.waitForFunction(
    () =>
      window.__voxelWorld?.ready &&
      !document.querySelector(".action-button--refus")?.disabled,
  );

test(
  "voxel inhabitants, expressive heroes, physical collisions and temporary close-ups",
  { timeout: 90000 },
  async (t) => {
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
    });
    t.after(() => browser.close());
    async function fixture(viewport = { width: 1280, height: 800 }) {
      const context = await browser.newContext({
          viewport,
          deviceScaleFactor: 1,
        }),
        page = await context.newPage(),
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
                characterId: "chevalier",
                joinedAt: at,
              },
            ],
            events: [],
            casts: [],
          }),
        );
      });
      await page.goto(`${url}/local?debug&hour=18`);
      await ready(page);
      return { context, page, errors };
    }
    await t.test(
      "NPCs roam; all replies are punchlines, stop walking while talking, and never change the save",
      async () => {
        const { context, page, errors } = await fixture();
        try {
          const before = await page.evaluate(() =>
            localStorage.getItem("louchomage:v2"),
          );
          const position = await page.evaluate(
            () =>
              window.__voxelWorld.inhabitants.find((n) => n.id === "wanderer:0")
                .position,
          );
          await page.waitForFunction((old) => {
            const p = window.__voxelWorld.inhabitants.find(
              (n) => n.id === "wanderer:0",
            ).position;
            return Math.hypot(p.x - old.x, p.z - old.z) > 0.2;
          }, position);
          for (let i = 0; i < 2; i++) {
            await page.locator('[data-world-object="wanderer:0"]').click();
            const line = await page
              .locator(".voxel-speech")
              .getAttribute("data-line");
            assert.ok(PUNCHLINES.includes(line), line);
            await page.waitForFunction(
              () =>
                window.__voxelWorld.zoom > 2 &&
                window.__voxelWorld.inspection?.id === "wanderer:0",
            );
            const still = await page.evaluate(
              () =>
                window.__voxelWorld.inhabitants.find(
                  (n) => n.id === "wanderer:0",
                ).position,
            );
            await page.waitForTimeout(250);
            const after = await page.evaluate(
              () =>
                window.__voxelWorld.inhabitants.find(
                  (n) => n.id === "wanderer:0",
                ).position,
            );
            assert.ok(Math.hypot(after.x - still.x, after.z - still.z) < 0.02);
            await page
              .getByRole("button", { name: "Fermer le dialogue" })
              .click();
          }
          assert.equal(
            await page.evaluate(() => localStorage.getItem("louchomage:v2")),
            before,
          );
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      },
    );
    await t.test(
      "dialogue types progressively, highlights keywords, ticks per letter and respects mute and reduced motion",
      async () => {
        const { context, page, errors } = await fixture();
        try {
          await page.evaluate(() => {
            window.__letterSounds = 0;
            const original = AudioContext.prototype.createOscillator;
            AudioContext.prototype.createOscillator = function (...args) {
              window.__letterSounds++;
              return original.apply(this, args);
            };
          });
          await page.locator('[data-world-object="wanderer:0"]').click();
          const card = page.locator(".voxel-speech");
          const full = await card.getAttribute("data-line");
          assert.equal(await card.getAttribute("data-typing"), "true");
          await page.waitForTimeout(220);
          const visible = await card
            .locator("p span[style]")
            .evaluateAll(
              (nodes) =>
                nodes.filter((n) => n.style.visibility === "visible").length,
            );
          assert.ok(visible > 0 && visible < full.length);
          assert.ok(await page.evaluate(() => window.__letterSounds > 0));
          await page
            .getByRole("button", { name: "Tout afficher ▾", exact: true })
            .click();
          assert.equal(await card.getAttribute("data-typing"), "false");
          assert.ok((await card.locator("mark").count()) > 0);
          assert.equal(
            await card.locator("p > span[aria-hidden]").innerText(),
            full,
          );
          await page
            .getByRole("button", { name: "Fermer le dialogue" })
            .click();
          const stopped = await page.evaluate(() => window.__letterSounds);
          await page.waitForTimeout(150);
          assert.equal(
            await page.evaluate(() => window.__letterSounds),
            stopped,
            "closing cancels all future typing sounds",
          );
          await page.getByRole("button", { name: /Ouvrir le carnet/ }).click();
          await page.locator(".sound-toggle").click(); // Music off, effects remain.
          await page.locator(".sound-toggle").click(); // All sound off.
          await page.keyboard.press("Escape");
          await ready(page);
          const muted = await page.evaluate(() => window.__letterSounds);
          await page.locator('[data-world-object="wanderer:0"]').click();
          await page.waitForTimeout(220);
          assert.equal(await page.evaluate(() => window.__letterSounds), muted);
          assert.equal(
            await card.getAttribute("data-typing"),
            "true",
            "mute leaves the visual typing intact",
          );
          await page
            .getByRole("button", { name: "Fermer le dialogue" })
            .click();
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page.locator('[data-world-object="wanderer:0"]').click();
          await page.waitForFunction(
            () =>
              document.querySelector(".voxel-speech")?.dataset.typing ===
              "false",
          );
          assert.equal(await page.evaluate(() => window.__letterSounds), muted);
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      },
    );
    await t.test(
      "clicking the actual wooden board focuses it and automatically restores the previous zoom on desktop and mobile",
      async () => {
        for (const viewport of [
          { width: 1280, height: 800 },
          { width: 390, height: 844 },
        ]) {
          const { context, page, errors } = await fixture(viewport);
          try {
            const original = await page.evaluate(
              () => window.__voxelWorld.zoom,
            );
            const target = page.locator('[data-world-object="sign:0:0"]');
            const box = await target.boundingBox();
            // Outside the small accessible hotspot: this exercises raycasting on the board itself.
            if (viewport.width > 400)
              await page.mouse.click(
                box.x + box.width / 2 + 26,
                box.y + box.height - 2,
              );
            else await target.click();
            await page.waitForFunction(
              () => window.__voxelWorld.inspection?.id === "sign:0:0",
            );
            await page.waitForFunction(
              (z) => window.__voxelWorld.zoom > z + 0.5,
              original,
            );
            assert.equal(
              await page.locator(".voxel-speech").count(),
              0,
              "the physical inscription is never duplicated in a popup",
            );
            if (viewport.width < 640)
              await page.waitForFunction(() => window.__voxelWorld.zoom > 3.1);
            await page.waitForFunction(
              (z) =>
                !window.__voxelWorld.inspection &&
                Math.abs(window.__voxelWorld.zoom - z) < 0.04,
              original,
              { timeout: 11000 },
            );
            assert.equal(await page.locator(".voxel-speech").count(), 0);
            assert.deepEqual(errors, []);
          } finally {
            await context.close();
          }
        }
      },
    );
    await t.test(
      "a real journey knocks a roaming NPC into a ballistic flight; it lands and no cosmetic state is saved",
      async () => {
        const { context, page, errors } = await fixture();
        try {
          await page.locator(".action-button--refus").click();
          await page.waitForFunction(
            () =>
              window.__voxelWorld.inhabitants.some(
                (n) => n.hits > 0 && n.mode === "flying",
              ),
            null,
            { polling: 30 },
          );
          const hit = await page.evaluate(() =>
            window.__voxelWorld.inhabitants.find((n) => n.hits > 0),
          );
          assert.ok(hit.velocity.y > 0);
          assert.equal(
            await page.evaluate(() => window.__voxelWorld.inspection),
            null,
          );
          await page.waitForFunction(
            (id) =>
              window.__voxelWorld.inhabitants.find((n) => n.id === id)?.mode ===
              "walking",
            hit.id,
          );
          const save = await page.evaluate(() =>
            JSON.parse(localStorage.getItem("louchomage:v2")),
          );
          assert.equal(save.events.length, 1);
          assert.equal(save.events[0].kind, "refus");
          assert.equal(save.inhabitants, undefined);
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      },
    );
  },
);
