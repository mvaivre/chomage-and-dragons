import type { MiniGameKind, MonsterKind } from "@/lib/data/types";

export type EncounterModel = MonsterKind | MiniGameKind | "ball";
export interface EncounterBox { color: string; x: number; y: number; z: number; w: number; h: number; d: number }
/** Shared geometry: the actual roadside object and its sharp, lightweight journal illustration. */
export function encounterBoxes(kind: EncounterModel, rare = false): EncounterBox[] {
  const boxes: EncounterBox[] = [];
  const box = (color: string, x: number, y: number, z: number, w: number, h = w, d = w) => boxes.push({ color, x, y, z, w, h, d });
  const ink = "#293c3d", paper = rare ? "#f2ce64" : "#ede4c6", gold = "#d8b568", red = "#b75d57", green = "#718b64", wood = "#856346";
  const eyes = (y: number, z: number, gap = .38) => { for (const s of [-1, 1]) { box("#f6efdb", s * gap, y, z, .25, .3, .12); box(ink, s * gap + .04, y, z + .07, .12, .16, .06); } };
  const feet = () => { for (const s of [-1, 1]) box(ink, s * .6, .15, .2, .6, .3, .8); };
  const stack = () => { for (let i = 0; i < 6; i++) box(i % 2 ? paper : "#d2c9aa", (i % 3 - 1) * .13, .16 + i * .21, 0, 2.8, .18, 1.8); };
  const bird = (x: number, y: number, z: number) => {
    box("#8caba7", x, y + .25, z, .8, .6, .65); box("#b9c8bd", x + .3, y + .7, z, .5, .5, .5);
    box(gold, x + .65, y + .65, z, .3, .14, .2); box(ink, x + .4, y + .8, z + .26, .09, .09, .05);
    box("#647d7e", x - .12, y + .3, z + .34, .55, .2, .12);
  };
  switch (kind) {
    case "cv": case "refusal": {
      feet(); box(paper, 0, 1.7, 0, 1.9, 2.8, .3); box("#cfbd97", .8, 2.9, .04, .32, .4, .4);
      eyes(2.35, .2); box(ink, 0, 1.94, .2, .4, .1, .08);
      for (let i = 0; i < 4; i++) box(kind === "refusal" && i === 1 ? red : "#a49e86", -.1, 1.52 - i * .26, .19, 1.1 - i % 2 * .25, .08, .08);
      for (const s of [-1, 1]) box(paper, s * 1.15, 1.6, 0, .5, .25, .3);
      if (kind === "refusal") { box(red, .5, .65, .28, .5, .45, .12); box(paper, .5, .65, .36, .3, .08, .06); }
      break;
    }
    case "orp": {
      feet(); box(rare ? "#d9bf79" : "#688f9d", 0, 1.15, 0, 1.6, 1.7, .85); box("#deb994", 0, 2.5, 0, 1.15, 1.1, 1);
      box("#9a9b8e", 0, 3.03, -.08, 1.25, .24, 1.05); eyes(2.6, .53, .27);
      box(paper, 0, 1.7, .46, .4, .5, .12); box(red, 0, 1.25, .52, .17, .6, .1);
      box(paper, -1.05, 1.2, .2, .75, 1.1, .16); box(gold, 1.1, 1.3, .15, .55, .4, .5); break;
    }
    case "chair": {
      box(ink, 0, .25, 0, 2.5, .18, .25); box(ink, 0, .25, 0, .25, .18, 2.2); box("#919d9c", 0, .8, 0, .3, 1.2, .3);
      box(rare ? "#8fac85" : "#a4728d", 0, 1.5, .1, 1.9, .4, 1.65); box(rare ? "#8fac85" : "#a4728d", 0, 2.45, -.6, 1.9, 1.8, .4);
      eyes(2.65, -.34); for (const s of [-1, 1]) { box(ink, s * 1.15, 1.9, .15, .25, .8, .25); box(ink, s * 1.15, 2.28, .2, .35, .2, 1.1); for (const z of [-.8, .8]) box(ink, s * .9, .12, z, .4, .24, .4); } break;
    }
    case "coffee": {
      feet(); box(rare ? "#97b6a6" : "#ceab7e", 0, 1.3, 0, 1.6, 1.9, 1.4); box(paper, 0, 2.29, 0, 1.7, .18, 1.5); box("#66483a", 0, 2.4, 0, 1.35, .08, 1.15);
      box(paper, 1.08, 1.45, 0, .3, 1.1, .75); for (const y of [1, 1.9]) box(paper, .85, y, 0, .6, .2, .7);
      eyes(1.75, .74); box(ink, 0, 1.22, .75, .3, .15, .1);
      for (let i = 0; i < 3; i++) box("#c7d2bd", -.35 + i * .35, 2.72 + (i % 2) * .22, 0, .15, .4, .15); break;
    }
    case "doubt": {
      for (let i = 0; i < 4; i++) box(rare ? "#919ab4" : "#8e83a5", (i % 2 - .5) * .22, .5 + i * .65, 0, 2.5 - Math.abs(i - 1.5) * .45, .85, 1.6 - Math.abs(i - 1.5) * .2);
      eyes(2.05, .84); box(ink, 0, 1.56, .85, .4, .1, .1); for (const s of [-1, 1]) box("#b5a7c3", s * 1.3, .45, .1, .6, .45, .7); break;
    }
    case "ai": {
      feet(); box("#537977", 0, 1, -.1, .5, 1.5, .5); box(rare ? "#d2b46e" : "#729c99", 0, 2.2, 0, 2.5, 1.9, 1.2);
      box(ink, 0, 2.25, .66, 2.12, 1.45, .15); eyes(2.48, .77, .52); box("#96dfba", 0, 1.97, .79, .7, .1, .06);
      box(gold, 0, 3.35, 0, .15, .5, .15); box(red, 0, 3.65, 0, .28, .2, .28);
      for (const s of [-1, 1]) { box("#537977", s * 1.65, 1.7, 0, .9, .23, .3); box(paper, s * 2.02, 1.35, 0, .7, .9, .2); }
      if (rare) box(red, 1, 2.85, .75, .32, .32, .18); break;
    }
    case "ball": {
      box(paper, 0, .85, 0, 1.5, .7, 1.5); box(red, 0, 1.55, 0, 1.5, .7, 1.5); box(ink, 0, 1.2, 0, 1.6, .15, 1.6);
      box(gold, 0, 1.2, .85, .52, .52, .2); box(paper, 0, 1.2, .97, .25, .25, .1); break;
    }
    case "slots": {
      box(wood, 0, .25, 0, 2.5, .5, 1.8); box(red, 0, 1.7, 0, 2.3, 2.5, 1.5); box(gold, 0, 3.1, 0, 2.6, .5, 1.6);
      box(ink, 0, 2.1, .81, 2, 1.05, .15); for (let i = -1; i <= 1; i++) { box(paper, i * .62, 2.1, .91, .5, .76, .1); box(i === 0 ? red : green, i * .62, 2.1, .99, .25, .3, .08); }
      box(ink, 0, .9, .81, 1.4, .4, .1); box(gold, 1.5, 2.1, 0, .2, 1.2, .2); box(red, 1.5, 2.8, 0, .4, .4, .4); break;
    }
    case "pigeon": case "pigeonRace": {
      box(wood, 0, .4, 0, 3, .6, 2.5); for (const s of [-1, 1]) { box("#ae9665", s * 1.2, .85, 0, .35, .4, 2.5); box("#ae9665", 0, .85, s * 1.03, 2.5, .4, .35); }
      bird(-.5, .9, .15); bird(.65, .9, -.5); if (kind === "pigeonRace") { box(ink, 1.4, 1.8, -.7, .1, 2.5, .1); box(red, 1.8, 2.85, -.7, .9, .5, .12); } break;
    }
    case "snake": {
      stack(); for (const [x, z] of [[-1,.5],[0,.5],[1,.5],[1,-.3],[0,-.3],[-.6,-.3]]) box(green, x, 1.5, z, .8, .5, .65);
      box("#9aad6f", -.8, 1.95, -.3, .9, .65, .8); eyes(2.07, .12, .23); box(red, -.8, 1.77, .4, .15, .08, .4); break;
    }
    case "dragon": {
      box(green, 0, 1.05, 0, 1.5, 1.6, 1.4); box("#94aa78", 0, 2.1, .4, 1.6, 1, 1.5); eyes(2.3, 1.2);
      for (const s of [-1,1]) { box(gold, s * .6, 2.9, .3, .23, .8, .23); box("#ad9363", s * 1.3, 1.9, -.2, 1.6, .2, 1.5); } break;
    }
    case "stamp": {
      stack(); box(red, 0, 1.6, 0, 2, .5, 1.5); box(wood, 0, 2.2, 0, .5, 1, .5); box(gold, 0, 2.8, 0, 1.3, .35, .8); break;
    }
    case "quiz": {
      box(wood, 0, 1.05, 0, 3, .3, 1.7); for (const x of [-1.2,1.2]) box(wood, x, .5, 0, .3, 1, 1.3);
      box(paper, 0, 1.35, 0, 1.4, .12, 1.2); box("#9d87ab", .7, 2, -.4, .75, 1.2, .7); box(gold, .7, 2.75, -.4, .3, .3, .3); break;
    }
    case "pong": {
      box(green, 0, 1.3, 0, 3, .22, 2.3); for (const x of [-1.1,1.1]) box(wood, x, .6, 0, .3, 1.2, 1.5); box(paper, 0, 1.65, 0, .1, .6, 2.4); box(gold, .8, 1.7, .5, .22); break;
    }
    case "maze": {
      box(wood, 0, .2, 0, 3, .4, 2.5); for (let i = 0; i < 4; i++) { box(gold, i * .7 - 1, .8, -.8, .25, 1, 1.2 + i % 2 * .6); box(paper, i * .7 - 1, .8, .8, .6, 1, .2); } break;
    }
    default: {
      stack(); if (kind === "stack") { for (let i = 0; i < 4; i++) box(i % 2 ? red : green, (i % 2 - .5) * .4, 1.5 + i * .4, 0, 2 - i * .2, .38, 1.5); }
      else { box(wood, 1.2, 1.7, 0, .2, 2, .2); box(kind === "paperCut" ? "#b4c1bb" : gold, 1.2, 2.5, 0, kind === "paperCut" ? .6 : 1.2, .8, .2); } break;
    }
  }
  return boxes;
}

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
