import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { APP_MODE, defaultPostLoginPath } from "./lib/app-mode";
import {
  buildLoginRedirectUrl,
  getSessionCookieValue,
  isAuthRoute,
  isProtectedRoute,
  validateSessionWithAuthServer,
} from "./lib/middleware-session";

const PERSONAL_ROUTE_PREFIXES = ["/", "/settings"];

function isPersonalRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return PERSONAL_ROUTE_PREFIXES
    .filter((prefix) => prefix !== "/")
    .some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(
    getSessionCookieValue((cookieName) => request.cookies.get(cookieName)?.value)
  );
  const shouldCheckSession = isAuthRoute(pathname) || isProtectedRoute(pathname);

  if (shouldCheckSession) {
    const authServerBaseUrl =
      process.env.NEXT_PUBLIC_API_URL ?? request.nextUrl.origin;
    const cookieHeader = request.headers.get("cookie") ?? "";

    // Session cookie is set by the backend (same-origin to API). When frontend and backend
    // are on different domains (e.g. app.splito.io vs api.splito.io), the browser does NOT
    // send that cookie on requests to the frontend. So we only validate when we have a cookie
    // (e.g. cross-subdomain cookie with domain=.splito.io). When we have no cookie, allow
    // the request through and let the client-side / API 401 handle redirect to login.
    const isSessionValid = hasSessionCookie
      ? await validateSessionWithAuthServer({
          authServerBaseUrl,
          cookieHeader,
        })
      : null; // null = unknown (no cookie to validate)

    if (isAuthRoute(pathname) && isSessionValid === true) {
      return NextResponse.redirect(
        new URL(defaultPostLoginPath, request.nextUrl.origin)
      );
    }

    // Only redirect protected routes when we had a cookie and it was invalid.
    // If no cookie, let through so the page can load and the client will get 401 from API and redirect.
    if (isProtectedRoute(pathname) && isSessionValid === false) {
      return NextResponse.redirect(buildLoginRedirectUrl(request.nextUrl));
    }
  }

  if (APP_MODE === "personal" && pathname.startsWith("/organization")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (
    APP_MODE === "organization" &&
    !isAuthRoute(pathname) &&
    isPersonalRoute(pathname)
  ) {
    return NextResponse.redirect(new URL("/organization", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml).*)"],
};
