/**
 * @file app/api/realtime/token/route.ts
 * @description Issues a 1h Realtime token limited to the caller's notification topic.
 */

import { NextResponse } from "next/server";
import { withAuth, apiError, StatusCodes, forbiddenError, hasPermission } from "@/db/helpers";
import { PermissionKey, ProjectSlug, Role } from "@/lib/constants/enums";
import { AuthErrorMessage } from "@/lib/constants/messages";
import { signHs256 } from "@/lib/auth/realtime-token";

// Short on purpose: Realtime keeps a joined token until it expires, even after logout or a role/factory change.
const TTL_SECONDS = 600;

export const GET = withAuth(async (_req, user) => {
  const canRead =
    hasPermission(user, ProjectSlug.ENTRIES, PermissionKey.READ) ||
    hasPermission(user, ProjectSlug.WEIGHMENTS, PermissionKey.READ);
  if (!canRead) return forbiddenError();

  const isBase = user.role === Role.BASE;
  // Fail closed: never hand out a "factory:null" topic.
  if (!isBase && !Number.isInteger(user.factory_id)) return forbiddenError();

  const secret = process.env.SUPABASE_JWT_SECRET;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY; // never SUPABASE_SECRET_KEY: that one is the service role
  const url = process.env.SUPABASE_URL;
  if (!secret || !anonKey || !url) {
    console.error(
      "Realtime token: SUPABASE_JWT_SECRET, SUPABASE_PUBLISHABLE_KEY and SUPABASE_URL are required",
    );
    return apiError(AuthErrorMessage.INTERNAL_SERVER_ERROR, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + TTL_SECONDS;
  const token = signHs256(
    {
      aud: "authenticated",
      role: "authenticated",
      sub: user.sub,
      app_role: user.role,
      factory_id: user.factory_id,
      iat,
      exp,
    },
    secret,
  );
  const topic = isBase ? `user:${user.sub}` : `factory:${user.factory_id}`;

  return NextResponse.json(
    { token, url, anonKey, topic, expiresAt: exp * 1000 },
    { headers: { "Cache-Control": "no-store" } },
  );
});
