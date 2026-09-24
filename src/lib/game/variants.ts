import type { ActionKind } from "@/lib/data/types";
import { mulberry32, seedFrom } from "@/lib/game/random";

/**
 * Every action has several stagings, from the usual one to a rare treat.
 * The pick depends only on the event id: every friend sees the same variant,
 * a reload shows it again, and the album can count what each player has seen.
 */

export type Rarity = "common" | "rare" | "legendary";

export interface Variant {
  id: string;
  action: ActionKind;
  name: string;
  rarity: Rarity;
}

export const VARIANTS: Record<ActionKind, Variant[]> = {
  candidature: [
    { id: "pigeon", action: "candidature", name: "Pigeon voyageur", rarity: "common" },
    { id: "pigeonSquadron", action: "candidature", name: "L’escadrille", rarity: "rare" },
    { id: "pigeonRocket", action: "candidature", name: "Pigeon fusée", rarity: "rare" },
    { id: "pigeonReceipt", action: "candidature", name: "Accusé de réception", rarity: "legendary" },
  ],
  refus: [
    { id: "lightning", action: "refus", name: "Coup de foudre", rarity: "common" },
    { id: "storm", action: "refus", name: "L’orage", rarity: "rare" },
    { id: "bigNo", action: "refus", name: "Le grand NON", rarity: "rare" },
    { id: "refusalAvalanche", action: "refus", name: "Avalanche de refus", rarity: "legendary" },
  ],
  entretien: [
    { id: "cocktail", action: "entretien", name: "Le cocktail", rarity: "common" },
    { id: "cocktailFireworks", action: "entretien", name: "Feu d’artifice de cocktails", rarity: "rare" },
    { id: "redCarpet", action: "entretien", name: "Tapis rouge", rarity: "rare" },
    { id: "gnomeBand", action: "entretien", name: "La fanfare des gnomes", rarity: "legendary" },
  ],
  rejetApresEntretien: [
    { id: "legendary", action: "rejetApresEntretien", name: "Le tampon légendaire", rarity: "common" },
    { id: "meteor", action: "rejetApresEntretien", name: "Le météore", rarity: "rare" },
    { id: "frogReader", action: "rejetApresEntretien", name: "Le crapaud lit la lettre", rarity: "rare" },
    { id: "mythicRejection", action: "rejetApresEntretien", name: "Quarante-sept lettres", rarity: "legendary" },
  ],
  embauche: [
    { id: "trophy", action: "embauche", name: "Le trophée", rarity: "common" },
    { id: "grandFireworks", action: "embauche", name: "Le grand feu d’artifice", rarity: "rare" },
    { id: "pigeonAscension", action: "embauche", name: "L’ascension des pigeons", rarity: "legendary" },
  ],
};

/** Chances of each rarity: six in ten common, three rare, one legendary. */
export const RARITY_ODDS: Record<Rarity, number> = { common: 0.6, rare: 0.3, legendary: 0.1 };

export function variantFor(eventId: string, action: ActionKind): Variant {
  const random = mulberry32(seedFrom(`variant:${eventId}`));
  const roll = random();
  const rarity: Rarity = roll < RARITY_ODDS.legendary ? "legendary" : roll < RARITY_ODDS.legendary + RARITY_ODDS.rare ? "rare" : "common";
  const pool = VARIANTS[action].filter((variant) => variant.rarity === rarity);
  const candidates = pool.length ? pool : VARIANTS[action];
  return candidates[Math.floor(random() * candidates.length)];
}

export const RARITY_LABELS: Record<Rarity, string> = { common: "Classique", rare: "Variante rare", legendary: "Légendaire" };
