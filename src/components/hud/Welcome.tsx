"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createInitiationProgress, INITIATION_ENCOUNTERS, INITIATION_KEY,
  initiationStorageKey, parseInitiationProgress, type InitiationProgress,
} from "@/lib/game/initiation";
import { DragonLesson } from "./initiation/DragonLesson";
import { JourneyLesson } from "./initiation/JourneyLesson";
import { TreasureLesson } from "./initiation/TreasureLesson";
import "./initiation/initiation.css";

export const WELCOME_KEY = INITIATION_KEY;
export function hasSeenWelcome(scope?: string) {
  try { return localStorage.getItem(initiationStorageKey(scope)) === "seen"; } catch { return false; }
}
export function rememberWelcome(scope?: string) {
  try { localStorage.setItem(initiationStorageKey(scope), "seen"); } catch { /* Private browsing can deny storage. */ }
}
function readProgress(scope?: string) {
  try { return parseInitiationProgress(localStorage.getItem(`${initiationStorageKey(scope)}:progress`)); }
  catch { return createInitiationProgress(); }
}
const rites = [
  { name: "Le dragon", title: "Le baptême de l’air", symbol: "Ⅰ" },
  { name: "Le chemin", title: "Les portes du refus", symbol: "Ⅱ" },
  { name: "La compagnie", title: "Le serment du comptoir", symbol: "Ⅲ" },
] as const;

export function Welcome({ onClose, scope }: { onClose: () => void; scope?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const nextRite = useRef<HTMLButtonElement>(null);
  const [progress, setProgress] = useState(() => readProgress(scope));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    title.current?.focus({ preventScroll: true });
    return () => { node?.close(); previous?.focus(); };
  }, []);
  useEffect(() => {
    try { localStorage.setItem(`${initiationStorageKey(scope)}:progress`, JSON.stringify(progress)); } catch { /* Training still works without storage. */ }
  }, [progress, scope]);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    const body = dialog.current?.querySelector(".initiation-card__body");
    if (body) body.scrollTop = 0;
  }, [progress.stage]);
  const completeDragon = useCallback(() => setProgress(value => ({ ...value, dragonDone: true })), []);
  const patch = (value: Partial<InitiationProgress>) => setProgress(previous => ({ ...previous, ...value }));
  const ready = progress.stage === 0 ? progress.dragonDone : progress.stage === 1 ? progress.encounters >= INITIATION_ENCOUNTERS.length : progress.crownDone;
  useEffect(() => { if (ready) nextRite.current?.focus({ preventScroll: true }); }, [ready]);
  const rite = rites[progress.stage];
  const leave = () => { rememberWelcome(scope); onClose(); };
  return <dialog ref={dialog} className="initiation-card" aria-labelledby="initiation-title" onCancel={event => { event.preventDefault(); leave(); }} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <header className="initiation-card__header">
      <div><p className="initiation-eyebrow">Chômage & Dragons</p><span className="initiation-card__subtitle">L’initiation des improbables</span></div>
      <button className="initiation-close" type="button" onClick={leave} aria-label="Fermer l’initiation">×</button>
    </header>
    <ol className="initiation-rites" aria-label="Les trois rites">{rites.map((item, i) => <li key={item.name} data-current={i === progress.stage} data-complete={i < progress.stage} aria-current={i === progress.stage ? "step" : undefined}>
      <span aria-hidden>{i < progress.stage ? "✓" : item.symbol}</span><b>{item.name}</b>
    </li>)}</ol>
    <div className="initiation-card__body">
      <p className="initiation-eyebrow">Rite {progress.stage + 1} sur 3 · Entraînement sans conséquence</p>
      <h1 ref={title} id="initiation-title" tabIndex={-1}>{rite.title}</h1>
      {progress.stage === 0 ? <DragonLesson key={attempt} complete={progress.dragonDone} onComplete={completeDragon} /> : progress.stage === 1 ? <JourneyLesson encounters={progress.encounters} onAnswer={() => setProgress(value => ({ ...value, encounters: Math.min(INITIATION_ENCOUNTERS.length, value.encounters + 1) }))} /> : <TreasureLesson chestOpen={progress.chestOpen} powerCast={progress.powerCast} crownDone={progress.crownDone} onOpen={() => patch({ chestOpen: true })} onCast={() => patch({ powerCast: true })} onCrown={() => patch({ crownDone: true })} />}
    </div>
    <footer className="initiation-card__footer">
      {ready ? <button ref={nextRite} className="initiation-primary" type="button" onClick={() => progress.stage === 2 ? leave() : patch({ stage: (progress.stage + 1) as 1 | 2 })}>{progress.stage === 2 ? "Entrer dans la légende" : "Rite suivant →"}</button> : null}
      <div className="initiation-card__links"><button type="button" onClick={leave}>Passer l’initiation</button><button type="button" onClick={() => { setProgress(createInitiationProgress()); setAttempt(value => value + 1); }}>Recommencer</button></div>
      <small>Rejouable depuis « Quêtes » · Échap pour rejoindre le chemin</small>
    </footer>
  </dialog>;
}
