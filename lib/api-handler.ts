import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { type z } from "zod";
import { AuthError, getAuthSession } from "@/lib/auth";
import type { User } from "@/app/users/types";
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
 */
export function handleApiRoute(
  handler: (request: Request, context: ApiContext) => Promise<NextResponse>,
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    try {
      const session = getAuthSession(request);
      return await handler(request, { user: session.user, factory: session.factory });
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
