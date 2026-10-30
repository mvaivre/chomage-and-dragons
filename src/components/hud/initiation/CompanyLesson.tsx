"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import { InitiationScene } from "./InitiationScene";

export function CompanyLesson({ characterId }: { characterId: string ;
}) {
  const uiLocale = useLocale();
    return <section className="quick-lesson" aria-label={tr("Voyager ensemble", undefined, uiLocale)}>
    <p className="quick-lead">{tr("Avance à ton rythme, retrouve tes amis et explore les défis du carnet quand tu en as envie.", undefined, uiLocale)}</p>
    <div className="rite-scene" data-scene="company"><InitiationScene scene="company" characterId={characterId} animated label={tr("Ton héros et un compagnon sur le chemin de la taverne" , undefined, uiLocale)}/></div>
    <div className="quick-facts"><p><strong>{tr("La couronne du mois", undefined, uiLocale)}</strong>{tr("Le joueur qui avance le plus dans le mois gagne un verre.", undefined, uiLocale)}</p><p><strong>{tr("La taverne t’attend", undefined, uiLocale)}</strong>{tr("Un emploi trouvé ? Ton héros y rejoint la fête.", undefined, uiLocale)}</p></div>
  </section>;
}
