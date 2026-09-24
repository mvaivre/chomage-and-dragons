"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniGameResult } from "@/lib/data/types";
import { JOURNEY_STEPS, MINI_GAME_BONUS } from "@/lib/config";
import { ACTION_ART } from "@/lib/game/art";
import { withImage as loadImage } from "@/lib/client/preload";
import {
  COURSE, courseSeed, createPigeonSim, flapPigeon, pigeonSpeed, pigeonTargetY, stepPigeon, towersPassed,
  type PigeonEvent, type PigeonSim, type PigeonStatus,
} from "@/lib/game/pigeon-flight";
import { ACTION_KEYS, MiniGameShell, type MiniGameProps } from "./MiniGameShell";
import { createFx, drawPigeonScene, GROUND_Y, pigeonScreenX, spawnParticles, updateParticles, type SceneAssets, type SceneView } from "./pigeon-scene";

const FAR_LAYER = "/art/world-v3/runtime/plaine-far.webp";


/**
 * The backwards courier's obstacle course: tap to beat the wings, thread the
 * towers, reach the mailbox. Touch, mouse, Space and Enter all flap; the
 * simulation lives in pigeon-flight.ts and the drawing in pigeon-scene.ts.
 */
export function PigeonGame({ seedId, onResolve, onDone, practice }: MiniGameProps) {
  const arena = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const view = useRef<SceneView>({ width: 0, height: COURSE.height, pigeonX: COURSE.pigeonX, now: 0, reducedMotion: false });
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const reduced = useRef(reducedMotion);
  // The simulation is mutated in place by the frame loop and never replaced.
  const [sim] = useState<PigeonSim>(() => createPigeonSim(courseSeed(seedId), { speedScale: reducedMotion ? 0.75 : 1 }));
  const fx = useRef(createFx());
  const assets = useRef<SceneAssets>({ pigeon: null, far: null });
  const resolved = useRef<MiniGameResult | null>(null);
  const [phase, setPhase] = useState<"play" | "result">("play");
  const phaseRef = useRef(phase);
  const [status, setStatus] = useState<PigeonStatus>("ready");
  const [passed, setPassed] = useState(0);
  const [feathers, setFeathers] = useState<number>(COURSE.feathers);
  const [outcome, setOutcome] = useState<MiniGameResult | null>(null);
  const base = JOURNEY_STEPS.candidature;
  const bonus = MINI_GAME_BONUS.candidature;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(preference.matches);
      sim.speedScale = preference.matches ? 0.75 : 1;
    };
    preference.addEventListener("change", sync);
    loadImage(ACTION_ART.candidature, image => { assets.current.pigeon = image; });
    loadImage(FAR_LAYER, image => { assets.current.far = image; });
    return () => preference.removeEventListener("change", sync);
  }, [sim]);

  useEffect(() => { reduced.current = reducedMotion; }, [reducedMotion]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const settle = useCallback((result: MiniGameResult) => {
    if (resolved.current) return;
    resolved.current = result;
    setOutcome(result);
    // Save before the landing animation, so reloading cannot replay the attempt.
    onResolve(result);
  }, [onResolve]);
  const settleRef = useRef(settle);
  useEffect(() => { settleRef.current = settle; }, [settle]);

  const leave = () => {
    if (!resolved.current) settle("skipped");
    onDone();
  };

  // The frame loop steps the simulation, reacts to its events and draws.
  useEffect(() => {
    const canvasNode = canvas.current;
    const arenaNode = arena.current;
    const ctx = canvasNode?.getContext("2d");
    const current = sim;
    if (!canvasNode || !arenaNode || !ctx) return;
    const scene = view.current;
    let scale = 1;
    let dpr = 1;
    const resize = () => {
      const rect = arenaNode.getBoundingClientRect();
      if (!rect.height) return;
      scale = rect.height / COURSE.height;
      scene.width = rect.width / scale;
      scene.pigeonX = pigeonScreenX(scene.width);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvasNode.width = Math.round(rect.width * dpr);
      canvasNode.height = Math.round(rect.height * dpr);
    };
    resize();
    const observer = new ResizeObserver(() => {
      resize();
      // A resize clears the canvas; repaint the final picture if drawing has stopped.
      if (stopped) { ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0); drawPigeonScene(ctx, current, fx.current, scene, assets.current); }
    });
    observer.observe(arenaNode);
    let previous = performance.now();
    let frame = 0;
    let stopped = false;
    let hitStopUntil = 0;
    const timeouts: number[] = [];
    const later = (ms: number, run: () => void) => { timeouts.push(window.setTimeout(run, ms)); };
    const syncVisibility = () => { previous = performance.now(); };
    document.addEventListener("visibilitychange", syncVisibility);

    const react = (event: PigeonEvent, now: number) => {
      const s = current;
      const effects = fx.current;
      const calm = reduced.current;
      if (event === "pass") {
        setPassed(towersPassed(s));
        const tower = [...s.towers].reverse().find(t => t.passed);
        if (tower && !calm) {
          const x = scene.pigeonX + (tower.x - s.distance) + COURSE.towerWidth / 2;
          spawnParticles(effects, "spark", x, tower.gapY - tower.gapHeight / 2 - 8, 5);
          spawnParticles(effects, "spark", x, tower.gapY + tower.gapHeight / 2 + 8, 5);
        }
      } else if (event === "hit") {
        setFeathers(s.feathers);
        if (calm) return;
        effects.shakeUntil = now + 220;
        effects.flashUntil = now + 160;
        hitStopUntil = now + 80;
        spawnParticles(effects, "feather", scene.pigeonX, s.y, 6);
        if (s.y > GROUND_Y - 30) spawnParticles(effects, "dust", scene.pigeonX, GROUND_Y, 6);
      } else if (event === "crashed") {
        effects.finishedAt = now;
        effects.finalY = s.y;
        setStatus("crashed");
        settleRef.current("lost");
        if (!calm) { spawnParticles(effects, "feather", scene.pigeonX, s.y, 10); later(680, () => spawnParticles(fx.current, "dust", scene.pigeonX, GROUND_Y, 10)); }
        later(calm ? 300 : 1000, () => setPhase("result"));
      } else if (event === "delivered") {
        effects.finishedAt = now;
        effects.finalY = s.y;
        setStatus("delivered");
        settleRef.current("won");
        if (!calm) later(620, () => spawnParticles(fx.current, "spark", scene.pigeonX + (current.mailboxX - current.distance), GROUND_Y / 2 - 20, 16));
        later(calm ? 300 : 1200, () => setPhase("result"));
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(100, now - previous);
      previous = now;
      scene.now = now;
      scene.reducedMotion = reduced.current;
      if (!document.hidden && now >= hitStopUntil) {
        for (const event of stepPigeon(current, dt)) react(event, now);
      }
      updateParticles(fx.current, dt, current.status === "flying" ? pigeonSpeed(current) : 0);
      if (progress.current) progress.current.style.width = `${Math.min(100, current.distance / current.mailboxX * 100)}%`;
      // The browser tests fly the course through the real input path using these.
      arenaNode.dataset.status = current.status;
      arenaNode.dataset.y = current.y.toFixed(1);
      arenaNode.dataset.vy = current.vy.toFixed(1);
      arenaNode.dataset.target = pigeonTargetY(current).toFixed(1);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      drawPigeonScene(ctx, current, fx.current, scene, assets.current);
      // Once the landing has played out, the picture no longer changes: stop drawing.
      const finished = current.status === "delivered" || current.status === "crashed";
      if (finished && now - fx.current.finishedAt > 2400 && fx.current.particles.length === 0) { stopped = true; return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncVisibility);
      timeouts.forEach(id => window.clearTimeout(id));
    };
  }, [sim]);

  const flap = useCallback(() => {
    if (phaseRef.current !== "play") return;
    const wasReady = sim.status === "ready";
    if (!flapPigeon(sim).length) return;
    if (wasReady) setStatus("flying");
    if (!reduced.current) spawnParticles(fx.current, "trail", view.current.pigeonX - 18, sim.y + 8, 2);
  }, [sim]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (phase !== "play" || event.repeat || !ACTION_KEYS.has(event.key)) return;
    if ((event.target as HTMLElement).closest(".mini-game__skip, .mini-game__close")) return;
    event.preventDefault();
    flap();
  };

  const won = outcome === "won";
  const remaining = COURSE.towers - passed;
  const instructions = phase === "result"
    ? won ? "Livré à l’envers. Compté double." : "Le CV s’est égaré. Ta candidature compte quand même."
    : status === "ready"
      ? `Tape pour battre des ailes. Franchis les ${COURSE.towers} tours sans perdre tes ${COURSE.feathers} plumes : la boîte aux lettres double cette candidature, +${base + bonus} pas !`
      : remaining > 0 ? `Tape, tape, tape ! Encore ${remaining} tour${remaining > 1 ? "s" : ""} avant la boîte aux lettres.` : "Dernière ligne droite : vise la fente dorée !";

  return <MiniGameShell kind="pigeon" eyebrow={`${practice ? "Entraînement · " : ""}Courrier presque prioritaire · +${base} pas acquis`} title="Le pigeon à reculons"
    instructions={instructions} onKeyDown={onKeyDown} onLeave={leave} focusKey={phase}
    hud={<>
      <span className="mini-game__counter"><b>{passed}</b> / {COURSE.towers} tours</span>
      <span className="mini-game__progress"><span ref={progress} /></span>
      <span className="mini-game__lives">
        {Array.from({ length: COURSE.feathers }, (_, i) => <i key={i} className="mini-game__feather" data-lost={i >= feathers} />)}
      </span>
    </>}
    status={phase === "result" ? <><strong>{won ? `×2 · +${base + bonus} pas` : `+${base} pas conservés`}</strong><span>{won ? `${base} pas de candidature + ${bonus} pas bonus` : "Aucun pas perdu. Le voyage continue."}</span></> :
      <span>{status === "ready" ? `Une seule tentative · ${COURSE.towers} tours · ${COURSE.feathers} plumes` :
        status === "flying" ? `${feathers} plume${feathers > 1 ? "s" : ""} · Touche l’image, Espace ou Entrée` : won ? "Livraison en cours…" : "Atterrissage forcé…"}</span>}
    primary={{
      label: phase === "result" ? "Continuer le voyage" : status === "ready" ? "Décoller !" : status === "flying" ? "Battre des ailes" : won ? "Livraison…" : "Aïe…",
      disabled: phase === "play" && status !== "ready" && status !== "flying",
      onClick: () => phase === "play" ? flap() : onDone(),
    }}
    skip={phase === "play" && (status === "ready" || status === "flying") ? { label: `Garder mes +${base} pas`, onClick: leave } : null}>
    <button ref={arena} type="button" tabIndex={-1} className="mini-game__arena" data-phase={phase} data-won={won} data-reduced={reducedMotion}
      aria-label="Battre des ailes" disabled={phase !== "play"}
      onPointerDown={event => { event.preventDefault(); flap(); }} onContextMenu={event => event.preventDefault()}>
      <canvas ref={canvas} className="mini-game__canvas" aria-hidden />
      {phase === "play" && status === "ready" ? <span className="mini-game__prompt" aria-hidden>Touche pour décoller !<small>Espace ou Entrée au clavier</small></span> : null}
      {phase === "result" ? <span className="mini-game__stamp" aria-hidden>{won ? "LIVRÉ ! ×2" : "ADRESSE INTROUVABLE"}</span> : null}
    </button>
  </MiniGameShell>;
}
