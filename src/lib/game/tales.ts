import type { ActionKind, GameEvent } from "@/lib/data/types";
import { mulberry32, seedFrom } from "@/lib/game/random";

/**
 * The random events of the pitch: a stroke of luck, an HR mini-boss, an
 * absurdity of recruiting. Purely narrative, they never touch points or steps.
 * Drawn from the event id, so the same action tells the same tale everywhere
 * and forever, as the pitch requires.
 */

export type TaleKind = "luck" | "boss" | "absurd";

export interface Tale {
  id: string;
  kind: TaleKind;
  title: string;
  text: string;
  /** Actions it fits; empty means any. */
  after?: readonly ActionKind[];
}

export const TALES: readonly Tale[] = [
  { id: "linkedin-like", kind: "luck", title: "Un like inattendu", text: "Un recruteur a aimé ton post. Il ne lira jamais ton CV, mais c’est un début." },
  { id: "coffee", kind: "luck", title: "Café offert", text: "La conseillère de l’ORP t’a offert un café. Il était froid. Le geste compte." },
  { id: "ats-bug", kind: "luck", title: "Le robot a buggé", text: "Le robot trieur a laissé passer ton CV par erreur. Quelqu’un l’a ouvert. Quatre secondes." },
  { id: "network", kind: "luck", title: "Le cousin d’un ami", text: "Le cousin d’un ami connaît quelqu’un qui a entendu parler d’un poste. Probablement." },
  { id: "sunny", kind: "luck", title: "Grand soleil", text: "Il fait beau. Aucun recruteur n’a écrit, mais il fait beau." },
  { id: "boss-hydra", kind: "boss", title: "L’Hydre des ressources humaines", text: "Coupe une tête, trois formulaires repoussent. Elle retourne à sa pause café.", after: ["entretien", "rejetApresEntretien"] },
  { id: "boss-gatekeeper", kind: "boss", title: "Le Gardien du Standard", text: "« Je transmets. » Il ne transmettra pas. Il ne transmet jamais.", after: ["candidature", "refus"] },
  { id: "boss-ats", kind: "boss", title: "L’ATS-9000", text: "Ton CV a été scanné, pondéré, archivé, oublié. En 0,3 seconde." },
  { id: "boss-ghost", kind: "boss", title: "Le Fantôme du Recruteur", text: "Il a vu ton message. Il le verra encore. Il ne répondra jamais.", after: ["rejetApresEntretien", "entretien"] },
  { id: "absurd-intern", kind: "absurd", title: "Stage, dix ans d’expérience", text: "Une offre de stage exige dix ans d’expérience et un permis poids lourd." },
  { id: "absurd-family", kind: "absurd", title: "Une grande famille", text: "L’annonce promet « une grande famille ». Tu comptes déjà les repas de Noël obligatoires." },
  { id: "absurd-rockstar", kind: "absurd", title: "Rockstar recherché·e", text: "On cherche une rockstar du tableur. Salaire : l’amour du métier." },
  { id: "absurd-test", kind: "absurd", title: "Test de huit heures", text: "Le « petit exercice » à rendre demain ressemble fort à leur projet client." },
  { id: "absurd-mission", kind: "absurd", title: "Mission : disrupter", text: "Le poste consiste à disrupter la disruption. Personne n’a su expliquer." },
  { id: "absurd-competitive", kind: "absurd", title: "Salaire compétitif", text: "Compétitif avec quoi, l’annonce ne le dit pas." },
];

/** One action in eight tells a tale. */
export const TALE_CHANCE = 1 / 8;

export function taleFor(event: Pick<GameEvent, "id" | "kind">): Tale | null {
  if (event.kind === "embauche") return null;
  const random = mulberry32(seedFrom(`tale:${event.id}`));
  if (random() >= TALE_CHANCE) return null;
  const pool = TALES.filter((tale) => !tale.after || tale.after.includes(event.kind));
  return pool[Math.floor(random() * pool.length)];
}

export const TALE_LABELS: Record<TaleKind, string> = { luck: "Coup de chance", boss: "Mini-boss RH", absurd: "Absurdité du recrutement" };
