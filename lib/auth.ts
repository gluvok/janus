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

const sessionCache = new LRUCache<string, SessionData>({
  max: 5000,
});

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

export function updateUserSessionCache(userId: number, updatedUser: User): void {
  for (const [_token, session] of sessionCache.entries()) {
    if (session.user.id === userId) {
      session.user = updatedUser;
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

/**
 * Creates a persistent database session for the given user ID.
 */
export async function createSession(userId: number): Promise<{ token: string }> {
  const token = crypto.randomUUID();
  const tokenHash = hashSessionToken(token);

  const { error } = await supabase.from("sessions").insert({
    token_hash: tokenHash,
    user_id: userId,
  });

  if (error) {
    throw new AuthError(
      `Failed to create session: ${error.message}`,
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  return { token };
}

/**
 * Validates a session token using in-memory LRU cache and read-only database query.
 * Returns both the current authenticated user and their factory configuration.
 */
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
    factory: Factory;
  };

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

/**
 * Extracts and validates session headers using a loop over SESSION_HEADER_KEYS.
 * Returns SessionData if all 11 headers exist, or null if any header is missing.
 */
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
 * Reads user identity injected into request headers by proxy.ts with zero database queries.
 * Throws AuthError (401) if headers are missing.
 */
export function getAuthUser(req: Request): User {
  return getAuthSession(req).user;
}

/**
 * Reads factory configuration injected into request headers by proxy.ts with zero database queries.
 * Throws AuthError (401) if headers are missing.
 */
export function getAuthFactory(req: Request): Factory {
  return getAuthSession(req).factory;
}

/**
 * Extracts and verifies the current session in Next.js Server Components.
 * Reads request headers set by proxy.ts; falls back to session lookup only if headers are not set.
 */
export async function getServerSession(): Promise<SessionData | null> {
  try {
    const headerList = await headers();
    const session = parseSessionHeaders(headerList);
    if (session) return session;
  } catch {
    // headers() might not be available
  }

  let token: string | undefined;
  try {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    // Cookie store unavailable
  }

  if (!token) return null;
  return getSessionUser(token);
}

/**
 * Asserts an authenticated user session in Server Components, throwing AuthError (401) if invalid or expired.
 */
export async function requireServerSession(): Promise<SessionData> {
  const session = await getServerSession();
  if (!session) {
    throw new AuthError("Unauthorized. Please log in again.", StatusCodes.UNAUTHORIZED);
  }
  return session;
}
