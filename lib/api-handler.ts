import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { type z } from "zod";
import { AuthError, getAuthSession } from "@/lib/auth";
import { isRoleAllowed } from "@/lib/security";
import type { User, UserRole } from "@/app/users/types";
import type { Factory } from "@/app/settings/types";

export interface ApiContext {
  user: User;
  factory: Factory;
  /** Resolved dynamic route segments (e.g. `{ id: "5" }` for `/[id]`); empty for static routes. */
  params: Record<string, string>;
}

/** Second argument Next.js passes to route handlers; `params` is a Promise since Next 15. */
type NextRouteContext = { params: Promise<Record<string, string>> };

export class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function validationErrorResponse(error: z.ZodError): NextResponse {
  return NextResponse.json(
    { error: error.issues[0]?.message ?? "Validation failed" },
    { status: StatusCodes.BAD_REQUEST },
  );
}

/**
 * Wraps an API route handler: reads the session from proxy headers, returns 403 when
 * `options.roles` is set and the session's role is not listed, and maps AuthError,
 * ServiceError and unexpected errors to status responses.
 */
export function handleApiRoute(
  handler: (request: Request, context: ApiContext) => Promise<NextResponse>,
  options: { roles?: readonly UserRole[] } = {},
): (request: Request, routeContext?: NextRouteContext) => Promise<NextResponse> {
  return async (request: Request, routeContext?: NextRouteContext) => {
    try {
      const session = getAuthSession(request);
      if (!isRoleAllowed(options.roles, session.user.role)) {
        throw new AuthError("Forbidden", StatusCodes.FORBIDDEN);
      }
      const params = (await routeContext?.params) ?? {};
      return await handler(request, { user: session.user, factory: session.factory, params });
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode });
      }
      if (err instanceof ServiceError && err.statusCode < StatusCodes.INTERNAL_SERVER_ERROR) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode });
      }
      console.error("API error:", err);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }
  };
}
