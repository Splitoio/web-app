const AUTH_ROUTES = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);
const PUBLIC_ROUTE_PREFIXES = ["/contract/view", "/sign", "/pay"];

// Canonical source of truth for "no session required" pathnames. Consumed
// server-side by proxy.ts (session-cookie redirect gate) and client-side by
// api-helpers/client.ts (401 interceptor) and components/AuthProvider.tsx
// (render-blocking gate). components/onboarding-gate.tsx and
// app/client-layout.tsx still keep their own narrower auth-page checks
// (chrome/UI decisions, not security gates) — if you add a new public route,
// update it here first, then check those two for whether their UI treatment
// should change too.

export const SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "__Host-better-auth.session_token",
  "better-auth.session_token",
  "session_token",
  "sessionToken",
] as const;

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.has(pathname);
}

export function isPublicRoute(pathname: string): boolean {
  // "/" is the anonymous create-request landing — an account is offered,
  // never required. See .specs/2026-08-06-request-money-design.md and
  // .plans/2026-08-06-request-money.md ("NO AUTH, EVER"). Must be an exact
  // match, not a prefix — every other route also starts with "/".
  if (pathname === "/") return true;
  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isProtectedRoute(pathname: string): boolean {
  return !isAuthRoute(pathname) && !isPublicRoute(pathname);
}

export function getSessionCookieValue(
  getCookie: (name: string) => string | undefined
): string | null {
  for (const cookieName of SESSION_COOKIE_NAMES) {
    const value = getCookie(cookieName);
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

export function buildLoginRedirectUrl(requestUrl: URL): URL {
  const loginUrl = new URL("/login", requestUrl.origin);
  const callbackUrl = `${requestUrl.pathname}${requestUrl.search}`;
  loginUrl.searchParams.set("callbackUrl", callbackUrl);
  return loginUrl;
}

export function isValidSessionPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  if ("user" in payload) {
    const candidate = payload as { user?: { id?: unknown } };
    return typeof candidate.user?.id === "string";
  }

  return false;
}

export async function validateSessionWithAuthServer(params: {
  authServerBaseUrl: string;
  cookieHeader: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const { authServerBaseUrl, cookieHeader, fetchImpl = fetch } = params;

  if (!cookieHeader.trim()) {
    return false;
  }

  try {
    const response = await fetchImpl(
      `${authServerBaseUrl.replace(/\/+$/, "")}/api/auth/get-session`,
      {
        method: "GET",
        headers: {
          cookie: cookieHeader,
          accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return isValidSessionPayload(payload);
  } catch {
    return false;
  }
}
