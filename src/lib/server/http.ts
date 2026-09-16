import { cookies } from "next/headers";
import { createSessionValue, SESSION_MAX_AGE, sessionCookieName, verifySessionValue } from "@/lib/server/auth";
import { getDb, type GroupRow } from "@/lib/server/db";
import { GroupError } from "@/lib/server/groups";

/** Shared plumbing of the route handlers: JSON bodies, errors, the group cookie. */

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof GroupError) return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  return Response.json({ error: "Le serveur a trébuché. Réessaie." }, { status: 500 });
}

export async function grantSession(group: GroupRow): Promise<void> {
  const store = await cookies();
  store.set(sessionCookieName(group.id), createSessionValue(group.id), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE,
  });
}

/** The group named in the URL, only if this browser holds a valid session for it. */
export async function requireGroup(slug: string): Promise<GroupRow> {
  const group = await getDb().findGroupBySlug(slug);
  if (!group) throw new GroupError(404, "Ce groupe n’existe pas.");
  const store = await cookies();
  if (!verifySessionValue(store.get(sessionCookieName(group.id))?.value, group.id)) throw new GroupError(401, "Entre d’abord le mot de passe du groupe.");
  return group;
}

export async function hasSession(group: GroupRow): Promise<boolean> {
  const store = await cookies();
  return verifySessionValue(store.get(sessionCookieName(group.id))?.value, group.id);
}

export function deviceToken(request: Request): string | null {
  return request.headers.get("x-player-token");
}
