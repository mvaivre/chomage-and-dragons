"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniGameResult } from "@/lib/data/types";
import { seedFrom } from "@/lib/game/random";
import { SLOTS, createSlotsSim, jackpotCount, slotsAutopilot, stepSlots, stopReel, type SlotsSim, type SlotsStatus } from "@/lib/game/slot-machine";
import { ACTION_KEYS, MiniGameShell, type MiniGameProps } from "./MiniGameShell";
import { useArenaCanvas, type ArenaView } from "./useArenaCanvas";

const INK = "#28241a";
const WIDTH = 320;
const HEIGHT = 240;
const REEL_X = [68, 160, 252];
const REEL_W = 82;
const REEL_TOP = 66;
const REEL_H = 118;
const ROW = 40;

function drawSlots(ctx: CanvasRenderingContext2D, sim: SlotsSim, view: ArenaView) {
  const { bleedX, bleedY, now } = view;
  ctx.fillStyle = "#3b2a22";
  ctx.fillRect(-bleedX - 10, -bleedY - 10, WIDTH + bleedX * 2 + 20, HEIGHT + bleedY * 2 + 20);
  // Cabinet.
  ctx.fillStyle = "#8a2f2a";
  ctx.beginPath(); ctx.roundRect(10, 8, WIDTH - 20, HEIGHT - 16, 14); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#d4a53f";
  ctx.beginPath(); ctx.roundRect(24, 18, WIDTH - 48, 30, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.fillText("SALAIRE SELON EXPÉRIENCE", WIDTH / 2, 38);
  // Lights around the title, blinking while spinning.
  for (let i = 0; i < 12; i++) {
    const on = sim.status === "spinning" ? Math.floor(now / 120 + i) % 3 === 0 : sim.status === "won" ? Math.floor(now / 90) % 2 === 0 : false;
    ctx.fillStyle = on ? "#fff1bd" : "#5a2320";
    ctx.beginPath(); ctx.arc(30 + i * (WIDTH - 60) / 11, 56, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Reels.
  sim.reels.forEach((reel, index) => {
    const x = REEL_X[index] - REEL_W / 2;
    ctx.fillStyle = "#f5e8bd";
    ctx.fillRect(x, REEL_TOP, REEL_W, REEL_H);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, REEL_TOP, REEL_W, REEL_H); ctx.clip();
    const centre = REEL_TOP + REEL_H / 2;
    const n = reel.symbols.length;
    const first = Math.floor(reel.offset) - 2;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let k = first; k <= first + 5; k++) {
      const y = centre + (k - reel.offset) * ROW;
      if (y < REEL_TOP - ROW || y > REEL_TOP + REEL_H + ROW) continue;
      const symbol = reel.symbols[((k % n) + n) % n];
      const jackpot = symbol === "CHF";
      ctx.fillStyle = jackpot ? "#d4a53f" : "#4a4238";
      ctx.font = jackpot ? "bold 20px system-ui, sans-serif" : "bold 11px system-ui, sans-serif";
      if (jackpot) { ctx.beginPath(); ctx.arc(REEL_X[index], y, 15, 0, Math.PI * 2); ctx.fillStyle = "#f5d163"; ctx.fill(); ctx.strokeStyle = "#8a6a1e"; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = "#6b4d10"; ctx.font = "bold 12px system-ui, sans-serif"; }
      ctx.fillText(symbol, REEL_X[index], y + 1);
      ctx.strokeStyle = "rgb(40 36 26 / 0.15)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 4, y + ROW / 2); ctx.lineTo(x + REEL_W - 4, y + ROW / 2); ctx.stroke();
    }
    ctx.restore();
    ctx.textBaseline = "alphabetic";
    // Window frame, brighter once the reel is stopped.
    ctx.strokeStyle = reel.stopped ? "#f5d163" : INK; ctx.lineWidth = reel.stopped ? 4 : 3;
    ctx.strokeRect(x, REEL_TOP, REEL_W, REEL_H);
    if (sim.status === "spinning" && index === sim.current) {
      ctx.fillStyle = "#f5d163"; ctx.font = "bold 10px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("▲ STOP", REEL_X[index], REEL_TOP + REEL_H + 12);
    }
  });
  // Payline.
  ctx.strokeStyle = "rgb(206 77 72 / 0.85)"; ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(18, REEL_TOP + REEL_H / 2); ctx.lineTo(WIDTH - 18, REEL_TOP + REEL_H / 2); ctx.stroke();
  ctx.setLineDash([]);
  // Payout tray and its promise.
  ctx.fillStyle = "#5a2320";
  ctx.beginPath(); ctx.roundRect(60, 196, WIDTH - 120, 22, 6); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = "#f5e8bd"; ctx.font = "9px system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.fillText(sim.status === "won" ? "JACKPOT · BUTIN SUPPLÉMENTAIRE" : sim.status === "lost" ? `${jackpotCount(sim)} CHF sur 3 · « à discuter »` : "3 × CHF = un butin de plus", WIDTH / 2, 210);
}

/** The chest's double bottom: stop the three reels on CHF. */
export function SlotsGame({ seedId, onResolve, onDone, practice }: MiniGameProps) {
  const [sim] = useState<SlotsSim>(() => createSlotsSim(seedFrom(seedId)));
  const resolved = useRef<MiniGameResult | null>(null);
  const [phase, setPhase] = useState<"play" | "result">("play");
  const phaseRef = useRef(phase);
  const [status, setStatus] = useState<SlotsStatus>("ready");
  const [stopped, setStopped] = useState(0);
  const [outcome, setOutcome] = useState<MiniGameResult | null>(null);
  const timeouts = useRef<number[]>([]);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => () => { timeouts.current.forEach(id => window.clearTimeout(id)); }, []);
  const settle = useCallback((result: MiniGameResult) => {
    if (resolved.current) return;
    resolved.current = result;
    setOutcome(result);
    onResolve(result);
  }, [onResolve]);

  const frame = useCallback((ctx: CanvasRenderingContext2D, view: ArenaView, dt: number, node: HTMLButtonElement) => {
    stepSlots(sim, dt);
    // The browser tests stop the reels through the real input path using these.
    const reel = sim.reels[Math.min(sim.current, sim.reels.length - 1)];
    node.dataset.status = sim.status;
    node.dataset.reel = String(sim.current);
    node.dataset.offset = reel.offset.toFixed(3);
    node.dataset.chf = reel.symbols.map((s, i) => s === "CHF" ? i : -1).filter(i => i >= 0).join(",");
    node.dataset.autopilot = String(slotsAutopilot(sim));
    drawSlots(ctx, sim, view);
  }, [sim]);
  const { arena, canvas } = useArenaCanvas<HTMLButtonElement>({ height: HEIGHT, width: WIDTH }, frame);

  const tap = useCallback(() => {
    if (phaseRef.current !== "play") return;
    const events = stopReel(sim);
    if (!events.length) return;
    setStatus(sim.status);
    setStopped(sim.current);
    if (events.includes("won") || events.includes("lost")) {
      settle(sim.status === "won" ? "won" : "lost");
      timeouts.current.push(window.setTimeout(() => setPhase("result"), 900));
    }
  }, [sim, settle]);

  const leave = () => {
    if (!resolved.current) settle("skipped");
    onDone();
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (phase !== "play" || event.repeat || !ACTION_KEYS.has(event.key)) return;
    if ((event.target as HTMLElement).closest(".mini-game__skip, .mini-game__close")) return;
    event.preventDefault();
    tap();
  };

  const won = outcome === "won";
  const instructions = phase === "result"
    ? won ? "Jackpot ! Un butin de plus dans ton sac à malices." : "« Selon expérience », donc rien. Le coffre reste à toi."
    : status === "ready" ? `Le coffre a un double fond : une machine à sous. Arrête les ${SLOTS.reels} rouleaux sur CHF pour un butin de plus.`
    : `Tape pour arrêter le rouleau ${stopped + 1} sur CHF !`;

  return <MiniGameShell kind="slots" eyebrow={`${practice ? "Entraînement · " : ""}Salaire : selon expérience · butin acquis`} title="Salaire selon expérience"
    instructions={instructions} onKeyDown={onKeyDown} onLeave={leave} focusKey={phase}
    hud={<>
      <span className="mini-game__counter"><b>{stopped}</b> / {SLOTS.reels} rouleaux</span>
      <span className="mini-game__progress"><span style={{ width: `${stopped / SLOTS.reels * 100}%` }} /></span>
      <span className="mini-game__score">CHF : <b>{jackpotCount(sim)}</b></span>
    </>}
    status={phase === "result" ? <><strong>{won ? "Jackpot · +1 butin" : "Butin conservé"}</strong><span>{won ? "Un pouvoir supplémentaire à lancer" : "Le coffre ne se retire jamais."}</span></> :
      <span>{status === "ready" ? "Une seule tentative · trois arrêts · pas de retour" : "Touche l’image, Espace ou Entrée"}</span>}
    primary={{
      label: phase === "result" ? "Continuer le voyage" : status === "ready" ? "Lancer les rouleaux" : status === "spinning" ? "Stop !" : won ? "Jackpot…" : "Bof…",
      disabled: phase === "play" && status !== "ready" && status !== "spinning",
      onClick: () => phase === "play" ? tap() : onDone(),
    }}
    skip={phase === "play" && status === "ready" ? { label: "Refermer le coffre", onClick: leave } : null}>
    <button ref={arena} type="button" tabIndex={-1} className="mini-game__arena" data-phase={phase} data-won={won}
      aria-label="Arrêter le rouleau" disabled={phase !== "play"}
      onPointerDown={event => { event.preventDefault(); tap(); }} onContextMenu={event => event.preventDefault()}>
      <canvas ref={canvas} className="mini-game__canvas" aria-hidden />
      {phase === "play" && status === "ready" ? <span className="mini-game__prompt" aria-hidden>Touche pour lancer<small>puis tape pour arrêter chaque rouleau</small></span> : null}
      {phase === "result" ? <span className="mini-game__stamp" aria-hidden>{won ? "JACKPOT !" : "SELON EXPÉRIENCE"}</span> : null}
    </button>
  </MiniGameShell>;
}
