"use client";

import type { VoxelPainter } from "@/components/voxel/arena";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniGameResult } from "@/lib/data/types";
import { sfx } from "@/lib/client/sound";
import { seedFrom } from "@/lib/game/random";
import { punchlineFor } from "@/lib/game/punchlines";
import { SLOTS, createSlotsSim, jackpotCount, slotsAutopilot, stepSlots, stopReel, type SlotsSim, type SlotsStatus } from "@/lib/game/slot-machine";
import { ACTION_KEYS, MiniGameShell, ScoreLine, type MiniGameProps } from "./MiniGameShell";
import { slotsScore } from "@/lib/game/scores";
import { useArenaCanvas, type ArenaView } from "@/components/voxel/useArena";

const WIDTH = 320;
const HEIGHT = 240;
const REEL_X = [68, 160, 252];
const ROW = 40;

function drawSlots(ctx: VoxelPainter, sim: SlotsSim, view: ArenaView) {
  ctx.background();ctx.block(0x87644b,160,120,300,222,20,-3);ctx.block(0xb29860,160,32,270,29,8,4);ctx.text("SALAIRE SELON EXPÉRIENCE",160,32,12,"#233932","center",12);
  for(let i=0;i<12;i++)ctx.block(sim.status==="spinning"&&Math.floor(view.now/150+i)%3===0?0xf0d28c:0x807052,30+i*260/11,57,5,5,4,6,0,true);
  sim.reels.forEach((reel,index)=>{const x=REEL_X[index];ctx.block(reel.stopped?0xd6bb7a:0x5c6c57,x,125,84,120,9,2);ctx.block(0xdad0ac,x,125,74,110,4,7);const n=reel.symbols.length;
    for(let k=Math.floor(reel.offset)-2;k<=Math.floor(reel.offset)+2;k++){const y=125+(k-reel.offset)*ROW;if(y<82||y>166)continue;const symbol=reel.symbols[((k%n)+n)%n];if(symbol==="CHF")ctx.coin(x,y,12);ctx.text(symbol,x,y,symbol==="CHF"?11:9,"#32463a","center",17);}
  });
  ctx.line(20,125,300,125,0xb6755f,1.2,18);ctx.text(sim.status==="won"?"JACKPOT · BUTIN SUPPLÉMENTAIRE":"3 × CHF = un butin de plus",160,211,10);
}

/** The chest's double bottom: stop the three reels on CHF. */
export function SlotsGame({ seedId, onResolve, onDone, practice, record, best }: MiniGameProps) {
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
  const [score, setScore] = useState<number | null>(null);
  const settle = useCallback((result: MiniGameResult) => {
    if (resolved.current) return;
    resolved.current = result;
    setOutcome(result);
    const points = result === "skipped" ? undefined : slotsScore(sim);
    if (points !== undefined) setScore(points);
    onResolve(result, points);
  }, [onResolve, sim]);

  const frame = useCallback((ctx: VoxelPainter, view: ArenaView, dt: number, node: HTMLButtonElement) => {
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
    if (events.includes("stop")) sfx.stamp();
    if (events.includes("won")) sfx.fanfare();
    if (events.includes("lost")) sfx.sad();
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
  const onKeyDown = (event: KeyboardEvent) => {
    if (phase !== "play" || event.repeat || !ACTION_KEYS.has(event.key)) return;
    if ((event.target as HTMLElement).closest(".mini-game__skip, .mini-game__close")) return;
    event.preventDefault();
    tap();
  };

  const won = outcome === "won";
  const instructions = phase === "result"
    ? won ? "1 butin supplémentaire" : punchlineFor(`slots:${seedId}`)
    : status === "ready" ? `Arrête les ${SLOTS.reels} rouleaux sur CHF`
    : `Arrête le rouleau ${stopped + 1} sur CHF`;

  return <MiniGameShell kind="slots" eyebrow={practice ? "Entraînement" : "Défi"} title="Salaire selon expérience"
    instructions={instructions} onKeyDown={onKeyDown} onLeave={leave} focusKey={phase}
    hud={<>
      <span className="mini-game__counter"><b>{stopped}</b> / {SLOTS.reels} rouleaux</span>
      <span className="mini-game__progress"><span style={{ width: `${stopped / SLOTS.reels * 100}%` }} /></span>
      <span className="mini-game__score">CHF : <b>{jackpotCount(sim)}</b></span>
    </>}
    status={phase === "result" ? <><strong>{won ? "Jackpot · +1 butin" : "Butin conservé"}</strong><ScoreLine score={score} unit="CHF" record={record} best={best} practice={practice} /></> :
      <span>{status === "ready" ? "Touche ou Espace : lancer, puis arrêter" : "Touche ou Espace : arrêter"}</span>}
    primary={{
      inArena: phase === "play" && status === "ready",
      label: phase === "result" ? "Continuer le voyage" : status === "ready" ? "Lancer les rouleaux" : status === "spinning" ? "Stop !" : won ? "Jackpot…" : "Bof…",
      disabled: phase === "play" && status !== "ready" && status !== "spinning",
      onClick: () => phase === "play" ? tap() : onDone(),
    }}
    skip={phase === "play" && status === "ready" ? { label: "Refermer le coffre", onClick: leave } : null}>
    <button ref={arena} type="button" tabIndex={-1} className="mini-game__arena" data-phase={phase} data-won={won}
      aria-label="Arrêter le rouleau" disabled={phase !== "play"}
      onPointerDown={event => { event.preventDefault(); tap(); }} onContextMenu={event => event.preventDefault()}>
      <canvas ref={canvas} className="mini-game__canvas" aria-hidden />
      {phase === "result" ? <span className="mini-game__stamp" aria-hidden>{won ? "JACKPOT !" : "SELON EXPÉRIENCE"}</span> : null}
    </button>
  </MiniGameShell>;
}
