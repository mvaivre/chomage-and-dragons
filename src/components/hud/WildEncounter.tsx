"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { EncounterMove, WildEncounter as Encounter } from "@/lib/data/types";
import { activeEncounter, captureHint, incomingHeavy, monsterName, MONSTERS } from "@/lib/game/encounters";
import { EncounterArtwork } from "./EncounterArtwork";
import { CharacterPortrait } from "./CharacterPortrait";
import { characterById } from "@/lib/game/characters";
import { useDialogKeyboard } from "./useDialogKeyboard";
import { sfx } from "@/lib/client/sound";

export function WildEncounter({ encounter: e, name, characterId, onMove, onDone, onCollection }: {
  encounter: Encounter; name: string; characterId: string;
  onMove: (move: EncounterMove) => void; onDone: () => void; onCollection: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const [choosingTechnique, setChoosingTechnique] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [animation, setAnimation] = useState<EncounterMove | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offered = e.status === "offered", finished = !activeEncounter(e), captured = e.status === "captured";
  const title = monsterName(e);
  useEffect(() => {
    if (!animating && captured) sfx.fanfare();
    else if (!animating && e.status === "lost") sfx.sad();
  }, [animating, captured, e.status]);
  const close = () => { if (activeEncounter(e)) onMove("leave"); onDone(); };
  useDialogKeyboard(dialog);
  useEffect(() => {
    const node = dialog.current, previous = document.activeElement as HTMLElement | null;
    node?.showModal(); primary.current?.focus(); sfx.invite();
    return () => { node?.close(); if (timer.current) clearTimeout(timer.current); previous?.focus(); };
  }, []);
  useLayoutEffect(() => { if (!animating) primary.current?.focus({ preventScroll: true }); }, [e.status, animating, choosingTechnique]);
  const move = (value: EncounterMove) => {
    if (animating) return;
    if (value === "challenge" || value === "leave") { onMove(value); return; }
    setChoosingTechnique(false); setAnimation(value); setAnimating(true); sfx.stamp();
    // Save the turn immediately. The animation never owns the capture outcome.
    onMove(value);
    timer.current = setTimeout(() => { setAnimating(false); setAnimation(null); }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 150 : value === "capture" ? 1200 : 650);
  };
  return <dialog ref={dialog} className="wild-encounter" aria-labelledby="wild-title" aria-describedby="wild-message" data-status={e.status} data-animation={animation ?? undefined} data-turn={e.turn} onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => event.stopPropagation()}>
    <div className="wild-encounter__heading"><span>Rencontre sauvage {e.rare ? "· Variante rare ✦" : ""}</span><button type="button" onClick={close} aria-label="Quitter la rencontre">×</button></div>
    <div className="wild-encounter__field">
      <div className="wild-encounter__enemy-card"><h2 id="wild-title">{title}</h2><small>{offered ? "Une drôle de rencontre…" : captured ? "Dossier classé !" : captureHint(e.hp)}</small><label>Résistance <meter min="0" max="100" value={e.hp}>{e.hp} / 100</meter></label></div>
      <div className="wild-encounter__enemy-platform" />
      <EncounterArtwork model={e.monster} rare={e.rare} className="wild-encounter__enemy" />
      <div className="wild-encounter__hero-platform" />
      <div className="wild-encounter__hero"><CharacterPortrait character={characterById(characterId)} /></div>
      <div className="wild-encounter__hero-card"><strong>{name}</strong><label>Énergie <meter min="0" max="100" value={e.energy}>{e.energy} / 100</meter></label><small>{e.balls} chômageball{e.balls > 1 ? "s" : ""} · offertes pour cette rencontre</small></div>
      {animation === "capture" || captured ? <div className="wild-encounter__ball"><EncounterArtwork model="ball" /></div> : null}
    </div>
    <div className="wild-encounter__dialogue">
      <div className="wild-encounter__message" role="status" aria-live="polite"><p id="wild-message">{offered ? MONSTERS[e.monster].intro : animating && animation === "capture" ? "Tu lances une chômageball…" : e.message}</p><small>{offered ? MONSTERS[e.monster].description : !finished ? incomingHeavy(e) ? "Il prépare une grosse attaque. Une relance polie ou une pause amortira le choc." : "Affaiblis-le pour faciliter la capture." : captured ? "Ajouté à tes dossiers classés." : "Tous tes pas sont conservés."}</small></div>
      {offered ? <div className="wild-encounter__choices"><button ref={primary} type="button" onClick={() => move("challenge")}>Relever le défi</button><button type="button" onClick={close}>Continuer mon chemin</button></div> : finished && !animating ? <div className="wild-encounter__choices"><button ref={primary} type="button" onClick={onDone}>Reprendre la route</button>{captured ? <button type="button" onClick={onCollection}>Voir ma collection</button> : null}</div> : <div className="wild-encounter__commands" aria-label="Actions de combat" aria-busy={animating}>
        {choosingTechnique ? <>
          <button ref={primary} type="button" disabled={animating} onClick={() => move("argue")}>Argument béton<small>Affaiblir · −28</small></button>
          <button type="button" disabled={animating} onClick={() => move("polite")}>Relance polie<small>Affaiblir · −18 et se protéger</small></button>
          <button type="button" onClick={() => setChoosingTechnique(false)}>← Retour</button>
        </> : <>
        <button ref={primary} type="button" disabled={animating} onClick={() => setChoosingTechnique(true)}>Agir<small>Choisir une technique</small></button>
        <button type="button" disabled={animating} onClick={() => move("rest")}>Souffler<small>Récupérer et se protéger</small></button>
        <button type="button" disabled={animating || e.balls === 0} onClick={() => move("capture")}>Chômageball<small>Capturer · {e.balls} restantes</small></button>
        <button type="button" disabled={animating} onClick={close}>Partir<small>Continuer ma route</small></button>
        </>}
      </div>}
    </div>
  </dialog>;
}
