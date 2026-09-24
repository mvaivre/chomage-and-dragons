"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniGameResult } from "@/lib/data/types";
import { sfx } from "@/lib/client/sound";
import { JOURNEY_STEPS, MINI_GAME_BONUS } from "@/lib/config";
import { seedFrom } from "@/lib/game/random";
import { RAIN, createRainSim, rainAutopilot, startRain, steerBasket, stepRain, wordScreenX, wordWidth, type RainEvent, type RainSim, type RainStatus } from "@/lib/game/keyword-rain";
import { ACTION_KEYS, MiniGameShell, ScoreLine, type MiniGameProps } from "./MiniGameShell";
import { keywordsScore } from "@/lib/game/scores";
import { pointerToLogical, useArenaCanvas, type ArenaView } from "./useArenaCanvas";

const INK = "#28241a";

function drawRain(ctx: CanvasRenderingContext2D, sim: RainSim, view: ArenaView) {
  const { width, height, bleedX, bleedY, now } = view;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#9fb5be");
  sky.addColorStop(1, "#e6dfc8");
  ctx.fillStyle = sky;
  ctx.fillRect(-bleedX - 10, -bleedY - 10, width + bleedX * 2 + 20, height + bleedY * 2 + 20);
  // Floor: the recruiter's carpet and its edge, beyond the play box too.
  ctx.fillStyle = "#7a5a3a";
  ctx.fillRect(-bleedX - 10, RAIN.basketY + 16, width + bleedX * 2 + 20, height);
  ctx.fillStyle = INK;
  ctx.fillRect(-bleedX - 10, RAIN.basketY + 14, width + bleedX * 2 + 20, 3);
  if (bleedX > 2) {
    ctx.strokeStyle = "rgb(40 36 26 / 0.35)"; ctx.lineWidth = 2;
    ctx.strokeRect(0, -bleedY - 10, width, height + bleedY * 2 + 20);
  }

  // The applicant-tracking robot, scanning from the top right.
  const rx = width - 46, ry = 12;
  ctx.fillStyle = "#8d949b";
  ctx.fillRect(rx, ry, 36, 26);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(rx, ry, 36, 26);
  ctx.fillRect(rx + 16, ry - 8, 3, 8);
  ctx.beginPath(); ctx.arc(rx + 17.5, ry - 10, 3, 0, Math.PI * 2); ctx.fillStyle = "#ce4d48"; ctx.fill(); ctx.stroke();
  const blink = Math.floor(now / 500) % 4 === 0;
  ctx.fillStyle = blink ? "#ce4d48" : "#f5d163";
  ctx.fillRect(rx + 7, ry + 8, 8, blink ? 2 : 6);
  ctx.fillRect(rx + 21, ry + 8, 8, blink ? 2 : 6);
  ctx.fillStyle = INK;
  ctx.fillRect(rx + 9, ry + 19, 18, 3);
  ctx.font = "bold 8px system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.fillText("ATS-3000", rx + 18, ry + 36);

  // Falling tags. Every kind looks the same: reading is the skill.
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  for (const word of sim.words) {
    if (word.state === "missed") continue;
    const w = wordWidth(word.text);
    const x = wordScreenX(word);
    let alpha = 1;
    if (word.state === "caught") {
      const u = Math.min(1, (sim.t - Math.max(sim.lastCatchAt, sim.lastBadAt)) / 500);
      alpha = 1 - u;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, word.y);
    ctx.rotate(Math.sin(word.y / 40) * 0.08);
    ctx.fillStyle = word.state === "caught" ? (word.kind === "bad" ? "#ce4d48" : word.kind === "required" ? "#718744" : "#aaa") : "#f5e8bd";
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-w / 2, -10, w, 20, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = word.state === "caught" ? "#fff" : INK;
    ctx.fillText(word.text, 0, 1);
    ctx.restore();
  }
  ctx.textBaseline = "alphabetic";

  // The CV folder, held open under the rain.
  const bx = sim.basketX;
  const shake = sim.t - sim.lastBadAt < 300 && !view.reducedMotion ? Math.sin(sim.t / 12) * 3 : 0;
  ctx.save();
  ctx.translate(bx + shake, RAIN.basketY);
  ctx.fillStyle = "#d9b568";
  ctx.beginPath(); ctx.roundRect(-RAIN.basketWidth / 2, -12, RAIN.basketWidth, 30, 3); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = "#e8cb84";
  ctx.fillRect(-RAIN.basketWidth / 2 + 4, -16, 22, 8);
  ctx.strokeRect(-RAIN.basketWidth / 2 + 4, -16, 22, 8);
  ctx.fillStyle = INK; ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.fillText("CV", 0, 8);
  if (sim.t - sim.lastCatchAt < 350) {
    ctx.strokeStyle = "#718744"; ctx.lineWidth = 3;
    ctx.strokeRect(-RAIN.basketWidth / 2 - 4, -16, RAIN.basketWidth + 8, 38);
  }
  ctx.restore();
  if (sim.t - sim.lastBadAt < 200 && !view.reducedMotion) {
    ctx.fillStyle = "rgb(206 77 72 / 0.3)";
    ctx.fillRect(-bleedX - 10, -bleedY - 10, width + bleedX * 2 + 20, height + bleedY * 2 + 20);
  }
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

  const frame = useCallback((ctx: CanvasRenderingContext2D, view: ArenaView, dt: number, node: HTMLButtonElement) => {
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
  const onKeyDown = (event: React.KeyboardEvent) => {
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
    ? won ? "Le robot a trouvé tous ses mots. CV validé, compté double." : "Le robot a jeté ton CV. Ta candidature compte quand même."
    : status === "ready"
      ? `Le robot trieur crache les mots de l’annonce. Glisse ton CV pour attraper les ${RAIN.required} mots demandés. Une faute de goût est pardonnée, pas deux.`
      : remaining > 0 ? `Encore ${remaining} mot${remaining > 1 ? "s" : ""} ! Glisse le CV, ou flèches ← →.` : "Le robot réfléchit…";

  return <MiniGameShell kind="keywords" eyebrow={`${practice ? "Entraînement · " : ""}Le robot trieur de CV · +${base} pas acquis`} title="Le CV à mots-clés"
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
    status={phase === "result" ? <><strong>{won ? `×2 · +${base + bonus} pas` : `+${base} pas conservés`}</strong><span>{won ? `${base} pas de candidature + ${bonus} pas bonus` : "Aucun pas perdu. Le voyage continue."}</span><ScoreLine score={score} unit="pts" record={record} best={best} /></> :
      <span>{status === "ready" ? `Une seule tentative · ${RAIN.required} mots à attraper · ${RAIN.badAllowed} faute tolérée` :
        status === "running" ? (bad > 0 ? "Le robot fronce ses diodes. Plus de faute !" : "Glisse sur l’image, ou flèches ← →") : won ? "Le robot tamponne…" : "Le robot déchiquette…"}</span>}
    primary={{
      label: phase === "result" ? "Continuer le voyage" : status === "ready" ? "Lancer le robot" : status === "running" ? "Ça tombe !" : won ? "Validé…" : "Broyé…",
      disabled: phase === "play" && status !== "ready",
      onClick: () => phase === "play" ? start() : onDone(),
    }}
    skip={phase === "play" && (status === "ready" || status === "running") ? { label: `Garder mes +${base} pas`, onClick: leave } : null}>
    <button ref={arena} type="button" tabIndex={-1} className="mini-game__arena mini-game__arena--drag" data-phase={phase} data-won={won}
      aria-label="Déplacer le CV" disabled={phase !== "play"}
      onPointerDown={event => { event.preventDefault(); start(); steerTo(event); }} onPointerMove={steerTo} onContextMenu={event => event.preventDefault()}>
      <canvas ref={canvas} className="mini-game__canvas" aria-hidden />
      {phase === "play" && status === "ready" ? <span className="mini-game__prompt" aria-hidden>Touche pour lancer le robot<small>puis glisse le CV sous les mots</small></span> : null}
      {phase === "result" ? <span className="mini-game__stamp" aria-hidden>{won ? "CV VALIDÉ ×2" : "REJETÉ PAR LE ROBOT"}</span> : null}
    </button>
  </MiniGameShell>;
}
