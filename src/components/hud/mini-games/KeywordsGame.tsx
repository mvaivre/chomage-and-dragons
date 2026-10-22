"use client";

import type { VoxelPainter } from "@/components/voxel/arena";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniGameResult } from "@/lib/data/types";
import { sfx } from "@/lib/client/sound";
import { JOURNEY_STEPS, MINI_GAME_BONUS } from "@/lib/config";
import { seedFrom } from "@/lib/game/random";
import { punchlineFor } from "@/lib/game/punchlines";
import { RAIN, createRainSim, rainAutopilot, startRain, steerBasket, stepRain, wordScreenX, wordWidth, type RainEvent, type RainSim, type RainStatus } from "@/lib/game/keyword-rain";
import { ACTION_KEYS, MiniGameShell, ScoreLine, type MiniGameProps } from "./MiniGameShell";
import { keywordsScore } from "@/lib/game/scores";
import { pointerToLogical, useArenaCanvas, type ArenaView } from "@/components/voxel/useArena";

function drawRain(ctx: VoxelPainter, sim: RainSim, view: ArenaView) {
  ctx.background();
  ctx.block(0x746246,view.width/2,RAIN.basketY+29,view.width+30,35,12,-2);
  ctx.person(view.width-29,65,.65,0x71877a);ctx.text("ATS-3000",view.width-37,79,8);
  for(const word of sim.words){if(word.state==="missed")continue;const x=wordScreenX(word),w=wordWidth(word.text);
    const color=word.state==="caught"?(word.kind==="bad"?0xb37470:0x9db985):0xd8c797;
    ctx.block(0x75694e,x+1,word.y+2,w,21,5,1);ctx.block(color,x,word.y,w,19,4,4);ctx.text(word.text,x,word.y,11,"#243b34","center",10);
  }
  ctx.block(0xb99754,sim.basketX,RAIN.basketY+4,RAIN.basketWidth,29,12,5);ctx.block(0xd5bb77,sim.basketX-RAIN.basketWidth/2+15,RAIN.basketY-11,25,8,5,7);ctx.text("CV",sim.basketX,RAIN.basketY+4,12,"#243b34","center",15);
}

/** The keyword rain: drag the CV under the words the ad asked for. */
export function KeywordsGame({ seedId, onResolve, onDone, practice, record, best }: MiniGameProps) {
  const [sim] = useState<RainSim>(() => createRainSim(seedFrom(seedId)));
  const resolved = useRef<MiniGameResult | null>(null);
  const [phase, setPhase] = useState<"play" | "result">("play");
  const phaseRef = useRef(phase);
  const [status, setStatus] = useState<RainStatus>("ready");
  const [caught, setCaught] = useState<string[]>([]);
  const [bad, setBad] = useState(0);
  const [outcome, setOutcome] = useState<MiniGameResult | null>(null);
  const base = JOURNEY_STEPS.candidature;
  const bonus = MINI_GAME_BONUS.candidature;

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const [score, setScore] = useState<number | null>(null);
  const settle = useCallback((result: MiniGameResult) => {
    if (resolved.current) return;
    resolved.current = result;
    setOutcome(result);
    const points = result === "skipped" ? undefined : keywordsScore(sim);
    if (points !== undefined) setScore(points);
    onResolve(result, points);
  }, [onResolve, sim]);
  const settleRef = useRef(settle);
  useEffect(() => { settleRef.current = settle; }, [settle]);
  const timeouts = useRef<number[]>([]);
  useEffect(() => () => { timeouts.current.forEach(id => window.clearTimeout(id)); }, []);

  const react = useCallback((event: RainEvent) => {
    if (event === "caught") { sfx.coin(); setCaught([...sim.caught]); }
    else if (event === "bad") { sfx.hit(); setBad(sim.badCaught); }
    else if (event === "won" || event === "lost") {
      if (event === "won") sfx.win(); else sfx.sad();
      setStatus(event);
      settleRef.current(event);
      timeouts.current.push(window.setTimeout(() => setPhase("result"), 900));
    }
  }, [sim]);

  const frame = useCallback((ctx: VoxelPainter, view: ArenaView, dt: number, node: HTMLButtonElement) => {
    for (const event of stepRain(sim, dt)) react(event);
    // The browser tests steer through the real pointer path using these.
    node.dataset.status = sim.status;
    node.dataset.basket = sim.basketX.toFixed(1);
    node.dataset.target = (rainAutopilot(sim) ?? sim.basketX).toFixed(1);
    drawRain(ctx, sim, view);
  }, [sim, react]);
  const { arena, canvas, view } = useArenaCanvas<HTMLButtonElement>({ height: RAIN.height, width: RAIN.width }, frame);

  const start = useCallback(() => {
    if (phaseRef.current !== "play") return;
    if (startRain(sim).length) setStatus("running");
  }, [sim]);

  const steerTo = useCallback((event: React.PointerEvent) => {
    if (phaseRef.current !== "play" || !arena.current) return;
    steerBasket(sim, pointerToLogical(event, arena.current, view.current).x);
  }, [sim, arena, view]);

  const leave = () => {
    if (!resolved.current) settle("skipped");
    onDone();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (phase !== "play") return;
    if ((event.target as HTMLElement).closest(".mini-game__skip, .mini-game__close")) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      start();
      steerBasket(sim, sim.targetX + (event.key === "ArrowLeft" ? -44 : 44));
    } else if (ACTION_KEYS.has(event.key) && !event.repeat) {
      event.preventDefault();
      start();
    }
  };

  const won = outcome === "won";
  const remaining = RAIN.required - caught.length;
  const instructions = phase === "result"
    ? won ? "CV validé, pas doublés" : punchlineFor(`keywords:${seedId}`)
    : status === "ready"
      ? `Attrape uniquement les ${RAIN.required} mots de l’annonce`
      : remaining > 0 ? `Encore ${remaining} mot${remaining > 1 ? "s" : ""}` : "Le robot réfléchit…";

  return <MiniGameShell kind="keywords" eyebrow={practice ? "Entraînement" : "Défi"} title="Le CV à mots-clés"
    instructions={instructions} onKeyDown={onKeyDown} onLeave={leave} focusKey={phase}
    hud={<>
      <span className="mini-game__counter"><b>{caught.length}</b> / {RAIN.required} mots</span>
      <span className="mini-game__lives">
        {Array.from({ length: RAIN.badAllowed + 1 }, (_, i) => <i key={i} className="mini-game__cross" data-lost={i < bad} />)}
      </span>
      <span className="mini-game__tags">
        <span className="mini-game__tags-label">Annonce :</span>
        {sim.required.map(word => <span key={word} className="mini-game__tag" data-caught={caught.includes(word)}>{word}</span>)}
      </span>
    </>}
    status={phase === "result" ? <><strong>{won ? `×2 · +${base + bonus} pas` : `+${base} pas conservés`}</strong><ScoreLine score={score} unit="" record={record} best={best} practice={practice} /></> :
      <span>{status === "ready" ? `Glisse ou ← → · ${RAIN.badAllowed} erreur permise` :
        status === "running" ? (bad > 0 ? "Plus d’erreur permise." : "Glisse ou ← →") : won ? "Validé…" : "Rejeté…"}</span>}
    primary={{
      inArena: phase === "play" && status === "ready",
      label: phase === "result" ? "Continuer le voyage" : status === "ready" ? "Lancer le robot" : status === "running" ? "Ça tombe !" : won ? "Validé…" : "Broyé…",
      disabled: phase === "play" && status !== "ready",
      onClick: () => phase === "play" ? start() : onDone(),
    }}
    skip={phase === "play" && (status === "ready" || status === "running") ? { label: `Garder mes +${base} pas`, onClick: leave } : null}>
    <button ref={arena} type="button" tabIndex={-1} className="mini-game__arena mini-game__arena--drag" data-phase={phase} data-won={won}
      aria-label="Déplacer le CV" disabled={phase !== "play"}
      onPointerDown={event => { event.preventDefault(); start(); steerTo(event); }} onPointerMove={steerTo} onContextMenu={event => event.preventDefault()}>
      <canvas ref={canvas} className="mini-game__canvas" aria-hidden />
      {phase === "result" ? <span className="mini-game__stamp" aria-hidden>{won ? "CV VALIDÉ ×2" : "REJETÉ PAR LE ROBOT"}</span> : null}
    </button>
  </MiniGameShell>;
}
