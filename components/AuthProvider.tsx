"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useCurrencyDisplayStore, type CurrencyDisplayMode } from "@/stores/currencyDisplayStore";
import { useGetUser } from "@/features/user/hooks/use-update-profile";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { isAuthRoute, isPublicRoute } from "@/lib/middleware-session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
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
  const skipFetch = isAuthPage || (isPublicPage && !isRoot);
  const neverGate = isAuthPage || isPublicPage;
  const { data: user, isPending } = useGetUser({ enabled: !skipFetch });
  const posthog = usePostHog();

  useEffect(() => {
    if (user) {
      setUser(user);
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

  if (!neverGate && isPending) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-white/50" />
      </div>
    );
  }

  return <>{children}</>;
}
