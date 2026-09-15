"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniGameResult } from "@/lib/data/types";
import { JOURNEY_STEPS, MINI_GAME_BONUS } from "@/lib/config";
import { seedFrom } from "@/lib/game/random";
import { GHOSTING, generateGhosting, ghostingPhase, ghostingVerdict, waitingDay, type GhostingPhase } from "@/lib/game/ghosting";
import { PowerArtwork } from "../Artwork";
import { ACTION_KEYS, MiniGameShell, type MiniGameProps } from "./MiniGameShell";

type GhostingStatus = "ready" | GhostingPhase | "won" | "lost";
type Loss = "early" | "late" | "relance";

const HISTORY = [
  { me: false, text: "Merci pour ce cinquième entretien, très enrichissant." },
  { me: true, text: "Merci à vous ! Toujours très motivé·e." },
  { me: true, text: "Petit rappel bienveillant : avez-vous une réponse ?" },
  { me: true, text: "Re-bonjour ! Juste pour savoir." },
];

/** Fourteen days of silence: answer the real message, never the dots. */
export function GhostingGame({ seedId, onResolve, onDone, practice }: MiniGameProps) {
  const [schedule] = useState(() => generateGhosting(seedFrom(seedId)));
  const [status, setStatus] = useState<GhostingStatus>("ready");
  const [day, setDay] = useState(1);
  const [loss, setLoss] = useState<Loss | null>(null);
  const [outcome, setOutcome] = useState<MiniGameResult | null>(null);
  const resolved = useRef<MiniGameResult | null>(null);
  const elapsed = useRef(0);
  const running = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  const base = JOURNEY_STEPS.rejetApresEntretien;
  const bonus = MINI_GAME_BONUS.rejetApresEntretien;

  const settle = useCallback((result: MiniGameResult) => {
    if (resolved.current) return;
    resolved.current = result;
    setOutcome(result);
    onResolve(result);
  }, [onResolve]);

  const lose = useCallback((why: Loss) => {
    running.current = false;
    setLoss(why);
    setStatus("lost");
    settle("lost");
  }, [settle]);

  // The wait: a frame loop tracking visible time and the recruiter's typing bursts.
  useEffect(() => {
    if (status === "ready" || status === "won" || status === "lost") return;
    running.current = true;
    let previous = performance.now();
    let raf = 0;
    const syncVisibility = () => { previous = performance.now(); };
    document.addEventListener("visibilitychange", syncVisibility);
    const tick = (now: number) => {
      if (!running.current) return;
      if (!document.hidden) elapsed.current += Math.min(100, now - previous);
      previous = now;
      const phase = ghostingPhase(schedule, elapsed.current);
      const currentDay = waitingDay(elapsed.current);
      setDay(d => d === currentDay ? d : currentDay);
      if (phase === "gone") { lose("late"); return; }
      setStatus(s => s === phase ? s : phase);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", syncVisibility); };
  }, [status === "ready" || status === "won" || status === "lost", schedule, lose]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [status]);

  const reply = useCallback(() => {
    if (status === "ready") { setStatus("waiting"); return; }
    if (status === "won" || status === "lost") return;
    const verdict = ghostingVerdict(schedule, elapsed.current);
    if (verdict === "won") { running.current = false; setStatus("won"); settle("won"); }
    else lose(verdict);
  }, [status, schedule, settle, lose]);

  const leave = () => {
    if (!resolved.current) settle("skipped");
    onDone();
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (status === "won" || status === "lost" || event.repeat || !ACTION_KEYS.has(event.key)) return;
    if ((event.target as HTMLElement).closest(".mini-game__skip, .mini-game__close, .chat__relance")) return;
    event.preventDefault();
    reply();
  };

  const won = outcome === "won";
  const finished = status === "won" || status === "lost";
  const instructions = finished
    ? won ? "Recruteur attrapé au vol : impossible de te ghoster. Le rejet légendaire vaut deux pas de plus."
      : loss === "early" ? "Trop insistant·e. « Nous avons retenu un autre profil. »" : loss === "late" ? "Message vu, jamais répondu. Ghosté·e en retour." : "Relance envoyée. Silence radio définitif."
    : status === "ready"
      ? "Cinq entretiens, puis plus rien depuis quatorze jours. Le recruteur va écrire… ou pas. Réponds seulement quand un vrai message tombe, jamais avant."
      : status === "message" ? "MAINTENANT ! Réponds !" : "Ne relance pas. Les points de suspension mentent. Attends le croassement.";

  return <MiniGameShell kind="ghosting" eyebrow={`${practice ? "Entraînement · " : ""}Sans nouvelles depuis 14 jours · +${base} pas acquis`} title="Ne relance pas"
    instructions={instructions} onKeyDown={onKeyDown} onLeave={leave} focusKey={status === "ready" || finished ? status : "wait"}
    hud={<>
      <span className="mini-game__counter"><b>Jour {day}</b> sans réponse</span>
      <span className="mini-game__progress"><span style={{ width: `${Math.min(100, day * GHOSTING.msPerDay / GHOSTING.messageAt[1] * 100)}%` }} /></span>
      <span className="mini-game__score">Fenêtre : <b>{GHOSTING.windowMs / 1000} s</b></span>
    </>}
    status={finished ? <><strong>{won ? `+${base + bonus} pas` : `+${base} pas conservés`}</strong><span>{won ? `${base} pas de rejet + ${bonus} pas bonus` : "Aucun pas perdu. Le voyage continue."}</span></> :
      <span>{status === "ready" ? "Une seule tentative · un seul vrai message · réponds dans la seconde" : status === "typing" ? "Il écrit… ou il fait semblant." : status === "message" ? "CROÂ ! C’est le vrai !" : "Silence. Ne tape pas."}</span>}
    primary={{
      label: finished ? "Continuer le voyage" : status === "ready" ? "Attendre (14 jours)" : "Répondre",
      onClick: () => finished ? onDone() : reply(),
    }}
    skip={!finished ? { label: `Garder mes +${base} pas`, onClick: leave } : null}>
    <div className="mini-game__arena mini-game__arena--panel chat" data-status={status}>
      <div className="chat__header">
        <PowerArtwork kind="crapaud" className="chat__avatar" />
        <div><strong>Cabinet Crapaud &amp; Associés</strong><small>{status === "typing" ? "écrit…" : status === "message" ? "en ligne" : "vu il y a 14 jours"}</small></div>
        <span className="chat__day">J+{day}</span>
      </div>
      <div ref={log} className="chat__log">
        {HISTORY.map((line, i) => <p key={i} className={`chat__bubble ${line.me ? "chat__bubble--me" : ""}`}>{line.text}</p>)}
        {status === "typing" ? <p className="chat__bubble chat__bubble--typing" aria-label="Le recruteur écrit"><span /><span /><span /></p> : null}
        {status === "message" || status === "won" ? <p className="chat__bubble chat__bubble--real"><b className="chat__croak">CROÂ !</b> Bonne nouvelle : nous avons une réponse pour vous.</p> : null}
        {status === "won" ? <p className="chat__bubble chat__bubble--me">Je suis là ! Je réponds ! Vous ne pouvez plus me ghoster.</p> : null}
        {status === "lost" ? <p className="chat__bubble chat__bubble--real">{loss === "early" ? "Nous avons retenu un autre profil. Bonne continuation." : loss === "late" ? "Bon, tant pis. Bonne continuation." : "Vu."}</p> : null}
      </div>
      {!finished && status !== "ready" ? <button type="button" className="chat__relance" onClick={() => lose("relance")}>Relancer (juste un petit message…)</button> : null}
      {finished ? <span className="mini-game__stamp" aria-hidden>{won ? "ATTRAPÉ ! +2 PAS" : "GHOSTÉ·E"}</span> : null}
    </div>
  </MiniGameShell>;
}
