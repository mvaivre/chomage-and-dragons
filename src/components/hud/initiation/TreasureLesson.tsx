"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import { InitiationScene } from "./InitiationScene";

export function TreasureLesson({ characterId, chestOpen, powerCast }: { characterId: string; chestOpen: boolean; powerCast: boolean ;
}) {
  const uiLocale = useLocale();
    return <section className="quick-lesson" aria-label={tr("Essayer un butin", undefined, uiLocale)}>
    <p className="quick-lead">{tr("Les coffres contiennent des pouvoirs à lancer sur tes compagnons. Ouvre celui-ci, puis essaie le sort du crapaud.", undefined, uiLocale)}</p>
    <div className="rite-scene" data-scene="treasure"><InitiationScene scene="treasure" characterId={characterId} chestOpen={chestOpen} powerCast={powerCast} animated label={tr(powerCast ? "Le compagnon d’entraînement a été transformé en crapaud" : chestOpen ? "Le coffre ouvert révèle un pouvoir" : "Ton héros découvre un coffre dans une clairière", undefined, uiLocale)} /><span className="rite-scene__badge">{tr(powerCast ? "Et hop, un crapaud !" : chestOpen ? "Sort du crapaud" : "Un coffre t’attend", undefined, uiLocale)}</span></div>
    <p className="quick-result" role="status">{tr(powerCast ? "Bien joué ! Tes vrais pouvoirs t’attendront dans ton carnet." : chestOpen ? "Notre volontaire est prêt. Lance le pouvoir !" : "Tous les 10 pas, un nouveau pouvoir à découvrir.", undefined, uiLocale)}</p>
  </section>;
}
