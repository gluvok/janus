import { cookies, headers } from "next/headers";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { type User } from "@/app/users/types";

export const SESSION_COOKIE_NAME = "mesto_session";
export const SESSION_TTL_SECONDS = 400 * 24 * 60 * 60; // 400 days (RFC 6265bis browser maximum)
export const ROLLING_REFRESH_THRESHOLD_SECONDS = 24 * 60 * 60; // 1 day

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
 */
export async function getSessionUser(token: string): Promise<User | null> {
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
        updated_at
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

  return data.user as unknown as User;
}

/**
 * Hard-deletes a session record from the database.
 */
export async function deleteSession(token: string): Promise<void> {
  if (!token) return;
  await supabase.from("sessions").delete().eq("token", token);
}

/**
 * Reads user identity injected into request headers by proxy.ts with zero database queries.
 * Throws AuthError (401) if headers are missing.
 */
export function getAuthUser(req: Request): User {
  const userIdStr = req.headers.get("x-user-id");
  const factoryIdStr = req.headers.get("x-factory-id");
  const role = req.headers.get("x-user-role");
  const encodedName = req.headers.get("x-user-name");
  const username = req.headers.get("x-user-username");
  const createdAt = req.headers.get("x-user-created-at") || "";
  const updatedAt = req.headers.get("x-user-updated-at") || "";

  if (!userIdStr || !factoryIdStr || !role || !username) {
    throw new AuthError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const name = encodedName ? decodeURIComponent(encodedName) : "";

  return {
    id: parseInt(userIdStr, 10),
    factory_id: parseInt(factoryIdStr, 10),
    role: role as User["role"],
    name,
    username,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

/**
 * Extracts and verifies the current session user in Next.js Server Components.
 * Reads request headers set by proxy.ts; falls back to session lookup only if headers are not set.
 */
export async function getServerSession(req?: Request): Promise<User | null> {
  if (req) {
    const userIdStr = req.headers.get("x-user-id");
    if (userIdStr) {
      try {
        return getAuthUser(req);
      } catch {
        return null;
      }
    }
  }

  try {
    const headerList = await headers();
    const userIdStr = headerList.get("x-user-id");
    if (userIdStr) {
      const factoryIdStr = headerList.get("x-factory-id");
      const role = headerList.get("x-user-role");
      const encodedName = headerList.get("x-user-name");
      const username = headerList.get("x-user-username");
      const createdAt = headerList.get("x-user-created-at") || "";
      const updatedAt = headerList.get("x-user-updated-at") || "";

      if (userIdStr && factoryIdStr && role && username) {
        return {
          id: parseInt(userIdStr, 10),
          factory_id: parseInt(factoryIdStr, 10),
          role: role as User["role"],
          name: encodedName ? decodeURIComponent(encodedName) : "",
          username,
          created_at: createdAt,
          updated_at: updatedAt,
        };
      }
    }
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
export async function requireServerSession(req?: Request): Promise<User> {
  const user = await getServerSession(req);
  if (!user) {
    throw new AuthError(
      "Session expired or invalid. Please log in again.",
      StatusCodes.UNAUTHORIZED,
    );
  }
  return user;
}
