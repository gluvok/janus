import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/logo.png" ||
    pathname === "/icon.png";

  const isPublicAuthApi = pathname === "/api/auth/login" || pathname === "/api/auth/logout";

  if (isPublicAsset || isPublicAuthApi) {
    return NextResponse.next();
  }

  const isLoginPage = pathname === "/login";
  const isApi = pathname.startsWith("/api");
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Unauthenticated requests
  if (!sessionToken) {
    if (isLoginPage) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-pathname", pathname);
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    const target = `${pathname}${search}`;
    if (target && target !== "/") {
      loginUrl.searchParams.set("next", target);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Validate session against database
  const user = await getSessionUser(sessionToken);

  // Expired or invalid session
  if (!user) {
    if (isLoginPage) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-pathname", pathname);
      const res = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    if (isApi) {
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    const loginUrl = new URL("/login", request.url);
    const target = `${pathname}${search}`;
    if (target && target !== "/") {
      loginUrl.searchParams.set("next", target);
    }
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  // Authenticated user attempting to visit login page
  if (isLoginPage) {
    const nextUrl = request.nextUrl.searchParams.get("next") || "/";
    return NextResponse.redirect(new URL(nextUrl, request.url));
  }

  // Authenticated request: inject user headers for downstream consumption
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", String(user.id));
  requestHeaders.set("x-factory-id", String(user.factory_id));
  requestHeaders.set("x-user-role", user.role);
  requestHeaders.set("x-user-name", encodeURIComponent(user.name));
  requestHeaders.set("x-user-username", user.username);
  requestHeaders.set("x-user-created-at", user.created_at);
  requestHeaders.set("x-user-updated-at", user.updated_at);
  requestHeaders.set("x-pathname", pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
