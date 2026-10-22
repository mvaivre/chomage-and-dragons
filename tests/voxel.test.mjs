import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createHash } from "node:crypto";
import * as THREE from "three";
registerHooks({
  resolve(s, c, n) {
    if (s.startsWith("@/"))
      return n(new URL(`../src/${s.slice(2)}.ts`, import.meta.url).href, c);
    if (
      c.parentURL?.endsWith(".ts") &&
      s.startsWith(".") &&
      !/\.[a-z]+$/i.test(s)
    )
      return n(`${s}.ts`, c);
    return n(s, c);
  },
});
const { WORLD_LENGTH, BIOMES } = await import("../src/lib/game/world.ts");
const { CHARACTERS } = await import("../src/lib/game/characters.ts");
const { HIDDEN_ITEMS } = await import("../src/lib/game/hidden-objects.ts");
const { VARIANTS } = await import("../src/lib/game/variants.ts");
const {
  routeHeight,
  biomeWeights,
  routePoint,
  routeZ,
  terrainHeight,
  voxelPalette,
  WORLD_SCALE,
  CHUNK_SIZE,
  FOREGROUND_DEPTH,
  BACKGROUND_DEPTH,
  TERRAIN_BASE_THICKNESS,
  tileBottom,
  FOG_FAR,
  foregroundPool,
  poolRadius,
} = await import("../src/components/voxel/world.ts");
const { VoxelResources } = await import("../src/components/voxel/resources.ts");
const { makeChunk } = await import("../src/components/voxel/chunks.ts");
const { characterModel, propModel, dragonModel } =
  await import("../src/components/voxel/objects.ts");
const { createReaction } = await import("../src/components/voxel/staging.ts");
const { reactionTiming } = await import("../src/components/voxel/reactions.ts");
const { chestXForStep } = await import("../src/components/voxel/travel.ts");

test("the voxel route preserves every saved distance and is continuous at all biome borders", () => {
  for (let x = 0; x < WORLD_LENGTH * 3; x += 151.2) {
    assert.equal(routePoint(x).x, x / WORLD_SCALE);
    assert.equal(routePoint(x).y, routeHeight(x / WORLD_SCALE) + 0.18);
  }
  for (const b of BIOMES)
    for (let lap = 0; lap < 3; lap++) {
      const x = ((b.to + lap) * WORLD_LENGTH) / WORLD_SCALE;
      assert.ok(
        Math.abs(routeHeight(x - 0.001) - routeHeight(x + 0.001)) < 0.01,
        b.id,
      );
      const a = voxelPalette(x - 0.001),
        z = voxelPalette(x + 0.001);
      for (const key of Object.keys(a))
        assert.ok(
          Math.abs(new THREE.Color(a[key]).r - new THREE.Color(z[key]).r) <
            0.015,
        );
    }
  const mountain = routeHeight((0.66 * WORLD_LENGTH) / WORLD_SCALE),
    plain = routeHeight(20);
  assert.ok(mountain > plain + 10, "mountains have physical altitude");
  assert.ok(
    FOG_FAR < CHUNK_SIZE * 2,
    "the fog closes before the streamed terrain edge",
  );
  for (let i = 1; i <= 500; i++)
    assert.equal(
      chestXForStep(i * 10, WORLD_LENGTH, 200),
      ((i * 10) / 200) * WORLD_LENGTH,
    );
});

test("resident dragons retain five distinct coats and the black dragon's red eyes", () => {
  const r = new VoxelResources(),
    coats = new Set();
  for (const variant of ["green", "red", "blue", "black", "gold"]) {
    const root = dragonModel(r, variant);
    coats.add(signature(root));
    if (variant === "black") {
      let redEyes = false;
      root.traverse((o) => {
        if (o.isInstancedMesh && o.material.color.getHex() === 0xd4484d)
          redEyes = true;
      });
      assert.ok(redEyes);
    }
    r.release(root);
  }
  assert.equal(coats.size, 5);
  assert.equal(r.instances.size, 0);
  r.dispose();
});

function signature(root) {
  const hash = createHash("sha256");
  root.traverse((o) => {
    if (o.isInstancedMesh) {
      hash.update(Buffer.from(o.instanceMatrix.array.buffer));
      hash.update(String(o.material.color.getHex()));
      if (o.instanceColor) hash.update(Buffer.from(o.instanceColor.array.buffer));
    }
  });
  return hash.digest("hex");
}
test("all characters and collectibles have distinct voxel models with registered feet", () => {
  const r = new VoxelResources(),
    signatures = new Set();
  for (const c of CHARACTERS) {
    const root = characterModel(r, c.id, true),
      b = new THREE.Box3().setFromObject(root);
    assert.ok(b.min.y >= -0.08 && b.min.y <= 0.05, c.id);
    assert.ok(b.max.y > 1.7, c.id);
    let triangles = 0;
    root.traverse(o => { if (o.isInstancedMesh) triangles += o.count * 12; });
    assert.ok(triangles <= 1000, `${c.id}: model plus its occlusion proxy stay bounded`);
    signatures.add(signature(root));
    r.release(root);
    assert.equal(
      r.ownedMaterials.size,
      0,
      "character masks release their private materials",
    );
  }
  assert.equal(signatures.size, CHARACTERS.length);
  const objects = new Set();
  for (const item of HIDDEN_ITEMS) {
    const root = propModel(r, item.model);
    objects.add(signature(root));
    r.release(root);
  }
  assert.equal(objects.size, HIDDEN_ITEMS.length);
  assert.equal(
    r.instances.size,
    0,
    "unloaded models release their GPU instance buffers",
  );
  r.dispose();
});

test("chunk generation is deterministic and every terrain face has correct winding", () => {
  const r = new VoxelResources(),
    a = makeChunk(0, 0, r),
    b = makeChunk(0, 0, r);
  assert.equal(signature(a), signature(b));
  const ground = a.children.find((o) => o.isMesh && !o.isInstancedMesh),
    p = ground.geometry.attributes.position,
    n = ground.geometry.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    assert.ok(
      p.getZ(i) <= FOREGROUND_DEPTH && p.getZ(i) >= -BACKGROUND_DEPTH,
      "terrain, including its exposed sides, stays inside the straight tile boundaries",
    );
  }
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
    normal = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    v.forEach((x, j) => x.fromBufferAttribute(p, i + j));
    normal
      .subVectors(v[1], v[0])
      .cross(new THREE.Vector3().subVectors(v[2], v[0]));
    assert.ok(
      normal.dot(new THREE.Vector3().fromBufferAttribute(n, i)) > 0,
      `backwards terrain face ${i}`,
    );
  }
  for (let x = -2; x < 2; x += 0.25)
    assert.equal(terrainHeight(x, 5), terrainHeight(x, 5));
  a.userData.dispose();
  b.userData.dispose();
  assert.equal(r.instances.size, 0);
  r.dispose();
});

test("all saved reactions build, animate and release their resources, including the 47 letters", () => {
  const r = new VoxelResources();
  for (const kind of [
    ...Object.values(VARIANTS)
      .flat()
      .map((v) => v.id),
    "shotVolley",
    "fireCurse",
    "dragonDrop",
    "frogCurse",
    "paperStorm",
    "chest",
    "dragonMeal",
  ]) {
    const effect = createReaction(r, kind),
      timing = reactionTiming(kind);
    assert.ok(timing.impact < timing.duration, kind);
    assert.ok(effect.root.children.length > 0, kind);
    for (const t of [0, 0.2, 0.5, 1]) {
      effect.update(t, (t * timing.duration) / 1000);
      effect.root.traverse((o) =>
        assert.ok([...o.position].every(Number.isFinite), kind),
      );
    }
    if (kind === "mythicRejection")
      assert.equal(effect.root.children.length, 47);
    r.release(effect.root);
  }
  assert.equal(r.instances.size, 0);
  r.dispose();
});

test("inhabitants have articulated movement and return to a stable reduced-motion pose", () => {
  const resources = new VoxelResources();
  for (const kind of ["hero", "fox", "hen", "goat", "otter", "heron"]) {
    const root =
      kind === "hero"
        ? characterModel(resources, "barde")
        : propModel(resources, kind);
    const poses = () => {
      const values = [];
      root.traverse((o) =>
        values.push(o.rotation.x, o.rotation.y, o.rotation.z),
      );
      return values;
    };
    root.userData.animate(0, false);
    const still = poses();
    root.userData.animate(0.43, true);
    assert.notDeepEqual(poses(), still, kind);
    assert.ok(poses().every(Number.isFinite), kind);
    root.userData.animate(0, false);
    assert.deepEqual(poses(), still, kind);
    resources.release(root);
  }
  assert.equal(resources.instances.size, 0);
  resources.dispose();
});

const { createLifeBody, patrol, segmentDistance, launch, stepLife } =
  await import("../src/components/voxel/life.ts");
const { conversationLine } =
  await import("../src/components/voxel/conversations.ts");
const { PUNCHLINES } = await import("../src/lib/game/punchlines.ts");

test("inhabitants patrol inside a bounded miniature and stay still with reduced motion", () => {
  const body = createLifeBody({ x: 10, y: 0, z: -3.2 }, 0.7);
  for (let time = 0; time < 100; time += 0.1) {
    const p = patrol(body, time);
    assert.ok(Math.abs(p.x - 10) <= 2.1 + 0.001);
    assert.ok(p.z >= -3.2 && p.z <= 0.3 + 0.001);
    const desk = patrol(body, time, true);
    assert.ok(Math.abs(desk.x - 10) <= 0.281);
    assert.deepEqual(patrol(body, time, false, true), body.home);
  }
});
test("a swept collision launches once, bounces and recovers consistently at different frame rates", () => {
  assert.equal(
    segmentDistance(
      { x: 0, y: 0, z: 0 },
      { x: 20, y: 0, z: 0 },
      { x: 10, y: 0, z: 0.3 },
    ),
    0.3,
  );
  const simulate = (dt) => {
    const body = createLifeBody({ x: 0, y: 0, z: 0 }, 0.3);
    assert.ok(launch(body, 12, 0));
    assert.equal(launch(body, 12, 0), false);
    const frozen = JSON.stringify(body);
    stepLife(body, 0, () => 0);
    assert.equal(JSON.stringify(body), frozen);
    let peak = 0;
    for (let t = 0; t < 5; t += dt) {
      stepLife(body, dt, () => 0);
      peak = Math.max(peak, body.position.y);
      assert.ok(body.position.y >= 0);
      assert.ok(Math.abs(body.position.x) <= 5.501);
      assert.ok(Object.values(body.position).every(Number.isFinite));
    }
    assert.ok(peak > 1.4);
    assert.equal(body.mode, "walking");
    assert.equal(body.hits, 1);
    assert.equal(body.tumble, 0);
    return body;
  };
  const a = simulate(1 / 30),
    b = simulate(1 / 120);
  assert.ok(Math.abs(a.position.x - b.position.x) < 0.08);
  const gentle = createLifeBody({ x: 0, y: 0, z: 0 }, 0);
  launch(gentle, 8, 0, true);
  assert.equal(gentle.spin, 0);
  stepLife(gentle, 0.05, () => 0);
  assert.ok(gentle.position.y < 0.1);
});
test("every NPC conversation is a rotating punchline; signs retain their own inscriptions", () => {
  for (const id of [
    "resident:hen",
    "staff:clerk",
    "tavern:band",
    "dragon:100",
  ]) {
    const lines = Array.from({ length: PUNCHLINES.length }, (_, i) =>
      conversationLine(id, "resident", "old line", i),
    );
    assert.equal(new Set(lines).size, PUNCHLINES.length);
    assert.ok(lines.every((line) => PUNCHLINES.includes(line)));
  }
  assert.equal(
    conversationLine(
      "sign:welcome",
      "sign",
      "Bienvenue dans la quête du CDI",
      8,
    ),
    "Bienvenue dans la quête du CDI",
  );
});
test("heroes have head, torso and distance-driven gait as well as expressive action poses", () => {
  const resources = new VoxelResources();
  const pose = (root) => {
    const values = [];
    root.traverse((o) =>
      values.push(o.rotation.x, o.rotation.y, o.rotation.z, o.position.y),
    );
    return values;
  };
  for (const character of CHARACTERS) {
    const root = characterModel(resources, character.id);
    assert.ok(root.getObjectByName("head"));
    assert.ok(root.getObjectByName("torso"));
    root.userData.animate(1, true, { blend: 1, stride: 0 });
    const first = pose(root);
    root.userData.animate(1, true, { blend: 1, stride: Math.PI / 2 });
    assert.notDeepEqual(pose(root), first, character.id);
    const poses = new Set();
    for (const motion of ["idle", "send", "hurt", "celebrate"]) {
      root.userData.animate(1, false, { motion });
      poses.add(JSON.stringify(pose(root)));
    }
    assert.equal(poses.size, 4, character.id);
    resources.release(root);
  }
  resources.dispose();
});

test("foreground stays level outside inset ponds while the back keeps real relief", () => {
  for (const biome of BIOMES) {
    const x = (((biome.from + biome.to) / 2) * WORLD_LENGTH) / WORLD_SCALE;
    for (const depth of [1.5, 2.5, 4, FOREGROUND_DEPTH - 0.2]) {
      const pool = foregroundPool(x);
      if (pool && poolRadius(pool, x, routeZ(x) + depth) < 1.35) continue;
      assert.ok(
        Math.abs(
          terrainHeight(x, routeZ(x) + depth) - (routeHeight(x) + 0.12),
        ) < 1e-9,
        biome.id,
      );
    }
  }
  assert.ok(BACKGROUND_DEPTH > FOREGROUND_DEPTH);
  const x = (0.67 * WORLD_LENGTH) / WORLD_SCALE;
  assert.ok(
    Array.from(
      { length: 12 },
      (_, i) => terrainHeight(x + i, routeZ(x + i) - 8) - routeHeight(x + i),
    ).some((y) => Math.abs(y) > 1),
  );
});

test("foreground ponds have level water, a submerged bed, clear walking lanes and compact wildlife", () => {
  const r = new VoxelResources();
  for (let x = 0; x < WORLD_LENGTH / WORLD_SCALE * 2; x += 26) {
    const pool = foregroundPool(x);
    if (!pool) continue;
    assert.ok(pool.z + pool.rz * 1.35 < FOREGROUND_DEPTH);
    assert.ok(pool.z - pool.rz * 1.35 > routeZ(pool.x) + 1.4);
    for (const dx of [-1, 0, 1]) assert.ok(terrainHeight(pool.x + dx, pool.z) < pool.y);
  }
  const chunk = makeChunk(0, 0, r), ducks = [];
  chunk.traverse(o => { if (o.name === "pond-duck") ducks.push(o); });
  assert.equal(ducks.length, 2);
  const before = ducks.map(duck => duck.position.clone());
  chunk.userData.animate(10);
  for (const [index, duck] of ducks.entries()) {
    let cost = 0;
    duck.traverse(o => { if (o.isInstancedMesh) cost += o.count * 12; });
    assert.ok(cost < 120);
    assert.ok(duck.position.distanceTo(before[index]) > 0.1);
    assert.ok(Math.abs(duck.position.y - foregroundPool(9).y) < 0.02);
  }
  chunk.userData.dispose(); assert.equal(r.instances.size, 0); r.dispose();
});
test("straight front and rear edges share a closed underside even across steep biome transitions", () => {
  const r = new VoxelResources();
  for (const cx of [0, 25, 27, 31]) {
    const chunk = makeChunk(cx, 0, r),
      mesh = chunk.children.find((o) => o.isMesh && !o.isInstancedMesh);
    const p = mesh.geometry.attributes.position,
      n = mesh.geometry.attributes.normal;
    const bottoms = new Map();
    let underside = 0;
    for (let i = 0; i < p.count; i += 6) {
      if (n.getY(i) < -0.1) {
        underside++;
        for (let j = 0; j < 6; j++)
          assert.ok(
            Math.abs(p.getY(i + j) - tileBottom(p.getX(i + j))) < 0.00001,
          );
      }
      if (
        Math.abs(n.getZ(i)) < 0.9 ||
        (p.getZ(i) !== FOREGROUND_DEPTH && p.getZ(i) !== -BACKGROUND_DEPTH)
      )
        continue;
      for (let j = 0; j < 6; j++) {
        const x = p.getX(i + j),
          z = p.getZ(i + j),
          y = p.getY(i + j),
          key = `${x}:${z}`;
        bottoms.set(key, Math.min(bottoms.get(key) ?? Infinity, y));
      }
    }
    assert.equal(underside, CHUNK_SIZE / 0.5);
    for (const [key, y] of bottoms) {
      const [x] = key.split(":").map(Number);
      assert.ok(Math.abs(y - tileBottom(x)) < 0.00001, key);
    }
    assert.equal(bottoms.size, (CHUNK_SIZE / 0.5 + 1) * 2);
    chunk.userData.dispose();
  }
  assert.equal(r.instances.size, 0);
  r.dispose();
  for (let x = 0; x < WORLD_LENGTH / WORLD_SCALE; x += 0.25)
    for (let z = -BACKGROUND_DEPTH; z <= FOREGROUND_DEPTH; z += 1)
      assert.ok(
        terrainHeight(x, z) > tileBottom(x),
        `no terrain below the slab at ${x},${z}`,
      );
  assert.ok(
    TERRAIN_BASE_THICKNESS < 2,
    "the readable front edge remains shallow",
  );
});

const { dialogueTokens, letterDelay } =
  await import("../src/components/voxel/dialogue-text.ts");
test("every punchline keeps its exact text and meaningful emphasis, with short punctuation pauses", () => {
  for (const text of PUNCHLINES) {
    const tokens = dialogueTokens(text);
    assert.equal(tokens.map((t) => t.text).join(""), text);
    assert.ok(
      tokens.some((t) => t.emphasis),
      text,
    );
    for (const t of tokens)
      assert.equal(text.slice(t.start, t.start + t.text.length), t.text);
  }
  assert.ok(
    dialogueTokens("Ton cerveau est actuellement en error 404.").some(
      (t) => t.emphasis && t.text === "error 404",
    ),
  );
  assert.ok(
    letterDelay(".") > letterDelay(",") && letterDelay(",") > letterDelay("e"),
  );
});

const { stampCrushPose, hasStampCrush, STAMP_RELEASE } =
  await import("../src/components/voxel/stamp-crush.ts");
test("the post-interview stamp holds a paper-thin hero, lifts before a rubbery pop and settles exactly", () => {
  assert.ok(hasStampCrush({ kind: "legendary" }));
  for (const variant of VARIANTS.rejetApresEntretien) {
    assert.ok(hasStampCrush({ kind: variant.id, stampCrush: true }));
    assert.equal(reactionTiming(variant.id, true).duration, 3900);
  }
  assert.ok(!hasStampCrush({ kind: "pigeon" }));
  const pressed = stampCrushPose(0.8),
    sliding = stampCrushPose(2);
  assert.ok(pressed.y < 0.08 && pressed.x > 3 && pressed.z > 3);
  assert.deepEqual(pressed, sliding);
  assert.equal(pressed.stampLift, 0);
  const lift = stampCrushPose(STAMP_RELEASE + 0.07);
  assert.ok(
    lift.stampLift > 0 && lift.y < 0.08,
    "the stamp lifts before the hero springs up",
  );
  assert.ok(stampCrushPose(2.95).y > 1.25);
  for (let t = 0; t < 4; t += 1 / 120) {
    const pose = stampCrushPose(t);
    assert.ok(
      [pose.x, pose.y, pose.z, pose.hop, pose.wobble, pose.stampLift].every(
        Number.isFinite,
      ),
    );
    assert.ok(pose.x > 0 && pose.y > 0 && pose.z > 0);
  }
  assert.deepEqual(stampCrushPose(3.9), stampCrushPose(0, true));
  const resources = new VoxelResources();
  for (const character of CHARACTERS) {
    const hero = characterModel(resources, character.id);
    const height = new THREE.Box3()
      .setFromObject(hero)
      .getSize(new THREE.Vector3()).y;
    const staging = createReaction(resources, "legendary");
    staging.update(0.8 / 3.9, 0.8, height);
    const stamp = staging.root.getObjectByName("crushing-stamp");
    assert.ok(
      Math.abs(
        new THREE.Box3().setFromObject(stamp).min.y -
          (height * pressed.y + 0.025),
      ) < 0.000001,
      character.id,
    );
    staging.update(1, 3.9, height);
    assert.equal(stamp.visible, false);
    resources.release(staging.root);
    resources.release(hero);
  }
  for (const variant of VARIANTS.rejetApresEntretien) {
    const staging = createReaction(resources, variant.id, "green", true);
    assert.ok(staging.root.getObjectByName("crushing-stamp"));
    for (const t of [0, 0.56, 1.8, 2.95, 3.9]) staging.update(t / 3.9, t);
    resources.release(staging.root);
  }
  assert.equal(resources.instances.size, 0);
  resources.dispose();
});

const { chestStopForJourney } =
  await import("../src/components/voxel/travel.ts");
const { chestPickupPose, chestPickup, CHEST_OPEN_AT, CHEST_PICKUP_DURATION } =
  await import("../src/components/voxel/chest.ts");
test("a chest interrupts only its forward milestone; pickup remains closed before opening and never accumulates its world origin", () => {
  const length = 30240,
    total = 200;
  assert.equal(chestStopForJourney(1209.6, 1512, 10, length, total), 1449.5);
  assert.equal(chestStopForJourney(1209.6, 2116.8, 10, length, total), 1449.5);
  assert.equal(chestStopForJourney(1512, 1209.6, 10, length, total), null);
  assert.equal(chestStopForJourney(1600, 1800, 10, length, total), null);
  assert.equal(chestStopForJourney(1209.6, 1512, null, length, total), null);
  assert.equal(reactionTiming("chest").impact / 1000, CHEST_OPEN_AT);
  assert.equal(reactionTiming("chest").duration / 1000, CHEST_PICKUP_DURATION);
  assert.equal(chestPickupPose(0.5).lift, 0);
  assert.equal(chestPickupPose(1.6).lift, 1);
  assert.equal(chestPickupPose(1.6).opening, 0);
  assert.equal(chestPickupPose(2.5).opening, 1);
  assert.equal(chestPickupPose(0.4, true).wobble, 0);
  assert.equal(chestPickupPose(1, true).hop, 0);
  const r = new VoxelResources(),
    effect = chestPickup(r);
  const chest = effect.root.getObjectByName("treasure-chest");
  effect.update(0, 0);
  assert.ok(new THREE.Box3().setFromObject(chest).min.y >= 0);
  for (const elapsed of [0.3, 1.5, 2.5, 3.2]) {
    effect.root.position.set(30, 3, 4);
    effect.update(elapsed / 3.2, elapsed);
    assert.deepEqual(effect.root.position.toArray(), [0, 0, 0]);
    assert.ok([...chest.position].every(Number.isFinite));
    assert.ok(chest.userData.lid.rotation.x <= 0);
  }
  assert.ok(chest.userData.lid.rotation.x < -Math.PI / 2);
  r.release(effect.root);
  assert.equal(r.instances.size, 0);
  r.dispose();
});

const { plantTree } = await import("../src/components/voxel/trees.ts");
const { sceneryFootprints, journeyPoint, roomRouteZ, portalSite, millSite } = await import("../src/components/voxel/layout.ts");
const { INTERIORS } = await import("../src/lib/game/decor.ts");

test("every generated canopy stays clear of building roofs and mill sails across two laps", () => {
  const r = new VoxelResources();
  for (let cx = -1; cx < Math.ceil(WORLD_LENGTH / WORLD_SCALE * 2 / CHUNK_SIZE); cx++) {
    const chunk = makeChunk(cx, 0, r), sites = sceneryFootprints(cx * CHUNK_SIZE - 4, (cx + 1) * CHUNK_SIZE + 4);
    for (const tree of chunk.userData.trees) {
      const bounds = new THREE.Box3();
      const emit = (_color, x, y, z, w, h = w, d = w) => {
        bounds.expandByPoint(new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2));
        bounds.expandByPoint(new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2));
      };
      plantTree(emit, emit, biomeWeights(tree.x).a.id, 1, tree.x, 0, tree.z, tree.size, 0x426d3c);
      for (const s of sites) assert.ok(bounds.max.x <= s.x - s.rx || bounds.min.x >= s.x + s.rx || bounds.max.z <= s.z - s.rz || bounds.min.z >= s.z + s.rz, `${cx}: tree intersects ${s.id}`);
    }
    chunk.userData.dispose();
  }
  const mill = millSite(0), level = terrainHeight(mill.x, mill.z);
  for (const dx of [-0.9, 0.9]) for (const dz of [-0.6, 0.6]) assert.equal(terrainHeight(mill.x + dx, mill.z + dz), level);
  assert.equal(r.instances.size, 0); r.dispose();
});

test("interior journeys use the room aisle and visible doors while preserving saved distances", () => {
  for (const room of INTERIORS) {
    for (let x = room.from + 0.1; x < room.to; x += 10) for (const lane of [-0.95, 0, 0.95]) {
      const p = journeyPoint(x, lane);
      assert.equal(p.x, x / WORLD_SCALE); assert.equal(p.z, roomRouteZ(room) + lane);
      assert.equal(p.y, routeHeight(p.x) + 0.18);
      assert.ok(Math.abs(p.z - roomRouteZ(room)) + 0.5 < 1.55, "body stays clear of counters, conveyors and door jambs");
    }
    for (const end of [0, 1]) {
      const door = portalSite(room, end), boundary = end ? room.to : room.from;
      const p = journeyPoint(boundary + (end ? 0.01 : -0.01));
      assert.ok(Math.abs(p.x - door.x) < 0.001);
      assert.ok(Math.abs(p.z - door.doorZ) < 0.001);
      assert.ok(Math.abs(p.y - door.y - 0.36) < 0.001);
    }
  }
});
const { LocalLightPool } = await import("../src/components/voxel/lighting.ts");
const { QUALITY, deviceQuality, QualityGovernor } = await import("../src/components/voxel/quality.ts");

test("every tree species stays below 100 triangles while retaining a grounded trunk", () => {
  for (const biome of BIOMES) {
    if (["volcan", "desert"].includes(biome.id)) continue;
    for (let variant = 0; variant < 12; variant++) {
      const boxes = [];
      const emit = (...args) => boxes.push(args);
      const triangles = plantTree(emit, emit, biome.id, variant, 10, 3, -5, 1.25, 0x426d3c);
      assert.equal(triangles, boxes.length * 12);
      assert.ok(triangles >= 72 && triangles <= 96, `${biome.id}: ${triangles}`);
      const trunk = boxes[0];
      assert.ok(Math.abs(trunk[2] - trunk[5] / 2 - 3) < 1e-8);
    }
  }
});

test("multicolor voxel batches preserve exact linear colors in two draws and release light sources", () => {
  const r = new VoxelResources(true), root = new THREE.Group();
  const b = r.batch(root);
  const shades = [0x245537, 0xe3a26d, 0xb8d2a3, 0xffd675];
  shades.forEach((color, i) => b.box(color, i, 0, 0, 1));
  b.box(0xfebc55, 0, 1, 0, 1, 1, 1, 0, true);
  b.finish();
  assert.equal(root.children.length, 2);
  const colors = root.children[0].instanceColor;
  shades.forEach((color, i) => {
    const expected = new THREE.Color(color);
    assert.ok(Math.abs(colors.getX(i) - expected.r) < 1e-6);
    assert.ok(Math.abs(colors.getY(i) - expected.g) < 1e-6);
    assert.ok(Math.abs(colors.getZ(i) - expected.b) < 1e-6);
  });
  const light = r.pointLight(0xffb85e, 12, 7);
  root.add(light);
  assert.equal(light.visible, false);
  assert.equal(r.lights.size, 1);
  r.release(root);
  assert.equal(r.instances.size, 0);
  assert.equal(r.lights.size, 0);
  r.dispose();
});

test("the shader light count stays constant across hidden rooms and changing source counts", () => {
  const world = new THREE.Scene(), r = new VoxelResources(), pool = new LocalLightPool(world, 4);
  const outside = new THREE.Group(), inside = new THREE.Group();
  world.add(outside, inside);
  inside.visible = false;
  for (let i = 0; i < 20; i++) {
    const light = r.pointLight(0xffbb66, i + 1, 6);
    light.position.x = i;
    outside.add(light);
  }
  inside.add(r.pointLight(0xff0000, 100, 6));
  pool.update(r.lights, new THREE.Vector3(), 2);
  assert.equal(pool.active, 2);
  assert.deepEqual(pool.lights.map(l => l.intensity), [1, 2, 0, 0]);
  outside.visible = false;
  inside.visible = true;
  pool.update(r.lights, new THREE.Vector3(), 4);
  assert.equal(pool.active, 1);
  assert.deepEqual(pool.lights.map(l => l.intensity), [100, 0, 0, 0]);
  r.release(inside);
  pool.update(r.lights, new THREE.Vector3(), 4);
  assert.equal(pool.active, 0);
  assert.equal(pool.lights.length, 4);
  assert.ok(pool.lights.every(l => l.visible));
  r.release(outside); r.dispose();
});

test("mobile budgets disable bloom immediately; isolated loading stalls never downgrade quality", () => {
  assert.equal(deviceQuality(390, false, 8), 1);
  assert.equal(deviceQuality(1280, true, 8), 1);
  assert.equal(deviceQuality(1280, false, 4), 1);
  assert.equal(deviceQuality(1280, false, 8, 4), 1);
  assert.equal(deviceQuality(1280, false, 8, 8), 0);
  assert.equal(QUALITY[1].bloom, false);
  assert.ok(QUALITY[1].lights <= 2 && QUALITY[1].shadowSize <= 512);
  const governor = new QualityGovernor();
  for (let i = 0; i < 100; i++) governor.sample(250, false);
  assert.equal(governor.level, 0);
  for (let i = 0; i < 10; i++) { governor.sample(80, true); governor.sample(33, true); }
  assert.equal(governor.level, 0);
  for (let i = 0; i < 30; i++) governor.sample(80, true);
  assert.equal(governor.level, 1);
  for (let i = 0; i < 100; i++) governor.sample(80, true);
  assert.equal(governor.level, 2);
});

const { ContactShadows } = await import("../src/components/voxel/contact-shadows.ts");
test("mobile contact shadows use two triangles per footprint, cap capacity, clear and release their resources", () => {
  const world = new THREE.Scene(), shadows = new ContactShadows(world, new THREE.Vector2(), 2);
  assert.equal(shadows.mesh.geometry.index.count, 6);
  assert.ok(shadows.mesh.geometry.attributes.normal.getY(0) > 0.99);
  assert.equal(shadows.mesh.castShadow, false);
  assert.equal(shadows.mesh.material.depthWrite, false);
  assert.equal(shadows.mesh.material.uniforms.focus.value.isVector2, true);
  shadows.begin(true);
  shadows.add({ x: 10, y: 3, z: -2, rx: 2, rz: 1 });
  shadows.add({ x: 11, y: 3.2, z: -2, rx: 0.4, rz: 0.3, opacity: 0.5 });
  shadows.add({ x: 50, y: 3, z: 20, rx: 1, rz: 1 });
  shadows.finish();
  assert.equal(shadows.mesh.count, 2);
  const transform = new THREE.Matrix4(); shadows.mesh.getMatrixAt(0, transform);
  assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(transform).toArray(), [10, 3, -2]);
  assert.deepEqual(new THREE.Vector3().setFromMatrixScale(transform).toArray(), [2, 1, 1]);
  shadows.begin(false); shadows.finish();
  assert.equal(shadows.mesh.count, 0);
  assert.equal(shadows.mesh.visible, false);
  let released = 0;
  for (const resource of [shadows.mesh, shadows.mesh.geometry, shadows.mesh.material])
    resource.addEventListener("dispose", () => released++);
  shadows.dispose();
  assert.equal(released, 3);
  assert.equal(world.children.length, 0);
  assert.equal(QUALITY[1].shadowSize, 0, "mobile never allocates a shadow map");
});

test("mobile terrain strips preserve exactly the same surfaces, colors and decorations", () => {
  const fullResources = new VoxelResources(true), mobileResources = new VoxelResources(true, 4);
  const full = makeChunk(34, 0, fullResources), mobile = makeChunk(34, 0, mobileResources);
  function surfaces(root) {
    const quads = [];
    root.traverse(mesh => {
      if (!mesh.isMesh || mesh.isInstancedMesh) return;
      const { position, normal, color } = mesh.geometry.attributes;
      for (let i = 0; i < position.count; i += 6) {
        const face = [];
        for (let j = 0; j < 6; j++) for (const attr of [position, normal, color])
          face.push(attr.getX(i + j), attr.getY(i + j), attr.getZ(i + j));
        quads.push(face.join(","));
      }
    });
    return quads.sort();
  }
  function cubes(root) {
    root.updateMatrixWorld(true);
    const boxes = [], matrix = new THREE.Matrix4(), color = new THREE.Color();
    root.traverse(mesh => {
      if (!mesh.isInstancedMesh) return;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix); matrix.premultiply(mesh.matrixWorld);
        if (mesh.instanceColor) mesh.getColorAt(i, color); else color.copy(mesh.material.color);
        boxes.push([...matrix.elements, color.r, color.g, color.b].join(","));
      }
    });
    return boxes.sort();
  }
  assert.deepEqual(surfaces(mobile), surfaces(full));
  assert.deepEqual(cubes(mobile), cubes(full));
  assert.deepEqual(mobile.userData.contactPatches, full.userData.contactPatches);
  assert.equal(mobile.children.filter(c => c.isMesh && !c.isInstancedMesh).length, 4);
  full.userData.dispose(); mobile.userData.dispose();
  assert.equal(fullResources.instances.size, 0); assert.equal(mobileResources.instances.size, 0);
  fullResources.dispose(); mobileResources.dispose();
});

test("wall signs keep their text aspect and cannot overlap the room title", async () => {
  const { letterBoard, interiorDetails } = await import("../src/components/voxel/scenery.ts");
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document"), calls = [];
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement() { const context = { font: "", fillRect() {}, strokeRect() {}, measureText(text) { return { width: text.length * parseFloat(this.font.replace("bold ", "")) * 0.55 }; }, fillText(...args) { calls.push(args); } }; return { width: 0, height: 0, getContext() { return context; } }; } } });
  const r = new VoxelResources();
  try {
    for (const [width, height, text] of [[2.8, 1.05, "Votre expérience ne rentre pas horizontalement"], [2.6, 0.6, "GUICHET 5 · Pause réglementaire"], [3.4, 0.5, "BUREAU DES POSSIBLES"]]) {
      const board = letterBoard(r, text, width, height, "wall"), layout = board.userData.textLayout;
      assert.ok(Math.abs(layout.textureWidth / layout.textureHeight - width / height) < 0.04);
      assert.equal(layout.lines.join(" "), text); assert.ok(layout.lines.length * layout.fontSize * 1.15 < layout.textureHeight);
      assert.ok(new THREE.Box3().setFromObject(board).min.y > 1, "wall labels have no stray stake");
      r.release(board);
    }
    for (const room of INTERIORS) {
      const model = interiorDetails(r, room.id, room.from / WORLD_SCALE, room.to / WORLD_SCALE), title = model.getObjectByName("room-title-sign"), a = new THREE.Box3().setFromObject(title);
      model.traverse(o => { if (o.name.startsWith("counter-sign:")) { const b = new THREE.Box3().setFromObject(o); assert.ok(!a.intersectsBox(b), `${room.id}: ${o.name}`); } });
      r.release(model);
    }
    assert.ok(calls.length > 0 && calls.every(args => args.length === 3), "text is wrapped, never squeezed with fillText's maxWidth");
    assert.equal(r.ownedMaterials.size, 0); assert.equal(r.instances.size, 0);
  } finally { r.dispose(); if (previous) Object.defineProperty(globalThis, "document", previous); else delete globalThis.document; }
});

test("the forest troll has a grounded heavy silhouette, a face and four moving limbs below 600 triangles", () => {
  const r = new VoxelResources(), troll = propModel(r, "troll"), bounds = new THREE.Box3().setFromObject(troll);
  assert.equal(troll.name, "forest-troll"); assert.ok(Math.abs(bounds.min.y) < 0.00001);
  assert.ok(bounds.max.y > 2.3 && bounds.getSize(new THREE.Vector3()).x > 1.9);
  assert.equal(troll.userData.arms.length, 2); assert.equal(troll.userData.legs.length, 2);
  let triangles = 0, draws = 0;
  troll.traverse(o => { if (o.isInstancedMesh) { triangles += o.count * 12; draws++; } });
  assert.ok(triangles < 600); assert.ok(draws <= 6);
  troll.userData.animate(1, true, { stride: 1, blend: 1 });
  assert.ok(troll.userData.legs[0].rotation.x > 0.1 && troll.userData.legs[1].rotation.x < -0.1);
  troll.userData.animate(2, false, { blend: 0, motion: "send" });
  assert.equal(Math.abs(troll.userData.legs[0].rotation.x), 0); assert.ok(Math.abs(troll.userData.head.rotation.x) > 0);
  r.release(troll); assert.equal(r.instances.size, 0); r.dispose();
});
