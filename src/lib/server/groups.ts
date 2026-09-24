import { randomBytes, randomUUID } from "node:crypto";
import type { GameState, PowerCast } from "@/lib/data/types";
import { applyAction, type ActionContext, type ActionResult, type GameAction } from "@/lib/game/reducer";
import { hashSecret, hashToken, isValidPin, issueDeviceToken, verifySecret } from "@/lib/server/auth";
import type { Db, GroupRow } from "@/lib/server/db";

/**
 * Everything a group can do, as plain functions over the database contract:
 * the route handlers only parse requests and translate these results into
 * HTTP. Errors are values with a status, never thrown for expected cases.
 */

export class GroupError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const EMPTY_STATE: GameState = { players: [], events: [], casts: [], miniGames: [] };

export function slugify(name: string): string {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "groupe";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export function validateGroupName(name: unknown): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (trimmed.length < 2 || trimmed.length > 40) throw new GroupError(400, "Le nom du groupe fait entre 2 et 40 caractères.");
  return trimmed;
}

export function validatePassword(password: unknown): string {
  if (typeof password !== "string" || password.length < 4 || password.length > 72) throw new GroupError(400, "Le mot de passe fait entre 4 et 72 caractères.");
  return password;
}

export async function createGroup(db: Db, input: { name: unknown; password: unknown }, now = new Date()): Promise<GroupRow> {
  const name = validateGroupName(input.name);
  const password = validatePassword(input.password);
  const group: GroupRow = { id: randomUUID(), slug: slugify(name), name, passwordHash: await hashSecret(password), createdAt: now.toISOString() };
  await db.createGroup(group, EMPTY_STATE);
  return group;
}

/** Wrong passwords are throttled per group: five misses, then a minute of silence. */
const misses = new Map<string, { count: number; until: number }>();
export function noteMiss(key: string, now = Date.now()): void {
  const entry = misses.get(key) ?? { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= 5) { entry.until = now + 60_000; entry.count = 0; }
  misses.set(key, entry);
}
export function assertNotThrottled(key: string, now = Date.now()): void {
  const entry = misses.get(key);
  if (entry && entry.until > now) throw new GroupError(429, "Trop d’essais. Réessaie dans une minute.");
}
export function clearMisses(key: string): void {
  misses.delete(key);
}

export async function joinGroup(db: Db, slug: string, password: unknown): Promise<GroupRow> {
  const group = await db.findGroupBySlug(slug);
  if (!group) throw new GroupError(404, "Ce groupe n’existe pas.");
  assertNotThrottled(group.id);
  if (typeof password !== "string" || !(await verifySecret(password, group.passwordHash))) {
    noteMiss(group.id);
    throw new GroupError(403, "Mauvais mot de passe.");
  }
  clearMisses(group.id);
  return group;
}

export interface Snapshot {
  state: GameState;
  version: number;
}

export async function loadSnapshot(db: Db, groupId: string): Promise<Snapshot> {
  const row = await db.loadState(groupId);
  if (!row) throw new GroupError(404, "Partie introuvable.");
  return row;
}

/** Which player a device token stands for in this group, if any. */
export async function playerForToken(db: Db, groupId: string, token: string | null): Promise<string | null> {
  if (!token) return null;
  const owner = await db.findDeviceToken(hashToken(token));
  return owner && owner.groupId === groupId ? owner.playerId : null;
}

function castsTargeting(state: GameState, ids: string[]): PowerCast[] {
  const wanted = new Set(ids);
  return state.casts.filter((cast) => wanted.has(cast.id));
}

/** A member only ever acts for the character bound to their device. */
export function authorize(state: GameState, action: GameAction, tokenPlayer: string | null): void {
  const own = (playerId: string) => {
    if (tokenPlayer !== playerId) throw new GroupError(403, "Ce personnage n’est pas lié à cet appareil.");
  };
  switch (action.type) {
    case "addPlayer": return;
    case "addEvent":
    case "undoLast":
    case "castPower":
    case "removePlayer":
    case "cheer":
    case "dailyRun": return own(action.playerId);
    case "finishMiniGame": {
      const attempt = state.miniGames?.find((a) => a.id === action.attemptId);
      if (!attempt) throw new GroupError(404, "Tentative inconnue.");
      return own(attempt.playerId);
    }
    case "markCastSeen": {
      const cast = castsTargeting(state, [action.castId])[0];
      if (!cast) throw new GroupError(404, "Butin inconnu.");
      return own(cast.targetPlayerId);
    }
    case "settleShots": {
      for (const cast of castsTargeting(state, action.castIds)) own(cast.targetPlayerId);
      return;
    }
  }
}

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The device proposes ids and the instant, so its optimistic state matches the server's. */
export function validateContext(context: unknown, now = new Date()): ActionContext {
  const given = (context ?? {}) as { id?: unknown; now?: unknown };
  const id = typeof given.id === "string" && ID_PATTERN.test(given.id) ? given.id : randomUUID();
  const proposed = typeof given.now === "string" ? Date.parse(given.now) : NaN;
  const at = Number.isFinite(proposed) && Math.abs(proposed - now.getTime()) < 5 * 60_000 ? new Date(proposed).toISOString() : now.toISOString();
  return { id: () => id, now: () => at };
}

const ACTION_TYPES = new Set(["addEvent", "finishMiniGame", "castPower", "markCastSeen", "settleShots", "undoLast", "addPlayer", "removePlayer", "cheer", "dailyRun"]);

export function validateAction(action: unknown): GameAction {
  const given = action as { type?: unknown } | null;
  if (!given || typeof given !== "object" || typeof given.type !== "string" || !ACTION_TYPES.has(given.type)) throw new GroupError(400, "Action inconnue.");
  return given as GameAction;
}

export interface Applied<A extends GameAction> extends Snapshot {
  result: ActionResult<A>;
  /** Only when a player was just created: shown once, then kept as a hash. */
  deviceToken?: string;
}

/**
 * Apply one action to the group's state, with compare-and-set on the version:
 * when another device saved first, reload and apply again on the fresh state.
 */
export async function applyGroupAction<A extends GameAction>(db: Db, group: GroupRow, action: A, context: ActionContext, tokenPlayer: string | null, pin?: unknown): Promise<Applied<A>> {
  if (action.type === "addPlayer" && (typeof pin !== "string" || !isValidPin(pin))) throw new GroupError(400, "Choisis un code PIN de 4 à 6 chiffres.");
  for (let attempt = 0; attempt < 4; attempt++) {
    const snapshot = await loadSnapshot(db, group.id);
    authorize(snapshot.state, action, tokenPlayer);
    const applied = applyAction(snapshot.state, action, context);
    const rejected = (applied.result as { rejected?: string }).rejected;
    if (rejected) throw new GroupError(409, rejected);
    if (applied.state === snapshot.state) return { ...snapshot, result: applied.result };
    const saved = await db.saveState(group.id, snapshot.version, applied.state, context.now());
    if (!saved) continue;
    const version = snapshot.version + 1;
    await db.appendAction({ groupId: group.id, playerId: tokenPlayer, action, version, at: context.now() });
    let deviceToken: string | undefined;
    if (action.type === "addPlayer") {
      const created = (applied.result as ActionResult<Extract<GameAction, { type: "addPlayer" }>>).player;
      if (created) {
        await db.savePin(group.id, created.id, await hashSecret(pin as string));
        const issued = issueDeviceToken();
        await db.saveDeviceToken(issued.hash, group.id, created.id, context.now());
        deviceToken = issued.token;
      }
    }
    if (action.type === "removePlayer") await db.deletePlayerSecrets(group.id, action.playerId);
    return { state: applied.state, version, result: applied.result, deviceToken };
  }
  throw new GroupError(409, "La partie a changé pendant l’action. Réessaie.");
}

/** Bind a character to a new device with its PIN; earlier devices lose it. */
export async function claimPlayer(db: Db, group: GroupRow, playerId: unknown, pin: unknown, now = new Date()): Promise<string> {
  if (typeof playerId !== "string" || typeof pin !== "string") throw new GroupError(400, "Personnage et code PIN requis.");
  assertNotThrottled(`${group.id}/${playerId}`);
  const snapshot = await loadSnapshot(db, group.id);
  if (!snapshot.state.players.some((p) => p.id === playerId)) throw new GroupError(404, "Personnage inconnu.");
  const hash = await db.findPin(group.id, playerId);
  if (!hash || !(await verifySecret(pin, hash))) {
    noteMiss(`${group.id}/${playerId}`);
    throw new GroupError(403, "Mauvais code PIN.");
  }
  clearMisses(`${group.id}/${playerId}`);
  await db.revokeDeviceTokens(group.id, playerId);
  const issued = issueDeviceToken();
  await db.saveDeviceToken(issued.hash, group.id, playerId, now.toISOString());
  return issued.token;
}
