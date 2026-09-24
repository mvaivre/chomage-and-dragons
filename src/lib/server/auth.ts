import { createHmac, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * Secrets of the group layer: hashed passwords and PINs, per-device tokens
 * kept only as hashes, and a signed cookie proving access to a group.
 * No accounts anywhere.
 */

const ROUNDS = 10;

export const hashSecret = (secret: string) => bcrypt.hash(secret, ROUNDS);
export const verifySecret = (secret: string, hash: string) => bcrypt.compare(secret, hash);

/** A device token is shown once; the server keeps its hash. */
export function issueDeviceToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

declare global {
  // Route handlers and pages are bundled apart: the fallback secret must be shared by the process.
  var __louchomageSessionSecret: string | undefined;
}

function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET;
  if (configured) return configured;
  if (!globalThis.__louchomageSessionSecret) {
    // Serverless instances must agree on the key, or visitors bounce back to the
    // password page. The database URL is a secret every instance shares.
    const database = process.env.DATABASE_URL;
    globalThis.__louchomageSessionSecret = database
      ? createHash("sha256").update(`louchomage-session:${database}`).digest("base64url")
      : randomBytes(32).toString("base64url");
    if (process.env.NODE_ENV === "production") console.warn("SESSION_SECRET is not set: using a key derived from DATABASE_URL.");
  }
  return globalThis.__louchomageSessionSecret;
}

const sign = (payload: string) => createHmac("sha256", sessionSecret()).update(payload).digest("base64url");

export const SESSION_MAX_AGE = 60 * 60 * 24 * 400;

export function sessionCookieName(groupId: string): string {
  return `cdg_${groupId.replace(/[^a-zA-Z0-9]/g, "")}`;
}

/** The cookie value: group id, issue time and a signature over both. */
export function createSessionValue(groupId: string, now = Date.now()): string {
  const payload = `${groupId}.${now}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionValue(value: string | undefined, groupId: string): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== groupId) return false;
  const expected = sign(`${parts[0]}.${parts[1]}`);
  const given = parts[2];
  if (expected.length !== given.length) return false;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return false;
  return Date.now() - Number(parts[1]) < SESSION_MAX_AGE * 1000;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}
