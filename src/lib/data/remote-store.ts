import type { GameState } from "./types";
import type { ActionContext, ActionResult, GameAction } from "@/lib/game/reducer";

/**
 * The device's window onto a group's game on the server. It keeps the
 * per-device token that proves which character this browser plays, and
 * speaks the small JSON API of /api/groups.
 */

export interface RemoteSnapshot {
  state: GameState;
  version: number;
  name: string;
  /** The player this device's token stands for, as the server sees it. */
  me: string | null;
}

export interface RemoteApplied<A extends GameAction> {
  state: GameState;
  version: number;
  result: ActionResult<A>;
  deviceToken?: string;
}

export class RemoteError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(input: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, { ...init, headers: { "content-type": "application/json", ...init.headers }, cache: "no-store" });
  } catch {
    throw new RemoteError(0, "Pas de réseau. Tes actions attendront la reconnexion.");
  }
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new RemoteError(response.status, body.error ?? "Le serveur a trébuché.");
  return body;
}

export class RemoteStore {
  readonly slug: string;
  private readonly tokenKey: string;

  constructor(slug: string) {
    this.slug = slug;
    this.tokenKey = `louchomage:jeton:${slug}`;
  }

  token(): string | null {
    try {
      return window.localStorage.getItem(this.tokenKey);
    } catch {
      return null;
    }
  }

  setToken(token: string | null): void {
    try {
      if (token) window.localStorage.setItem(this.tokenKey, token);
      else window.localStorage.removeItem(this.tokenKey);
    } catch {
      // Sans mémoire locale, il faudra ressaisir le PIN à la prochaine visite.
    }
  }

  private headers(): Record<string, string> {
    const token = this.token();
    return token ? { "x-player-token": token } : {};
  }

  private url(path = ""): string {
    return `/api/groups/${encodeURIComponent(this.slug)}${path}`;
  }

  load(): Promise<RemoteSnapshot> {
    return call<RemoteSnapshot>(this.url(), { headers: this.headers() });
  }

  /** Null when the server still holds the version we know. */
  async poll(version: number): Promise<RemoteSnapshot | null> {
    const body = await call<RemoteSnapshot & { unchanged?: boolean }>(this.url(`?version=${version}`), { headers: this.headers() });
    return body.unchanged ? null : body;
  }

  async dispatch<A extends GameAction>(action: A, context: ActionContext, extras: { pin?: string } = {}): Promise<RemoteApplied<A>> {
    const applied = await call<RemoteApplied<A>>(this.url("/actions"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ action, context: { id: context.id(), now: context.now() }, ...extras }),
    });
    if (applied.deviceToken) this.setToken(applied.deviceToken);
    return applied;
  }

  async claim(playerId: string, pin: string): Promise<void> {
    const body = await call<{ deviceToken: string }>(this.url("/claim"), { method: "POST", body: JSON.stringify({ playerId, pin }) });
    this.setToken(body.deviceToken);
  }
}

export async function createGroup(name: string, password: string): Promise<{ slug: string; name: string }> {
  return call("/api/groups", { method: "POST", body: JSON.stringify({ name, password }) });
}

export async function joinGroup(slug: string, password: string): Promise<{ slug: string; name: string }> {
  return call(`/api/groups/${encodeURIComponent(slug)}/join`, { method: "POST", body: JSON.stringify({ password }) });
}
