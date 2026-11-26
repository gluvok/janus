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
}

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
 * Standardized higher-order wrapper for API route handlers.
 * Catches AuthError, ServiceError, and generic exceptions,
 * automatically extracts authenticated ApiContext from proxy headers,
 * and returns clean, uniform NextResponse envelopes across all endpoints.
 * When `options.roles` is set, sessions whose role is not listed get 403.
 */
export function handleApiRoute(
  handler: (request: Request, context: ApiContext) => Promise<NextResponse>,
  options: { roles?: readonly UserRole[] } = {},
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    try {
      const session = getAuthSession(request);
      if (!isRoleAllowed(options.roles, session.user.role)) {
        throw new AuthError("Forbidden", StatusCodes.FORBIDDEN);
      }
      return await handler(request, { user: session.user, factory: session.factory });
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
