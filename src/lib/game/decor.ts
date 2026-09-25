import type { DailyRun, GameEvent, Player } from "@/lib/data/types";
import { mulberry32, seedFrom } from "@/lib/game/random";
import { BIOMES, WORLD_LENGTH } from "@/lib/game/world";
import { soleLeader, standings } from "@/lib/game/standings";
import { dailyRanking } from "@/lib/game/daily";

/** Words stay short enough to read on the road, including the narrowest camera. */
export const DECOR_TEXTS = {
  refusal: [
    "Profil trop qualifié", "Profil pas assez qualifié", "Vous n’avez pas coché la case",
    "Votre police déplaît au logiciel", "Nous cherchons quelqu’un de plus… autre",
    "Candidature reçue un mardi", "Votre enthousiasme manque de recul", "Votre recul manque d’enthousiasme",
    "Le poste était déjà pourvu", "Le poste n’a jamais existé", "Votre prénom dépasse du formulaire",
    "Merci de joindre le fichier joint", "Le logiciel préfère les logiciels", "Votre disponibilité nous inquiète",
    "Votre expérience date d’avant demain", "Le dragon interne a été promu", "Vous respirez hors des horaires",
    "La case motivation était carrée", "Votre diplôme manque de dorures", "Nous recrutons uniquement des recommandations",
    "Votre CV sent le papier", "Votre lettre contient des lettres", "La pièce jointe était trop jointe",
    "Votre parcours comporte un parcours", "Votre profil dépasse du cadre", "Nos valeurs viennent de changer",
    "Le budget est parti déjeuner", "Votre sourire manque de tableur", "Votre tableur manque de sourire",
    "Nous privilégions une absence d’expérience vécue", "Votre candidature est trop candidate",
    "Votre adresse contient une voyelle", "Le recruteur cherche encore son mot",
    "Votre ambition dépasse notre plafond", "Vous avez répondu à l’annonce", "Votre réseau comporte des humains",
    "L’algorithme a senti une émotion", "Votre lettre était trop personnelle", "Votre lettre était trop impersonnelle",
    "Nous cherchons un profil introuvable", "Votre ponctualité nous a surpris", "L’entretien précédait votre naissance",
    "Votre motivation manque de pièces justificatives", "Le formulaire exige une plume bleue",
    "Votre expérience ne rentre pas horizontalement", "Le comité consulte encore le comité",
    "Votre diplôme est trop lisible", "Le poste exige un autre poste", "Vous avez demandé le salaire",
    "Votre passion manque de justificatif", "Notre culture préfère les yaourts", "Votre candidature tombe entre deux budgets",
    "Le tampon est en congé", "La décision attend sa décision", "Le recruteur a oublié la question",
    "Votre reconversion tourne dans le mauvais sens", "Votre potentiel gêne le mobilier",
    "Votre disponibilité est trop immédiate", "Votre réponse contient une réponse", "Le stage exige un ancien stagiaire",
    "Votre polyvalence est trop variée", "Votre spécialité est trop précise", "Votre profil manque de profil",
    "Le poste est réservé au neveu", "Votre photo regarde le mauvais avenir", "Votre CV n’est pas assez circulaire",
    "Le service humain est automatisé", "Votre candidature nécessite une candidature",
    "Votre adresse manque de prestige postal", "La machine refuse les marges humaines",
    "Votre patience manque de certification", "Notre silence vaut entretien annuel", "Votre plume menace notre transformation numérique",
    "Votre diplôme expire pendant la pause", "Le poste demande quatre mains gauches",
    "Votre avenir ne correspond pas au planning", "Le recruteur a cliqué par habitude",
    "Vous avez lu toute l’annonce", "Votre CV manque de mots invisibles", "La direction cherche une autre direction",
    "Votre dossier a réussi trop tôt", "L’offre préfère rester une promesse", "Votre candidature dérange les statistiques",
    "Le pigeon n’avait pas de badge", "Votre lettre dépasse notre attention", "Votre humanité échoue au test automatique",
  ],
  direction: ["CDI → 4 382 km", "Stage non rémunéré ← 0 km", "Réponse humaine → prochain siècle", "Ascenseur social : prenez l’escalier", "Service compétent → ailleurs", "Réseautage ← tournez en rond"],
  offer: ["Junior, 10 ans d’expérience", "Salaire : la passion", "Avantage : une chaise", "Télétravail depuis le donjon", "Cherche stagiaire pour former la direction", "Équipe familiale, héritage non compris", "Poste évolutif vers la sortie", "Congés : selon prophétie"],
  wanted: ["Recherche personne sachant tout faire", "Avis de recherche : réponse humaine", "Disparu : budget formation", "Recherche expérience avant première expérience", "Dernière apparition du recruteur : lundi", "Recherche dragon sachant utiliser Excel"],
  epitaph: ["Ci-gît ma candidature spontanée", "Partie rejoindre le vivier", "Dossier complet, avenir en pièces", "Relance éternelle, réponse éventuelle", "Ici repose un fichier final", "Lu, oublié, archivé"],
  coach: ["Sors de ta zone de salaire", "Deviens ton propre département RH", "Visualise ton loyer payé", "Ton réseau est ton filet", "Réveille le tableur en toi", "Transforme tes refus en confettis"],
  influencer: ["J’ai transformé mon licenciement en contenu", "Abonne-toi à mon silence inspirant", "Ce miroir finance ma reconversion", "Ravi·e d’annoncer mon annonce", "Mon échec compte mille interactions", "Lien du bonheur en biographie"],
  orp: ["N° 000 · Votre numéro : 4 812", "Guichet fermé pour ouverture prochaine", "Veuillez patienter avant de patienter", "Votre attente est importante pour nous", "Prochain rendez-vous : après le prochain", "Justificatif de recherche du justificatif"],
  crowd: ["En attente de réponse depuis 2019", "Disponible depuis trois prophéties", "Le vivier déborde, nous aussi", "Toujours debout, dossier compris"],
} as const;

export type DecorKind = keyof typeof DECOR_TEXTS | "welcome" | "friend" | "grave" | "crown" | "daily" | "hired" | "setpiece";
export type InteriorId = "orp" | "factory";
export const INTERIORS: ReadonlyArray<{ id: InteriorId; biome: string; name: string; from: number; to: number }> = [
  { id: "orp", biome: "plaine", name: "Centre ORP", from: 1000, to: 2663.2 },
  { id: "factory", biome: "foret", name: "Usine à CV", from: 4300, to: 5963.2 },
];
export const DECOR_SPACING = 600;
/** Includes the landmark's silhouette (at most 178 wide) and half a sign. */
export const TRANSITION_CLEARANCE = 250;
export const INTERIOR_CLEARANCE = 150;

export function interiorAt(x: number) {
  if (x < 0) return undefined;
  const local = x % WORLD_LENGTH;
  return INTERIORS.find(room => local >= room.from && local <= room.to);
}

export function interiorsInRange(left: number, right: number) {
  const result: Array<(typeof INTERIORS)[number]> = [];
  for (let lap = Math.max(0, Math.floor(left / WORLD_LENGTH)); lap <= Math.floor(right / WORLD_LENGTH); lap++) {
    for (const room of INTERIORS) {
      const from = room.from + lap * WORLD_LENGTH, to = room.to + lap * WORLD_LENGTH;
      if (to >= left && from <= right) result.push({ ...room, from, to });
    }
  }
  return result;
}

export interface DecorSite {
  id: string;
  x: number;
  biome: string;
  kind: DecorKind;
  text: string;
  reaction: "none" | "turn" | "fall" | "change";
  setpiece?: boolean;
}

/** Safe intervals use only world coordinates: viewport and pixel density never enter. */
export function decorIntervals(): Array<[number, number]> {
  const blocked: Array<[number, number]> = [
    ...BIOMES.slice(0, -1).map(b => [b.to * WORLD_LENGTH - TRANSITION_CLEARANCE, b.to * WORLD_LENGTH + TRANSITION_CLEARANCE] as [number, number]),
    ...INTERIORS.map(r => [r.from - INTERIOR_CLEARANCE, r.to + INTERIOR_CLEARANCE] as [number, number]),
  ].sort((a, b) => a[0] - b[0]);
  const intervals: Array<[number, number]> = [];
  let start = 160;
  for (const [from, to] of blocked) {
    if (from > start) intervals.push([start, from]);
    start = Math.max(start, to);
  }
  intervals.push([start, WORLD_LENGTH - 440]);
  return intervals;
}

/** Packed before drawing, with a small seeded slack; 40 stops per 200-step lap. */
export function decorForLap(lap: number): DecorSite[] {
  const cycle = Math.max(0, Math.floor(lap));
  const random = mulberry32(seedFrom(`decor-v1:${cycle}`));
  const sites: DecorSite[] = [];
  const categories = ["refusal", "direction", "refusal", "offer", "wanted", "epitaph", "coach", "influencer"] as const;
  let previous = -DECOR_SPACING;
  for (const [from, to] of decorIntervals()) {
    for (let x = Math.max(from + 1, previous + DECOR_SPACING) + Math.floor(random() * 9); x < to; x += DECOR_SPACING + Math.floor(random() * 9)) {
      const biome = BIOMES.find(b => x >= b.from * WORLD_LENGTH && x < b.to * WORLD_LENGTH)!;
      const kind = categories[Math.floor(random() * categories.length)];
      const texts = DECOR_TEXTS[kind];
      sites.push({ id: `${cycle}:${sites.length}`, x: x + cycle * WORLD_LENGTH, biome: biome.id, kind,
        text: texts[Math.floor(random() * texts.length)], reaction: (["none", "turn", "fall", "change"] as const)[sites.length % 4] });
      previous = x;
    }
  }
  const count = new Map<string, number>();
  return sites.map((original, siteIndex) => {
    const site = cycle === 0 && siteIndex === 0 ? { ...original, x: 0 } : original;
    const index = count.get(site.biome) ?? 0;
    count.set(site.biome, index + 1);
    const target = site.biome === "plaine" ? 0 : site.biome === "foret" ? sites.filter(s => s.biome === "foret").length - 1 : 1;
    return { ...site, setpiece: index === target };
  });
}

type DecorPlayer = Pick<Player, "id" | "name" | "characterId" | "hiredAt">;
export interface DecorGroup {
  players: readonly DecorPlayer[];
  events: readonly GameEvent[];
  daily: readonly DailyRun[];
  /** Explicit Zurich calendar keys, shared by all selectors. No clock inside this module. */
  day: string;
  month: string;
}
export interface GroupDecor {
  friends: string[];
  graves: Array<{ eventId: string; text: string }>;
  crown: { text: string; characterId?: string };
  daily: string;
  hired: string[];
}

/** A name remains recognisable without allowing one long name to shrink every sign. */
function shortName(name: string): string { return Array.from(name.trim().split(/\s+/)[0] || "Ami·e").slice(0, 18).join(""); }

export function groupDecor(group: DecorGroup): GroupDecor {
  const players = [...group.players].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const names = new Map(players.map(p => [p.id, shortName(p.name)]));
  const leader = soleLeader(standings([...group.events], players.map(p => ({ ...p, joinedAt: "" })), group.month));
  const champion = dailyRanking([...group.daily].filter(r => !r.pending && names.has(r.playerId)), group.day)[0];
  const winner = players.find(p => p.id === leader?.playerId);
  // Recent means the last eight refusals of the group, stable even in an old save.
  const graves = group.events.filter(e => names.has(e.playerId) && (e.kind === "refus" || e.kind === "rejetApresEntretien"))
    .sort((a, b) => a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? -1 : 1).slice(0, 8)
    .map(e => ({ eventId: e.id, text: `${names.get(e.playerId)} · Une candidature repose ici` }));
  return {
    friends: players.map(p => `${names.get(p.id)} est passé·e ici. Respect.`),
    graves,
    crown: winner ? { text: `Couronne du mois · ${names.get(winner.id)}`, characterId: winner.characterId } : { text: "Couronne du mois · Gloire à partager" },
    daily: champion ? `Défi du jour · Bravo ${names.get(champion.playerId)}` : "Défi du jour · La gloire attend",
    hired: players.filter(p => p.hiredAt).map(p => `${names.get(p.id)} · Engagé·e, toujours de la compagnie`),
  };
}

/** Personalisation changes the contents, never the spacing or the deterministic world. */
export function personaliseDecor(sites: readonly DecorSite[], group: GroupDecor): DecorSite[] {
  let friend = 0, grave = 0;
  const tavernStart = sites.findIndex(s => s.biome === "taverne");
  return sites.map((site, index) => {
    if (site.id === "0:0" || site.id === "0:1") return { ...site, kind: "welcome", reaction: "none", text: site.id === "0:0" ? "Bienvenue dans la quête du CDI" : "Ici, les refus font avancer" };
    const page = index - tavernStart;
    if (site.biome === "taverne" && page < Math.max(1, Math.ceil(group.hired.length / 3))) {
      const names = group.hired.slice(page * 3, page * 3 + 3).map(text => text.split(" · ")[0]);
      return { ...site, kind: "hired", text: names.join(" · ") || "La prochaine tournée vous attend" };
    }
    if (index === 0 && group.friends.length) return { ...site, kind: "friend", text: group.friends[friend++ % group.friends.length] };
    if (index === 2) return { ...site, kind: "crowd", text: DECOR_TEXTS.crowd[0] };
    if (index === 9) return { ...site, kind: "crown", text: group.crown.text };
    if (index === 31) return { ...site, kind: "daily", text: group.daily };
    if (site.biome === "marais" || site.biome === "cascade") {
      const entry = group.graves[grave++];
      if (entry) return { ...site, kind: "grave", text: entry.text };
    }
    if (index % 7 === 0 && group.friends.length) return { ...site, kind: "friend", text: group.friends[friend++ % group.friends.length] };
    return site;
  });
}
