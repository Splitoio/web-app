"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useCurrencyDisplayStore, type CurrencyDisplayMode } from "@/stores/currencyDisplayStore";
import { useGetUser } from "@/features/user/hooks/use-update-profile";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { isAuthRoute, isPublicRoute } from "@/lib/middleware-session";
import { setSessionPresent } from "@/lib/session-presence";
import { isUnauthorizedError } from "@/api-helpers/client";
import { SessionStatusProvider, type SessionStatus } from "@/contexts/session";

export function AuthProvider({
  children,
  hasSession = false,
}: {
  children: React.ReactNode;
  /**
   * Whether a session cookie was present on the server render (app/layout.tsx).
   * The cookie is httpOnly, so this is the only way the client can know before
   * asking the API — and asking is exactly what we are avoiding here.
   * Presence, not proof: the server still authenticates every request, so a
   * forged or expired cookie buys nothing but one 401 we already handle.
   */
  hasSession?: boolean;
}) {
  // Published DURING RENDER, not in an effect: this provider renders before any
  // of its children mount, and their queries can 401 on the very first tick.
  // An effect fires after that, which would leave the interceptor deciding the
  // anonymous-vs-expired question (api-helpers/client.ts) with a stale `false`
  // and silently swallow a genuine expiry redirect. The write is idempotent and
  // targets a module-scoped flag, so repeating it on every render is free.
  setSessionPresent(hasSession);

  const setUser = useAuthStore((state) => state.setUser);
  const setCurrencyDisplayMode = useCurrencyDisplayStore((s) => s.setMode);
  const pathname = usePathname() ?? "";
  // /login, /signup, /forgot-password, /reset-password — never fire a
  // session-requiring query here at all.
  const isAuthPage = isAuthRoute(pathname);
  // "/" is public — an anonymous visitor must never be blocked behind a user
  // fetch there, whether it is slow, down, or 401s. But "/" is ALSO the
  // dashboard for everyone who IS signed in, so when a session cookie exists
  // it has to wait for the answer like any protected route: rendering through
  // the in-flight fetch showed a signed-in user the full signed-OUT console
  // ("Guest session", a locked workspace switcher, "No account needed") on
  // every single load of the most-visited route in the app, which then flipped
  // under them a moment later. Hence `neverGate` below turns on the ABSENCE of
  // a session, not on the route being public.
  //
  // (This used to say "/" wants the fetch to show a "Recent" list. That list
  // and its useRecentRequests hook are gone — "/" now renders either the
  // dashboard or the create screen.)
  const isRoot = pathname === "/";
  const isPublicPage = isPublicRoute(pathname); // includes "/"
  // `hasSession` is a HINT, never the authority. It is the Next server looking
  // for the session cookie on the app's OWN origin — and the cookie is set by
  // the backend on a different host, so unless crossSubDomainCookies is enabled
  // (backend/src/lib/auth.ts: only when AUTH_COOKIE_DOMAIN is set, which it is
  // NOT in production today) the app origin never sees it and `hasSession` is
  // false for EVERYONE, signed in or not.
  //
  // This used to read `|| !hasSession`, which skipped the fetch entirely and
  // let the UI conclude "anonymous" without ever asking. Every signed-in user
  // was therefore shown the guest console and could not get out of it: sign in,
  // get bounced to "/", get told you are a guest, forever.
  //
  // Only GET /api/users/me can answer this, because only the browser sends that
  // cookie cross-origin. So we always ask, on every route that renders anything
  // identity-dependent. /pay/* and /invite/* still opt out: they are chrome-free
  // and render the same thing for everyone.
  const skipFetch = isAuthPage || (isPublicPage && !isRoot);
  const neverGate = isAuthPage || (isPublicPage && !hasSession);
  const { data: user, isPending, isError, error } = useGetUser({ enabled: !skipFetch });
  const posthog = usePostHog();

  useEffect(() => {
    if (user) {
      setUser(user);
      // A session proven by an actual 200, for the case the server render
      // missed it (a client-side sign-in that never re-rendered on the server).
      setSessionPresent(true);
      const cd = user.currencyDisplay;
      if (cd === "both" || cd === "real" || cd === "converted") {
        setCurrencyDisplayMode(cd as CurrencyDisplayMode);
      }
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
      });
    }
  }, [user, setUser, setCurrencyDisplayMode, posthog]);

  // A 401 is not a failure, it is an ANSWER: the cookie is expired, revoked, or
  // forged, and there is no session behind it. That has to land on "anonymous",
  // not "error" — "/" is public, so neither proxy.ts (which only validates
  // isAuthRoute/isProtectedRoute) nor the 401 interceptor (which never bounces
  // a public page) will move them, and calling it an error left an expired
  // session pinned to a screen insisting "you're still signed in" with a Try
  // again that reloaded into the same dead end forever. Landing on "anonymous"
  // gives them the guest console, where creating a request still works — the
  // entire point of "/".
  const sessionRejected = isError && isUnauthorizedError(error);

  // The one place that decides how much the UI is allowed to assume — see
  // contexts/session.tsx. `!user` has FOUR different meanings and the screens
  // below must not collapse them into "signed out".
  // Derived from the ANSWER, not from the cookie hint. Ordering matters: the
  // query result wins wherever we have one, and `hasSession` is consulted only
  // on routes that deliberately never ask.
  const status: SessionStatus = skipFetch
    ? // This route opted out of the fetch (/login, /pay/*, /invite/*). Nothing
      // here renders a locked or gated surface, so fall back to the cookie hint
      // rather than reporting a "loading" that would never resolve — a disabled
      // query stays `isPending` forever.
      hasSession
      ? "authenticated"
      : "anonymous"
    : user
      ? "authenticated"
      : sessionRejected
        ? // 401 — no session behind the request, whether or not a cookie was
          // sent. This is the real "signed out", and the only thing that should
          // ever produce a locked console.
          "anonymous"
        : isError
          ? // The fetch failed for some OTHER reason (500, network, backend
            // restarting). Not a signed-out visitor — possibly a signed-in one
            // whose backend hiccuped. Telling them to sign in would be a lie,
            // and a sticky one (staleTime 5min, no refetch on focus), so screens
            // show an error with a way out instead.
            "error"
          : "loading";

  // `skipFetch` must be part of this test: react-query reports a DISABLED query
  // as `isPending` forever, so gating on `isPending` alone would hang a
  // protected route behind a spinner for a request that was never sent.
  if (!neverGate && !skipFetch && isPending) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-white/50" />
      </div>
    );
  }

  return <SessionStatusProvider status={status}>{children}</SessionStatusProvider>;
}
