"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PigeonResult } from "@/lib/data/types";
import { JOURNEY_STEPS } from "@/lib/config";
import { MAILBOX_Y, PIGEON_DURATION_MS, pigeonAltitude, pigeonHitsMailbox } from "@/lib/game/pigeon-flight";
import { ActionArtwork } from "./Artwork";

/** One timing gesture. The same button works with touch, Space and Enter. */
export function PigeonGame({ onResolve, onDone }: {
  onResolve: (result: PigeonResult) => void;
  onDone: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const bird = useRef<HTMLSpanElement>(null);
  const timer = useRef<HTMLOutputElement>(null);
  const altitude = useRef(pigeonAltitude(0));
  const resolved = useRef<PigeonResult | null>(null);
  const [phase, setPhase] = useState<"intro" | "aim" | "flight" | "result">("intro");
  const [outcome, setOutcome] = useState<PigeonResult | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const base = JOURNEY_STEPS.candidature;

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    primary.current?.focus();
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", sync);
    return () => {
      node?.close();
      preference.removeEventListener("change", sync);
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".action-button:not(:disabled)")?.focus());
    };
  }, []);

  const settle = useCallback((result: PigeonResult) => {
    if (resolved.current) return;
    resolved.current = result;
    setOutcome(result);
    // Save before the celebratory flight, so reloading cannot replay the attempt.
    onResolve(result);
    setPhase(result === "skipped" || reducedMotion ? "result" : "flight");
  }, [onResolve, reducedMotion]);

  const leave = () => {
    if (!resolved.current) settle("skipped");
    onDone();
  };

  useEffect(() => {
    if (phase !== "aim" || reducedMotion) return;
    let elapsed = 0;
    let previous = performance.now();
    let frame = 0;
    const syncVisibility = () => { previous = performance.now(); };
    document.addEventListener("visibilitychange", syncVisibility);
    const tick = (now: number) => {
      if (!document.hidden) elapsed += now - previous;
      previous = now;
      altitude.current = pigeonAltitude(elapsed);
      if (bird.current) bird.current.style.top = `${altitude.current}%`;
      if (timer.current) timer.current.textContent = `${Math.max(0, Math.ceil((PIGEON_DURATION_MS - elapsed) / 1000))} s`;
      if (elapsed >= PIGEON_DURATION_MS) { settle("miss"); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, [phase, reducedMotion, settle]);

  useEffect(() => {
    if (phase !== "flight") return;
    const timeout = window.setTimeout(() => setPhase("result"), 1050);
    return () => window.clearTimeout(timeout);
  }, [phase]);

  useEffect(() => { primary.current?.focus(); }, [phase]);

  const launch = () => {
    if (phase === "aim") settle(pigeonHitsMailbox(altitude.current) ? "hit" : "miss");
  };
  const hit = outcome === "hit";

  return <dialog ref={dialog} className="pigeon-game" aria-labelledby="pigeon-title" aria-describedby="pigeon-instructions"
    onCancel={event => { event.preventDefault(); leave(); }}>
    <button type="button" className="pigeon-game__close" onClick={leave} aria-label="Fermer le mini-jeu">×</button>
    <header>
      <p className="pigeon-game__eyebrow">Courrier presque prioritaire · +{base} pas acquis</p>
      <h2 id="pigeon-title">Le pigeon à reculons</h2>
      <p id="pigeon-instructions">{phase === "intro"
        ? `Il vole en marche arrière. Vise la boîte aux lettres pour doubler cette candidature : +${base * 2} pas !`
        : phase === "aim" ? reducedMotion ? "Ajuste sa hauteur, puis envoie-le vers la fente dorée." : "Quand le pigeon est à la hauteur de la fente dorée, envoie-le !"
        : hit ? "Livré à l’envers. Compté double." : "Le CV s’est égaré. Ta candidature compte quand même."}</p>
    </header>

    <button type="button" tabIndex={-1} className="pigeon-game__arena" data-phase={phase} data-hit={hit} data-reduced={reducedMotion}
      aria-label="Envoyer le pigeon vers la boîte aux lettres" disabled={phase !== "aim"} onClick={launch}>
      <span className="pigeon-game__cloud" aria-hidden />
      <span className="pigeon-game__lane" style={{ top: `${MAILBOX_Y}%` }} aria-hidden />
      <span className="pigeon-game__mailbox" style={{ top: `${MAILBOX_Y}%` }} aria-hidden>
        <span className="pigeon-game__mail-slot" /><strong>CV</strong><i />
      </span>
      <span ref={bird} className="pigeon-game__bird" aria-hidden>
        <ActionArtwork kind="candidature" className="pigeon-game__bird-art" />
      </span>
      {phase === "aim" && !reducedMotion ? <output ref={timer} className="pigeon-game__timer" aria-label="Temps restant">12 s</output> : null}
      {phase === "result" ? <span className="pigeon-game__stamp" aria-hidden>{hit ? "LIVRÉ ! ×2" : "ADRESSE INTROUVABLE"}</span> : null}
    </button>

    {phase === "aim" && reducedMotion ? <label className="pigeon-game__altitude">Hauteur du pigeon
      <input type="range" min="23" max="77" defaultValue="23" onChange={event => {
        altitude.current = Number(event.target.value);
        if (bird.current) bird.current.style.top = `${altitude.current}%`;
      }} />
    </label> : null}

    <div className="pigeon-game__result" role="status" aria-live="polite">
      {phase === "result" ? <><strong>{hit ? `×2 · +${base * 2} pas` : `+${base} pas conservés`}</strong><span>{hit ? `${base} pas de candidature + ${base} pas bonus` : "Aucun pas perdu. Le voyage continue."}</span></> :
        <span>{phase === "intro" ? "Une tentative facultative · 12 secondes" : phase === "aim" ? reducedMotion ? "Réglage sans mouvement ni limite de temps" : "Touche l’image ou le bouton · Espace / Entrée" : "Livraison en cours…"}</span>}
    </div>
    <footer>
      <button ref={primary} type="button" className="pigeon-game__primary" disabled={phase === "flight"}
        onClick={() => phase === "intro" ? setPhase("aim") : phase === "aim" ? launch() : onDone()}>
        {phase === "intro" ? "Tenter le ×2" : phase === "aim" ? "Envoyer !" : phase === "flight" ? "En plein vol…" : "Continuer le voyage"}
      </button>
      {phase === "intro" || phase === "aim" ? <button type="button" className="pigeon-game__skip" onClick={leave}>Garder mes +{base} pas</button> : null}
    </footer>
  </dialog>;
}
