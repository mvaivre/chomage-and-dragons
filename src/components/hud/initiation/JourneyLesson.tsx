"use client";

import { useEffect, useRef, useState } from "react";
import { JOURNEY_STEPS, STEPS_PER_LEVEL } from "@/lib/config";
import { answerInitiation, INITIATION_ACTIONS, INITIATION_ENCOUNTERS, initiationSteps } from "@/lib/game/initiation";
import type { ActionKind } from "@/lib/data/types";
import { ActionArtwork } from "../Artwork";

export function JourneyLesson({ encounters, onAnswer }: { encounters: number; onAnswer: () => void }) {
  const [feedback, setFeedback] = useState("");
  const [wrong, setWrong] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const nextControl = useRef<HTMLButtonElement>(null);
  const firstChoice = useRef<HTMLButtonElement>(null);
  const interacted = useRef(false);
  useEffect(() => {
    if (interacted.current) (showResult ? nextControl.current : firstChoice.current)?.focus({ preventScroll: true });
  }, [showResult]);
  const finished = encounters >= INITIATION_ENCOUNTERS.length;
  const encounter = INITIATION_ENCOUNTERS[Math.min(showResult ? Math.max(0, encounters - 1) : encounters, INITIATION_ENCOUNTERS.length - 1)];
  const steps = initiationSteps(encounters);
  const choose = (kind: ActionKind) => {
    if (finished || showResult) return;
    if (!answerInitiation(encounters, kind)) {
      setWrong(true); setFeedback("Le gobelin a mélangé les dossiers. Essaie une autre action."); return;
    }
    setWrong(false);
    interacted.current = true;
    setFeedback(`${encounter.response} ${JOURNEY_STEPS[kind] > 0 ? "+" : ""}${JOURNEY_STEPS[kind]} pas.`);
    setShowResult(true);
    onAnswer();
  };
  return <section className="initiation-lesson initiation-lesson--journey" aria-label="Rite du chemin">
    <p className="initiation-lead">Tes vraies démarches font voyager ton héros. Essaie dans ce royaume miniature.</p>
    <div className="initiation-road" role="img" aria-label={`Héros à ${steps} pas. Coffre à ${STEPS_PER_LEVEL} pas.`}>
      <span className="initiation-road__label">CAMP D’ESSAI</span>
      <div className="initiation-road__track" />
      {Array.from({ length: STEPS_PER_LEVEL + 1 }, (_, i) => <span key={i} className="initiation-road__stone" style={{ left: `${8 + i / STEPS_PER_LEVEL * 80}%` }} />)}
      <div className="initiation-road__hero" style={{ left: `${8 + steps / STEPS_PER_LEVEL * 80}%` }} />
      <div className="initiation-road__chest" />
      <span className="initiation-road__count">{steps} pas</span>
    </div>
    <div className="initiation-encounter" aria-live="polite" aria-atomic="true">
      <span className="initiation-encounter__number">{finished ? "Épreuve accomplie" : `Démarche ${showResult ? encounters : encounters + 1} / ${INITIATION_ENCOUNTERS.length}`}</span>
      <h2>{finished ? "La poisse fait du chemin." : encounter.title}</h2>
      <p>{finished ? `Tu as atteint ${STEPS_PER_LEVEL} pas. Un coffre t’attend !` : encounter.prompt}</p>
    </div>
    {!finished && !showResult ? <div className="initiation-choices">{INITIATION_ACTIONS.map((action, index) => <button ref={index === 0 ? firstChoice : undefined} type="button" key={action.kind} onClick={() => choose(action.kind)}>
      <ActionArtwork kind={action.kind} />
      <span>{action.label}</span>
    </button>)}</div> : null}
    <p className={`initiation-feedback${wrong ? " initiation-feedback--retry" : ""}`} role="status">{feedback || "Choisis l’action qui correspond au message."}</p>
    {showResult && !finished ? <button ref={nextControl} className="initiation-primary" type="button" onClick={() => { setShowResult(false); setFeedback(""); }}>Démarche suivante →</button> : null}
    <p className="initiation-hint">Tout est simulé. Ton journal et tes pas restent intacts.</p>
  </section>;
}
