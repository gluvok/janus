import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { handleApiRoute, ServiceError } from "@/lib/api-handler";
import { NOTIFY_ROLES } from "@/lib/security";
import { signHs256 } from "@/lib/realtime-token";

// Short on purpose: Realtime keeps a joined token until it expires, even after logout or a role change.
const TTL_SECONDS = 600;

export const GET = handleApiRoute(
  async (_request, { user, factory }) => {
    const secret = process.env.SUPABASE_JWT_SECRET;
    const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY; // never SUPABASE_SECRET_KEY
    const url = process.env.SUPABASE_URL;
    if (!secret || !anonKey || !url) {
      console.error(
        "Realtime token: SUPABASE_JWT_SECRET, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL required",
      );
      throw new ServiceError("Realtime unavailable", StatusCodes.INTERNAL_SERVER_ERROR);
    }
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + TTL_SECONDS;
    const token = signHs256(
      {
        aud: "authenticated",
        role: "authenticated",
        sub: String(user.id),
        app_role: user.role,
        factory_id: factory.id,
        iat,
        exp,
      },
      secret,
    );
    return NextResponse.json(
      { token, url, anonKey, topic: `factory:${factory.id}`, expiresAt: exp * 1000 },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
  { roles: NOTIFY_ROLES },
);
