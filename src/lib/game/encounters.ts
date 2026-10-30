import type { EncounterMove, GameEvent, GameState, MonsterKind, WildEncounter } from "@/lib/data/types";
import { mulberry32, seedFrom } from "@/lib/game/random";
import { journeyProgress } from "@/lib/game/scoring";
import { racePosition } from "@/lib/game/progress";
import { biomeAt, worldXFor } from "@/lib/game/world";

export const MONSTERS: Record<MonsterKind, { name: string; rareName: string; intro: string; attack: string; description: string; color: string }> = {
  cv: { name: "CV froissé", rareName: "CV doré", intro: "Un CV sauvage apparaît !", attack: "Trou dans le parcours", description: "Deux pages, trois langues et une expérience exigée depuis la naissance.", color: "#ddc98d" },
  orp: { name: "Conseiller ORP", rareName: "Conseiller ORP en vacances", intro: "Un Conseiller ORP sauvage apparaît !", attack: "Justificatif manquant", description: "Il lui manque toujours une pièce. Même quand tu lui apportes le puzzle entier.", color: "#799eac" },
  chair: { name: "Chaise de bureau", rareName: "Chaise vraiment ergonomique", intro: "Une Chaise de bureau sauvage apparaît !", attack: "Réunion interminable", description: "A assisté à 4 827 réunions. N’a toujours pas compris leur utilité.", color: "#bc899c" },
  coffee: { name: "Café de trop", rareName: "Décaféiné légendaire", intro: "Un Café de trop sauvage apparaît !", attack: "Palpitations", description: "Tu ne cherches plus un emploi. Tu entends les couleurs.", color: "#bb895a" },
  refusal: { name: "Lettre de refus", rareName: "Refus personnalisé", intro: "Une Lettre de refus sauvage apparaît !", attack: "Malgré la qualité de votre profil", description: "Elle a étudié ta candidature avec attention pendant exactement 0,03 seconde.", color: "#c37b6c" },
  doubt: { name: "Brume du doute", rareName: "Brume du lundi matin", intro: "Une Brume du doute sauvage apparaît !", attack: "À quoi bon", description: "Elle grossit quand on reste seul. Une pause et un peu de compagnie lui font perdre pied.", color: "#9b8cb2" },
  ai: { name: "IA du chômage éternel", rareName: "IA avec un bouton arrêt", intro: "Une IA sauvage apparaît !", attack: "Remplacement intégral", description: "Promet de mettre tout le monde au chômage pour toujours. Demande encore de l’aide pour ouvrir un PDF.", color: "#83bcaf" },
};
export const MONSTER_KINDS = Object.keys(MONSTERS) as MonsterKind[];
export const monsterName = (e: Pick<WildEncounter, "monster" | "rare">) => e.rare ? MONSTERS[e.monster].rareName : MONSTERS[e.monster].name;
export const activeEncounter = (e: WildEncounter) => e.status === "offered" || e.status === "battle";
export const captureChance = (hp: number) => hp <= 20 ? 1 : hp <= 40 ? .8 : hp <= 65 ? .4 : .1;
export const captureHint = (hp: number) => hp <= 20 ? "Prêt à être classé · capture assurée" : hp <= 40 ? "Vacille · capture facile" : hp <= 65 ? "Résiste encore · capture difficile" : "En pleine forme · affaiblis-le";
export const incomingHeavy = (e: Pick<WildEncounter, "turn">) => e.turn % 3 === 2;

/** Every third new journey offers one monster, replacing that journey's arcade halt. */
export function reserveEncounter(state: GameState, event: GameEvent): { state: GameState; encounter: WildEncounter | null } {
  const slot = state.events.filter(e => e.playerId === event.playerId && e.kind !== "embauche").length;
  if (event.kind === "embauche" || slot % 3 !== 2) return { state, encounter: null };
  if (state.encounters?.some(e => e.playerId === event.playerId && e.slot === slot)) return { state, encounter: null };
  // Do not stack unresolved encounters, including when another device logs an action.
  if (state.encounters?.some(e => e.playerId === event.playerId && activeEncounter(e) && state.events.some(ev => ev.id === e.eventId))) return { state, encounter: null };
  const steps = journeyProgress([...state.events, event].filter(e => e.playerId === event.playerId)).steps;
  const biome = biomeAt(worldXFor(racePosition(steps)));
  // A shuffled cycle visits every species before repeating. Each player starts at a different point in the cycle.
  const offset = seedFrom(event.playerId) % MONSTER_KINDS.length;
  const monster = MONSTER_KINDS[(Math.floor(slot / 3) + offset) % MONSTER_KINDS.length];
  const rare = seedFrom(`rare:${event.playerId}:${slot}`) % 12 === 0;
  const encounter: WildEncounter = { id: `${event.id}-wild`, playerId: event.playerId, eventId: event.id, slot, monster, rare, place: biome.name, at: event.at, status: "offered", hp: 100, energy: 100, turn: 0, balls: 3, braced: false, message: MONSTERS[monster].intro };
  return { state: { ...state, encounters: [...state.encounters ?? [], encounter] }, encounter };
}

/** The same seeded turn runs on the device and server; no client-supplied victory or species. */
export function playEncounter(state: GameState, encounterId: string, expectedTurn: number, move: EncounterMove, now: string): { state: GameState; encounter: WildEncounter | null; rejected?: string } {
  const encounter = state.encounters?.find(e => e.id === encounterId);
  const reject = (rejected: string) => ({ state, encounter: null, rejected });
  if (!encounter || !state.events.some(e => e.id === encounter.eventId && e.playerId === encounter.playerId)) return reject("unknown encounter");
  if (!activeEncounter(encounter) || encounter.turn !== expectedTurn) return reject("encounter already advanced");
  if (!["challenge", "argue", "polite", "rest", "capture", "leave"].includes(move)) return reject("unknown move");
  const e = { ...encounter };
  const name = monsterName(e);
  if (move === "leave") { e.status = "fled"; e.message = "Tu reprends ton chemin. Le dossier attendra."; }
  else if (e.status === "offered") {
    if (move !== "challenge") return reject("challenge not accepted");
    e.status = "battle"; e.message = `${name} te défie. Affaiblis-le, puis lance une chômageball !`;
  } else {
    if (move === "challenge") return reject("already battling");
    const random = mulberry32(seedFrom(`${e.id}:${e.turn}`));
    let message = "";
    if (move === "capture") {
      if (e.balls <= 0) return reject("no balls left");
      e.balls--;
      if (random() < captureChance(e.hp)) {
        e.status = "captured"; e.capturedAt = now;
        message = `${name} capturé ! Pour une fois, c’est toi qui conserves le dossier.`;
      } else message = `${name} s’échappe de la chômageball !`;
    } else if (move === "rest") {
      e.energy = Math.min(100, e.energy + 30); e.braced = true;
      message = "Pause syndicale. Tu reprends ton souffle et te prépares à encaisser.";
    } else {
      const damage = move === "argue" ? 28 : 18;
      e.hp = Math.max(1, e.hp - damage);
      e.braced = move === "polite";
      message = move === "argue" ? `Argument béton ! ${name} perd ${damage} points de résistance.` : `Relance polie ! ${name} perd ${damage} points de résistance. Tu gardes ton calme.`;
    }
    if (e.status === "battle") {
      const heavy = incomingHeavy(encounter);
      const damage = Math.round((heavy ? 28 : 14) * (e.braced ? .4 : 1));
      e.energy = Math.max(0, e.energy - damage); e.braced = false;
      message += ` ${name} utilise « ${MONSTERS[e.monster].attack} ». −${damage} énergie.`;
      if (e.energy === 0 || e.balls === 0) {
        e.status = "lost";
        message += e.energy === 0 ? " Besoin d’une pause. Tu reprends la route sans perdre de pas." : " Plus de chômageballs. Il file ; tu gardes tous tes pas.";
      }
    }
    e.message = message;
  }
  e.turn++;
  return { state: { ...state, encounters: state.encounters!.map(other => other.id === e.id ? e : other) }, encounter: e };
}
