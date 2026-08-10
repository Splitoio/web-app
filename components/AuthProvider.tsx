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
  // "/" is the anonymous create-request landing (see
  // lib/middleware-session.ts). It — and the other no-account public routes
  // like /pay/* — must render immediately for an anonymous visitor: never
  // blocked behind a user fetch, never redirected, whether that fetch is
  // slow, down, or 401s. "/" still WANTS the fetch (to show "Recent" for a
  // returning user), just never gated on it; /pay/* etc. skip the fetch
  // entirely, same as auth pages.
  const isRoot = pathname === "/";
  const isPublicPage = isPublicRoute(pathname); // includes "/"
  // No session cookie => nobody to fetch. "/" used to fire GET /api/users/me
  // for every anonymous visitor and 401, which is noise on a page that is
  // no-account by design. A returning user still has the cookie, so "/" still
  // gets its user (and its "Recent" list) exactly as before.
  const skipFetch = isAuthPage || (isPublicPage && !isRoot) || !hasSession;
  const neverGate = isAuthPage || isPublicPage;
  const { data: user, isPending } = useGetUser({ enabled: !skipFetch });
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

  return <>{children}</>;
}
