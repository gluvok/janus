import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { StatusCodes } from "http-status-codes";
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/auth";
import { safeNextPath, stripSessionHeaders } from "@/lib/security";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Never trust identity headers from the client; only the session below may set them.
  const requestHeaders = stripSessionHeaders(request.headers);

  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/logo.png" ||
    pathname === "/icon.png";

  // Device ingest (POST only; GET stays session-protected) authenticates itself via x-api-key inside the route.
  const isPublicAuthApi =
    pathname === "/api/auth/login" ||
    (pathname === "/api/entries/automatic" && request.method === "POST");

  if (isPublicAsset || isPublicAuthApi) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const isLoginPage = pathname === "/login";
  const isApi = pathname.startsWith("/api");
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const session = sessionToken ? await getSessionUser(sessionToken) : null;

  if (!session) {
    if (isLoginPage) {
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

  if (isLoginPage) {
    const nextUrl = safeNextPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(nextUrl, request.url));
  }

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

  for (const [key, value] of Object.entries(sessionHeaders)) {
    requestHeaders.set(key, value);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
