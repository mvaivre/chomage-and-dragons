"use client";
import { VoxelPortrait } from "@/components/voxel/PortraitStudio";

export function CompanyLesson({ characterId }: { characterId: string }) {
  return <section className="quick-lesson" aria-label="Voyager ensemble">
    <p className="quick-lead">Avance à ton rythme, retrouve tes amis et explore les défis du carnet quand tu en as envie.</p>
    <div className="rite-scene" data-scene="company"><VoxelPortrait scene="company" characterId={characterId} animated label="Ton héros et un compagnon près d’un feu, devant la taverne illuminée" /></div>
    <div className="quick-facts"><p><strong>La couronne du mois</strong>Le joueur qui avance le plus dans le mois gagne un verre.</p><p><strong>La taverne t’attend</strong>Un emploi trouvé ? Ton héros y rejoint la fête.</p></div>
  </section>;
}
