"use client";
import { VoxelPortrait } from "@/components/voxel/PortraitStudio";
import { INITIATION_EXAMPLE_STEPS } from "@/lib/game/initiation";
import { JOURNEY_STEPS } from "@/lib/config";

export function JourneyLesson({ characterId, complete }: { characterId: string; complete: boolean }) {
  return <section className="quick-lesson" aria-label="Essayer une démarche">
    <p className="quick-lead">Tu envoies un CV ? Déclare une candidature : ton héros avance de <strong>2 pas</strong>.</p>
    <div className="rite-scene" data-scene="road"><VoxelPortrait scene="road" characterId={characterId} steps={complete ? INITIATION_EXAMPLE_STEPS : 0} animated label="Ton héros sur un chemin fleuri, devant une boîte aux lettres" /><span className="rite-scene__badge">{complete ? "+2 pas" : "À toi d’essayer"}</span></div>
    <p className="quick-result" role="status">{complete ? "Voilà ! Dans le jeu, déclare seulement tes vraies démarches." : "Touche le bouton pour voir ton héros avancer."}</p>
    <div className="quick-steps" aria-label="Les pas de chaque démarche">{[["Candidature", JOURNEY_STEPS.candidature], ["Refus", JOURNEY_STEPS.refus], ["Entretien", JOURNEY_STEPS.entretien], ["Rejet après entretien", JOURNEY_STEPS.rejetApresEntretien]].map(([name, steps]) => <span key={name}><b>{Number(steps) > 0 ? "+" : ""}{steps}</b>{name}</span>)}</div>
  </section>;
}
