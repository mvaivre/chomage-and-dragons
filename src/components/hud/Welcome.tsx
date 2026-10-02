"use client";

import { useEffect, useRef } from "react";
import { JOURNEY_STEPS, STEPS_PER_LEVEL } from "@/lib/config";

export const WELCOME_KEY = "chomage:welcome:steps-v1";
export function hasSeenWelcome() {
  try { return localStorage.getItem(WELCOME_KEY) === "seen"; } catch { return false; }
}
export function rememberWelcome() {
  try { localStorage.setItem(WELCOME_KEY, "seen"); } catch { /* Private browsing can deny storage. */ }
}

export function Welcome({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    node?.querySelector("h1")?.focus({ preventScroll: true });
    if (node) node.scrollTop = 0;
    return () => { node?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="welcome-card" aria-labelledby="welcome-title" onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()}>
    <div className="welcome-card__body">
    <p className="welcome-card__eyebrow">Chômage & Dragons</p>
    <h1 id="welcome-title" tabIndex={-1}>Les refus font avancer.</h1>
    <p>Déclare tes démarches : ton héros avance.</p>
    <dl className="welcome-card__actions">
      <div><dt>Candidature</dt><dd>+{JOURNEY_STEPS.candidature} pas</dd></div>
      <div><dt>Refus</dt><dd>+{JOURNEY_STEPS.refus} pas</dd></div>
      <div><dt>Entretien</dt><dd>{JOURNEY_STEPS.entretien} pas</dd></div>
      <div><dt>Rejet après entretien</dt><dd>+{JOURNEY_STEPS.rejetApresEntretien} pas</dd></div>
    </dl>
    <p className="welcome-card__aside">Un entretien te rapproche de l’emploi. Engagé·e ? Direction la taverne !</p>
    <p><strong>Tous les {STEPS_PER_LEVEL} pas :</strong> un coffre et un pouvoir à lancer sur un ami. Mini-jeux : pas bonus ou butin.</p>
    <p><strong>Le classement suit vos pas.</strong> La couronne du mois repart de zéro. Comparez aussi vos records au défi du jour.</p>
    </div>
    <button type="button" className="welcome-card__start" onClick={onClose}>C’est parti !</button>
    <small>Retrouve ces règles avec le bouton « Aide ».</small>
  </dialog>;
}
