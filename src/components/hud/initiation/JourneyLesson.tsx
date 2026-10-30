"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import { InitiationScene } from "./InitiationScene";
import { INITIATION_EXAMPLE_STEPS } from "@/lib/game/initiation";
import { JOURNEY_STEPS } from "@/lib/config";
export function JourneyLesson({ characterId, complete }: {
    characterId: string;
    complete: boolean;
}) {
    const uiLocale = useLocale();
    return <section className="quick-lesson" aria-label={tr("Essayer une démarche", undefined, uiLocale)}>
    <p className="quick-lead">{tr("Tu envoies un CV ? Déclare une candidature : ton héros avance de ", undefined, uiLocale)}<strong>{tr("2 pas", undefined, uiLocale)}</strong>.</p>
    <div className="rite-scene" data-scene="road"><InitiationScene scene="road" characterId={characterId} steps={complete ? INITIATION_EXAMPLE_STEPS : 0} animated label={tr("Ton héros sur le chemin de la Plaine de la Poisse", undefined, uiLocale)}/><span className="rite-scene__badge">{tr(complete ? "+2 pas" : "À toi d’essayer", undefined, uiLocale)}</span></div>
    <p className="quick-result" role="status">{tr(complete ? "Voilà ! Dans le jeu, déclare seulement tes vraies démarches." : "Touche le bouton pour voir ton héros avancer.", undefined, uiLocale)}</p>
    <div className="quick-steps" aria-label={tr("Les pas de chaque démarche", undefined, uiLocale)}>{[["Candidature", JOURNEY_STEPS.candidature], ["Refus", JOURNEY_STEPS.refus], ["Entretien", JOURNEY_STEPS.entretien], ["Rejet après entretien", JOURNEY_STEPS.rejetApresEntretien]].map(([name, steps]) => <span key={name}><b>{tr(Number(steps) > 0 ? "+" : "", undefined, uiLocale)}{tr(steps, undefined, uiLocale)}</b>{tr(name, undefined, uiLocale)}</span>)}</div>
  </section>;
}
