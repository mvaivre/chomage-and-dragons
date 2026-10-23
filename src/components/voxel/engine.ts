import * as THREE from "three";
import { FramePacer } from "./frame-pacer";
import { SceneObjects } from "./scene-objects";
import { ContactShadows, type ContactPatch } from "./contact-shadows";
import { LocalLightPool } from "./lighting";
import { QUALITY, deviceQuality, QualityGovernor } from "./quality";
import { chestStopForJourney } from "./travel";
import { hasStampCrush, stampCrushPose, STAMP_RELEASE } from "./stamp-crush";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { MiniaturePass } from "./miniature";
import { ScenePass, sceneSamples } from "./scene-pass";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { PlayerView } from "@/hooks/useGame";
import { HIDDEN_ITEMS } from "@/lib/game/hidden-objects";
import {
  dragonNests,
  dragonVariantAt,
  dragonFirePower,
  dragonIdleFrame,
} from "@/lib/game/dragon";
import {
  decorForLap,
  personaliseDecor,
  interiorsInRange,
  interiorAt,
  type GroupDecor,
} from "@/lib/game/decor";
import { environmentSites } from "@/lib/game/environment";
import { biomeAt, WORLD_LENGTH, worldXFor } from "@/lib/game/world";
import { currentDaylight } from "@/lib/client/daylight";
import { setMusicPlace } from "@/lib/client/music";
import { sfx } from "@/lib/client/sound";
import { JOURNEY_TARGET } from "@/lib/config";
import { scene, resetScene, residentReactions } from "./state";
import { VoxelResources } from "./resources";
import { makeChunk } from "./chunks";
import { characterModel, dragonModel, propModel } from "./objects";
import {
  CHUNK_SIZE,
  FOREGROUND_DEPTH,
  BACKGROUND_DEPTH,
  WORLD_SCALE,
  routeHeight,
  routeZ,
  voxelPalette,
  terrainSurface as terrainHeight,
} from "./world";
import { reactionTiming, type Effect, type HeroMotion } from "./reactions";
import { bursts } from "./fx";
import { landmarkModel, tavernGuest } from "./landmarks";
import { TAVERN_GUESTS, tavernMoonwalk } from "@/lib/game/tavern";
import {
  createLifeBody,
  WALKERS,
  patrol,
  launch,
  stepLife,
  segmentDistance,
  dampAngle,
  type LifeBody,
} from "./life";
import { nextDoor, type RoomLocation } from "@/lib/game/doors";
import { journeyPoint, portalSite, villageSites, millSite, roomRouteZ, tearsSite, landscapePlots, foregroundPlots, landscapeView, narrativeSite, entranceViewZoom } from "./layout";
import { factoryStations, factoryWorker } from "./factory";
import { landscapeModel } from "./landscapes";
import { ExplorationZoom, frameRoadPerspective, MINIATURE_CAMERA_DISTANCE } from "./framing";
import { skyDragon, skyFlights } from "./sky";
import { foregroundGrove } from "./foreground";
import { INSPECTION_SECONDS } from "./conversations";
import { letterBoard, cottage, interiorDetails, waysideCamp } from "./scenery";
import { entranceBuilding } from "./entrances";
import { startingMarket } from "./starting-market";
import { START_MARKET_X } from "./sites";
import { createReaction } from "./staging";

export interface GameCanvasProps {
  players: PlayerView[];
  meId: string | null;
  focusPlayerId?: string | null;
  decor: GroupDecor;
  effects: Effect[];
  hiddenFoundIds: readonly string[];
  onFindHidden: (id: string) => void;
  onSceneReady: () => void;
  onEffectDone: (id: string) => void;
  onTravelDone: (id: string) => void;
  onChestReached: (id: string) => boolean;
  onReturnToMe?: () => void;
  onDragonChallenge?: () => void;
  onDragonSwallow?: (nest: number) => boolean;
  paused: boolean;
  atmosphere?: boolean;
  actionDockVisible: boolean;
  pendingChestStep: number | null;
  freeCamera?: boolean;
  devHero: { characterId: string; motion: HeroMotion };
  devCameraTarget?: { worldX: number; revision: number } | null;
  journeyRevision: string;
}
export interface WorldLabel {
  id: string;
  kind: "player" | "hidden" | "dragon" | "resident" | "sign";
  x: number;
  y: number;
  text: string;
  worldX: number;
  extra?: string;
}
type Actor = {
  root: THREE.Group;
  height: number;
  character: string;
  x: number;
  from: number;
  target: number;
  started: number;
  duration: number;
  moving: boolean;
  lane: number;
  previous: THREE.Vector3;
  velocity: THREE.Vector3;
  stride: number;
  walkBlend: number;
  pickup?: {
    step: number;
    stop: number;
    phase: "waiting" | "collecting";
    seen: boolean;
  };
  collectedChestStep?: number;
  passage?: { boundary: number; direction: number; started: number; source: RoomLocation | null; destination: RoomLocation | null; start: THREE.Vector3 };

};
type Staging = ReturnType<typeof createReaction> & {
  started: number;
  impact: boolean;
  recovered?: boolean;
  effect: Effect;
};

export function createVoxelWorld(
  host: HTMLElement,
  getProps: () => GameCanvasProps,
  onLabels: (labels: WorldLabel[]) => void,
  onInteraction: (
    label: WorldLabel,
    cause: "click" | "collision",
  ) => void = () => {},
) {
  resetScene();
  const params = new URLSearchParams(location.search);
  const profileGeometry = params.has("profile");
  const diagnostics = params.has("debug") || profileGeometry || process.env.NODE_ENV === "development";
  const pacer = new FramePacer();
  const governor = new QualityGovernor();
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  let deviceLevel = deviceQuality(window.innerWidth, coarse, navigator.hardwareConcurrency, memory);
  let quality = QUALITY[deviceLevel];
  const resources = new VoxelResources(true, deviceLevel ? 4 : 0),
    world = new THREE.Scene();
  // Animations update the world once before labels and lighting; render reuses it.
  world.matrixWorldAutoUpdate = false;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    stencil: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = quality.shadowSize > 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const portalFade = document.createElement("div");
  portalFade.setAttribute("aria-hidden", "true");
  portalFade.className = "voxel-door-fade";
  Object.assign(portalFade.style, { position: "absolute", inset: "0", pointerEvents: "none", background: "#152c27", opacity: "0" });
  host.appendChild(portalFade);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    "aria-label",
    "Monde voxel. Glisser pour tourner à 360 degrés, majuscule et glisser pour explorer, molette ou pincement pour zoomer. Flèches pour explorer.",
  );
  const camera = new THREE.PerspectiveCamera(28, 1, .1, 250);
  const ambient = new THREE.HemisphereLight(0xd2e0d4, 0x62664e, 1.8);
  world.add(ambient);
  const sun = new THREE.DirectionalLight(0xffd9a1, 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowSize || 512, quality.shadowSize || 512);
  Object.assign(sun.shadow.camera, {
    left: -28,
    right: 28,
    top: 28,
    bottom: -28,
    near: 1,
    far: 90,
  });
  sun.shadow.normalBias = 0.055;
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;
  world.add(sun);
  world.add(sun.target);
  const rim = new THREE.DirectionalLight(0x9bc7d4, 1);
  rim.position.set(15, 12, -20);
  world.add(rim);
  const samples = sceneSamples(renderer);
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    }),
  );
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(512, 512),
    0.32,
    0.45,
    1.3,
  );
  const miniature = new MiniaturePass();
  const miniatureRequested = !(new URLSearchParams(location.search).has("debug") && new URLSearchParams(location.search).get("miniature") === "0");
  const source = new ScenePass(world, camera, miniature, samples);
  composer.addPass(source);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const localLights = new LocalLightPool(world, deviceLevel ? 2 : 4);
  const contactShadows = new ContactShadows(world, resources.focus);
  const chunks = new Map<string, THREE.Group>(),
    actors = new Map<string, Actor>(),
    stagings = new Map<string, Staging>(),
    objects = new SceneObjects();
  const props0 = getProps(),
    initial =
      props0.players.find(
        (p) => p.id === (props0.focusPlayerId ?? props0.meId),
      ) ?? props0.players[0];
  let readyForIdentity = props0.meId;
  let focusX = initial ? worldXFor(initial.position) / WORLD_SCALE : 4,
    azimuth = 0.62,
    elevation = 0.74,
    userZoom = 1,
    width = 1,
    height = 1,
    last = 0,
    time = 0,
    frame = 0,
    targetsRevision = -1,
    ready = false,
    disposed = false,
    lastLight = 0,
    previewRevision = -1;
  let effectsEnabled = true,
    shadowFocusX = Infinity,
    lastJourneyRevision = props0.journeyRevision,
    lastLifeShadow = -1,
    lastShadowRender = -Infinity,
    shadowDirty = true,
    lastChunkBuilt = -Infinity,
    tickCount = 0,
    renderMilliseconds = 0,
    updateMilliseconds = 0,
    frameInterval = 0,
    targetScans = 0,
    lastStats = 0;
  const focus = new THREE.Vector3(
    focusX,
    routeHeight(focusX) + .18,
    routeZ(focusX),
  );
  const cutoutSize = new THREE.Vector2(), cutoutPoint = new THREE.Vector3();
  const labelPoint = new THREE.Vector3(), focusScratch = new THREE.Vector3();
  let targetsRoom: number | undefined;
  if (new URLSearchParams(window.location.search).has("debug") && new URLSearchParams(window.location.search).get("occlusion") === "0") resources.cutout.enabled.value = 0;
  const projected = new THREE.Vector3(),
    pointer = new Map<
      number,
      { x: number; y: number; startX: number; startY: number; dragged: boolean }
    >();
  const targets = new Map<
    string,
    { root: THREE.Object3D; label: WorldLabel; height: number }
  >();
  const raycaster = new THREE.Raycaster();
  let inspection: {
    id: string;
    until: number;
    room: number | undefined;
  } | null = null;
  let inspectionBlend = 0,
    inspectionZoom = 1,
    viewAzimuth = azimuth;
  let decorSource: GameCanvasProps["decor"] | undefined, decorLap = -1;
  let decorSites: ReturnType<typeof personaliseDecor> = [];
  const cameraFocus = focus.clone();
  const explorationZoom = new ExplorationZoom();
  const visible = (obj: THREE.Object3D): boolean => {
    for (let p: THREE.Object3D | null = obj; p; p = p.parent)
      if (!p.visible) return false;
    return true;
  };
  function inspect(id: string) {
    const target = targets.get(id);
    if (!target || !visible(target.root) || getProps().paused) return;
    inspection = {
      id,
      until: time + INSPECTION_SECONDS,
      room: scene.viewedRoom?.from,
    };
  }
  const cancelInspection = () => {
    inspection = null;
  };
  function refreshTargets() {
    targetsRevision = objects.revision; targetsRoom = scene.viewedRoom?.from; targetScans++;
    targets.clear();
    for (const [id, obj] of objects) {
      if (!visible(obj)) continue;
      const add = (
        key: string,
        root: THREE.Object3D,
        kind: WorldLabel["kind"],
        text: string,
        extra?: string,
      ) => {
        if (!visible(root)) return;
        const point = root.getWorldPosition(new THREE.Vector3());
        const label = {
          id: key,
          kind,
          x: 0,
          y: 0,
          text,
          extra,
          worldX:
            kind === "dragon" ? Number(key.slice(7)) : point.x * WORLD_SCALE,
        };
        targets.set(key, {
          root,
          label,
          height: kind === "sign" ? 1.75 : kind === "dragon" ? 1.2 : 0.95,
        });
        root.userData.interactionId = key;
      };
      if (obj.userData.sign) add(id, obj, "sign", obj.userData.text);
      else if (id.startsWith("dragon:")) add(id, obj, "dragon", "Dragon");
      else if (obj.userData.guest)
        add(
          id,
          obj,
          "resident",
          obj.userData.guest.label,
          `tavern:${obj.userData.guest.id}`,
        );
      else if (WALKERS.has(obj.userData.kind) || obj.userData.kind === "tree")
        add(id, obj, "resident", obj.userData.kind, obj.userData.kind);
      let part = 0;
      obj.traverse((child) => {
        if (child === obj) return;
        if (child.userData.sign)
          add(`${id}:board:${part++}`, child, "sign", child.userData.text);
        else if (child.userData.resident && !targets.has(id))
          add(
            `${id}:npc:${part++}`,
            child,
            "resident",
            child.userData.kind,
            child.userData.kind,
          );
      });
    }
  }

  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  scene.reducedMotion = preference.matches;
  const motion = () => {
    scene.reducedMotion = preference.matches;
  };
  preference.addEventListener("change", motion);
  const keyFor = (x: number, z: number) => `${x}:${z}`;
  function stream(x: number, _z: number, immediate = false) {
    const cx = Math.floor(x / CHUNK_SIZE);
    let budget = immediate ? 5 : 1;
    for (const dx of [0, -1, 1, -2, 2]) {
      const key = keyFor(cx + dx, 0);
      if (!chunks.has(key) && budget-- > 0) {
        const chunk = makeChunk(cx + dx, 0, resources);
        lastChunkBuilt = performance.now();
        world.add(chunk);
        chunks.set(key, chunk);
        sun.shadow.needsUpdate = true;
      }
    }
    for (const [key, chunk] of chunks)
      if (Math.abs(Number(key.split(":")[0]) - cx) > 2) {
        chunk.userData.dispose();
        chunks.delete(key);
        sun.shadow.needsUpdate = true;
      }
  }
  function ctxBox(root: THREE.Object3D) {
    return resources.batch(root);
  }
  function addObject(
    id: string,
    kind: string,
    x: number,
    z: number,
    scale = 1,
  ) {
    let root = objects.get(id);
    if (!root) {
      root = propModel(resources, kind);
      root.position.set(
        x,
        Math.abs(z - routeZ(x)) < 2.5
          ? routeHeight(x) + 0.2
          : terrainHeight(x, z) + 0.1,
        z,
      );
      root.scale.setScalar(scale);
      root.userData.kind = kind;
      objects.set(id, root);
      world.add(root);
      sun.shadow.needsUpdate = true;
    }
    return root;
  }
  function building(room: ReturnType<typeof interiorsInRange>[number]) {
    const id = `room:${room.from}`;
    if (objects.has(id)) return;
    const from = room.from / WORLD_SCALE,
      to = room.to / WORLD_SCALE,
      cx = (from + to) / 2;
    const root = interiorDetails(resources, room.id, from, to);
    root.userData.room = room;
    objects.set(id, root);
    world.add(root);
    for (const index of [0, 1] as const) {
      const site = portalSite(room, index);
      const outside = entranceBuilding(resources, room, index === 1);
      outside.position.set(site.x, site.y, site.z);
      outside.userData.portal = { room, end: index, ...site };
      // The visible stepping stones use exactly the actor's approach curve.
      const stones = resources.batch(outside);
      for (let i = 0; i <= 32; i++) {
        const p = journeyPoint((site.boundary + (index ? 1 : -1) * (.01 + i * .25)) * WORLD_SCALE);
        stones.box(i % 3 ? 0xb8ac84 : 0xd2c59c, p.x - site.x, p.y - site.y - .1, p.z - site.z, .43, .16, 2.35);
      }
      stones.finish();
      objects.set(`facade:${room.from}:${index}`, outside);
      world.add(outside);
    }
    if (room.id === "tavern") {
      for (const guest of TAVERN_GUESTS) {
        const group = tavernGuest(resources, guest.id),
          x = from + guest.x / WORLD_SCALE;
        group.position.set(x, routeHeight(x) + 0.2, routeZ(cx) - 2.6);
        group.userData.guest = guest;
        group.userData.baseY = group.position.y;
        group.userData.interiorFrom = room.from;
        objects.set(`guest:${room.from}:${guest.id}`, group);
        world.add(group);
      }
      const pigeon = propModel(resources, "pigeon");
      pigeon.position.set(cx, routeHeight(cx) + 0.2, routeZ(cx) + 2);
      pigeon.userData.moonwalk = cx;
      pigeon.userData.interiorFrom = room.from;
      objects.set(`party-pigeon:${room.from}`, pigeon);
      world.add(pigeon);
    } else if (room.id === "factory") {
      for (const station of factoryStations(from, to)) {
        const worker = factoryWorker(resources, station.index);
        worker.position.set(station.workerX, routeHeight(station.workerX) + 0.18, routeZ(cx) + station.workerZ);
        worker.userData.interiorFrom = room.from;
        objects.set(`staff:${room.from}:${station.index}`, worker); world.add(worker);
      }
    } else
      for (let i = 0; i < 6; i++) {
        const x = from + 2 + i * 5,
          staff = addObject(
            `staff:${room.from}:${i}`,
            room.id === "orp" ? "clerk" : "worker",
            x,
            routeZ(cx) - 3.7,
            1,
          );
        staff.position.y = routeHeight(x) + 0.2;
        staff.userData.interiorFrom = room.from;
      }
  }
  stream(focus.x, focus.z, true);
  function applyQuality() {
    deviceLevel = deviceQuality(width, coarse, navigator.hardwareConcurrency, memory);
    const next = QUALITY[Math.max(deviceLevel, governor.level)];
    if (quality.shadowSize !== next.shadowSize) {
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      sun.shadow.mapSize.set(next.shadowSize || 512, next.shadowSize || 512);
      shadowDirty = true;
    }
    quality = next;
    renderer.shadowMap.enabled = quality.shadowSize > 0;
    const dpr = Math.min(window.devicePixelRatio, quality.dpr, Math.sqrt(quality.pixels / (width * height)));
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
    // Focus is independent of bloom. Low quality releases its targets entirely.
    // Unsupported HDR multisampling falls back to the native antialiased canvas.
    const post = samples > 0 && (quality.bloom || (quality.miniatureScale > 0 && miniatureRequested));
    miniature.setResolutionScale(samples ? quality.miniatureScale : 0);
    composer.setPixelRatio(post ? dpr : 1);
    composer.setSize(post ? width : 1, post ? height : 1);
    miniature.enabled = samples > 0 && quality.miniatureScale > 0 && miniatureRequested;
  }
  const hudRoot = host.closest(".game-adventure") ?? host.parentElement;
  let hudTop: Element | null = null, hudDock: Element | null = null, hudNodesDirty = true, hudInsetsDirty = true;
  let hudOwner = props0.meId, hudDockVisible = props0.actionDockVisible;
  const hudResize = new ResizeObserver(() => { hudInsetsDirty = true; });
  const resize = new ResizeObserver((entries) => {
    width = Math.max(1, entries[0].contentRect.width);
    height = Math.max(1, entries[0].contentRect.height);
    applyQuality();
    hudNodesDirty = true;
  });
  resize.observe(host);
  const down = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pointer.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      dragged: false,
    });
    renderer.domElement.setPointerCapture(e.pointerId);
    renderer.domElement.focus({ preventScroll: true });
  };
  const move = (e: PointerEvent) => {
    const p = pointer.get(e.pointerId);
    if (!p) return;
    if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > 6) {
      p.dragged = true;
      cancelInspection();
    }
    if (pointer.size === 2) {
      for (const point of pointer.values()) point.dragged = true;
      const q = [...pointer.entries()].find(([id]) => id !== e.pointerId)![1],
        a = Math.hypot(p.x - q.x, p.y - q.y),
        b = Math.hypot(e.clientX - q.x, e.clientY - q.y);
      if (a) userZoom = THREE.MathUtils.clamp((userZoom * b) / a, 0.65, 2.5);
    } else if (e.shiftKey) {
      scene.exploreCenter =
        (scene.exploreCenter ?? focusX * WORLD_SCALE) -
        (e.clientX - p.x) * WORLD_SCALE * 0.04;
    } else {
      azimuth -= (e.clientX - p.x) * 0.006;
      elevation = THREE.MathUtils.clamp(
        elevation + (e.clientY - p.y) * 0.003,
        0.35,
        1.3,
      );
    }
    p.x = e.clientX;
    p.y = e.clientY;
  };
  const up = (e: PointerEvent) => {
    const p = pointer.get(e.pointerId);
    if (
      p &&
      !p.dragged &&
      pointer.size === 1 &&
      e.type === "pointerup" &&
      !getProps().paused
    ) {
      const rect = canvas.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          1 - ((e.clientY - rect.top) / rect.height) * 2,
        ),
        camera,
      );
      const hits = raycaster.intersectObjects(
        [...targets.values()].map((t) => t.root),
        true,
      );
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj && !obj.userData.interactionId) obj = obj.parent;
        const target = obj
          ? targets.get(obj.userData.interactionId)
          : undefined;
        if (target && visible(target.root)) {
          onInteraction(target.label, "click");
          break;
        }
      }
    }
    pointer.delete(e.pointerId);
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    cancelInspection();
    userZoom = THREE.MathUtils.clamp(
      userZoom * Math.exp(-e.deltaY * 0.001),
      0.65,
      2.5,
    );
  };
  const keyboard = (e: KeyboardEvent) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-"].includes(
        e.key,
      )
    )
      return;
    e.preventDefault();
    cancelInspection();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight")
      scene.exploreCenter = Math.max(
        0,
        (scene.exploreCenter ?? focusX * WORLD_SCALE) +
          (e.key === "ArrowRight" ? 1 : -1) * 250,
      );
    if (e.key === "ArrowUp") elevation = Math.min(1.3, elevation + 0.1);
    if (e.key === "ArrowDown") elevation = Math.max(0.35, elevation - 0.1);
    if (e.key === "+") userZoom = Math.min(2.5, userZoom + 0.15);
    if (e.key === "-") userZoom = Math.max(0.65, userZoom - 0.15);
  };
  const canvas = renderer.domElement;
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("lostpointercapture", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("keydown", keyboard);
  function tick(now: number) {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    if (document.hidden) { pacer.reset(); last = now; return; }
    if (!pacer.ready(now, getProps().paused ? 100 : quality === QUALITY[0] ? 1000 / 60 : 1000 / 30)) return;
    const tickStarted = performance.now();
    frameInterval = now - last;
    tickCount++;
    const dt = Math.min(0.1, frameInterval / 1000 || 0.033);
    last = now;
    const props = getProps();
    // Entering or reclaiming a character resets Game's ready gate without
    // remounting the renderer. Acknowledge the new identity after its first frame.
    if (props.meId !== readyForIdentity) {
      readyForIdentity = props.meId;
      ready = false;
    }
    if (!props.paused) time += dt;
    else cancelInspection();
    if (
      props.devCameraTarget &&
      props.devCameraTarget.revision !== previewRevision
    ) {
      previewRevision = props.devCameraTarget.revision;
      scene.exploreCenter = props.devCameraTarget.worldX;
    }
    const journeyChanged = lastJourneyRevision !== props.journeyRevision;
    lastJourneyRevision = props.journeyRevision;
    const all = props.players.length
      ? [...props.players]
      : [
          {
            id: "preview",
            name: "",
            characterId: props.devHero.characterId,
            position: 0.012,
          } as PlayerView,
        ];
    if (props.devCameraTarget)
      all.push({
        id: "visual-preview",
        name: "Aperçu",
        characterId: props.devHero.characterId,
        position: props.devCameraTarget.worldX / WORLD_LENGTH,
      } as PlayerView);
    for (const [index, player] of all.entries()) {
      const target = worldXFor(player.position);
      let actor = actors.get(player.id);
      if (!actor || actor.character !== player.characterId) {
        if (actor) resources.release(actor.root);
        const root = characterModel(resources, player.characterId);
        world.add(root);
        actor = {
          root,
          height: new THREE.Box3()
            .setFromObject(root)
            .getSize(new THREE.Vector3()).y,
          character: player.characterId,
          x: target,
          from: target,
          target,
          started: time,
          duration: 0,
          moving: false,
          lane: ((index % 3) - 1) * 0.95,
          previous: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          stride: 0,
          walkBlend: 0,
        };
        const start = journeyPoint(target, actor.lane);
        root.position.set(start.x, start.y, start.z);
        actor.previous.copy(root.position);
        actors.set(player.id, actor);
        sun.shadow.needsUpdate = true;
      }
      actor.previous.copy(actor.root.position);
      actor.root.scale.setScalar(1);
      if (player.id === "visual-preview") {
        actor.x = target;
        actor.target = target;
        actor.moving = false;
      }
      if (Math.abs(target - actor.target) > 0.01) {
        cancelInspection();
        actor.pickup = undefined;
        actor.passage = undefined;
        actor.collectedChestStep = undefined;
        actor.from = actor.x;
        actor.target = target;
        actor.started = time;
        actor.duration = Math.max(
          0.35,
          Math.min(
            5,
            (Math.abs(target - actor.x) / WORLD_LENGTH) * JOURNEY_TARGET * 0.32,
          ),
        );
        actor.moving = true;
        scene.exploreCenter = null;
      }
      // A zero-distance interview or undo is still a completed journey request.
      if (journeyChanged && player.id === props.meId && !actor.moving) {
        actor.started = time;
        actor.duration = 0.35;
        actor.from = actor.x;
        actor.moving = true;
      }
      if (actor.pickup && actor.pickup.step !== props.pendingChestStep)
        actor.pickup = undefined;
      if (actor.moving && !props.paused) {
        const pickup = actor.pickup;
        if (actor.passage) {
          const passage = actor.passage, elapsed = time - passage.started;
          actor.x = passage.boundary + passage.direction * (elapsed >= .98 ? 0.1 : -0.1);
          if (elapsed >= 1.5) {
            actor.x = passage.direction > 0 ? Math.min(actor.target, actor.x) : Math.max(actor.target, actor.x);
            actor.from = actor.x; actor.started = time - 0.95;
            actor.duration = Math.max(0.2, Math.abs(actor.target - actor.x) / WORLD_LENGTH * JOURNEY_TARGET * 0.32);
            actor.passage = undefined;
          }
        } else if (pickup) {
          actor.x = pickup.stop;
          const active = props.effects.some(
            (e) => e.kind === "chest" && e.playerId === player.id,
          );
          if (pickup.phase === "waiting") {
            // Let a rejection stamp or another action finish before lifting the chest.
            const busy = props.effects.some(
              (e) => e.playerId === player.id && e.kind !== "chest",
            );
            if (!busy) {
              pickup.phase = "collecting";
              if (!props.onChestReached(player.id)) pickup.seen = true;
            }
          } else {
            if (active) pickup.seen = true;
            if (pickup.seen && !active) {
              actor.collectedChestStep = pickup.step;
              actor.pickup = undefined;
              actor.from = actor.x;
              actor.started = time - 0.95;
              actor.duration = Math.max(
                0.15,
                (Math.abs(actor.target - actor.x) / WORLD_LENGTH) *
                  JOURNEY_TARGET *
                  0.32,
              );
            }
          }
        } else {
          const u = scene.reducedMotion
            ? time - actor.started >= 0.95
              ? 1
              : 0
            : Math.max(
                0,
                Math.min(1, (time - actor.started - 0.95) / actor.duration),
              );
          const next = THREE.MathUtils.lerp(
            actor.from,
            actor.target,
            u * u * (3 - 2 * u),
          );
          const stop =
            player.id === props.meId &&
            actor.collectedChestStep !== props.pendingChestStep
              ? chestStopForJourney(
                  actor.from,
                  actor.target,
                  props.pendingChestStep,
                  WORLD_LENGTH,
                  JOURNEY_TARGET,
                )
              : null;
          const crossing = nextDoor(actor.x, next);
          if (stop !== null && next >= stop && (!crossing || stop < crossing.x)) {
            actor.x = stop;
            actor.pickup = {
              step: props.pendingChestStep!,
              stop,
              phase: "waiting",
              seen: false,
            };
          } else {
            if (crossing) {
              actor.passage = { boundary: crossing.x, direction: Math.sign(next - actor.x), started: time, source: interiorAt(actor.x) ?? null, destination: crossing.destination, start: actor.root.position.clone() };
              actor.x = crossing.x - actor.passage.direction * 0.1;
            } else actor.x = next;
            const crushing = props.effects.find(
              (e) => e.playerId === player.id && hasStampCrush(e),
            );
            const crushingStage = crushing && stagings.get(crushing.id);
            const waitForRecovery =
              !scene.reducedMotion &&
              crushing &&
              (!crushingStage ||
                (time - crushingStage.started) * 1000 <
                  reactionTiming(crushing.kind, true).duration);
            if (u === 1 && !actor.passage && !waitForRecovery) {
              actor.moving = false;
              props.onTravelDone(player.id);
            }
          }
        }
        sun.shadow.needsUpdate = true;
      }
      const animated =
        actor.moving ||
        (player.id === "visual-preview" && props.devHero.motion !== "idle");
      const p = journeyPoint(actor.x, actor.lane);
      if (all.length > 3) {
        p.x +=
          (Math.floor(index / 3) - (Math.ceil(all.length / 3) - 1) / 2) * 1.15;
        const room = interiorAt(actor.x);
        p.y = room ? journeyPoint(actor.x).y : routeHeight(p.x) + 0.18;
        p.z = room ? roomRouteZ(room) + actor.lane : routeZ(p.x) + actor.lane;
      }
      if (actor.passage && time - actor.passage.started < .98) {
        const pass = actor.passage, room = pass.source ?? pass.destination!;
        const door = portalSite(room, Math.abs(pass.boundary - room.to) < 1 ? 1 : 0);
        const elapsed = scene.reducedMotion ? 1 : Math.min(1, (time - pass.started) / .85);
        const end = pass.source ? journeyPoint(pass.boundary - pass.direction * 0.1, actor.lane) : { x: door.x, y: door.y + 0.36, z: door.doorZ - 0.35 };
        p.x = THREE.MathUtils.lerp(pass.start.x, end.x, elapsed);
        p.y = THREE.MathUtils.lerp(pass.start.y, end.y, elapsed);
        p.z = THREE.MathUtils.lerp(pass.start.z, end.z, elapsed);
      }
      actor.velocity
        .set(p.x - actor.previous.x, 0, p.z - actor.previous.z)
        .divideScalar(dt);
      const speed = props.paused ? 0 : actor.velocity.length();
      const walking =
        speed > 0.08 ||
        (player.id === "visual-preview" && props.devHero.motion === "walk");
      actor.walkBlend +=
        (Number(walking) - actor.walkBlend) *
        (props.paused ? 0 : 1 - Math.exp(-dt * 10));
      actor.stride += speed * dt * 3.3;
      if (player.id === "visual-preview" && walking && speed < 0.08)
        actor.stride += props.paused ? 0 : dt * 9;
      const bounce = scene.reducedMotion
        ? 0
        : (1 - Math.cos(actor.stride * 2)) * 0.027 * actor.walkBlend;
      actor.root.position.set(p.x, p.y + bounce, p.z);
      if (actor.pickup && !scene.reducedMotion)
        actor.root.rotation.y = dampAngle(
          actor.root.rotation.y,
          Math.atan2(1.25, -actor.lane),
          dt,
        );
      else if (walking && !scene.reducedMotion)
        actor.root.rotation.y = dampAngle(
          actor.root.rotation.y,
          speed > 0.08
            ? Math.atan2(actor.velocity.x, actor.velocity.z)
            : Math.PI / 2,
          dt,
        );
      actor.root.rotation.z = scene.reducedMotion
        ? 0
        : Math.sin(actor.stride) * 0.025 * actor.walkBlend;
      const effect = props.effects.find((e) => e.playerId === player.id);
      const gesture =
        player.id === "visual-preview"
          ? props.devHero.motion
          : actor.pickup?.phase === "collecting"
            ? "celebrate"
            : effect
              ? hasStampCrush(effect)
                ? "hurt"
                : /lightning|anvil|meteor|storm|No|Avalanche|Rejection/.test(
                      effect.kind,
                    )
                  ? "hurt"
                  : /legendary|trophy|Fireworks|Carpet|Band|Ascension/.test(
                        effect.kind,
                      )
                    ? "celebrate"
                    : "send"
              : "idle";
      actor.root.userData.animate?.(scene.reducedMotion ? 0 : time, animated, {
        blend: scene.reducedMotion ? 0 : actor.walkBlend,
        stride: scene.reducedMotion ? 0 : actor.stride,
        motion: scene.reducedMotion ? "idle" : gesture,
      });
      actor.root.visible = Math.abs(p.x - focusX) < 40;
      scene.heroes.set(player.id, { x: actor.x, y: 646 });
    }
    for (const [id, actor] of actors)
      if (!all.some((p) => p.id === id)) {
        resources.release(actor.root);
        actors.delete(id);
        scene.heroes.delete(id);
      }
    const followed =
      actors.get(props.focusPlayerId ?? props.meId ?? "preview") ??
      actors.values().next().value;
    const wanted =
      scene.exploreCenter !== null
        ? scene.exploreCenter / WORLD_SCALE
        : (followed?.x ?? 0) / WORLD_SCALE;
    focusX +=
      (wanted - focusX) * (scene.reducedMotion ? 1 : 1 - Math.exp(-dt * 5));
    const focusPoint = journeyPoint(focusX * WORLD_SCALE), framing = interiorAt(focusX * WORLD_SCALE) ? { lift: 0, zoom: 1 } : landscapeView(focusX);
    focus.lerp(
      focusScratch.set(focusPoint.x, focusPoint.y, focusPoint.z),
      scene.reducedMotion ? 1 : 1 - Math.exp(-dt * 5),
    );
    scene.focus = focusX * WORLD_SCALE;
    scene.targetFocus = wanted * WORLD_SCALE;
    scene.room = interiorAt(followed?.x ?? 0) ?? null;
    const viewedRoom = scene.exploreCenter !== null ? interiorAt(focusX * WORLD_SCALE) ?? null : scene.room;
    if (scene.viewedRoom?.from !== viewedRoom?.from && scene.exploreCenter === null && followed) {
      focusX = followed.x / WORLD_SCALE;
      const p = journeyPoint(followed.x); focus.set(p.x, p.y, p.z); cameraFocus.copy(focus);
    }
    scene.viewedRoom = viewedRoom;
    const passage = followed?.passage;
    const portalTime = passage ? time - passage.started : -1;
    portalFade.style.opacity = passage ? String(Math.max(0, Math.min(1, (portalTime - .7) / .2, (1.36 - portalTime) / .3))) : "0";
    stream(focus.x, focus.z);
    const aspect = width / height,
      halfW = aspect < 0.8 ? 8.5 : Math.max(13, 9.4 * aspect);
    if (hudNodesDirty || hudOwner !== props.meId || hudDockVisible !== props.actionDockVisible) {
      hudOwner = props.meId; hudDockVisible = props.actionDockVisible; hudNodesDirty = false;
      hudResize.disconnect();
      hudTop = hudRoot?.querySelector(".hud-journey") ?? null;
      hudDock = props.actionDockVisible ? hudRoot?.querySelector(".hud-bottom") ?? null : null;
      if (hudTop) hudResize.observe(hudTop);
      if (hudDock) hudResize.observe(hudDock);
      hudInsetsDirty = true;
    }
    if (hudInsetsDirty) {
      const top = hudTop?.getBoundingClientRect(), bottom = hudDock?.getBoundingClientRect();
      scene.topInset = top?.height ? top.bottom : 50;
      scene.bottomInset = bottom?.height ? height - bottom.top : 70;
      hudInsetsDirty = false;
    }
    scene.zoom += (scene.zoomTarget - scene.zoom) * (1 - Math.exp(-dt * 7));
    if (
      inspection &&
      (time >= inspection.until || inspection.room !== scene.viewedRoom?.from)
    )
      inspection = null;
    const inspected = inspection ? targets.get(inspection.id) : undefined;
    if (inspection && (!inspected || !visible(inspected.root)))
      inspection = null;
    const targetBlend = inspection ? 1 : 0;
    inspectionBlend +=
      (targetBlend - inspectionBlend) *
      (scene.reducedMotion ? 1 : 1 - Math.exp(-dt * 6));
    const automaticZoom = userZoom * scene.zoom * (scene.viewedRoom ? 1 : Math.min(entranceViewZoom(focusX, width <= 700), width > 700 ? Math.min(framing.zoom, 1 - 0.32 * Math.max(0, 1 - Math.abs(focusX - tearsSite(Math.max(0, Math.floor(focusX * WORLD_SCALE / WORLD_LENGTH))).x) / 18)) : 1));
    const explorationFraming = explorationZoom.resolve(scene.exploreCenter !== null, userZoom, inspectionZoom, automaticZoom);
    const desiredZoom =
      inspection && inspected
        ? Math.min(
            3.5,
            Math.max(
              userZoom * scene.zoom,
              halfW /
                (width < 640
                  ? inspected.label.kind === "sign"
                    ? 2.4
                    : 2.5
                  : inspected.label.kind === "sign"
                    ? 4.8
                    : 4.2),
            ),
          )
        : explorationFraming;
    inspectionZoom +=
      (desiredZoom - inspectionZoom) *
      (scene.reducedMotion ? 1 : 1 - Math.exp(-dt * 6));
    const objectFocus =
      inspection && inspected
        ? inspected.root
            .getWorldPosition(new THREE.Vector3())
            .add(new THREE.Vector3(0, inspected.height, 0))
        : focus;
    if (inspection)
      cameraFocus.lerp(
        objectFocus,
        scene.reducedMotion ? 1 : 1 - Math.exp(-dt * 6),
      );
    else
      cameraFocus.lerp(focus, scene.reducedMotion ? 1 : 1 - Math.exp(-dt * 6));
    const viewFocus = inspectionBlend > 0.001 ? cameraFocus : focus;
    let wantedAzimuth = azimuth;
    if (inspection && inspected?.label.kind === "sign") {
      const rotation = new THREE.Euler().setFromQuaternion(
        inspected.root.getWorldQuaternion(new THREE.Quaternion()),
      );
      const front = rotation.y + 0.16,
        back = front + Math.PI;
      wantedAzimuth =
        Math.abs(
          Math.atan2(Math.sin(front - azimuth), Math.cos(front - azimuth)),
        ) <
        Math.abs(Math.atan2(Math.sin(back - azimuth), Math.cos(back - azimuth)))
          ? front
          : back;
    }
    viewAzimuth = scene.reducedMotion
      ? wantedAzimuth
      : dampAngle(viewAzimuth, wantedAzimuth, dt * 0.65);
    camera.zoom = inspectionZoom;
    frameRoadPerspective(camera, width, height, camera.zoom, scene.topInset, scene.bottomInset);
    camera.position.set(
      viewFocus.x + Math.sin(viewAzimuth) * MINIATURE_CAMERA_DISTANCE * Math.cos(elevation),
      viewFocus.y + Math.sin(elevation) * MINIATURE_CAMERA_DISTANCE,
      viewFocus.z + Math.cos(viewAzimuth) * MINIATURE_CAMERA_DISTANCE * Math.cos(elevation),
    );
    camera.lookAt(viewFocus);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    renderer.getDrawingBufferSize(cutoutSize);
    resources.cutout.begin(cutoutSize.x, cutoutSize.y);
    if (inspection && inspected) {
      const bounds = new THREE.Box3().setFromObject(inspected.root), size = bounds.getSize(cutoutPoint);
      resources.cutout.add(camera, bounds.getCenter(new THREE.Vector3()), Math.max(size.x, size.y), bounds.min.y);
    }
    const protect = (actor: Actor) => {
      const room = interiorAt(actor.x);
      if ((scene.viewedRoom ? room?.from === scene.viewedRoom.from : !room) && Math.abs(actor.x / WORLD_SCALE - focusX) < 18) {
        cutoutPoint.copy(actor.root.position); cutoutPoint.y += actor.height * 0.5;
        resources.cutout.add(camera, cutoutPoint, actor.height, actor.root.position.y);
      }
    };
    if (followed) protect(followed);
    for (const actor of actors.values()) if (actor !== followed) protect(actor);
    resources.focus.set(focus.x, focus.z);
    const palette = voxelPalette(focus.x);
    if (now - lastLight > 1000 || !ready) {
      lastLight = now;
      const light = currentDaylight();
      scene.night = light.night;
      scene.warm = light.warm;
      const color = new THREE.Color(palette.ground).multiplyScalar(1 - light.night * .65);
      resources.fogColor.copy(color);
      world.background = scene.viewedRoom ? new THREE.Color(0x080b10) : color;
      if (scene.viewedRoom) resources.fogColor.set(0x080b10);
      ambient.intensity = scene.viewedRoom ? 0.65 : 1.45 - light.night * 1.05;
      sun.intensity = scene.viewedRoom ? 0.25 : 3.2 - light.night * 2.85;
      rim.intensity = scene.viewedRoom ? 0.15 : 1 - light.night * 0.7;
      sun.color.set(light.night > 0.5 ? 0xa7c4df : 0xffd9a1);
      const musicX =
        (props.meId ? actors.get(props.meId)?.x : undefined) ??
        focusX * WORLD_SCALE;
      setMusicPlace(interiorAt(musicX)?.id ?? biomeAt(musicX).id);
    }
    if (Math.abs(shadowFocusX - focus.x) > 2) {
      shadowFocusX = focus.x;
      sun.position.set(focus.x - 14, focus.y + 22, focus.z + 12);
      sun.target.position.copy(focus);
      sun.shadow.needsUpdate = true;
    }
    const left = Math.max(0, (focusX - 40) * WORLD_SCALE),
      right = (focusX + 40) * WORLD_SCALE;
    for (const room of interiorsInRange(left, right)) {
      building(room);
    }
    const lap = Math.max(0, Math.floor((focusX * WORLD_SCALE) / WORLD_LENGTH));
    if (decorLap !== lap || decorSource !== props.decor) {
      decorSource = props.decor; decorLap = lap;
      decorSites = personaliseDecor(decorForLap(lap), props.decor);
    }
    const sites = decorSites.filter(site => Math.abs(site.x / WORLD_SCALE - focusX) < 22);
    for (const site of sites)
      if (site.setpiece && !objects.has(`landmark:${site.id}`)) {
        const root = landmarkModel(resources, site.biome),
          { x, z } = narrativeSite(site.x / WORLD_SCALE);
        root.position.set(x, terrainHeight(x, z), z);
        world.add(root);
        objects.set(`landmark:${site.id}`, root);
      }
    for (const site of sites) {
      const key = `sign:${site.id}`;
      let sign = objects.get(key);
      if (sign && sign.userData.text !== site.text) {
        resources.release(sign);
        objects.delete(key);
        sign = undefined;
      }
      if (!sign) {
        sign = letterBoard(resources, site.text);
        const x = site.x / WORLD_SCALE,
          z = routeZ(x) - 2.9;
        sign.position.set(x, terrainHeight(x, z) + 0.1, z);
        sign.userData.text = site.text;
        world.add(sign);
        objects.set(key, sign);
      }
    }
    if (Math.abs(focusX - START_MARKET_X) < 34 && !objects.has("starting-market")) {
      const market = startingMarket(resources); world.add(market); objects.set("starting-market", market);
    }
    // A lived-in hamlet at the start: the same scale and warm windows as the reference.
    for (const [i, site] of villageSites(lap).entries()) {
      const id = `village:${lap}:${i}`;
      if (Math.abs(site.x - focusX) < 34 && !objects.has(id)) {
        const house = cottage(resources, site.title, site.roof);
        house.position.set(site.x, terrainHeight(site.x, site.z), site.z);
        world.add(house); objects.set(id, house);
      }
    }
    const villagerX = lap * WORLD_LENGTH / WORLD_SCALE - 1;
    if (Math.abs(villagerX - focusX) < 30) addObject(`villager:${lap}`, "traveller", villagerX, routeZ(villagerX) - 2, 1.05);
    const roamerX = (lap * WORLD_LENGTH) / WORLD_SCALE + 3;
    if (Math.abs(roamerX - focusX) < 30) {
      const walker = addObject(
        `wanderer:${lap}`,
        "gnome",
        roamerX,
        routeZ(roamerX) - 2.8,
        0.95,
      );
      walker.userData.phase = 2;
    }
    const campX = (lap * WORLD_LENGTH) / WORLD_SCALE + 4;
    if (Math.abs(campX - focusX) < 32 && !objects.has(`camp:${lap}`)) {
      const camp = waysideCamp(resources);
      camp.position.set(campX, routeHeight(campX), routeZ(campX) - 4);
      objects.set(`camp:${lap}`, camp);
      world.add(camp);
    }
    const mill = millSite(lap), millX = mill.x;
    if (Math.abs(millX - focusX) < 32 && !objects.has(`mill:${lap}`)) {
      const root = landmarkModel(resources, "windmill"),
        z = mill.z;
      root.position.set(millX, terrainHeight(millX, z), z);
      objects.set(`mill:${lap}`, root);
      world.add(root);
    }
    for (const plot of landscapePlots(lap)) if (Math.abs(plot.x - focusX) < 38 && !objects.has(plot.id)) {
      const root = landscapeModel(resources, plot); world.add(root); objects.set(plot.id, root);
    }
    for (const plot of foregroundPlots(lap)) if (Math.abs(plot.x - focusX) < 30 && !objects.has(plot.id)) {
      const root = foregroundGrove(resources, plot.x, plot.biome); world.add(root); objects.set(plot.id, root);
    }
    for (const flight of skyFlights(lap)) if (Math.abs(flight.x - focusX) < 32 && !objects.has(flight.id)) {
      const root = skyDragon(resources, flight.x, flight.color); world.add(root); objects.set(flight.id, root);
    }
    const monument = tearsSite(lap), monumentX = monument.x;
    if (Math.abs(monumentX - focusX) < 30 && !objects.has(`fore-lake:${lap}`)) {
      const grove = foregroundGrove(resources, monumentX + 2.9, "lac"); world.add(grove); objects.set(`fore-lake:${lap}`, grove);
    }
    if (Math.abs(monumentX - focusX) < 32 && !objects.has(`tears:${lap}`)) {
      const root = landmarkModel(resources, "tears");
      root.position.set(monumentX, monument.y, monument.z);
      objects.set(`tears:${lap}`, root);
      world.add(root);
    }
    const residents = environmentSites(left, right, 1);
    for (const r of residents)
      addObject(
        r.id,
        r.kind,
        r.x / WORLD_SCALE,
        routeZ(r.x / WORLD_SCALE) - 3.2,
        r.kind === "yeti" ? 1.5 : 1,
      );
    for (const [id, obj] of objects) {
      const roomFrom = obj.userData.room?.from ?? obj.userData.interiorFrom;
      if (roomFrom !== scene.viewedRoom?.from || Math.abs(obj.position.x - focusX) > 36) continue;
      const kind = obj.userData.kind as string;
      if (WALKERS.has(kind)) {
        let body = obj.userData.life as LifeBody | undefined;
        if (!body) {
          body = createLifeBody(
            obj.position,
            obj.userData.phase ?? obj.position.x * 0.31,
          );
          obj.userData.life = body;
        }
        const roomFrom = obj.userData.interiorFrom as number | undefined;
        const stationed = id.startsWith("staff:");
        const inScene = roomFrom === scene.viewedRoom?.from;
        const ground = (x: number, z: number) => {
          if (roomFrom !== undefined) return routeHeight(x) + 0.18;
          const depth = z - routeZ(x);
          if (
            (kind === "otter" || kind === "heron") &&
            depth < -1.6 &&
            depth > -5.1
          )
            return routeHeight(x) - 0.3;
          return (
            (Math.abs(depth) < 1.4
              ? routeHeight(x) + 0.18
              : terrainHeight(x, z) + 0.03) +
            (kind === "ghost" || kind === "spirit" ? 0.25 : 0)
          );
        };
        const old = { ...body.position };
        if (!props.paused && inScene) {
          if (body.mode === "walking") {
            const desired =
                inspection?.id === id
                  ? body.position
                  : obj.userData.factoryWork ? body.home : patrol(body, time, stationed, scene.reducedMotion),
              u = scene.reducedMotion ? 1 : 1 - Math.exp(-dt * 4);
            if (
              roomFrom === undefined &&
              inspection?.id !== id &&
              !scene.reducedMotion
            )
              desired.z += routeZ(desired.x) - routeZ(body.home.x);
            body.position.x += (desired.x - body.position.x) * u;
            body.position.z += (desired.z - body.position.z) * u;
            const centerZ = roomFrom === undefined ? routeZ(body.position.x) : roomRouteZ(interiorAt(roomFrom)!);
            body.position.z = THREE.MathUtils.clamp(
              body.position.z,
              centerZ - 4.7,
              centerZ + 4.7,
            );
            body.position.y = ground(body.position.x, body.position.z);
            for (const actor of actors.values()) {
              const actorRoom = interiorAt(actor.x)?.from;
              if (
                actorRoom !== roomFrom ||
                actor.passage || actor.velocity.length() < 0.3 ||
                !actor.moving
              )
                continue;
              const radius = /hen|hedgehog|scarab|crow/.test(kind) ? 0.7 : 0.95;
              if (
                segmentDistance(
                  actor.previous,
                  actor.root.position,
                  body.position,
                ) < radius &&
                Math.abs(body.position.y - actor.root.position.y) < 1.1
              ) {
                if (
                  launch(
                    body,
                    actor.velocity.x,
                    actor.velocity.z,
                    scene.reducedMotion,
                  )
                ) {
                  const reply: WorldLabel = {
                    id,
                    kind: "resident",
                    text: kind,
                    extra: kind,
                    worldX: body.home.x * WORLD_SCALE,
                    x: 0,
                    y: 0,
                  };
                  onInteraction(reply, "collision");
                  if (!scene.reducedMotion) sfx.coo();
                  break;
                }
              }
            }
          }
          stepLife(body, dt, ground);
          if (
            body.position.z < -BACKGROUND_DEPTH + 0.9 ||
            body.position.z > FOREGROUND_DEPTH - 0.9
          ) {
            body.position.z = THREE.MathUtils.clamp(
              body.position.z,
              -BACKGROUND_DEPTH + 0.9,
              FOREGROUND_DEPTH - 0.9,
            );
            body.velocity.z *= -0.25;
          }
        }
        const speed =
          Math.hypot(body.position.x - old.x, body.position.z - old.z) / dt;
        const airborne = body.mode !== "walking";
        const height = /hen|hedgehog|fox|otter|scarab/.test(kind) ? 0.65 : 1.9;
        obj.position.set(
          body.position.x,
          body.position.y +
            (airborne
              ? (Math.max(0, -Math.cos(body.tumble)) +
                  Math.abs(Math.sin(body.tumble)) * 0.35) *
                height
              : 0),
          body.position.z,
        );
        obj.rotation.z = airborne ? body.tumble : 0;
        const forwardOffset =
          obj.userData.animal || /crow|pigeon/.test(kind) ? Math.PI / 2 : 0;
        if (speed > 0.05 && !airborne && !scene.reducedMotion)
          obj.rotation.y = dampAngle(
            obj.rotation.y,
            Math.atan2(body.position.x - old.x, body.position.z - old.z) +
              forwardOffset,
            dt,
          );
        const chatting = inspection?.id === id;
        if (obj.userData.factoryWork && !airborne && !chatting) obj.rotation.y = 0;
        if (chatting && !scene.reducedMotion)
          obj.rotation.y = dampAngle(
            obj.rotation.y,
            viewAzimuth + forwardOffset,
            dt,
          );
        const walkTarget = speed > 0.06 && !airborne ? 1 : 0;
        obj.userData.walkBlend =
          (obj.userData.walkBlend ?? 0) +
          (walkTarget - (obj.userData.walkBlend ?? 0)) *
            (props.paused || !inScene ? 0 : 1 - Math.exp(-dt * 9));
        obj.userData.stride =
          (obj.userData.stride ?? 0) +
          Math.hypot(body.position.x - old.x, body.position.z - old.z) * 3.3;
        obj.userData.animate?.(
          scene.reducedMotion ? 0 : time + body.phase,
          speed > 0.06 && !airborne,
          {
            motion: chatting ? "send" : "idle",
            blend: scene.reducedMotion ? 0 : obj.userData.walkBlend,
            stride: scene.reducedMotion ? 0 : obj.userData.stride,
          },
        );
        if (
          inScene &&
          !props.paused &&
          (speed > 0.03 || airborne) &&
          (airborne || time - lastLifeShadow > 0.1)
        ) {
          sun.shadow.needsUpdate = true;
          lastLifeShadow = time;
        }
      }
      if (obj.userData.camp || obj.userData.startingMarket)
        obj.userData.animate?.(scene.reducedMotion ? 0 : time);
      if (obj.userData.sails && !scene.reducedMotion)
        obj.userData.sails.rotation.z = time * 0.18;
      if (obj.userData.guest && !scene.reducedMotion) {
        const guest = obj.userData.guest;
        obj.traverse((child) => {
          if (child !== obj)
            child.userData.animate?.(time, false, {
              motion: guest.id === "dancers" ? "celebrate" : "idle",
            });
        });
        obj.position.y =
          obj.userData.baseY +
          (guest.id === "dancers"
            ? Math.abs(Math.sin(time * 4)) * 0.15
            : Math.sin(time * 1.5) * 0.025);
        obj.rotation.z = Math.sin(time * 2) * 0.035;
      }
      if (obj.userData.moonwalk !== undefined) {
        const walk = tavernMoonwalk(time, scene.reducedMotion);
        obj.position.x = obj.userData.moonwalk + walk.offset / WORLD_SCALE;
        obj.rotation.y = (walk.facing * Math.PI) / 2;
      }
    }
    const nests = dragonNests(left, right);
    for (const nest of nests) {
      const id = `dragon:${nest}`;
      if (!objects.has(id)) {
        const dragon = dragonModel(resources, dragonVariantAt(nest));
        const x = nest / WORLD_SCALE;
        dragon.position.set(
          x,
          terrainHeight(x, routeZ(x) - 4) + 0.1,
          routeZ(x) - 4,
        );
        const flame = propModel(resources, "fire");
        flame.position.set(-2.1, 1, 0.45);
        flame.rotation.z = Math.PI / 2;
        flame.scale.setScalar(2.2);
        dragon.add(flame);
        dragon.userData.flame = flame;
        world.add(dragon);
        objects.set(id, dragon);
      }
    }
    for (const nest of nests) {
      const dragon = objects.get(`dragon:${nest}`);
      if (!dragon) continue;
      const visit = residentReactions.get(`dragon:${nest}`),
        since = visit ? (performance.now() - visit.at) / 1000 : Infinity,
        power = dragonFirePower(
          time,
          since,
          visit?.visits ?? 0,
          scene.reducedMotion,
        );
      const flame = dragon.userData.flame as THREE.Group;
      flame.visible = power > 0.02;
      flame.scale.set(power * 2.2, power * 2.2, power * 2.2);
      const head = dragon.userData.head as THREE.Group;
      head.rotation.z =
        dragonIdleFrame(time, since < 4, scene.reducedMotion) === 7
          ? -0.16
          : Math.sin(scene.reducedMotion ? 0 : time) * 0.025;
    }
    for (const item of HIDDEN_ITEMS) {
      if (props.hiddenFoundIds.includes(item.id)) {
        const obj = objects.get(item.id);
        if (obj) {
          resources.release(obj);
          objects.delete(item.id);
        }
        continue;
      }
      if (item.x < left || item.x > right) continue;
      addObject(
        item.id,
        item.model,
        item.x / WORLD_SCALE,
        routeZ(item.x / WORLD_SCALE) + 2.2,
        0.65,
      );
    }
    for (
      let step = Math.max(
        10,
        Math.ceil(((left / WORLD_LENGTH) * JOURNEY_TARGET) / 10) * 10,
      );
      (step * WORLD_LENGTH) / JOURNEY_TARGET < right;
      step += 10
    ) {
      const x = ((step / JOURNEY_TARGET) * WORLD_LENGTH) / WORLD_SCALE;
      const chestPoint = journeyPoint(x * WORLD_SCALE);
      const chest = addObject(`chest:${step}`, "chest", x, chestPoint.z, 1.15);
      chest.position.x = chestPoint.x;
      chest.position.y = chestPoint.y;
      const owner = props.players.find((p) => p.id === props.meId);
      chest.userData.interiorFrom = interiorAt(x * WORLD_SCALE)?.from;
      chest.userData.pickedUp =
        ((owner?.earnedChests ?? 0) * 10 >= step &&
          props.pendingChestStep !== step) ||
        actors.get(props.meId ?? "")?.collectedChestStep === step ||
        props.effects.some(
          (e) =>
            e.kind === "chest" && Math.abs(e.origin.x - x * WORLD_SCALE) < 1,
        );
    }
    for (const [id, obj] of objects) {
      if (Math.abs(obj.position.x - focusX) > 55) {
        resources.release(obj);
        objects.delete(id);
      }
    }
    for (const effect of props.effects) {
      if (stagings.has(effect.id)) continue;
      const staging = createReaction(
        resources,
        effect.kind,
        dragonVariantAt(effect.origin.x),
        hasStampCrush(effect),
      );
      world.add(staging.root);
      stagings.set(effect.id, {
        ...staging,
        started: time,
        impact: false,
        effect,
      });
    }
    for (const [id, staging] of stagings) {
      if (!props.effects.some((effect) => effect.id === id)) {
        if (staging.effect.playerId)
          actors.get(staging.effect.playerId)?.root.scale.setScalar(1);
        if (staging.effect.kind === "dragonMeal") scene.dragonMeal = null;
        resources.release(staging.root);
        stagings.delete(id);
        continue;
      }
      const { effect } = staging,
        t = (time - staging.started) * 1000,
        timing = reactionTiming(effect.kind, hasStampCrush(effect)),
        u = Math.min(1, t / timing.duration),
        actor = effect.playerId ? actors.get(effect.playerId) : undefined;
      const p =
        effect.kind === "chest"
          ? journeyPoint(effect.origin.x)
          : (actor?.root.position ?? journeyPoint(effect.origin.x));
      if (effect.kind === "chest") {
        staging.root.userData.reducedMotion = scene.reducedMotion;
        staging.root.userData.collectorOffset = actor
          ? {
              x: actor.root.position.x - p.x,
              y: actor.root.position.y - p.y + actor.height + 0.25,
              z: actor.root.position.z - p.z,
            }
          : { x: -1.25, y: 2, z: -0.95 };
      }
      staging.update(
        scene.reducedMotion && effect.kind !== "chest" ? 0.5 : u,
        scene.reducedMotion && effect.kind !== "chest"
          ? timing.impact / 1000
          : t / 1000,
        actor?.height,
      );
      // The stamp rides the actual saved journey, not an extra cosmetic displacement.
      if (hasStampCrush(effect)) {
        const pose = stampCrushPose(t / 1000, scene.reducedMotion);
        staging.root.visible = !scene.reducedMotion;
        if (actor) {
          actor.root.scale.set(pose.x, pose.y, pose.z);
          actor.root.rotation.z = pose.wobble;
        }
        if (!staging.recovered && t / 1000 >= STAMP_RELEASE + 0.09) {
          staging.recovered = true;
          if (effect.loud && !scene.reducedMotion) sfx.boing();
        }
      }
      staging.root.position.add(new THREE.Vector3(p.x, p.y, p.z));
      if (actor && hasStampCrush(effect))
        actor.root.position.y += stampCrushPose(
          t / 1000,
          scene.reducedMotion,
        ).hop;
      if (actor && effect.kind === "frogCurse")
        actor.root.scale.setScalar(u > 0.15 && u < 0.85 ? 0.03 : 1);
      if (effect.kind === "dragonMeal" && actor) {
        actor.root.scale.setScalar(u > 0.25 && u < 0.7 ? 0.05 : 1);
        scene.dragonMeal = {
          nest: effect.origin.x,
          playerId: effect.playerId!,
          scale: 1,
        };
      }
      if (!staging.impact && t >= timing.impact) {
        staging.impact = true;
        if (effect.loud) {
          if (/pigeon/.test(effect.kind)) sfx.coo();
          else if (effect.kind === "chest") sfx.chime();
          else if (hasStampCrush(effect)) sfx.stamp();
          else if (/lightning|storm/.test(effect.kind)) sfx.thunder();
          else sfx.chime();
        }
        bursts.push({
          preset: effect.kind,
          x: actor?.x ?? effect.origin.x,
          y: 500,
          count: 16,
        });
      }
      if (t >= timing.duration) {
        if (actor) actor.root.scale.setScalar(1);
        scene.dragonMeal = null;
        resources.release(staging.root);
        stagings.delete(id);
        props.onEffectDone(id);
      }
    }
    // Bounded transient voxel particles; their semantic triggers remain in Game.
    while (bursts.length) {
      const burst = bursts.shift()!,
        id = `burst:${time}:${Math.random()}`;
      const root = new THREE.Group(),
        { box, finish } = ctxBox(root);
      for (let i = 0; i < Math.min(28, burst.count ?? 16); i++)
        box(
          burst.colors?.[i % burst.colors.length] ?? 0xe3c47e,
          (Math.random() - 0.5) * 2,
          Math.random() * 2,
          (Math.random() - 0.5) * 2,
          0.09,
          0.09,
          0.09,
          0,
          true,
        );
      finish();
      const p = journeyPoint(burst.x);
      root.position.set(p.x, p.y + 1, p.z);
      root.userData.burstUntil = time + 1.2;
      world.add(root);
      objects.set(id, root);
    }
    for (const [id, obj] of objects)
      if (obj.userData.burstUntil) {
        obj.rotation.y += props.paused ? 0 : dt;
        obj.position.y += props.paused ? 0 : dt * 0.5;
        if (time > obj.userData.burstUntil) {
          resources.release(obj);
          objects.delete(id);
        }
      }
    const activeRoom = scene.viewedRoom;
    for (const chunk of chunks.values()) {
      chunk.visible = !activeRoom;
      if (!activeRoom) chunk.userData.animate?.(scene.reducedMotion ? 0 : time);
      const foliage = chunk.userData.backPlanting as THREE.Group;
      const visible = true;
      if (foliage.visible !== visible) sun.shadow.needsUpdate = true;
      foliage.visible = visible;
    }
    for (const obj of objects.values()) {
      const roomFrom = obj.userData.room?.from ?? obj.userData.interiorFrom;
      obj.visible =
        !obj.userData.pickedUp &&
        (activeRoom ? roomFrom === activeRoom.from : roomFrom === undefined);
      const portal = obj.userData.portal;
      if (portal && obj.userData.door) {
        const near = [...actors.values()].some(a => Math.abs(a.x / WORLD_SCALE - portal.boundary) < 4);
        const opening = near ? Math.PI * .55 : 0;
        obj.userData.door.rotation.y = scene.reducedMotion ? opening : THREE.MathUtils.damp(obj.userData.door.rotation.y, opening, 7, dt);
      }
      if (obj.userData.backwall) obj.userData.backwall.visible = true;
    }
    for (const actor of actors.values()) {
      const room = interiorAt(actor.x);
      actor.root.visible =
        Math.abs(actor.x / WORLD_SCALE - focusX) < 40 &&
        (activeRoom ? room?.from === activeRoom.from : !room);
    }
    // Force atmosphere refresh on a room boundary, without changing saved coordinates.
    if (world.userData.roomFrom !== activeRoom?.from) {
      world.userData.roomFrom = activeRoom?.from;
      lastLight = 0;
      sun.shadow.needsUpdate = true;
    }
    world.updateMatrixWorld();
    if (targetsRevision !== objects.revision || targetsRoom !== activeRoom?.from) refreshTargets();
    {
      const labels: WorldLabel[] = [];
      const label = (
        id: string,
        kind: WorldLabel["kind"],
        point: THREE.Vector3,
        text: string,
        worldX: number,
        extra?: string,
      ) => {
        if (objects.has(id) && !objects.get(id)!.visible) return;
        if (Math.hypot(point.x - focus.x, point.z - focus.z) > 27) return;
        projected.copy(point).project(camera);
        if (Math.abs(projected.x) > 1.03 || Math.abs(projected.y) > 1.03)
          return;
        const screenX = ((projected.x + 1) * width) / 2,
          screenY = ((1 - projected.y) * height) / 2;
        labels.push({
          id,
          kind,
          x: screenX,
          y: screenY,
          text,
          worldX,
          extra,
        });
      };
      for (const player of props.players) {
        const a = actors.get(player.id);
        if (a?.pickup?.phase === "collecting") continue;
        if (a && a.root.visible)
          label(
            player.id,
            "player",
            labelPoint.set(0, a.height + .25, 0).applyMatrix4(a.root.matrixWorld),
            player.name,
            a.x,
          );
      }
      if (!props.paused) {
        for (const item of HIDDEN_ITEMS) {
          const obj = objects.get(item.id);
          if (obj)
            label(
              item.id,
              "hidden",
              labelPoint.copy(obj.position).addScaledVector(THREE.Object3D.DEFAULT_UP, .5),
              item.name,
              item.x,
            );
        }
      }
      if (!props.paused)
        for (const [id, target] of targets) {
          const point = labelPoint.setFromMatrixPosition(target.root.matrixWorld);
          point.y += target.height;
          label(
            id,
            target.label.kind,
            point,
            target.label.text,
            target.label.worldX,
            target.label.extra,
          );
        }
      onLabels(labels);
    }
    contactShadows.begin(quality.shadowSize === 0);
    if (quality.shadowSize === 0) {
      for (const actor of actors.values()) {
        if (!actor.root.visible) continue;
        const p = actor.root.position;
        const ground = routeHeight(p.x) + 0.195;
        contactShadows.add({ x: p.x, y: ground, z: p.z,
          rx: 0.52 * Math.min(2, actor.root.scale.x), rz: 0.38 * Math.min(2, actor.root.scale.z),
          opacity: 1 / (1 + Math.max(0, p.y - ground) * 0.3) });
      }
      for (const [id, obj] of objects) {
        if (!obj.visible) continue;
        const p = obj.position;
        if (Math.abs(p.x - focusX) > 30) continue;
        const patches = obj.userData.contactPatches as ContactPatch[] | undefined;
        if (patches) for (const patch of patches) contactShadows.add(patch);
        const footprint = obj.userData.contactFootprint;
        if (footprint) contactShadows.add({ x: p.x, y: terrainHeight(p.x, p.z) + 0.035, z: p.z, ...footprint });
        if (obj.userData.life || obj.userData.guest || id.startsWith("dragon:")) {
          const depth = p.z - routeZ(p.x);
          const ground = activeRoom || Math.abs(depth) < 1.4
            ? routeHeight(p.x) + 0.195 : terrainHeight(p.x, p.z) + 0.035;
          const scale = obj.scale.x;
          const dragon = id.startsWith("dragon:");
          contactShadows.add({ x: p.x, y: ground, z: p.z,
            rx: (dragon ? 2 : obj.userData.animal ? 0.38 : 0.48) * scale,
            rz: (dragon ? 1 : obj.userData.animal ? 0.24 : 0.32) * scale,
            opacity: 1 / (1 + Math.max(0, p.y - ground) * 0.3) });
        }
      }
      for (const chunk of chunks.values())
        if (chunk.visible)
          for (const patch of chunk.userData.contactPatches as ContactPatch[]) contactShadows.add(patch);
    }
    contactShadows.finish();
    localLights.update(resources.lights, viewFocus, quality.lights, true);
    // Coalesce all movement/streaming invalidations into a bounded shadow refresh.
    shadowDirty ||= sun.shadow.needsUpdate;
    sun.shadow.needsUpdate = quality.shadowSize > 0 && shadowDirty && now - lastShadowRender >= 1000 / quality.shadowHz;
    if (sun.shadow.needsUpdate) {
      shadowDirty = false;
      lastShadowRender = now;
    }
    updateMilliseconds = performance.now() - tickStarted;
    renderer.info.reset();
    const renderStarted = performance.now();
    miniature.setFocus(resources.cutout.count ? resources.cutout.windows[0].z : MINIATURE_CAMERA_DISTANCE, camera.near, camera.far, true);
    bloom.enabled = samples > 0 && effectsEnabled && quality.bloom;
    if (bloom.enabled || miniature.enabled) composer.render(dt);
    else renderer.render(world, camera);
    renderMilliseconds = performance.now() - renderStarted;
    if (governor.sample(Math.max(frameInterval, updateMilliseconds + renderMilliseconds),
      !props.paused && ready && now - lastChunkBuilt > 1500)) applyQuality();
    if (!ready) {
      ready = true;
      props.onSceneReady();
    }
    if (!diagnostics) return;
    const debug = {
      performance: {
        frames: tickCount,
        targetScans,
        targetFps: props.paused ? 10 : quality === QUALITY[0] ? 60 : 30,
        updateMs: updateMilliseconds,
        renderMs: renderMilliseconds,
        frameMs: frameInterval,
        quality: quality.name,
        bloom: bloom.enabled,
        miniature: miniature.enabled,
        miniatureScale: quality.miniatureScale,
        antialias: "msaa",
        sourceSamples: bloom.enabled || miniature.enabled ? samples : null,
        surround: world.background instanceof THREE.Color ? world.background.getHexString() : null,
        projection: "perspective",
        focusDepth: resources.cutout.count ? resources.cutout.windows[0].z : MINIATURE_CAMERA_DISTANCE,
        blurSize: miniature.blurSize.toArray(),
        pixelRatio: renderer.getPixelRatio(),
        shadowSize: quality.shadowSize,
        shadowMapAllocated: !!sun.shadow.map,
        contactShadows: contactShadows.mesh.count,
        lightSlots: localLights.lights.length,
        activeLights: localLights.active,
        shaders: renderer.info.programs?.length ?? 0,
        materials: resources.materials.size,
        terrainStripWidth: resources.terrainStripWidth,
      },
      get mainGeometry() { return profileGeometry ? (() => {
        const names = new Map<THREE.Object3D, string>([
          ...[...objects].map(([id, root]) => [root, id] as const),
          ...[...chunks].map(([id, root]) => [root, `chunk:${id}`] as const),
          ...[...actors].map(([id, actor]) => [actor.root, `hero:${id}`] as const),
        ]);
        const costs = new Map<string, number>();
        const list = renderer.renderLists.get(world, 0);
        for (const item of [...list.opaque, ...list.transparent]) {
          if (!item.geometry) continue;
          const mesh = item.object as THREE.Mesh;
          let root: THREE.Object3D = mesh;
          while (root.parent && root.parent !== world) root = root.parent;
          const name = names.get(root) ?? root.name;
          const triangles = (item.geometry.index?.count ?? item.geometry.attributes.position.count) / 3 *
            (mesh instanceof THREE.InstancedMesh ? mesh.count : 1);
          costs.set(name, (costs.get(name) ?? 0) + triangles);
        }
        return [...costs].sort((a, b) => b[1] - a[1]);
      })() : undefined; },
      focus: focusX,
      altitude: focus.y,
      chunks: chunks.size,
      visibleChunks: [...chunks.values()].filter((c) => c.visible).length,
      tileDepth: FOREGROUND_DEPTH + BACKGROUND_DEPTH,
      foregroundDepth: FOREGROUND_DEPTH,
      backgroundDepth: BACKGROUND_DEPTH,
      interiorOnly: !!activeRoom,
      biome: biomeAt(focusX * WORLD_SCALE).id,
      room: scene.viewedRoom?.id ?? null,
      objects: objects.size,
      geometries: renderer.info.memory.geometries,
      effects: stagings.size,
      azimuth,
      get landscapes() { return [...objects].filter(([id]) => id.startsWith("landscape:") || id.startsWith("foreground:") || id.startsWith("sky:")).map(([id, o]) => ({ id, ...o.userData.landscape, position: o.position.toArray() })); },
      occlusion: { enabled: resources.cutout.enabled.value, windows: resources.cutout.windows.slice(0, resources.cutout.count).map(w => w.toArray()), backPlantingVisible: [...chunks.values()].every(c => c.userData.backPlanting.visible) },
      zoom: camera.zoom,
      roadScreen: (() => { const p = new THREE.Vector3(focusPoint.x, focusPoint.y, focusPoint.z).project(camera); return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2, top: scene.topInset, bottom: scene.bottomInset }; })(),
      get actors() { return [...actors].map(([id, a]) => ({
        id,
        x: a.x,
        height: a.height,
        y: a.root.position.y,
        z: a.root.position.z,
        moving: a.moving,
        scale: a.root.scale.toArray(),
        tilt: a.root.rotation.z,
        pickup: a.pickup ?? null,
        position: a.root.position.toArray(),
        bounds: profileGeometry ? (() => { const b = new THREE.Box3().setFromObject(a.root); return { min: b.min.toArray(), max: b.max.toArray() }; })() : undefined,
        passage: a.passage ? { boundary: a.passage.boundary, elapsed: time - a.passage.started, source: a.passage.source?.id ?? null, destination: a.passage.destination?.id ?? null } : null,
      })); },
      get reactions() { return [...stagings].map(([id, s]) => ({
        id,
        kind: s.effect.kind,
        stampCrush: hasStampCrush(s.effect),
        elapsed: time - s.started,
        stamp: s.root.userData.stampPose ?? null,
        pickup: s.root.userData.pickupPose ?? null,
        position: s.root.position.toArray(),
      })); },
      get chests() { return [...objects]
        .filter(([id]) => id.startsWith("chest:"))
        .map(([id, o]) => ({
          id,
          position: o.position.toArray(),
          visible: o.visible,
          collected: !!o.userData.pickedUp,
        })); },
      get scenery() { return profileGeometry ? [...objects].filter(([id]) => /^(facade|mill|village):/.test(id)).map(([id, o]) => ({
        id, position: o.position.toArray(), visible: o.visible, door: o.userData.door?.rotation.y,
        entrance: o.userData.portal ? (() => {
          const b = new THREE.Box3().setFromObject(o), screen = new THREE.Box2();
          for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
            const p = new THREE.Vector3(x, y, z).project(camera); screen.expandByPoint(new THREE.Vector2((p.x + 1) * width / 2, (1 - p.y) * height / 2));
          }
          const p = o.userData.portal, door = new THREE.Vector3(p.x, p.y + 1.8, p.doorZ).project(camera);
          return { kind: o.name, min: b.min.toArray(), max: b.max.toArray(), screen: { min: screen.min.toArray(), max: screen.max.toArray() }, doorstep: [p.x, p.y + .36, p.doorZ], doorScreen: [(door.x + 1) * width / 2, (1 - door.y) * height / 2] };
        })() : undefined,
      })) : undefined; },
      get factory() { return profileGeometry && activeRoom?.id === "factory" ? objects.get(`room:${activeRoom.from}`)?.userData.productionLine?.userData.snapshot() : undefined; },
      get trees() { return profileGeometry ? [...chunks.values()].flatMap(c => c.userData.trees ?? []) : undefined; },
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      textures: renderer.info.memory.textures,
      ready,
      night: scene.night,
      inspection: inspection
        ? { id: inspection.id, remaining: inspection.until - time }
        : null,
      cameraTarget: { x: viewFocus.x, y: viewFocus.y, z: viewFocus.z },
      get inhabitants() { return [...objects]
        .filter(([, o]) => o.userData.life)
        .map(([id, o]) => ({
          id,
          kind: o.userData.kind,
          ...o.userData.life,
          visible: o.visible,
          stamp: o.userData.stamp,
        })); },
    };
    (window as unknown as { __voxelWorld: typeof debug }).__voxelWorld = debug;
    if (now - lastStats > 500) {
      lastStats = now;
      const stats = document.getElementById("scene-stats");
      const text = `${chunks.size} chunks · ${renderer.info.render.calls} appels · ${Math.round(renderer.info.render.triangles / 1000)}k triangles`;
      if (stats && stats.textContent !== text) stats.textContent = text;
    }
  }
  renderer.info.autoReset = false;
  frame = requestAnimationFrame(tick);
  return {
    inspect,
    cancelInspection,
    rotate(direction: number) {
      cancelInspection();
      azimuth += (direction * Math.PI) / 4;
    },
    zoom(direction: number) {
      cancelInspection();
      userZoom = THREE.MathUtils.clamp(userZoom + direction * 0.2, 0.65, 2.5);
    },
    recenter() {
      cancelInspection();
      scene.exploreCenter = null;
      scene.pan = 0;
      azimuth = 0.62;
      elevation = 0.74;
      userZoom = 1;
    },
    effects(value: boolean) {
      effectsEnabled = value;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      hudResize.disconnect();
      preference.removeEventListener("change", motion);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("keydown", keyboard);
      for (const chunk of chunks.values()) chunk.userData.dispose();
      for (const pass of composer.passes) pass.dispose();
      composer.dispose();
      contactShadows.dispose();
      sun.shadow.dispose();
      resources.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      portalFade.remove();
      canvas.remove();
      scene.heroes.clear();
      delete (window as unknown as { __voxelWorld?: unknown }).__voxelWorld;
    },
  };
}
