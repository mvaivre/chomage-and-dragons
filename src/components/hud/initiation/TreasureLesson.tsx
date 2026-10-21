"use client";

import { useEffect, useRef, useState } from "react";
import { STEPS_PER_LEVEL } from "@/lib/config";
import { ChestArtwork, CrownArtwork, PowerArtwork } from "../Artwork";

export function TreasureLesson({ chestOpen, powerCast, crownDone, onOpen, onCast, onCrown }: {
  chestOpen: boolean; powerCast: boolean; crownDone: boolean;
  onOpen: () => void; onCast: () => void; onCrown: () => void;
}) {
  const [wrong, setWrong] = useState(false);
  const target = useRef<HTMLButtonElement>(null);
  const verdict = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (chestOpen && !powerCast) target.current?.focus({ preventScroll: true });
    if (powerCast && !crownDone) verdict.current?.focus({ preventScroll: true });
  }, [chestOpen, powerCast, crownDone]);
  return <section className="initiation-lesson initiation-lesson--treasure" aria-label="Rite de la compagnie">
    <p className="initiation-lead">Un coffre tous les {STEPS_PER_LEVEL} pas. Il contient un pouvoir.</p>
    <div className="initiation-treasure" data-open={chestOpen} data-cast={powerCast}>
      {!chestOpen ? <button type="button" className="initiation-chest" onClick={onOpen}>
        <ChestArtwork /><span>Ouvrir le coffre</span>
      </button> : !powerCast ? <>
        <div className="initiation-treasure__power"><PowerArtwork kind="crapaud" /><span>Malédiction du crapaud</span></div>
        <span className="initiation-treasure__arrow" aria-hidden>→</span>
        <button ref={target} type="button" className="initiation-target" onClick={onCast}><span className="initiation-target__goblin" aria-hidden /><span>Viser le gobelin<br />d’entraînement</span></button>
      </> : <div className="initiation-treasure__cast"><span aria-hidden>🐸</span><strong>Gobelin reconverti.</strong><p>Ton aura vient de démissionner.</p></div>}
    </div>
    {!powerCast ? <p className="initiation-hint">{chestOpen ? "Touche le gobelin pour lancer le pouvoir." : "Essaie ce coffre."}</p> : <div className="initiation-crown">
      <CrownArtwork />
      <div><h2>{crownDone ? "Ta compagnie t’attend." : "À qui revient la couronne ?"}</h2>
        <p>{crownDone ? "Le plus de pas du mois gagne un verre. Fixez la date ensemble." : "Le mois se termine."}</p>
      </div>
      {!crownDone ? <div className="initiation-crown__choices">
        <button ref={verdict} type="button" onClick={() => { setWrong(false); onCrown(); }}>Au plus de pas ce mois</button>
        <button type="button" onClick={() => setWrong(true)}>Au plus joli CV</button>
      </div> : null}
      {wrong && !crownDone ? <p className="initiation-feedback initiation-feedback--retry" role="status">Réessaie : compte les pas du mois.</p> : null}
    </div>}
    {crownDone ? <p className="initiation-graduation" role="status">Mini-jeux : pas bonus ou butin.<br /><strong>Un emploi ? Direction la taverne !</strong></p> : null}
  </section>;
}
