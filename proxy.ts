import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const isLoginPage = pathname === "/login";
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname === "/logo.png" ||
    pathname === "/icon.png";

  if (isPublicAsset) {
    return NextResponse.next();
  }

  // If already logged in and visiting /login, redirect to target or home
  if (isLoginPage && sessionToken) {
    const nextUrl = request.nextUrl.searchParams.get("next") || "/";
    return NextResponse.redirect(new URL(nextUrl, request.url));
  }

  // If not logged in and visiting protected page, redirect to /login with ?next=
  if (!isLoginPage && !sessionToken) {
    const loginUrl = new URL("/login", request.url);
    const target = `${pathname}${search}`;
    if (target && target !== "/") {
      loginUrl.searchParams.set("next", target);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Forward pathname in request header for server layout conditional rendering
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files and API routes
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.png|icon.png).*)",
  ],
};
