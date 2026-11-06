import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { AuthError } from "@/lib/auth";
import { ServiceError } from "@/app/api/users/service";

/**
 * Standardized higher-order wrapper for API route handlers.
 * Catches AuthError, ServiceError, and generic exceptions,
 * returning clean, uniform NextResponse envelopes across all endpoints.
 */
export function handleApiRoute(
  handler: (request: Request) => Promise<NextResponse>,
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    try {
      return await handler(request);
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
