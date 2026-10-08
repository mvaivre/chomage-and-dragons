"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { sfx } from "@/lib/client/sound";
import { seedFrom } from "@/lib/game/random";
import {
  ARCADE, ARCADE_DURATIONS, arcadeScore, boostRace, createArcade, cutAtBlade, dropStack, moveCutBlade, movePong, moveStack, rotateStack,
  slicePapers, softDropStack, steerRace, stepArcade, turnMaze, turnSnake, type ArcadeKind, type Direction,
} from "@/lib/game/arcade";
import { MINI_GAMES } from "@/lib/game/mini-games";
import { punchlineFor } from "@/lib/game/punchlines";
import { MiniGameShell, ScoreLine, type MiniGameProps } from "./MiniGameShell";
import { pointerToLogical, useArenaCanvas } from "./useArenaCanvas";
import { arcadeHud, drawArcade } from "./arcade-scene";
import "./arcade.css";

const COPY: Record<ArcadeKind, { instructions: string; ready: string; won: string; controls: string }> = {
  pigeonRace: { instructions: "Termine en tête ! Change de couloir pour éviter les colis, puis turbo dès qu’il est prêt.", ready: "Trois pigeons géants. Zéro sens de l’orientation.", won: "Première place. La gravité a déposé une réclamation.", controls: "↑ ↓ : couloirs · Espace : turbo" },
  paperCut: { instructions: "Découpe 14 dossiers en glissant le doigt. Évite les sceaux rouges de l’ORP : ils coûtent 2 vies.", ready: "La paperasse va enfin connaître une fin digne.", won: "Quatorze dossiers classés. En confettis.", controls: "Glisse pour couper · Flèches : viseur · Espace : tranche" },
  snake: { instructions: "Avale 10 lettres sans toucher les murs ni ta propre file d’attente. Chaque lettre te fait grandir.", ready: "Un serpent administratif qui a très, très faim.", won: "Toutes les lettres avalées. Aucun recruteur n’a été digéré.", controls: "Flèches ou ZQSD / WASD : tourner" },
  maze: { instructions: "Ramasse toutes les pièces du labyrinthe et évite les recruteurs fantômes. Les potions turquoise les font fuir.", ready: "L’office des couloirs interminables ouvre ses portes.", won: "Le trésor est à toi. Les recruteurs cherchent encore la sortie.", controls: "Flèches ou ZQSD / WASD : se déplacer" },
  stack: { instructions: "Complète 4 lignes de dossiers. Tourne les pièces et utilise la silhouette pour préparer leur chute.", ready: "Cette fois, la pile de dossiers sera bien rangée.", won: "Quatre lignes impeccables. L’administration est terrifiée.", controls: "← → : déplacer · ↑ : tourner · ↓ : descendre · Espace : chute" },
  pong: { instructions: "Renvoie le dossier au recruteur. Le premier à 5 gagne. Vise avec les bords de ta raquette pour le surprendre.", ready: "Le recrutement est un sport de renvoi.", won: "Le dossier est revenu chez le recruteur. Cinq fois.", controls: "Glisse la raquette · Maintiens ← → au clavier" },
};
const DIRECTIONS: Record<string, Direction> = { ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", ArrowLeft: "left", w: "up", z: "up", d: "right", s: "down", a: "left", q: "left" };

export function ArcadeGame({ kind, seedId, onResolve, onDone, practice, record, best }: MiniGameProps & { kind: ArcadeKind }) {
  const [sim] = useState(() => createArcade(kind, seedFrom(seedId)));
  const [phase, setPhase] = useState<"ready" | "playing" | "done">("ready");
  const phaseRef = useRef(phase), resolved = useRef(false), painted = useRef(0);
  const held = useRef<Direction | null>(null), swipe = useRef<{ x: number; y: number } | null>(null);
  const [hud, setHud] = useState(() => ({ line: arcadeHud(sim), seconds: ARCADE_DURATIONS[kind], turbo: true }));
  const copy = COPY[kind];
  const settle = useCallback(() => {
    if (resolved.current) return;
    resolved.current = true; phaseRef.current = "done"; held.current = null; setPhase("done");
    onResolve(sim.status === "won" ? "won" : "lost", arcadeScore(sim));
    (sim.status === "won" ? sfx.win : sfx.sad)();
  }, [onResolve, sim]);
  const { arena, canvas, view } = useArenaCanvas<HTMLDivElement>(ARCADE, (ctx, viewport, dtMs, node) => {
    if (phaseRef.current === "playing") {
      if (sim.kind === "pong" && held.current) movePong(sim, sim.player + (held.current === "left" ? -1 : 1) * dtMs * .29);
      stepArcade(sim, dtMs / 1000);
      if (sim.status !== "running") settle();
    }
    if (viewport.now - painted.current > 100 || phaseRef.current === "done") {
      painted.current = viewport.now;
      const seconds = Math.max(0, Math.ceil(ARCADE_DURATIONS[kind] - sim.t));
      // Updating only changed values keeps a finished canvas from rerendering React every frame.
      const line = arcadeHud(sim), turbo = sim.kind !== "pigeonRace" || sim.cooldown <= 0;
      setHud(before => before.line === line && before.seconds === seconds && before.turbo === turbo ? before : { line, seconds, turbo });
    }
    node.dataset.status = phaseRef.current === "ready" ? "ready" : sim.status;
    drawArcade(ctx, sim, viewport.now, viewport.reducedMotion);
  });
  useEffect(() => {
    const release = () => { held.current = null; };
    window.addEventListener("keyup", release); window.addEventListener("blur", release); window.addEventListener("pointerup", release);
    return () => { window.removeEventListener("keyup", release); window.removeEventListener("blur", release); window.removeEventListener("pointerup", release); };
  }, []);
  const start = () => { if (phaseRef.current !== "ready") return; phaseRef.current = "playing"; setPhase("playing"); };
  const leave = () => { if (!resolved.current) { resolved.current = true; onResolve("skipped"); } onDone(); };
  const direction = (dir: Direction) => {
    if (phaseRef.current !== "playing") return;
    switch (sim.kind) {
      case "pigeonRace": if (dir === "up" || dir === "down") steerRace(sim, dir === "up" ? -1 : 1); break;
      case "snake": turnSnake(sim, dir); break;
      case "maze": turnMaze(sim, dir); break;
      case "stack": if (dir === "up") rotateStack(sim); else if (dir === "down") softDropStack(sim); else moveStack(sim, dir === "left" ? -1 : 1); break;
      case "pong": if (dir === "left" || dir === "right") { held.current = dir; movePong(sim, sim.player + (dir === "left" ? -8 : 8)); } break;
      case "paperCut": moveCutBlade(sim, dir); break;
    }
  };
  const action = () => {
    if (phaseRef.current !== "playing") return;
    if (sim.kind === "pigeonRace") { if (boostRace(sim)) sfx.flap(); }
    else if (sim.kind === "paperCut") { if (cutAtBlade(sim)) sfx.chime(); }
    else if (sim.kind === "stack") dropStack(sim);
    if (sim.status !== "running") settle();
  };
  const point = (event: PointerEvent<HTMLDivElement>) => pointerToLogical(event, event.currentTarget, view.current);
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== "playing") return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    const at = point(event); swipe.current = at;
    if (sim.kind === "pong") movePong(sim, at.x);
    if (sim.kind === "paperCut") { if (slicePapers(sim, at, at)) sfx.chime(); }
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== "playing" || !swipe.current) return;
    const at = point(event);
    if (sim.kind === "paperCut") { if (slicePapers(sim, swipe.current, at)) sfx.chime(); }
    if (sim.kind === "pong") movePong(sim, at.x);
    if (sim.kind === "snake" || sim.kind === "maze") {
      const dx = at.x - swipe.current.x, dy = at.y - swipe.current.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 16) { direction(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "right" : "left" : dy > 0 ? "down" : "up"); swipe.current = at; }
      return;
    }
    swipe.current = at;
  };
  const controls = kind === "snake" || kind === "maze" || kind === "paperCut" ? ["up", "left", "down", "right"] as const
    : kind === "pigeonRace" ? ["up", "down"] as const : kind === "stack" ? ["left", "up", "down", "right"] as const : ["left", "right"] as const;
  const labels: Record<Direction, string> = { up: kind === "stack" ? "↻" : "↑", right: "→", down: "↓", left: "←" };
  const names: Record<Direction, string> = { up: kind === "stack" ? "Tourner la pièce" : "Monter", right: "Aller à droite", down: kind === "stack" ? "Faire descendre la pièce" : "Descendre", left: "Aller à gauche" };
  const finished = phase === "done", playing = phase === "playing", won = sim.status === "won";
  return <MiniGameShell kind={kind} eyebrow={`${practice ? "Entraînement · " : ""}${MINI_GAMES[kind].misery}`} title={MINI_GAMES[kind].title}
    instructions={finished ? won ? copy.won : punchlineFor(`${kind}:${seedId}`) : copy.instructions}
    onLeave={leave} focusKey={phase} onKeyDown={event => {
      if (!playing) return;
      const dir = DIRECTIONS[event.key] ?? DIRECTIONS[event.key.toLowerCase()];
      if (dir) { event.preventDefault(); direction(dir); }
      else if (event.key === " " || event.key === "Enter") {
        // Native keyboard activation must still operate the focused control or close button.
        if ((event.target as HTMLElement).closest(".mini-game__close, .mini-game__skip, .arcade-controls button")) return;
        event.preventDefault(); if (!event.repeat) action();
      }
    }}
    hud={<><span><b>{hud.line}</b></span><span className="arcade-clock"><b>{hud.seconds} s</b></span></>}
    status={finished ? <><strong>{won ? "Défi réussi !" : "La revanche t’attend."}</strong><ScoreLine score={arcadeScore(sim)} unit="pts" record={record} best={best} practice={practice} /></>
      : <span>{playing ? copy.controls : copy.ready}</span>}
    primary={{ label: finished ? practice ? "Retour à l’arcade" : "Continuer" : playing ? "Défi en cours…" : "C’est parti !", disabled: playing, onClick: finished ? onDone : start }}
    skip={!finished ? { label: "Passer", onClick: leave } : null}>
    <div ref={arena} className="mini-game__arena arcade-arena" role="group" aria-label={`Terrain de jeu : ${MINI_GAMES[kind].title}`}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { swipe.current = null; }} onPointerCancel={() => { swipe.current = null; }} onContextMenu={event => event.preventDefault()}>
      <canvas ref={canvas} className="mini-game__canvas" aria-hidden />
      {phase === "ready" ? <span className="arcade-overlay"><b>{kind === "pigeonRace" ? "À L’ENVERS, TOUTE !" : kind === "paperCut" ? "À VOS LAMES" : kind === "snake" ? "COURRIER INDÉSIRABLE" : kind === "maze" ? "CHASSE AUX RECRUTEURS" : kind === "stack" ? "DOSSIERS EN CHUTE LIBRE" : "RENVOI À L’EXPÉDITEUR"}</b><small>Prêt·e pour le défi ?</small></span> : null}
      {finished ? <span className="arcade-overlay" data-won={won}><b>{won ? "VICTOIRE !" : "À CHARGE DE REVANCHE"}</b><small>{arcadeScore(sim)} points</small></span> : null}
    </div>
    <div className="arcade-controls" data-kind={kind} aria-label="Commandes du mini-jeu">
      {controls.map(dir => <button key={dir} type="button" disabled={!playing} aria-label={names[dir]}
        onPointerDown={event => { if (kind === "pong") { event.preventDefault(); direction(dir); } }}
        onPointerUp={() => { if (kind === "pong") held.current = null; }} onPointerCancel={() => { held.current = null; }}
        onClick={event => { if (kind !== "pong") direction(dir); else if (sim.kind === "pong" && event.detail === 0) { movePong(sim, sim.player + (dir === "left" ? -24 : 24)); held.current = null; } }}>{labels[dir]}</button>)}
      {kind === "pigeonRace" || kind === "paperCut" || kind === "stack" ? <button type="button" className="arcade-action" disabled={!playing} aria-disabled={kind === "pigeonRace" && !hud.turbo || undefined} onClick={action}>{kind === "pigeonRace" ? hud.turbo ? "Turbo !" : "Recharge…" : kind === "paperCut" ? "Trancher" : "Chute ↓"}</button> : null}
    </div>
  </MiniGameShell>;
}
