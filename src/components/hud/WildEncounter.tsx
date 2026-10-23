"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { EncounterMove, WildEncounter as Encounter } from "@/lib/data/types";
import { activeEncounter, captureHint, incomingHeavy, monsterName, MONSTERS } from "@/lib/game/encounters";
import { EncounterEntrance, useEncounterEntrance } from "./EncounterEntrance";
import { VoxelIcon } from "./VoxelIcon";
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
  const [animating, setAnimating] = useState(false);
  const [animation, setAnimation] = useState<EncounterMove | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offered = e.status === "offered", finished = !activeEncounter(e), captured = e.status === "captured";
  const title = monsterName(e);
  const entrance = useEncounterEntrance(offered, true);
  useEffect(() => {
    if (!animating && captured) sfx.fanfare();
    else if (!animating && e.status === "lost") sfx.sad();
  }, [animating, captured, e.status]);
  const close = () => { if (activeEncounter(e)) onMove("leave"); onDone(); };
  useDialogKeyboard(dialog, event => {
    if (event.repeat && ["Enter", " "].includes(event.key)) { event.preventDefault(); return; }
    if (!entrance.ready && ["Enter", " "].includes(event.key)) { event.preventDefault(); if (!event.repeat) entrance.finish(); }
  });
  useEffect(() => {
    const node = dialog.current, previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    if (primary.current) primary.current.focus(); else node?.focus();
    return () => { node?.close(); if (timer.current) clearTimeout(timer.current); previous?.focus(); };
  }, []);
  useLayoutEffect(() => { if (entrance.ready && !animating) primary.current?.focus({ preventScroll: true }); }, [e.status, animating, entrance.ready]);
  const move = (value: EncounterMove) => {
    if (animating) return;
    if (value === "challenge" || value === "leave") { if (value === "challenge") sfx.battleStart(); onMove(value); return; }
    setAnimation(value); setAnimating(true); sfx.battleMove(value);
    // Save the turn immediately. The animation never owns the capture outcome.
    onMove(value);
    timer.current = setTimeout(() => { setAnimating(false); setAnimation(null); }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 150 : value === "capture" ? 1200 : 650);
  };
  return <dialog ref={dialog} className="wild-encounter" tabIndex={-1} data-entrance={entrance.ready ? "ready" : "reveal"} aria-label={entrance.ready ? undefined : "Une rencontre sauvage apparaît"} aria-labelledby={entrance.ready ? "wild-title" : undefined} aria-describedby={entrance.ready ? "wild-message" : undefined} data-status={e.status} data-animation={animation ?? undefined} data-turn={e.turn} onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => event.stopPropagation()}>
    {!entrance.ready ? <EncounterEntrance model={e.monster} rare={e.rare} wild onFinish={entrance.finish} /> : <>
    <div className="wild-encounter__heading"><span>Rencontre sauvage {e.rare ? "· Variante rare ✦" : ""}</span><button type="button" onClick={close} aria-label="Quitter la rencontre">×</button></div>
    <div className="wild-encounter__field">
      <div className="wild-encounter__enemy-card"><h2 id="wild-title">{title}</h2><small>{offered ? "Une drôle de rencontre…" : captured ? "Dossier classé !" : captureHint(e.hp)}</small><label>Résistance <meter min="0" max="100" value={e.hp}>{e.hp} / 100</meter></label></div>
      <div className="wild-encounter__enemy-platform" />
      <EncounterArtwork model={e.monster} rare={e.rare} className="wild-encounter__enemy" />
      <div className="wild-encounter__hero-platform" />
      <div className="wild-encounter__hero"><CharacterPortrait character={characterById(characterId)} /></div>
      <div className="wild-encounter__hero-card"><strong>{name}</strong><label>Énergie <meter min="0" max="100" value={e.energy}>{e.energy} / 100</meter></label><small>{e.balls} chômageball{e.balls > 1 ? "s" : ""} · offertes pour cette rencontre</small></div>
      {animation === "argue" || animation === "polite" ? <div key={e.turn} className="wild-encounter__impact" aria-hidden="true">✦</div> : null}
      {animation === "rest" ? <div key={e.turn} className="wild-encounter__recovery" aria-hidden="true">+30</div> : null}
      {animation === "capture" || captured ? <div className="wild-encounter__ball"><EncounterArtwork model="ball" /></div> : null}
    </div>
    <div className="wild-encounter__dialogue">
      <div className="wild-encounter__message" role="status" aria-live="polite"><p id="wild-message">{offered ? MONSTERS[e.monster].intro : animating && animation === "capture" ? "Tu lances une chômageball…" : e.message}</p><small>{offered ? MONSTERS[e.monster].description : !finished ? incomingHeavy(e) ? "Il prépare une grosse attaque. Une relance polie ou une pause amortira le choc." : "Affaiblis-le pour faciliter la capture." : captured ? "Ajouté à tes dossiers classés." : "Tous tes pas sont conservés."}</small></div>
      {offered ? <div className="wild-encounter__choices"><button ref={primary} type="button" onClick={() => move("challenge")}>Relever le défi</button><button type="button" onClick={close}>Continuer mon chemin</button></div> : finished && !animating ? <div className="wild-encounter__choices"><button ref={primary} type="button" onClick={onDone}>Reprendre la route</button>{captured ? <button type="button" onClick={onCollection}>Voir ma collection</button> : null}</div> : <div className="wild-encounter__commands" aria-label="Actions de combat" aria-busy={animating}>
        <button ref={primary} type="button" data-move="argue" disabled={animating} onClick={() => move("argue")}><VoxelIcon name="sword" /><span>Argument béton<small>Attaquer · −28</small></span></button>
        <button type="button" data-move="polite" disabled={animating} onClick={() => move("polite")}><VoxelIcon name="letter" /><span>Relance polie<small>−18 et se protéger</small></span></button>
        <button type="button" data-move="rest" disabled={animating} onClick={() => move("rest")}><VoxelIcon name="mug" /><span>Souffler<small>+30 énergie · protection</small></span></button>
        <button type="button" data-move="capture" disabled={animating || e.balls === 0} onClick={() => move("capture")}><EncounterArtwork model="ball" /><span>Chômageball<small>Capturer · {e.balls} restantes</small></span></button>
        <button type="button" data-move="leave" disabled={animating} onClick={close}>Continuer mon chemin <span aria-hidden="true">›</span></button>
      </div>}
    </div></>}
  </dialog>;
}
