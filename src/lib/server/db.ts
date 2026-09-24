import { neon } from "@neondatabase/serverless";
import type { GameState } from "@/lib/data/types";

/**
 * The little the server needs from a database, behind one contract with two
 * implementations: Neon Postgres in production, an in-memory map when no
 * DATABASE_URL is set (development and browser tests). Nothing else in the
 * server code knows which one is running.
 */

export interface GroupRow {
  id: string;
  slug: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

export interface ActionRow {
  groupId: string;
  playerId: string | null;
  action: unknown;
  version: number;
  at: string;
}

export interface Db {
  createGroup(group: GroupRow, state: GameState): Promise<void>;
  findGroupBySlug(slug: string): Promise<GroupRow | null>;
  findGroupById(id: string): Promise<GroupRow | null>;
  loadState(groupId: string): Promise<{ state: GameState; version: number } | null>;
  /** Just the version, for polls that usually find nothing new. */
  loadVersion(groupId: string): Promise<number | null>;
  /** Compare-and-set: false when someone else saved first. */
  saveState(groupId: string, expectedVersion: number, state: GameState, at: string): Promise<boolean>;
  appendAction(row: ActionRow): Promise<void>;
  saveDeviceToken(tokenHash: string, groupId: string, playerId: string, at: string): Promise<void>;
  findDeviceToken(tokenHash: string): Promise<{ groupId: string; playerId: string } | null>;
  revokeDeviceTokens(groupId: string, playerId: string): Promise<void>;
  savePin(groupId: string, playerId: string, pinHash: string): Promise<void>;
  findPin(groupId: string, playerId: string): Promise<string | null>;
  deletePlayerSecrets(groupId: string, playerId: string): Promise<void>;
}

export const SCHEMA = `
create table if not exists groups (
  id uuid primary key,
  slug text unique not null,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null
);
create table if not exists game_states (
  group_id uuid primary key references groups(id) on delete cascade,
  version integer not null,
  state jsonb not null,
  updated_at timestamptz not null
);
create table if not exists actions (
  id bigserial primary key,
  group_id uuid not null references groups(id) on delete cascade,
  player_id text,
  action jsonb not null,
  version integer not null,
  at timestamptz not null
);
create table if not exists device_tokens (
  token_hash text primary key,
  group_id uuid not null references groups(id) on delete cascade,
  player_id text not null,
  created_at timestamptz not null
);
create index if not exists device_tokens_player on device_tokens (group_id, player_id);
create table if not exists player_pins (
  group_id uuid not null references groups(id) on delete cascade,
  player_id text not null,
  pin_hash text not null,
  primary key (group_id, player_id)
);
`;

/** Development and tests: everything lives in the server process. */
export function createMemoryDb(): Db {
  const groups = new Map<string, GroupRow>();
  const states = new Map<string, { state: GameState; version: number }>();
  const actions: ActionRow[] = [];
  const tokens = new Map<string, { groupId: string; playerId: string }>();
  const pins = new Map<string, string>();
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  return {
    async createGroup(group, state) {
      groups.set(group.id, { ...group });
      states.set(group.id, { state: clone(state), version: 1 });
    },
    async findGroupBySlug(slug) {
      return [...groups.values()].find((g) => g.slug === slug) ?? null;
    },
    async findGroupById(id) {
      return groups.get(id) ?? null;
    },
    async loadState(groupId) {
      const row = states.get(groupId);
      return row ? { state: clone(row.state), version: row.version } : null;
    },
    async loadVersion(groupId) {
      return states.get(groupId)?.version ?? null;
    },
    async saveState(groupId, expectedVersion, state) {
      const row = states.get(groupId);
      if (!row || row.version !== expectedVersion) return false;
      states.set(groupId, { state: clone(state), version: expectedVersion + 1 });
      return true;
    },
    async appendAction(row) {
      actions.push(clone(row));
    },
    async saveDeviceToken(tokenHash, groupId, playerId) {
      tokens.set(tokenHash, { groupId, playerId });
    },
    async findDeviceToken(tokenHash) {
      return tokens.get(tokenHash) ?? null;
    },
    async revokeDeviceTokens(groupId, playerId) {
      for (const [hash, owner] of tokens) if (owner.groupId === groupId && owner.playerId === playerId) tokens.delete(hash);
    },
    async savePin(groupId, playerId, pinHash) {
      pins.set(`${groupId}/${playerId}`, pinHash);
    },
    async findPin(groupId, playerId) {
      return pins.get(`${groupId}/${playerId}`) ?? null;
    },
    async deletePlayerSecrets(groupId, playerId) {
      pins.delete(`${groupId}/${playerId}`);
      for (const [hash, owner] of tokens) if (owner.groupId === groupId && owner.playerId === playerId) tokens.delete(hash);
    },
  };
}

/** Neon over HTTP: one round trip per query, no connection to keep alive. */
export function createNeonDb(connectionString: string): Db {
  const sql = neon(connectionString);
  let ready: Promise<void> | null = null;
  const ensureSchema = () => {
    ready ??= (async () => {
      for (const statement of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) await sql.query(statement);
    })();
    return ready;
  };
  const toGroup = (row: Record<string, unknown>): GroupRow => ({
    id: String(row.id), slug: String(row.slug), name: String(row.name), passwordHash: String(row.password_hash), createdAt: new Date(String(row.created_at)).toISOString(),
  });
  return {
    async createGroup(group, state) {
      await ensureSchema();
      await sql.query("insert into groups (id, slug, name, password_hash, created_at) values ($1, $2, $3, $4, $5)", [group.id, group.slug, group.name, group.passwordHash, group.createdAt]);
      await sql.query("insert into game_states (group_id, version, state, updated_at) values ($1, 1, $2, $3)", [group.id, JSON.stringify(state), group.createdAt]);
    },
    async findGroupBySlug(slug) {
      await ensureSchema();
      const rows = await sql.query("select * from groups where slug = $1", [slug]);
      return rows[0] ? toGroup(rows[0] as Record<string, unknown>) : null;
    },
    async findGroupById(id) {
      await ensureSchema();
      const rows = await sql.query("select * from groups where id = $1", [id]);
      return rows[0] ? toGroup(rows[0] as Record<string, unknown>) : null;
    },
    async loadState(groupId) {
      await ensureSchema();
      const rows = await sql.query("select state, version from game_states where group_id = $1", [groupId]);
      const row = rows[0] as { state: GameState; version: number } | undefined;
      return row ? { state: row.state, version: Number(row.version) } : null;
    },
    async loadVersion(groupId) {
      await ensureSchema();
      const rows = await sql.query("select version from game_states where group_id = $1", [groupId]);
      const row = rows[0] as { version: number } | undefined;
      return row ? Number(row.version) : null;
    },
    async saveState(groupId, expectedVersion, state, at) {
      const rows = await sql.query(
        "update game_states set state = $1, version = version + 1, updated_at = $2 where group_id = $3 and version = $4 returning version",
        [JSON.stringify(state), at, groupId, expectedVersion],
      );
      return rows.length === 1;
    },
    async appendAction(row) {
      await sql.query("insert into actions (group_id, player_id, action, version, at) values ($1, $2, $3, $4, $5)", [row.groupId, row.playerId, JSON.stringify(row.action), row.version, row.at]);
    },
    async saveDeviceToken(tokenHash, groupId, playerId, at) {
      await sql.query("insert into device_tokens (token_hash, group_id, player_id, created_at) values ($1, $2, $3, $4)", [tokenHash, groupId, playerId, at]);
    },
    async findDeviceToken(tokenHash) {
      await ensureSchema();
      const rows = await sql.query("select group_id, player_id from device_tokens where token_hash = $1", [tokenHash]);
      const row = rows[0] as { group_id: string; player_id: string } | undefined;
      return row ? { groupId: row.group_id, playerId: row.player_id } : null;
    },
    async revokeDeviceTokens(groupId, playerId) {
      await sql.query("delete from device_tokens where group_id = $1 and player_id = $2", [groupId, playerId]);
    },
    async savePin(groupId, playerId, pinHash) {
      await sql.query("insert into player_pins (group_id, player_id, pin_hash) values ($1, $2, $3) on conflict (group_id, player_id) do update set pin_hash = excluded.pin_hash", [groupId, playerId, pinHash]);
    },
    async findPin(groupId, playerId) {
      const rows = await sql.query("select pin_hash from player_pins where group_id = $1 and player_id = $2", [groupId, playerId]);
      const row = rows[0] as { pin_hash: string } | undefined;
      return row ? row.pin_hash : null;
    },
    async deletePlayerSecrets(groupId, playerId) {
      await sql.query("delete from player_pins where group_id = $1 and player_id = $2", [groupId, playerId]);
      await sql.query("delete from device_tokens where group_id = $1 and player_id = $2", [groupId, playerId]);
    },
  };
}

declare global {
  // The memory database must survive hot reloads in development, hence the global.
  var __louchomageDb: Db | undefined;
}

/** Neon when configured, otherwise the process-local memory database. */
export function getDb(): Db {
  if (!globalThis.__louchomageDb) {
    const url = process.env.DATABASE_URL;
    globalThis.__louchomageDb = url ? createNeonDb(url) : createMemoryDb();
    if (!url && process.env.NODE_ENV === "production") console.warn("DATABASE_URL is not set: groups live in memory and vanish with the process.");
  }
  return globalThis.__louchomageDb;
}
