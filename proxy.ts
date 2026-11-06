import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { StatusCodes } from "http-status-codes";
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/logo.png" ||
    pathname === "/icon.png";

  const isPublicAuthApi = pathname === "/api/auth/login";

  if (isPublicAsset || isPublicAuthApi) {
    return NextResponse.next();
  }

  const isLoginPage = pathname === "/login";
  const isApi = pathname.startsWith("/api");
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Validate session against database
  const session = sessionToken ? await getSessionUser(sessionToken) : null;

  // Unauthenticated or invalid/expired session
  if (!session) {
    if (isLoginPage) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-pathname", pathname);
      const res = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
      if (sessionToken) {
        res.cookies.delete(SESSION_COOKIE_NAME);
      }
      return res;
    }

    if (isApi) {
      const res = NextResponse.json(
        { error: "Unauthorized" },
        { status: StatusCodes.UNAUTHORIZED },
      );
      if (sessionToken) {
        res.cookies.delete(SESSION_COOKIE_NAME);
      }
      return res;
    }

    const loginUrl = new URL("/login", request.url);
    const target = `${pathname}${search}`;
    if (target !== "/") {
      loginUrl.searchParams.set("next", target);
    }
    const res = NextResponse.redirect(loginUrl);
    if (sessionToken) {
      res.cookies.delete(SESSION_COOKIE_NAME);
    }
    return res;
  }

  // Authenticated user attempting to visit login page
  if (isLoginPage) {
    const nextParam = request.nextUrl.searchParams.get("next");
    const nextUrl = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
    return NextResponse.redirect(new URL(nextUrl, request.url));
  }

  // Authenticated request: inject user and factory headers for downstream consumption
  const sessionHeaders: Record<string, string> = {
    "x-user-id": String(session.user.id),
    "x-factory-id": String(session.user.factory_id),
    "x-user-role": session.user.role,
    "x-user-name": encodeURIComponent(session.user.name),
    "x-user-username": session.user.username,
    "x-user-created-at": session.user.created_at,
    "x-user-updated-at": session.user.updated_at,
    "x-factory-name": encodeURIComponent(session.factory.name),
    "x-factory-receipt-images": String(session.factory.receipt_images_per_row),
    "x-factory-created-at": session.factory.created_at,
    "x-factory-updated-at": session.factory.updated_at,
    "x-pathname": pathname,
  };

  const requestHeaders = new Headers(request.headers);
  for (const [key, value] of Object.entries(sessionHeaders)) {
    requestHeaders.set(key, value);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
