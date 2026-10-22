"use client";

import type { VoxelPainter } from "@/components/voxel/arena";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniGameResult } from "@/lib/data/types";
import { sfx } from "@/lib/client/sound";
import { JOURNEY_STEPS, MINI_GAME_BONUS } from "@/lib/config";
import { seedFrom } from "@/lib/game/random";
import { punchlineFor } from "@/lib/game/punchlines";
import { DESK, beltSpeed, createDeskSim, deskAutopilot, dossierScreenX, nextDossier, slamStamp, stampedCount, stepDesk, type DeskEvent, type DeskSim, type DeskStatus } from "@/lib/game/stamp-desk";
import { ACTION_KEYS, MiniGameShell, ScoreLine, type MiniGameProps } from "./MiniGameShell";
import { stampScore } from "@/lib/game/scores";
import { useArenaCanvas, type ArenaView } from "@/components/voxel/useArena";

interface DeskFx {
  gnomeMood: "bored" | "skeptical" | "cheers" | "laughs";
  moodUntil: number;
  splats: { x: number; at: number }[];
  lateAt: number;
}

function drawDesk(ctx: VoxelPainter, sim: DeskSim, fx: DeskFx, view: ArenaView) {
  ctx.background();ctx.block(0x977b54,view.width/2,188,view.width+20,66,28,-2);ctx.block(0x52685b,view.width/2,172,view.width,29,7,5);
  for(let i=0;i<15;i++)ctx.block(0x7b8e72,((i*30-sim.distance)%450+450)%450,181,18,3,3,11);
  ctx.person(view.width-43,139,1.05,fx.gnomeMood==="skeptical"?0xa97964:0x7c9470);ctx.text("CENTRE ORP",view.width-52,28,12);
  for(const dossier of sim.dossiers){const x=dossierScreenX(sim,dossier);if(x< -40||x>view.width+40)continue;ctx.paper(x,164,DESK.dossierWidth,30,dossier.state==="stamped"?0xa2b88a:0xd4c49c);ctx.text(dossier.label,x,163,8,"#3b4a37","center",15);if(dossier.state==="stamped")ctx.text("VALIDÉ",x,176,8,"#42694b","center",16);}
  const since=sim.t-sim.lastSlamAt,slam=since>=0&&since<160?Math.sin(since/160*Math.PI)*27:0;
  ctx.block(0x7d6950,DESK.stampX,111+slam,31,24,18,17);ctx.block(0x455e50,DESK.stampX,92+slam,13,23,10,20);ctx.block(0xa77867,DESK.stampX,127+slam,43,7,20,16);
  ctx.line(DESK.stampX-18,201,DESK.stampX+18,201,0xe3c87f,3,14);
}

/** The regional office's stamping desk: tap when a folder sits under the stamp. */
export function StampGame({ seedId, onResolve, onDone, practice, record, best }: MiniGameProps) {
  const [sim] = useState<DeskSim>(() => createDeskSim(seedFrom(seedId)));
  const fx = useRef<DeskFx>({ gnomeMood: "bored", moodUntil: 0, splats: [], lateAt: -Infinity });
  const resolved = useRef<MiniGameResult | null>(null);
  const [phase, setPhase] = useState<"play" | "result">("play");
  const phaseRef = useRef(phase);
  const [status, setStatus] = useState<DeskStatus>("ready");
  const [stamped, setStamped] = useState(0);
  const [misses, setMisses] = useState(0);
  const [outcome, setOutcome] = useState<MiniGameResult | null>(null);
  const base = JOURNEY_STEPS.refus;
  const bonus = MINI_GAME_BONUS.refus;

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const [score, setScore] = useState<number | null>(null);
  const settle = useCallback((result: MiniGameResult) => {
    if (resolved.current) return;
    resolved.current = result;
    setOutcome(result);
    const points = result === "skipped" ? undefined : stampScore(sim);
    if (points !== undefined) setScore(points);
    onResolve(result, points);
  }, [onResolve, sim]);
  const settleRef = useRef(settle);
  useEffect(() => { settleRef.current = settle; }, [settle]);

  const timeouts = useRef<number[]>([]);
  useEffect(() => () => { timeouts.current.forEach(id => window.clearTimeout(id)); }, []);
  const later = (ms: number, run: () => void) => { timeouts.current.push(window.setTimeout(run, ms)); };

  const react = useCallback((event: DeskEvent, now: number) => {
    const effects = fx.current;
    if (event === "stamp") { sfx.stamp(); setStamped(stampedCount(sim)); }
    else if (event === "void" || event === "late") {
      sfx.hit();
      setMisses(sim.misses);
      effects.gnomeMood = "skeptical";
      effects.moodUntil = now + 900;
      if (event === "void") effects.splats.push({ x: DESK.stampX, at: now });
      else effects.lateAt = now;
    } else if (event === "won") {
      sfx.win();
      setStatus("won");
      settleRef.current("won");
      later(900, () => setPhase("result"));
    } else if (event === "lost") {
      sfx.sad();
      setStatus("lost");
      settleRef.current("lost");
      later(900, () => setPhase("result"));
    }
  }, [sim]);

  const frame = useCallback((ctx: VoxelPainter, view: ArenaView, dt: number, node: HTMLButtonElement) => {
    for (const event of stepDesk(sim, dt)) react(event, view.now);
    // The browser tests play through the real input path using these.
    const next = nextDossier(sim);
    node.dataset.status = sim.status;
    node.dataset.next = next ? (next.x - sim.distance).toFixed(1) : "";
    node.dataset.armed = String(sim.t - sim.lastSlamAt >= DESK.cooldownMs);
    node.dataset.speed = beltSpeed(sim).toFixed(0);
    node.dataset.autopilot = String(deskAutopilot(sim));
    drawDesk(ctx, sim, fx.current, view);
  }, [sim, react]);
  const { arena, canvas } = useArenaCanvas<HTMLButtonElement>({ height: DESK.height }, frame);

  const slam = useCallback(() => {
    if (phaseRef.current !== "play") return;
    const wasReady = sim.status === "ready";
    const events = slamStamp(sim);
    if (wasReady && events.includes("start")) setStatus("running");
    for (const event of events) react(event, performance.now());
  }, [sim, react]);

  const leave = () => {
    if (!resolved.current) settle("skipped");
    onDone();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (phase !== "play" || event.repeat || !ACTION_KEYS.has(event.key)) return;
    if ((event.target as HTMLElement).closest(".mini-game__skip, .mini-game__close")) return;
    event.preventDefault();
    slam();
  };

  const won = outcome === "won";
  const remaining = DESK.dossiers - stamped;
  const instructions = phase === "result"
    ? won ? "Dossier validé, 1 pas bonus" : punchlineFor(`stamp:${seedId}`)
    : status === "ready"
      ? `Tamponne les ${DESK.dossiers} dossiers dans la zone dorée`
      : remaining > 0 ? `Encore ${remaining} dossier${remaining > 1 ? "s" : ""}` : "Dernier dossier…";

  return <MiniGameShell kind="stamp" eyebrow={practice ? "Entraînement" : "Défi"} title="Le Tampon de l’ORP"
    instructions={instructions} onKeyDown={onKeyDown} onLeave={leave} focusKey={phase}
    hud={<>
      <span className="mini-game__counter"><b>{stamped}</b> / {DESK.dossiers} dossiers</span>
      <span className="mini-game__progress"><span style={{ width: `${(stamped + misses) / DESK.dossiers * 100}%` }} /></span>
      <span className="mini-game__lives">
        {Array.from({ length: DESK.missesAllowed }, (_, i) => <i key={i} className="mini-game__cross" data-lost={i < misses} />)}
      </span>
    </>}
    status={phase === "result" ? <><strong>{won ? `+${base + bonus} pas` : `+${base} pas conservés`}</strong><ScoreLine score={score} unit="" record={record} best={best} practice={practice} /></> :
      <span>{status === "ready" ? `Touche ou Espace · ${DESK.missesAllowed} ratés = perdu` :
        status === "running" ? "Touche ou Espace : tamponner" : won ? "Conforme…" : "Suspension…"}</span>}
    primary={{
      inArena: phase === "play" && status === "ready",
      label: phase === "result" ? "Continuer le voyage" : status === "ready" ? "Lancer le tapis" : status === "running" ? "Tamponner !" : won ? "Conforme…" : "Aïe…",
      disabled: phase === "play" && status !== "ready" && status !== "running",
      onClick: () => phase === "play" ? slam() : onDone(),
    }}
    skip={phase === "play" && (status === "ready" || status === "running") ? { label: `Garder mes +${base} pas`, onClick: leave } : null}>
    <button ref={arena} type="button" tabIndex={-1} className="mini-game__arena" data-phase={phase} data-won={won}
      aria-label="Tamponner" disabled={phase !== "play"}
      onPointerDown={event => { event.preventDefault(); slam(); }} onContextMenu={event => event.preventDefault()}>
      <canvas ref={canvas} className="mini-game__canvas" aria-hidden />
      {phase === "result" ? <span className="mini-game__stamp" aria-hidden>{won ? "CONFORME · +1 PAS" : "SUSPENSION 5 JOURS"}</span> : null}
    </button>
  </MiniGameShell>;
}
