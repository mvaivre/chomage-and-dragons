"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniGameResult } from "@/lib/data/types";
import { sfx } from "@/lib/client/sound";
import { JOURNEY_STEPS, MINI_GAME_BONUS } from "@/lib/config";
import { seedFrom } from "@/lib/game/random";
import { GHOSTING, generateGhosting, ghostingPhase, ghostingVerdict, waitingDay, type GhostingPhase } from "@/lib/game/ghosting";
import { PowerArtwork } from "../Artwork";
import { ACTION_KEYS, MiniGameShell, type MiniGameProps } from "./MiniGameShell";

type GhostingStatus = "ready" | GhostingPhase | "won" | "lost";
type Loss = "early" | "late";

const HISTORY = [
  { me: false, text: "Merci pour ce cinquième entretien, très enrichissant." },
  { me: true, text: "Merci à vous ! Toujours très motivé·e." },
  { me: true, text: "Petit rappel bienveillant : avez-vous une réponse ?" },
];
const DRAFT_RELANCE = "Re-bonjour ! Juste pour savoir si vous avez avancé… 🙂";
const DRAFT_REPLY = "OUI ! Je suis là, je suis disponible, je signe !";
const REAL_MESSAGE = "Bonne nouvelle : vous avez été sélectionné·e ! Confirmez-nous vite votre intérêt.";

/**
 * Fourteen days of silence after the fifth round. The recruiter pretends to
 * type, several times. One button, one rule: press Répondre only when the
 * golden message has landed, and within the window.
 */
export function GhostingGame({ seedId, onResolve, onDone, practice }: MiniGameProps) {
  const [schedule] = useState(() => generateGhosting(seedFrom(seedId)));
  const [status, setStatus] = useState<GhostingStatus>("ready");
  const [day, setDay] = useState(1);
  const [loss, setLoss] = useState<Loss | null>(null);
  /** The recruiter's last word and the stamp arrive a beat after the outcome, so both messages get read. */
  const [revealed, setRevealed] = useState(false);
  const [outcome, setOutcome] = useState<MiniGameResult | null>(null);
  const resolved = useRef<MiniGameResult | null>(null);
  const elapsed = useRef(0);
  const running = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  const sendButton = useRef<HTMLButtonElement>(null);
  const timeouts = useRef<number[]>([]);
  const base = JOURNEY_STEPS.rejetApresEntretien;
  const bonus = MINI_GAME_BONUS.rejetApresEntretien;
  const finished = status === "won" || status === "lost";
  const waiting = !finished && status !== "ready";

  useEffect(() => () => { timeouts.current.forEach(id => window.clearTimeout(id)); }, []);

  const settle = useCallback((result: MiniGameResult) => {
    if (resolved.current) return;
    resolved.current = result;
    setOutcome(result);
    onResolve(result);
    timeouts.current.push(window.setTimeout(() => setRevealed(true), 1100));
  }, [onResolve]);

  const lose = useCallback((why: Loss) => {
    running.current = false;
    sfx.sad();
    setLoss(why);
    setStatus("lost");
    settle("lost");
  }, [settle]);

  // The wait: a frame loop tracking visible time and the recruiter's typing bursts.
  useEffect(() => {
    if (!waiting) return;
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
  }, [waiting, schedule, lose]);

  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [status, revealed]);
  // An audible cue for the real message: fair on a phone held at arm's length.
  useEffect(() => { if (status === "message") sfx.croak(); }, [status]);
  useEffect(() => { if (waiting) sendButton.current?.focus(); }, [waiting]);

  const reply = useCallback(() => {
    if (!waiting) return;
    const verdict = ghostingVerdict(schedule, elapsed.current);
    if (verdict === "won") { running.current = false; sfx.win(); setStatus("won"); settle("won"); }
    else lose(verdict);
  }, [waiting, schedule, settle, lose]);

  const leave = () => {
    if (!resolved.current) settle("skipped");
    onDone();
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!waiting || event.repeat || !ACTION_KEYS.has(event.key)) return;
    if ((event.target as HTMLElement).closest(".mini-game__skip, .mini-game__close")) return;
    event.preventDefault();
    reply();
  };

  const won = outcome === "won";
  const hot = status === "message";
  const instructions = finished
    ? won ? "Répondu à temps : impossible de te ghoster. Deux pas de plus."
      : loss === "early" ? "Trop tôt. Tu as répondu aux points de suspension, pas à un message." : "Trop tard. Le message est arrivé, ta réponse non."
    : status === "ready"
      ? `Il va faire semblant d’écrire, plusieurs fois. N’appuie sur Répondre qu’à l’arrivée du message doré : ${GHOSTING.windowMs / 1000} s pour réagir.`
      : hot ? "C’EST LE VRAI ! Appuie sur Répondre !" : "Attends. Les points de suspension ne comptent pas.";

  return <MiniGameShell kind="ghosting" eyebrow={`${practice ? "Entraînement · " : ""}Sans nouvelles depuis 14 jours · +${base} pas acquis`} title="Ne relance pas"
    instructions={instructions} onKeyDown={onKeyDown} onLeave={leave} focusKey={status === "ready" || finished ? status : "wait"}
    hud={<>
      <span className="mini-game__counter"><b>Jour {day}</b> sans réponse</span>
      <span className="mini-game__progress"><span style={{ width: `${Math.min(100, day * GHOSTING.msPerDay / GHOSTING.messageAt[1] * 100)}%` }} /></span>
      <span className="mini-game__score">Fenêtre : <b>{GHOSTING.windowMs / 1000} s</b></span>
    </>}
    status={finished ? <><strong>{won ? `+${base + bonus} pas` : `+${base} pas conservés`}</strong><span>{won ? `${base} pas de rejet + ${bonus} pas bonus` : "Aucun pas perdu. Le voyage continue."}</span></> :
      <span>{status === "ready" ? "Une seule tentative · un seul vrai message · encadré doré" : status === "typing" ? "Il écrit… ou il fait semblant. N’appuie pas." : hot ? "MAINTENANT !" : "Silence. N’appuie pas."}</span>}
    primary={{
      label: finished ? "Continuer le voyage" : status === "ready" ? "Attendre (14 jours)" : "Réponds dans le chat ↑",
      disabled: waiting,
      onClick: () => finished ? onDone() : setStatus("waiting"),
    }}
    skip={!finished ? { label: `Garder mes +${base} pas`, onClick: leave } : null}>
    <div className="mini-game__arena mini-game__arena--panel chat" data-status={status} data-hot={hot}>
      <div className="chat__header">
        <PowerArtwork kind="crapaud" className="chat__avatar" />
        <div><strong>Cabinet Crapaud &amp; Associés</strong><small>{status === "typing" ? "écrit…" : hot || status === "won" ? "en ligne" : "vu il y a 14 jours"}</small></div>
        <span className="chat__day">J+{day}</span>
      </div>
      <div ref={log} className="chat__log">
        {HISTORY.map((line, i) => <p key={i} className={`chat__bubble ${line.me ? "chat__bubble--me" : ""}`}>{line.text}</p>)}
        {status === "typing" ? <p className="chat__bubble chat__bubble--typing" aria-label="Le recruteur écrit"><span /><span /><span /></p> : null}
        {hot || status === "won" || loss === "late" ? <p className="chat__bubble chat__bubble--real">
          <b className="chat__croak">CROÂ !</b> {REAL_MESSAGE}
          {hot ? <span className="chat__window" style={{ animationDuration: `${GHOSTING.windowMs}ms` }} aria-hidden /> : null}
        </p> : null}
        {status === "won" ? <p className="chat__bubble chat__bubble--me">{DRAFT_REPLY}</p> : null}
        {loss === "early" ? <p className="chat__bubble chat__bubble--me">{DRAFT_RELANCE}</p> : null}
        {status === "won" && revealed ? <p className="chat__bubble">Parfait. Contrat en préparation. (Pour de vrai, cette fois.)</p> : null}
        {loss === "early" && revealed ? <p className="chat__bubble">Suite à votre relance, nous avons retenu un autre profil. Bonne continuation.</p> : null}
        {loss === "late" && revealed ? <p className="chat__bubble">Sans réponse de votre part, le poste est parti. Bonne continuation.</p> : null}
      </div>
      <div className="chat__composer">
        <span className="chat__draft">{hot || status === "won" ? DRAFT_REPLY : DRAFT_RELANCE}</span>
        <button ref={sendButton} type="button" className="chat__send" data-hot={hot} disabled={!waiting} onClick={reply}>
          {hot ? "RÉPONDRE !" : "Répondre"}
        </button>
      </div>
      {finished && revealed ? <span className="mini-game__stamp" aria-hidden>{won ? "ATTRAPÉ ! +2 PAS" : loss === "early" ? "TROP TÔT" : "TROP TARD"}</span> : null}
    </div>
  </MiniGameShell>;
}
