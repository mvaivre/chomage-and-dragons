import type { MiniGameKind, MonsterKind } from "@/lib/data/types";

export type EncounterModel = MonsterKind | MiniGameKind | "ball";

export const STATIONS: Record<MiniGameKind, { title: string; line: string; play: string }> = {
  pigeon: { title: "Un nid de pigeons !", line: "Une livraison attend son pigeon. Il insiste pour voler à reculons.", play: "Prendre mon envol" },
  pigeonRace: { title: "Le départ des pigeons !", line: "Les concurrents roucoulent. La course va commencer.", play: "Prendre le départ" },
  slots: { title: "Une machine à sous apparaît !", line: "« Votre avenir mérite un petit investissement. »", play: "Tenter ma chance" },
  snake: { title: "Ça remue dans les CV…", line: "Un serpent administratif fait la queue depuis ce matin.", play: "Suivre le serpent" },
  stamp: { title: "Un guichet encore ouvert !", line: "Le tampon est prêt. Les justificatifs, beaucoup moins.", play: "Prendre le tampon" },
  keywords: { title: "Une pile de CV abandonnée !", line: "Le robot attend les bons mots. Les compétences viendront après.", play: "Présenter mon CV" },
  quiz: { title: "Un bureau d’entretien !", line: "« Installez-vous. Il n’y a pas de mauvaise réponse. Enfin… »", play: "Passer l’entretien" },
  dragon: { title: "Un dragon garde son butin !", line: "Il paraît qu’il recrute. Surtout pour son déjeuner.", play: "Défier le dragon" },
  paperCut: { title: "Un coupe-papier légendaire !", line: "Toute cette paperasse ne va pas se découper toute seule.", play: "Faire des confettis" },
  stack: { title: "Des dossiers menacent de tomber !", line: "Quelqu’un a classé le classement dans le mauvais classeur.", play: "Empiler les dossiers" },
  maze: { title: "Un plan de l’administration !", line: "Le bon guichet se trouve juste après les douze mauvais.", play: "Trouver la sortie" },
  pong: { title: "Une table de renvoi !", line: "« Ce dossier ne relève pas de notre service. » À toi de jouer.", play: "Renvoyer le dossier" },
  ghosting: { title: "Un ancien dossier", line: "Cette rencontre a quitté le chemin.", play: "Continuer" },
};
