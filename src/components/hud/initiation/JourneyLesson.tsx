"use client";
import { VoxelDisplay } from "@/components/voxel/Display";

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
      setWrong(true); setFeedback("Essaie une autre action"); return;
    }
    setWrong(false);
    interacted.current = true;
    setFeedback(`Tu ${JOURNEY_STEPS[kind] > 0 ? "avances" : "recules"} de ${Math.abs(JOURNEY_STEPS[kind])} pas`);
    setShowResult(true);
    onAnswer();
  };
  return <section className="initiation-lesson initiation-lesson--journey" aria-label="Rite du chemin">
    <p className="initiation-lead">Déclare tes démarches pour avancer</p>
    <div className="initiation-road" role="img" aria-label={`Héros à ${steps} pas. Coffre à ${STEPS_PER_LEVEL} pas.`}>
      <span className="initiation-road__label">CAMP D’ESSAI</span>
      <VoxelDisplay width={360} height={130} draw={ctx=>{ctx.background(360,130);for(let i=0;i<11;i++)ctx.block(0xc1b18a,29+i*28.8,95,27,14,9,3);ctx.person(29+steps*28.8,89,.72,0x879ba3);ctx.paper(326,84,30,23,0xb48a4a);}}/>
      <span className="initiation-road__count">{steps} pas</span>
    </div>
    <div className="initiation-encounter" aria-live="polite" aria-atomic="true">
      <span className="initiation-encounter__number">{finished ? "Épreuve accomplie" : `Démarche ${showResult ? encounters : encounters + 1} / ${INITIATION_ENCOUNTERS.length}`}</span>
      <h2>{finished ? "Coffre débloqué" : encounter.title}</h2>
      <p>{finished ? `Tu as atteint ${STEPS_PER_LEVEL} pas` : encounter.prompt}</p>
    </div>
    {!finished && !showResult ? <div className="initiation-choices">{INITIATION_ACTIONS.map((action, index) => <button ref={index === 0 ? firstChoice : undefined} type="button" key={action.kind} onClick={() => choose(action.kind)}>
      <ActionArtwork kind={action.kind} />
      <span>{action.label}</span>
    </button>)}</div> : null}
    <p className={`initiation-feedback${wrong ? " initiation-feedback--retry" : ""}`} role="status">{feedback || ""}</p>
    {showResult && !finished ? <button ref={nextControl} className="initiation-primary" type="button" onClick={() => { setShowResult(false); setFeedback(""); }}>Démarche suivante →</button> : null}
    <p className="initiation-hint">Cet entraînement ne modifie pas ton score</p>
  </section>;
}
