"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { VoxelResources } from "./resources";
import { characterModel, dragonModel, propModel } from "./objects";

export type StudioView = {
  characterId?: string;
  scene?: "portrait" | "flight" | "road" | "treasure";
  framing?: "full" | "bust";
  yaw?: number;
  animated?: boolean;
  lane?: number; ringLane?: number; ringX?: number; done?: boolean;
  steps?: number; chestOpen?: boolean; powerCast?: boolean;
  object?: string;
};
type Slot = { canvas: HTMLCanvasElement; view: StudioView; visible: boolean; dirty: boolean };

/** One small WebGL context paints all UI canvases. Thumbnails are painted once;
 * only the visible selected hero/lesson animates. No textures, shadow maps or post FX. */
class PortraitStudio {
  readonly id = THREE.MathUtils.generateUUID();
  readonly renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
  readonly resources = new VoxelResources();
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 60);
  readonly stage = new THREE.Group();
  readonly slots = new Set<Slot>();
  readonly models = new Map<string, THREE.Group>();
  readonly shadows: THREE.Mesh;
  frame = 0; last = 0; renders = 0;
  constructor() {
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.scene.add(new THREE.HemisphereLight(0xfff3ce, 0x617b78, 2.5));
    const sun = new THREE.DirectionalLight(0xffe6b0, 3.5); sun.position.set(-3, 6, 5); this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x9bd5cc, 1.4); rim.position.set(4, 3, -4); this.scene.add(rim);
    this.scene.add(this.stage);
    const geo = this.resources.geometry(new THREE.CircleGeometry(0.65, 24));
    const mat = new THREE.MeshBasicMaterial({ color: 0x102a24, transparent: true, opacity: 0.28, depthWrite: false });
    this.resources.ownedMaterials.add(mat);
    this.shadows = new THREE.Mesh(geo, mat); this.shadows.rotation.x = -Math.PI / 2; this.shadows.position.y = -0.005;
  }
  model(key: string) {
    let model = this.models.get(key);
    const actual = key.startsWith("target:") ? key.slice(7) : key;
    if (!model) {
      model = actual === "dragon" ? dragonModel(this.resources) : actual.startsWith("prop:") ? propModel(this.resources, actual.slice(5)) : characterModel(this.resources, actual);
      this.models.set(key, model);
    }
    model.position.set(0, 0, 0); model.rotation.set(0, 0, 0); model.scale.setScalar(1);
    return model;
  }
  wake = () => { if (!this.frame) this.frame = requestAnimationFrame(this.tick); };
  tick = (now: number) => {
    this.frame = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let active = false;
    for (const slot of this.slots) {
      if (!slot.visible || document.hidden) continue;
      const animate = slot.view.animated && !reduced;
      active ||= !!animate;
      if (slot.dirty || (animate && now - this.last >= 50)) { this.draw(slot, reduced ? 0 : now / 1000); slot.dirty = false; }
    }
    if (now - this.last >= 50) this.last = now;
    if (active) this.wake();
  };
  draw(slot: Slot, time: number) {
    const { canvas, view: v } = slot, rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(devicePixelRatio || 1, matchMedia("(pointer: coarse)").matches ? 1 : 1.5);
    const width = Math.min(720, Math.round(rect.width * ratio)), height = Math.min(540, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    if (this.renderer.domElement.width !== width || this.renderer.domElement.height !== height)
      this.renderer.setSize(width, height, false);
    this.stage.clear();
    const scene = v.scene ?? "portrait";
    let halfH = v.framing === "bust" ? 0.81 : 1.63, targetY = v.framing === "bust" ? 1.75 : 1.1;
    const hero = this.model(v.characterId ?? "barde");
    hero.userData.animate?.(time, false);
    if (scene === "portrait") {
      if (v.object) {
        const object = this.model(`prop:${v.object}`); this.stage.add(object); halfH = 0.85; targetY = 0.4;
      } else { hero.rotation.y = v.yaw ?? -0.3; this.stage.add(hero); }
      this.stage.add(this.shadows);
    } else {
      halfH = 3.15; targetY = 0.8;
      const scenery = this.lessonGround(scene); this.stage.add(scenery);
      if (scene === "flight") {
        halfH = 3.6; targetY = 1;
        const dragon = this.model("dragon"); dragon.scale.setScalar(0.75); dragon.rotation.y = Math.PI;
        dragon.position.set(-2.7, 2.1 - (v.done ? 1 : v.lane ?? 1) * 1.65, 0);
        hero.scale.setScalar(0.5); hero.position.copy(dragon.position).add(new THREE.Vector3(0, 1.05, 0)); hero.rotation.y = Math.PI / 2;
        this.stage.add(dragon, hero);
        if (!v.done) {
          const ring = this.lessonRing(); ring.position.set(((v.ringX ?? 105) - 23) * 0.12 - 2.7, 2.4 - (v.ringLane ?? 1) * 1.65, 0.4); this.stage.add(ring);
        }
      } else if (scene === "road") {
        halfH = 2.5;
        hero.scale.setScalar(0.78); hero.position.x = -3.4 + Math.min(10, v.steps ?? 0) * 0.65; hero.rotation.y = 0.4;
        const chest = this.model("prop:chest"); chest.position.set(3.4, 0, 0); (chest.userData.lid as THREE.Group).rotation.x = 0; this.stage.add(hero, chest);
      } else {
        hero.position.x = -2.2; hero.rotation.y = 0.35;
        const chest = this.model("prop:chest"); chest.position.set(0, 0, 0.3);
        (chest.userData.lid as THREE.Group).rotation.x = v.chestOpen ? -1.65 : 0;
        const target = this.model(v.powerCast ? "prop:frog" : "target:demon"); target.position.x = 2.2; target.scale.setScalar(v.powerCast ? 1.7 : 0.85);
        this.stage.add(hero, chest, target);
      }
    }
    // Keep full bodies/accessories visible in narrow slots as well as landscape lessons.
    const aspect = width / height;
    if (scene !== "portrait") halfH = Math.max(halfH, 5.2 / aspect);
    this.camera.left = -halfH * aspect; this.camera.right = halfH * aspect;
    this.camera.top = halfH; this.camera.bottom = -halfH;
    this.camera.position.set(scene === "flight" ? 0 : 4.2, targetY + (scene === "flight" ? 1.2 : 3), 8); this.camera.lookAt(0, targetY, 0); this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const ctx = canvas.getContext("2d", { alpha: true });
    ctx?.clearRect(0, 0, width, height); ctx?.drawImage(this.renderer.domElement, 0, 0);
    canvas.dataset.studio = this.id;
    canvas.dataset.model = v.object ?? v.characterId ?? "barde";
    canvas.dataset.triangles = String(this.renderer.info.render.triangles);
    canvas.dataset.rotation = String(v.yaw ?? -0.3);
    this.renders++;
  }
  lessonGround(kind: string) {
    const key = `ground:${kind}`;
    let root = this.models.get(key);
    if (root) return root;
    root = new THREE.Group(); const b = this.resources.batch(root);
    if (kind === "flight") {
      for (let i = 0; i < 5; i++) {
        b.box(0xd4e2d4, -4 + i * 2.1, -2.6 + i % 2 * 0.2, -1.5, 1.7, 0.3, 0.65);
        b.box(0xebedcf, -4 + i * 2.1, -2.4 + i % 2 * 0.2, -1.5, 0.85, 0.25, 0.5);
      }
    } else {
      b.box(0x546f4c, 0, -0.23, 0, 9.6, 0.42, 3);
      b.box(0xbcb188, 0, -0.01, 0.2, 9.6, 0.04, 1.1);
      for (let i = 0; i < 16; i++) {
        const x = -4.5 + i * 0.6, z = i % 2 ? -1 : 1.05;
        b.box(0x8ca866, x, 0.1, z, 0.12, 0.2, 0.1);
        b.box(i % 3 ? 0xe7ca74 : 0xd899a0, x, 0.22, z, 0.17, 0.09, 0.16);
      }
    }
    b.finish(); this.models.set(key, root); return root;
  }
  lessonRing() {
    let root = this.models.get("ring"); if (root) return root;
    root = new THREE.Group(); const b = this.resources.batch(root);
    for (const side of [-1, 1]) { b.box(0xedcc77, side * 0.63, 0, 0, 0.16, 1.1, 0.16, 0, true); b.box(0xedcc77, 0, side * 0.63, 0, 1.1, 0.16, 0.16, 0, true); }
    b.finish(); this.models.set("ring", root); return root;
  }
  dispose() { cancelAnimationFrame(this.frame); this.resources.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); }
}
let shared: PortraitStudio | undefined;
let disposal: ReturnType<typeof setTimeout> | undefined;

export function VoxelPortrait({ label, className = "", interactive = false, ...view }: StudioView & { label: string; className?: string; interactive?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null), slot = useRef<Slot | null>(null);
  const [yaw, setYaw] = useState(-0.3);
  const drag = useRef<{ x: number; yaw: number } | null>(null);
  useEffect(() => {
    let studio: PortraitStudio;
    try { clearTimeout(disposal); studio = shared ??= new PortraitStudio(); }
    catch { if (canvas.current) canvas.current.dataset.failed = "true"; return; }
    const node = canvas.current!;
    const record: Slot = { canvas: node, view: {}, visible: true, dirty: true }; slot.current = record; studio.slots.add(record);
    const resize = new ResizeObserver(() => { record.dirty = true; studio.wake(); }); resize.observe(node);
    const visibility = new IntersectionObserver(([entry]) => { record.visible = entry.isIntersecting; record.dirty = true; studio.wake(); }); visibility.observe(node);
    const wake = () => { record.dirty = true; studio.wake(); }; document.addEventListener("visibilitychange", wake);
    studio.wake();
    return () => {
      slot.current = null; resize.disconnect(); visibility.disconnect(); document.removeEventListener("visibilitychange", wake); studio.slots.delete(record);
      if (!studio.slots.size) disposal = setTimeout(() => { studio.dispose(); if (shared === studio) shared = undefined; }, 500);
    };
  }, []);
  useEffect(() => { if (slot.current) { slot.current.view = { ...view, yaw: interactive ? yaw : view.yaw }; slot.current.dirty = true; shared?.wake(); } });
  return <div className={`voxel-portrait ${className}`} data-interactive={interactive || undefined}>
    <canvas ref={canvas} role="img" aria-label={label} onPointerDown={interactive ? event => { drag.current = { x: event.clientX, yaw }; event.currentTarget.setPointerCapture(event.pointerId); } : undefined}
      onPointerMove={interactive ? event => { if (drag.current) setYaw(drag.current.yaw + (event.clientX - drag.current.x) * 0.014); } : undefined}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
    <span className="voxel-portrait__fallback">Aperçu 3D indisponible</span>
    {interactive ? <div className="voxel-portrait__turn"><button type="button" aria-label="Tourner le personnage à gauche" onClick={() => setYaw(value => value - Math.PI / 4)}>↶</button><span>Vue 3D · Glisse pour tourner</span><button type="button" aria-label="Tourner le personnage à droite" onClick={() => setYaw(value => value + Math.PI / 4)}>↷</button></div> : null}
  </div>;
}
