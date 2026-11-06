import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { AuthError, getAuthSession } from "@/lib/auth";
import { ServiceError } from "@/app/api/users/service";
import type { User } from "@/app/users/types";
import type { Factory } from "@/app/settings/types";

export interface ApiContext {
  user: User;
  factoryId: number;
  factory: Factory;
}

/**
 * Standardized higher-order wrapper for API route handlers.
 * Catches AuthError, ServiceError, and generic exceptions,
 * automatically extracts authenticated ApiContext from proxy headers,
 * and returns clean, uniform NextResponse envelopes across all endpoints.
 */
export function handleApiRoute(
  handler: (request: Request, context: ApiContext) => Promise<NextResponse>,
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    try {
      const isPublic = new URL(request.url).pathname === "/api/auth/login";
      const session = isPublic ? null : getAuthSession(request);
      const context: ApiContext = session
        ? { user: session.user, factoryId: session.user.factory_id, factory: session.factory }
        : ({} as ApiContext);
      return await handler(request, context);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode });
      }
      if (err instanceof ServiceError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode });
      }
      const message = err instanceof Error ? err.message : "Internal Server Error";
      return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
    }
  };
}
