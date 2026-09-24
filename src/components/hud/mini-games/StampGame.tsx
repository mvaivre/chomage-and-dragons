"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniGameResult } from "@/lib/data/types";
import { sfx } from "@/lib/client/sound";
import { JOURNEY_STEPS, MINI_GAME_BONUS } from "@/lib/config";
import { seedFrom } from "@/lib/game/random";
import { DESK, beltSpeed, createDeskSim, deskAutopilot, dossierScreenX, nextDossier, slamStamp, stampedCount, stepDesk, type DeskEvent, type DeskSim, type DeskStatus } from "@/lib/game/stamp-desk";
import { ACTION_KEYS, MiniGameShell, ScoreLine, type MiniGameProps } from "./MiniGameShell";
import { stampScore } from "@/lib/game/scores";
import { loadImage, useArenaCanvas, type ArenaView } from "./useArenaCanvas";

const GNOME_SHEET = "/art/world-v3/animations/gnomes.webp";
const GNOME_CELL = { width: 256, height: 320 };
const INK = "#28241a";
const GRUMBLES = ["Et le formulaire 3b ?", "Non conforme. Suivant.", "Ça, c’est une suspension.", "Je note. Je note tout."];

interface DeskFx {
  gnomeMood: "bored" | "skeptical" | "cheers" | "laughs";
  moodUntil: number;
  splats: { x: number; at: number }[];
  lateAt: number;
}

function drawGnome(ctx: CanvasRenderingContext2D, sheet: HTMLImageElement | null, frame: number, x: number, bottom: number, height: number) {
  if (!sheet) return;
  const width = height * GNOME_CELL.width / GNOME_CELL.height;
  ctx.drawImage(sheet, (frame % 4) * GNOME_CELL.width, Math.floor(frame / 4) * GNOME_CELL.height, GNOME_CELL.width, GNOME_CELL.height, x, bottom - height, width, height);
}

function drawDesk(ctx: CanvasRenderingContext2D, sim: DeskSim, fx: DeskFx, view: ArenaView, sheet: HTMLImageElement | null) {
  const { width, now } = view;
  const beltTop = 160;
  const beltBottom = 198;
  // Office wall, wainscot and the mandatory poster.
  ctx.fillStyle = "#d3c6a2";
  ctx.fillRect(-10, -10, width + 20, 260);
  ctx.fillStyle = "#b9a883";
  ctx.fillRect(-10, 112, width + 20, 3);
  ctx.fillStyle = "#c7b68e";
  ctx.fillRect(-10, 115, width + 20, 140);
  ctx.fillStyle = "#8a6a3d";
  ctx.fillRect(-10, beltBottom + 4, width + 20, 60);
  ctx.fillStyle = "#f2e6c4";
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.fillRect(width - 118, 18, 100, 58); ctx.strokeRect(width - 118, 18, 100, 58);
  ctx.fillStyle = INK; ctx.font = "bold 10px system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.fillText("OFFICE RÉGIONAL", width - 68, 34); ctx.fillText("DE PLACEMENT", width - 68, 46);
  ctx.font = "9px system-ui, sans-serif"; ctx.fillText("Preuves de recherches", width - 68, 60); ctx.fillText("avant le 5 du mois", width - 68, 70);

  // The counsellor, behind the belt.
  const mood = now < fx.moodUntil ? fx.gnomeMood : sim.status === "won" ? "cheers" : sim.status === "lost" ? "laughs" : "bored";
  const frame = mood === "bored" ? 0 : mood === "skeptical" ? 1 : mood === "cheers" ? 2 : 3;
  drawGnome(ctx, sheet, frame, 4, beltTop + 6, 122);

  // Conveyor belt with rollers and moving stripes.
  ctx.fillStyle = "#3a3a36";
  ctx.fillRect(-10, beltTop, width + 20, beltBottom - beltTop);
  ctx.fillStyle = "#55554f";
  const stripe = ((sim.distance * 1.0) % 24 + 24) % 24;
  for (let x = -stripe; x < width + 24; x += 24) ctx.fillRect(x, beltTop + 6, 10, beltBottom - beltTop - 12);
  ctx.fillStyle = INK;
  ctx.fillRect(-10, beltTop - 3, width + 20, 3);
  ctx.fillRect(-10, beltBottom, width + 20, 3);
  // The target zone under the stamp.
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = "#f5d163"; ctx.lineWidth = 2.5;
  ctx.strokeRect(DESK.stampX - DESK.dossierWidth / 2 - 6, beltTop - 44, DESK.dossierWidth + 12, 42);
  ctx.restore();

  // Folders riding the belt.
  for (const dossier of sim.dossiers) {
    const x = dossierScreenX(sim, dossier);
    if (x + DESK.dossierWidth < -10 || x - DESK.dossierWidth > width + 10) continue;
    const left = x - DESK.dossierWidth / 2;
    const top = beltTop - 36;
    ctx.fillStyle = "#d9b568";
    ctx.fillRect(left, top + 6, DESK.dossierWidth, 30);
    ctx.fillRect(left, top, 18, 8);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.strokeRect(left, top + 6, DESK.dossierWidth, 30);
    ctx.strokeRect(left, top, 18, 8);
    ctx.fillStyle = INK; ctx.font = "bold 8px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("PREUVES", x, top + 18);
    ctx.font = "8px system-ui, sans-serif";
    ctx.fillText(dossier.label, x, top + 29);
    if (dossier.state === "stamped") {
      ctx.save();
      ctx.translate(x, top + 22);
      ctx.rotate(-0.2);
      ctx.strokeStyle = "rgb(206 40 40 / 0.9)"; ctx.lineWidth = 2;
      ctx.strokeRect(-24, -8, 48, 16);
      ctx.fillStyle = "rgb(206 40 40 / 0.9)"; ctx.font = "bold 9px system-ui, sans-serif";
      ctx.fillText("CONFORME", 0, 3);
      ctx.restore();
    }
  }

  // Ink splats where the stamp hit the belt, and the late-folder warning.
  for (const splat of fx.splats) {
    const u = (now - splat.at) / 600;
    if (u > 1) continue;
    ctx.fillStyle = `rgb(160 30 30 / ${0.8 * (1 - u)})`;
    ctx.beginPath(); ctx.ellipse(splat.x, beltTop - 6, 22 + u * 6, 8, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (now - fx.lateAt < 700) {
    ctx.fillStyle = `rgb(206 77 72 / ${1 - (now - fx.lateAt) / 700})`;
    ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "left";
    ctx.fillText("NON TRAITÉ !", 8, beltTop - 50);
  }

  // The stamp: wooden handle, rubber base, slamming on tap.
  const u = Math.min(1, (sim.t - sim.lastSlamAt) / DESK.cooldownMs);
  const drop = sim.status === "running" && u < 1 ? (u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6) * 34 : 0;
  const baseBottom = 96 + drop;
  ctx.fillStyle = "#67462d";
  ctx.fillRect(DESK.stampX - 9, baseBottom - 56, 18, 42);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(DESK.stampX - 9, baseBottom - 56, 18, 42);
  ctx.fillStyle = "#9c6b3c";
  ctx.beginPath(); ctx.ellipse(DESK.stampX, baseBottom - 56, 14, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#2b2a26";
  ctx.fillRect(DESK.stampX - 28, baseBottom - 14, 56, 14);
  ctx.strokeRect(DESK.stampX - 28, baseBottom - 14, 56, 14);
  ctx.fillStyle = "#c8c0a8"; ctx.font = "bold 8px system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.fillText("ORP", DESK.stampX, baseBottom - 4);
}

/** The regional office's stamping desk: tap when a folder sits under the stamp. */
export function StampGame({ seedId, onResolve, onDone, practice, record, best }: MiniGameProps) {
  const [sim] = useState<DeskSim>(() => createDeskSim(seedFrom(seedId)));
  const fx = useRef<DeskFx>({ gnomeMood: "bored", moodUntil: 0, splats: [], lateAt: -Infinity });
  const sheet = useRef<HTMLImageElement | null>(null);
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
  useEffect(() => { loadImage(GNOME_SHEET, image => { sheet.current = image; }); }, []);

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

  const frame = useCallback((ctx: CanvasRenderingContext2D, view: ArenaView, dt: number, node: HTMLButtonElement) => {
    for (const event of stepDesk(sim, dt)) react(event, view.now);
    // The browser tests play through the real input path using these.
    const next = nextDossier(sim);
    node.dataset.status = sim.status;
    node.dataset.next = next ? (next.x - sim.distance).toFixed(1) : "";
    node.dataset.armed = String(sim.t - sim.lastSlamAt >= DESK.cooldownMs);
    node.dataset.speed = beltSpeed(sim).toFixed(0);
    node.dataset.autopilot = String(deskAutopilot(sim));
    drawDesk(ctx, sim, fx.current, view, sheet.current);
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
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (phase !== "play" || event.repeat || !ACTION_KEYS.has(event.key)) return;
    if ((event.target as HTMLElement).closest(".mini-game__skip, .mini-game__close")) return;
    event.preventDefault();
    slam();
  };

  const won = outcome === "won";
  const remaining = DESK.dossiers - stamped;
  const instructions = phase === "result"
    ? won ? "Dossier conforme. Le gnome grogne, mais il tamponne : ton refus vaut un pas de plus." : "Suspension de cinq jours. Ton refus compte quand même, le gnome moins."
    : status === "ready"
      ? `Le gnome de l’ORP veut ses preuves de recherches. Tape quand un dossier passe sous le tampon. ${DESK.missesAllowed} ratés et c’est la suspension.`
      : remaining > 0 ? `Tape pile dans la zone dorée ! Encore ${remaining} dossier${remaining > 1 ? "s" : ""}.` : "Dernier dossier…";

  return <MiniGameShell kind="stamp" eyebrow={`${practice ? "Entraînement · " : ""}Preuves de recherches · +${base} pas acquis`} title="Le Tampon de l’ORP"
    instructions={instructions} onKeyDown={onKeyDown} onLeave={leave} focusKey={phase}
    hud={<>
      <span className="mini-game__counter"><b>{stamped}</b> / {DESK.dossiers} dossiers</span>
      <span className="mini-game__progress"><span style={{ width: `${(stamped + misses) / DESK.dossiers * 100}%` }} /></span>
      <span className="mini-game__lives">
        {Array.from({ length: DESK.missesAllowed }, (_, i) => <i key={i} className="mini-game__cross" data-lost={i < misses} />)}
      </span>
    </>}
    status={phase === "result" ? <><strong>{won ? `+${base + bonus} pas` : `+${base} pas conservés`}</strong><span>{won ? `${base} pas de refus + ${bonus} pas bonus` : "Aucun pas perdu. Le voyage continue."}</span><ScoreLine score={score} unit="pts" record={record} best={best} /></> :
      <span>{status === "ready" ? `Une seule tentative · ${DESK.dossiers} dossiers · ${DESK.missesAllowed} ratés tolérés` :
        status === "running" ? (misses > 0 ? `Le gnome : « ${GRUMBLES[(misses - 1) % GRUMBLES.length]} »` : "Touche l’image, Espace ou Entrée") : won ? "Le gnome relit tout…" : "Le gnome sort le formulaire de suspension…"}</span>}
    primary={{
      label: phase === "result" ? "Continuer le voyage" : status === "ready" ? "Lancer le tapis" : status === "running" ? "Tamponner !" : won ? "Conforme…" : "Aïe…",
      disabled: phase === "play" && status !== "ready" && status !== "running",
      onClick: () => phase === "play" ? slam() : onDone(),
    }}
    skip={phase === "play" && (status === "ready" || status === "running") ? { label: `Garder mes +${base} pas`, onClick: leave } : null}>
    <button ref={arena} type="button" tabIndex={-1} className="mini-game__arena" data-phase={phase} data-won={won}
      aria-label="Tamponner" disabled={phase !== "play"}
      onPointerDown={event => { event.preventDefault(); slam(); }} onContextMenu={event => event.preventDefault()}>
      <canvas ref={canvas} className="mini-game__canvas" aria-hidden />
      {phase === "play" && status === "ready" ? <span className="mini-game__prompt" aria-hidden>Touche pour lancer le tapis<small>puis tape sous le tampon</small></span> : null}
      {phase === "result" ? <span className="mini-game__stamp" aria-hidden>{won ? "CONFORME · +1 PAS" : "SUSPENSION 5 JOURS"}</span> : null}
    </button>
  </MiniGameShell>;
}
