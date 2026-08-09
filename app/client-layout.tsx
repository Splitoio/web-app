"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { MobileMenuToggle } from "@/components/mobile-menu-toggle";
import { MobileMenuProvider } from "@/contexts/mobile-menu";
import { Providers } from "@/components/providers";
import { OnboardingGate } from "@/components/onboarding-gate";
import { MobileNav } from "@/components/mobile-nav";
import { isAuthRoute } from "@/lib/middleware-session";
import { useAuthStore } from "@/stores/authStore";

export function ClientLayout({
  children,
  initialWorkspaceId,
  hasSession = false,
}: {
  children: React.ReactNode;
  initialWorkspaceId?: string | null;
  /** Session cookie presence, read server-side in app/layout.tsx. */
  hasSession?: boolean;
}) {
  const pathname = usePathname();
  // "/pay" is the public, no-account payer flow — never mount the
  // authenticated chrome (Sidebar, OnboardingGate) there, since those fire
  // session-requiring queries that 401 an anonymous visitor straight to
  // /login. See .plans/2026-08-06-request-money.md "NO AUTH, EVER".
  //
  // Deliberately NOT using lib/middleware-session.ts's isPublicRoute() here:
  // that also covers "/" and "/contract/view" / "/sign", which DO want the
  // authenticated chrome (the shell is global nav, every page). Only
  // /login-style auth pages and /pay are chrome-free. If you add a new
  // no-chrome route, check components/AuthProvider.tsx and
  // api-helpers/client.ts too — they source from lib/middleware-session.ts and
  // may need the route added there instead.
  // "/invite/*" is chrome-free for the same reason: a signed-out visitor lands
  // there straight from an invite email, and the shell's session-requiring
  // queries would 401 them off to /login before they can read who invited them.
  const isAuthPage =
    isAuthRoute(pathname ?? "") ||
    pathname?.startsWith("/pay") ||
    pathname?.startsWith("/invite");

  // "/" is the anonymous-first create-request screen (see
  // .specs/2026-08-06-request-money-design.md "Accounts": no account is ever
  // required to request or pay). A stranger with no session must not see the
  // signed-in app shell — sidebar, topbar, bottom nav — since that's furniture
  // for an account they don't have. Once a session exists, "/" renders the full
  // shell exactly as every other route does.
  const { isAuthenticated } = useAuthStore();
  const isAnonymousLanding = pathname === "/" && !isAuthenticated;

  return (
    <MobileMenuProvider>
      <Providers initialWorkspaceId={initialWorkspaceId} hasSession={hasSession}>
        {isAuthPage ? (
          children
        ) : isAnonymousLanding ? (
          <div className="min-h-screen bg-[#0b0b0b] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-7 h-[64px] shrink-0">
              <Image src="/logo.svg" alt="Splito" width={100} height={26} className="h-6 w-auto" />
              <Link
                href="/login"
                className="text-[13px] font-semibold text-white/60 hover:text-white transition-colors"
              >
                Log in
              </Link>
            </div>
            <main className="flex-1 flex flex-col min-w-0">{children}</main>
          </div>
        ) : (
          <div className="min-h-screen bg-[#0b0b0b] splito-page-wrap">
            <OnboardingGate />
            <Sidebar />
            <MobileMenuToggle />
            <MobileNav />
            {/* The sidebar is fixed, so the shell offsets by its width at the
                breakpoint where it becomes visible (.splito-shell, globals.css). */}
            <div className="splito-shell flex flex-col min-h-screen min-w-0">
              <div className="hidden min-[1025px]:block">
                <Topbar />
              </div>
              <main className="flex-1 flex flex-col min-w-0 bg-[#0b0b0b]">
                <div className="splito-content w-full flex-1 flex flex-col min-w-0 max-[1024px]:max-w-[430px] max-[1024px]:mx-auto max-[1024px]:pb-[88px]">
                  {children}
                </div>
              </main>
            </div>
          </div>
        )}
      </Providers>
      <Toaster position="top-right" theme="dark" />
    </MobileMenuProvider>
  );
}
