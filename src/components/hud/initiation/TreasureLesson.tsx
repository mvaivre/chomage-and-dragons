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
    <p className="initiation-lead">Tous les {STEPS_PER_LEVEL} pas, un coffre et un pouvoir. La compagnie appréciera. Ou pas.</p>
    <div className="initiation-treasure" data-open={chestOpen} data-cast={powerCast}>
      {!chestOpen ? <button type="button" className="initiation-chest" onClick={onOpen}>
        <ChestArtwork /><span>Ouvrir le coffre</span>
      </button> : !powerCast ? <>
        <div className="initiation-treasure__power"><PowerArtwork kind="crapaud" /><span>Malédiction du crapaud</span></div>
        <span className="initiation-treasure__arrow" aria-hidden>→</span>
        <button ref={target} type="button" className="initiation-target" onClick={onCast}><span className="initiation-target__goblin" aria-hidden /><span>Viser le gobelin<br />d’entraînement</span></button>
      </> : <div className="initiation-treasure__cast"><span aria-hidden>🐸</span><strong>Gobelin reconverti.</strong><p>Ton aura vient de démissionner.<br />La sienne vient de coasser.</p></div>}
    </div>
    {!powerCast ? <p className="initiation-hint">{chestOpen ? "Clique sur le gobelin pour lancer le pouvoir. Aucun ami ne risque une patte." : "Ce coffre est un exercice. Le vrai butin se gagne sur le chemin."}</p> : <div className="initiation-crown">
      <CrownArtwork />
      <div><h2>{crownDone ? "Ta compagnie t’attend." : "À qui revient la couronne ?"}</h2>
        <p>{crownDone ? "Le plus de pas du mois gagne la couronne. La compagnie lui offre un verre : choisissez ensemble la date." : "Le mois se termine. Le conseil des gobelins attend ton verdict."}</p>
      </div>
      {!crownDone ? <div className="initiation-crown__choices">
        <button ref={verdict} type="button" onClick={() => { setWrong(false); onCrown(); }}>Au plus de pas ce mois</button>
        <button type="button" onClick={() => setWrong(true)}>Au plus joli CV</button>
      </div> : null}
      {wrong && !crownDone ? <p className="initiation-feedback initiation-feedback--retry" role="status">Le dragon ne lit pas les CV. Il compte les pas. Réessaie !</p> : null}
    </div>}
    {crownDone ? <p className="initiation-graduation" role="status">Les mini-jeux offrent des pas bonus ou du butin.<br /><strong>Un emploi décroché ? Direction la taverne !</strong></p> : null}
  </section>;
}
