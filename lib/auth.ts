import { cookies, headers } from "next/headers";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { type User } from "@/app/users/types";
import { type Factory } from "@/app/settings/types";

export const SESSION_COOKIE_NAME = "mesto_session";
export const SESSION_TTL_SECONDS = 400 * 24 * 60 * 60; // 400 days (RFC 6265bis browser maximum)
export const ROLLING_REFRESH_THRESHOLD_SECONDS = 24 * 60 * 60; // 1 day

export interface SessionData {
  user: User;
  factory: Factory;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = StatusCodes.UNAUTHORIZED,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Creates a persistent database session for the given user ID.
 */
export async function createSession(userId: number): Promise<{ token: string; expiresAt: string }> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  const { error } = await supabase.from("sessions").insert({
    token,
    user_id: userId,
    expires_at: expiresAt,
  });

  if (error) {
    throw new AuthError(
      `Failed to create session: ${error.message}`,
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  return { token, expiresAt };
}

/**
 * Validates a session token, performing rolling expiration updates on active use.
 * Returns both the current authenticated user and their factory configuration.
 */
export async function getSessionUser(token: string): Promise<SessionData | null> {
  if (!token) return null;

  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("sessions")
    .select(`
      id,
      token,
      expires_at,
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
    .eq("token", token)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (error || !data || !data.user) {
    return null;
  }

  // Rolling Refresh: If more than 1 day has passed, extend session by 400 days
  const remainingMs = new Date(data.expires_at).getTime() - Date.now();
  const maxMs = SESSION_TTL_SECONDS * 1000;
  const thresholdMs = ROLLING_REFRESH_THRESHOLD_SECONDS * 1000;

  if (maxMs - remainingMs > thresholdMs) {
    const rolledExpiresAt = new Date(Date.now() + maxMs).toISOString();
    await supabase.from("sessions").update({ expires_at: rolledExpiresAt }).eq("id", data.id);
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

  return { user, factory: rawUser.factory };
}

/**
 * Hard-deletes a session record from the database.
 */
export async function deleteSession(token: string): Promise<void> {
  if (!token) return;
  await supabase.from("sessions").delete().eq("token", token);
}

export const SESSION_HEADER_KEYS = [
  "x-user-id",
  "x-factory-id",
  "x-user-role",
  "x-user-name",
  "x-user-username",
  "x-user-created-at",
  "x-user-updated-at",
  "x-factory-name",
  "x-factory-receipt-images",
  "x-factory-created-at",
  "x-factory-updated-at",
] as const;

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
export async function getServerSession(req?: Request): Promise<SessionData | null> {
  if (req) {
    const session = parseSessionHeaders(req.headers);
    if (session) return session;
  }

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
 * Asserts an authenticated user session, throwing AuthError (401) if invalid or expired.
 */
export async function requireServerSession(req?: Request): Promise<SessionData> {
  const session = await getServerSession(req);
  if (!session) {
    throw new AuthError(
      "Session expired or invalid. Please log in again.",
      StatusCodes.UNAUTHORIZED,
    );
  }
  return session;
}
