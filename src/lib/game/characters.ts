/**
 * Les classes de Louchômage & Dragons.
 *
 * Chaque classe est une blague de recherche d'emploi déguisée en archétype de jeu
 * de rôle. La palette et la silhouette servent au personnage dessiné en code, qui
 * reste affiché tant que le sprite pixel-art n'est pas chargé.
 */

export type HatStyle =
  | "pointu"
  | "casque"
  | "capuche"
  | "couronne"
  | "plume"
  | "bandeau";

export type PropStyle =
  | "luth"
  | "baton"
  | "epee"
  | "dague"
  | "grimoire"
  | "lance";

export interface CharacterPalette {
  robe: number;
  robeDark: number;
  trim: number;
  skin: number;
}

export interface Character {
  id: string;
  /** Nom de classe, affiché sous le personnage et dans les classements. */
  name: string;
  /** Une ligne d'ambiance, lue à la sélection de personnage. */
  blurb: string;
  palette: CharacterPalette;
  hat: HatStyle;
  prop: PropStyle;
}

/** Ajouter une classe = ajouter une ligne ici, plus son sprite dans public/sprites. */
export const CHARACTERS: Character[] = [
  {
    id: "barde",
    name: "Barde du LinkedIn",
    blurb: "Chante ses propres louanges en public. Trois personnes ont aimé.",
    palette: { robe: 0xc85a7a, robeDark: 0x8e3a55, trim: 0xf0c96b, skin: 0xf1c9a5 },
    hat: "plume",
    prop: "luth",
  },
  {
    id: "sorciere",
    name: "Sorcière des Motivations",
    blurb: "Rédige la même lettre depuis quatre mois. Personne ne l'a lue.",
    palette: { robe: 0x6b4fa8, robeDark: 0x412f6b, trim: 0x9fd06a, skin: 0xe8bd97 },
    hat: "pointu",
    prop: "baton",
  },
  {
    id: "chevalier",
    name: "Chevalier de l'Intérim",
    blurb: "Loue son armure à la semaine, renouvelable une fois.",
    palette: { robe: 0x8d99ab, robeDark: 0x5c6675, trim: 0xd94f4f, skin: 0xefc6a0 },
    hat: "casque",
    prop: "epee",
  },
  {
    id: "voleur",
    name: "Voleur de Stages",
    blurb: "Dérobe des expériences non rémunérées dans l'ombre.",
    palette: { robe: 0x3f5a4a, robeDark: 0x263a2f, trim: 0xc0a860, skin: 0xdeb389 },
    hat: "capuche",
    prop: "dague",
  },
  {
    id: "archimage",
    name: "Archimage du Tableur",
    blurb: "Invoque des tableaux croisés dynamiques que nul ne comprend.",
    palette: { robe: 0x2f6f8f, robeDark: 0x1d475e, trim: 0x8fd7e8, skin: 0xf0cba6 },
    hat: "pointu",
    prop: "grimoire",
  },
  {
    id: "druidesse",
    name: "Druidesse du Télétravail",
    blurb: "Communie avec la nature depuis son salon, caméra coupée.",
    palette: { robe: 0x4f7f4a, robeDark: 0x2f5230, trim: 0xe0b64c, skin: 0xe9c19b },
    hat: "bandeau",
    prop: "baton",
  },
  {
    id: "paladin",
    name: "Paladin du CDI",
    blurb: "Croit encore au contrat à durée indéterminée. Touchant.",
    palette: { robe: 0xd8c48a, robeDark: 0xa08a52, trim: 0xf0c96b, skin: 0xf3ccaa },
    hat: "couronne",
    prop: "lance",
  },
  {
    id: "necromancien",
    name: "Nécromancien des CV",
    blurb: "Ranime des candidatures mortes depuis huit mois.",
    palette: { robe: 0x4a3f5c, robeDark: 0x2a2338, trim: 0x9fe0b0, skin: 0xd9d3c4 },
    hat: "capuche",
    prop: "baton",
  },
];

export function characterById(id: string): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
