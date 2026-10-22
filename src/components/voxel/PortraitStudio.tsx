"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { initiationDiorama } from "./InitiationDiorama";
import { VoxelResources } from "./resources";
import { characterModel, propModel } from "./objects";

export type StudioView = {
  characterId?: string;
  scene?: "portrait" | "road" | "treasure" | "company";
  framing?: "full" | "bust";
  yaw?: number;
  animated?: boolean;
  steps?: number; chestOpen?: boolean; powerCast?: boolean;
  object?: string;
};
type Slot = { canvas: HTMLCanvasElement; view: StudioView; visible: boolean; dirty: boolean;
  changed: { steps: number; chestOpen: number; powerCast: number }; previousSteps: number;
};
const ease = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };

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
  readonly glow = new THREE.PointLight(0xffcd83, 0, 9, 2);
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
    this.glow.position.set(0, 1.5, 0.5);
    this.scene.add(this.stage, this.glow);
    const geo = this.resources.geometry(new THREE.CircleGeometry(0.65, 24));
    const mat = new THREE.MeshBasicMaterial({ color: 0x102a24, transparent: true, opacity: 0.28, depthWrite: false });
    this.resources.ownedMaterials.add(mat);
    this.shadows = new THREE.Mesh(geo, mat); this.shadows.rotation.x = -Math.PI / 2; this.shadows.position.y = -0.005;
  }
  model(key: string) {
    let model = this.models.get(key);
    const actual = key.startsWith("target:") ? key.slice(7) : key;
    if (!model) {
      model = actual.startsWith("prop:") ? propModel(this.resources, actual.slice(5)) : characterModel(this.resources, actual);
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
    this.renderer.toneMappingExposure = scene === "portrait" ? 1.35 : 1.12;
    let halfH = v.framing === "bust" ? 0.81 : 1.63, targetY = v.framing === "bust" ? 1.75 : 1.1;
    const hero = this.model(v.characterId ?? "barde");
    hero.userData.animate?.(time, false);
    if (scene === "portrait") {
      if (v.object) {
        const object = this.model(`prop:${v.object}`); this.stage.add(object); halfH = 0.85; targetY = 0.4;
      } else { hero.rotation.y = v.yaw ?? -0.3; this.stage.add(hero); }
      this.stage.add(this.shadows);
    } else {
      halfH = 2.7; targetY = 1.05;
      this.glow.intensity = scene === "company" ? 4 : 2;
      const key = scene === "company" ? "ground:company" : "ground:forest";
      let scenery = this.models.get(key);
      if (!scenery) { scenery = initiationDiorama(this.resources, scene === "company"); this.models.set(key, scenery); }
      this.stage.add(scenery);
      const elapsed = (field: keyof Slot["changed"]) => time === 0 ? 10 : Math.max(0, time - slot.changed[field]);
      hero.rotation.y = 0.15; hero.position.set(-1.35, 0.05, 0.3);
      if (scene === "road") {
        const motion = ease(elapsed("steps") / 0.72);
        const steps = THREE.MathUtils.lerp(slot.previousSteps, v.steps ?? 0, motion);
        hero.position.x += steps * 0.57;
        hero.userData.animate?.(time, motion < 1 && (v.steps ?? 0) > 0, { stride: motion * Math.PI * 4 });
        if ((v.steps ?? 0) > 0 && motion < 1) {
          const paper = this.model("prop:scroll"); paper.scale.setScalar(0.35);
          paper.position.set(THREE.MathUtils.lerp(-0.9, 1.65, motion), 1.3 + Math.sin(motion * Math.PI) * 0.35, 0.1);
          paper.rotation.z = motion * -0.5; this.stage.add(paper);
        }
      } else if (scene === "treasure") {
        const opening = v.chestOpen ? ease(elapsed("chestOpen") / 0.65) : 0;
        const casting = v.powerCast ? ease(elapsed("powerCast") / 0.6) : 0;
        const chest = this.model("prop:chest"); chest.position.set(-0.05, 0.05, 0.35); chest.scale.setScalar(1.1);
        (chest.userData.lid as THREE.Group).rotation.x = -opening * 1.65;
        const target = this.model(v.powerCast && casting > 0.5 ? "prop:frog" : "target:demon");
        target.position.set(1.55, 0.05, 0.35);
        const scale = v.powerCast ? casting <= 0.5 ? 1 - casting * 1.75 : 0.2 + (casting - 0.5) * 2.3 : 0.9;
        target.scale.setScalar(scale); this.stage.add(chest, target);
        if (casting > 0 && casting < 1) {
          const spell = this.model("prop:lightning"); spell.scale.setScalar(0.35 + Math.sin(casting * Math.PI) * 0.25);
          spell.position.set(-1.1 + casting * 2.7, 0.9 + Math.sin(casting * Math.PI) * 0.4, 0.55); this.stage.add(spell);
          hero.userData.animate?.(time, false, { motion: "send" });
        }
        this.contact("target", target.position.x, 0.35, v.powerCast ? 0.6 : 0.75);
        this.contact("chest", -0.05, 0.35, 0.85);
      } else {
        const friend = this.model(`target:${v.characterId === "barde" ? "chevalier" : "barde"}`);
        friend.position.set(1.1, 0.05, 0.5); friend.rotation.y = -0.35; friend.userData.animate?.(time, false);
        hero.position.set(-1.1, 0.05, 0.45); hero.rotation.y = 0.45;
        this.stage.add(friend); this.contact("friend", 1.1, 0.5, 0.8);
      }
      this.stage.add(hero); this.contact("hero", hero.position.x, hero.position.z, 0.8);
    }
    const aspect = width / height;
    if (scene !== "portrait") halfH = Math.max(halfH, 4.15 / aspect);
    else this.glow.intensity = 0;
    this.camera.left = -halfH * aspect; this.camera.right = halfH * aspect;
    this.camera.top = halfH; this.camera.bottom = -halfH;
    this.camera.position.set(scene === "portrait" ? 4.2 : 3.6, targetY + (scene === "portrait" ? 3 : 3.5), 8); this.camera.lookAt(0, targetY, 0); this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const ctx = canvas.getContext("2d", { alpha: true });
    ctx?.clearRect(0, 0, width, height); ctx?.drawImage(this.renderer.domElement, 0, 0);
    canvas.dataset.studio = this.id;
    canvas.dataset.model = v.object ?? v.characterId ?? "barde";
    canvas.dataset.triangles = String(this.renderer.info.render.triangles);
    canvas.dataset.rotation = String(v.yaw ?? -0.3);
    this.renders++;
  }
  contact(key: string, x: number, z: number, scale: number) {
    const id = `contact:${key}`;
    let shadow = this.models.get(id);
    if (!shadow) { shadow = new THREE.Group(); shadow.add(this.shadows.clone()); this.models.set(id, shadow); }
    shadow.position.set(x, 0.04, z); shadow.scale.set(scale, 1, scale); this.stage.add(shadow);
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
    const record: Slot = { canvas: node, view: {}, visible: true, dirty: true, changed: { steps: -10, chestOpen: -10, powerCast: -10 }, previousSteps: 0 }; slot.current = record; studio.slots.add(record);
    const resize = new ResizeObserver(() => { record.dirty = true; studio.wake(); }); resize.observe(node);
    const visibility = new IntersectionObserver(([entry]) => { record.visible = entry.isIntersecting; record.dirty = true; studio.wake(); }); visibility.observe(node);
    const wake = () => { record.dirty = true; studio.wake(); }; document.addEventListener("visibilitychange", wake);
    studio.wake();
    return () => {
      slot.current = null; resize.disconnect(); visibility.disconnect(); document.removeEventListener("visibilitychange", wake); studio.slots.delete(record);
      if (!studio.slots.size) disposal = setTimeout(() => { studio.dispose(); if (shared === studio) shared = undefined; }, 500);
    };
  }, []);
  useEffect(() => {
    const record = slot.current; if (!record) return;
    for (const field of ["steps", "chestOpen", "powerCast"] as const) if (record.view[field] !== view[field]) {
      record.changed[field] = performance.now() / 1000;
      if (field === "steps") record.previousSteps = record.view.steps ?? 0;
    }
    record.view = { ...view, yaw: interactive ? yaw : view.yaw }; record.dirty = true; shared?.wake();
  });
  return <div className={`voxel-portrait ${className}`} data-interactive={interactive || undefined}>
    <canvas ref={canvas} role="img" aria-label={label} onPointerDown={interactive ? event => { drag.current = { x: event.clientX, yaw }; event.currentTarget.setPointerCapture(event.pointerId); } : undefined}
      onPointerMove={interactive ? event => { if (drag.current) setYaw(drag.current.yaw + (event.clientX - drag.current.x) * 0.014); } : undefined}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
    <span className="voxel-portrait__fallback">Aperçu 3D indisponible</span>
    {interactive ? <div className="voxel-portrait__turn"><button type="button" aria-label="Tourner le personnage à gauche" onClick={() => setYaw(value => value - Math.PI / 4)}>↶</button><span>Vue 3D · Glisse pour tourner</span><button type="button" aria-label="Tourner le personnage à droite" onClick={() => setYaw(value => value + Math.PI / 4)}>↷</button></div> : null}
  </div>;
}
