import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { StatusCodes } from "http-status-codes";
import { LRUCache } from "lru-cache";
import { supabase } from "@/lib/supabase";
import { SESSION_HEADER_KEYS } from "@/lib/security";
import { type User } from "@/app/users/types";
import { type Factory } from "@/app/settings/types";

export const SESSION_COOKIE_NAME = "mesto_session";

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface SessionData {
  user: User;
  factory: Factory;
}

export const SESSION_TTL_SECONDS = 60 * 60 * 12; // D4
const CACHE_TTL_MS = 10_000;

// ponytail: per-instance cache (proxy and API routes don't share one); revocation lags <=10s. Shared cache if instant is needed.
const sessionCache = new LRUCache<string, SessionData>({ max: 5000, ttl: CACHE_TTL_MS });

export function sessionCutoffIso(): string {
  return new Date(Date.now() - SESSION_TTL_SECONDS * 1000).toISOString();
}

export function invalidateSessionCache(token: string): void {
  sessionCache.delete(token);
}

export function invalidateAllUserSessionCache(userId: number): void {
  for (const [token, session] of sessionCache.entries()) {
    if (session.user.id === userId) {
      sessionCache.delete(token);
    }
  }
}

export function updateFactorySessionCache(factoryId: number, updatedFactory: Factory): void {
  for (const [_token, session] of sessionCache.entries()) {
    if (session.factory.id === factoryId) {
      session.factory = updatedFactory;
    }
  }
}

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

export async function createSession(userId: number): Promise<{ token: string }> {
  const token = crypto.randomUUID();
  const tokenHash = hashSessionToken(token);

  const { error } = await supabase.from("sessions").insert({
    token_hash: tokenHash,
    user_id: userId,
  });

  if (error) {
    console.error("Failed to create session:", error);
    throw new AuthError("Failed to create session.", StatusCodes.INTERNAL_SERVER_ERROR);
  }

  return { token };
}

/** Null when the token is unknown, expired, or the user is soft-deleted. */
export async function getSessionUser(token: string): Promise<SessionData | null> {
  if (!token) return null;

  const cached = sessionCache.get(token);
  if (cached) {
    return cached;
  }

  const tokenHash = hashSessionToken(token);

  const { data, error } = await supabase
    .from("sessions")
    .select(`
      id,
      token_hash,
      created_at,
      user:users!user_id(
        id,
        username,
        name,
        role,
        factory_id,
        created_at,
        updated_at,
        deleted_at,
        factory:factories!factory_id(
          id,
          name,
          receipt_images_per_row,
          created_at,
          updated_at
        )
      )
    `)
    .eq("token_hash", tokenHash)
    .is("deleted_at", null)
    .gt("created_at", sessionCutoffIso())
    .maybeSingle();

  if (error || !data || !data.user) {
    return null;
  }

  const rawUser = data.user as unknown as {
    id: number;
    username: string;
    name: string;
    role: User["role"];
    factory_id: number;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    factory: Factory;
  };

  if (rawUser.deleted_at) {
    return null;
  }

  const user: User = {
    id: rawUser.id,
    username: rawUser.username,
    name: rawUser.name,
    role: rawUser.role,
    factory_id: rawUser.factory_id,
    created_at: rawUser.created_at,
    updated_at: rawUser.updated_at,
  };

  const sessionData: SessionData = { user, factory: rawUser.factory };
  sessionCache.set(token, sessionData);

  return sessionData;
}

export { SESSION_HEADER_KEYS };

export type SessionHeaderKey = (typeof SESSION_HEADER_KEYS)[number];

/** Null if any SESSION_HEADER_KEYS header is missing. */
export function parseSessionHeaders(headerSource: {
  get(name: string): string | null;
}): SessionData | null {
  const values = {} as Record<SessionHeaderKey, string>;
  for (const key of SESSION_HEADER_KEYS) {
    const val = headerSource.get(key);
    if (!val) return null;
    values[key] = val;
  }

  return {
    user: {
      id: parseInt(values["x-user-id"], 10),
      factory_id: parseInt(values["x-factory-id"], 10),
      role: values["x-user-role"] as User["role"],
      name: decodeURIComponent(values["x-user-name"]),
      username: values["x-user-username"],
      created_at: values["x-user-created-at"],
      updated_at: values["x-user-updated-at"],
    },
    factory: {
      id: parseInt(values["x-factory-id"], 10),
      name: decodeURIComponent(values["x-factory-name"]),
      receipt_images_per_row: parseInt(values["x-factory-receipt-images"], 10),
      created_at: values["x-factory-created-at"],
      updated_at: values["x-factory-updated-at"],
    },
  };
}

/**
 * Reads user identity and factory configuration injected into request headers by proxy.ts with zero database queries.
 * Throws AuthError (401) if headers are missing.
 */
export function getAuthSession(req: Request): SessionData {
  const session = parseSessionHeaders(req.headers);
  if (!session) {
    throw new AuthError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  return session;
}

/**
 * Extracts and verifies the current session in Next.js Server Components.
 * Reads request headers set by proxy.ts; falls back to session lookup only if headers are not set.
 */
export async function getServerSession(): Promise<SessionData | null> {
  const session = parseSessionHeaders(await headers());
  if (session) return session;

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return getSessionUser(token);
}
