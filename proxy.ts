import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildLoginRedirectUrl,
  getSessionCookieValue,
  isAuthRoute,
  isProtectedRoute,
  safeCallbackPath,
  validateSessionWithAuthServer,
} from "./lib/middleware-session";
import { WORKSPACE_COOKIE, resolveOrganizationRedirect } from "./lib/workspace";

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
      // A signed-in visitor has no business on /login or /signup — but they may
      // have been sent there mid-flight by something with a destination in
      // mind. Sign-up is exactly that case: better-auth's emailAndPassword
      // auto-signs-in, so `/signup?callbackUrl=/invite/<token>` hands off to
      // `/login?callbackUrl=…` with a live session already in the jar and lands
      // right here. Redirecting to "/" unconditionally drops the callback and
      // strands the new account on the dashboard with the invite still PENDING.
      const destination = safeCallbackPath(request.nextUrl.searchParams.get("callbackUrl")) ?? "/";
      return NextResponse.redirect(new URL(destination, request.nextUrl.origin));
    }

    // Only redirect protected routes when we had a cookie and it was invalid.
    // If no cookie, let through so the page can load and the client will get 401 from API and redirect.
    if (isProtectedRoute(pathname) && isSessionValid === false) {
      return NextResponse.redirect(buildLoginRedirectUrl(request.nextUrl));
    }
  }

  // The `/organization/*` tree collapsed into workspace-scoped top-level routes.
  // Old links keep working: send them to the successor route and adopt the
  // organization from the URL as the active workspace, so the destination shows
  // the workspace the bookmark meant. See lib/workspace.ts for the map.
  const legacy = resolveOrganizationRedirect(pathname);
  if (legacy) {
    const target = new URL(legacy.pathname, request.nextUrl.origin);
    target.search = request.nextUrl.search;
    const response = NextResponse.redirect(target);
    if (legacy.workspaceId) {
      response.cookies.set(WORKSPACE_COOKIE, legacy.workspaceId, {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml).*)"],
};
