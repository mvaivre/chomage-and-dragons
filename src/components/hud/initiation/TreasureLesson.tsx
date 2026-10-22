"use client";
import { VoxelPortrait } from "@/components/voxel/PortraitStudio";

export function TreasureLesson({ characterId, chestOpen, powerCast }: { characterId: string; chestOpen: boolean; powerCast: boolean }) {
  return <section className="quick-lesson" aria-label="Essayer un butin">
    <p className="quick-lead">Les coffres contiennent des pouvoirs à lancer sur tes compagnons. Ouvre celui-ci, puis essaie le sort du crapaud.</p>
    <div className="rite-scene" data-scene="treasure"><VoxelPortrait scene="treasure" characterId={characterId} chestOpen={chestOpen} powerCast={powerCast} animated label={powerCast ? "Le compagnon d’entraînement a été transformé en crapaud" : chestOpen ? "Le coffre ouvert révèle un pouvoir" : "Ton héros découvre un coffre dans une clairière"} /><span className="rite-scene__badge">{powerCast ? "Et hop, un crapaud !" : chestOpen ? "Sort du crapaud" : "Un coffre t’attend"}</span></div>
    <p className="quick-result" role="status">{powerCast ? "Bien joué ! Tes vrais pouvoirs t’attendront dans ton carnet." : chestOpen ? "Notre volontaire est prêt. Lance le pouvoir !" : "Tous les 10 pas, un nouveau pouvoir à découvrir."}</p>
  </section>;
}
