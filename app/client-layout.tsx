"use client";

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

  // A signed-out visitor on "/" USED TO get a chrome-free card here — logo,
  // "Log in", and a stripped-down request form. That branch is gone. The
  // logged-out visitor now lands in the same shell as everyone else and sees
  // the real console: the sidebar (with its "Guest session" panel), the topbar,
  // the mobile nav, all of it. What they cannot use is rendered disabled with a
  // reason rather than hidden — see components/shell/locked-feature.tsx and
  // app/page.tsx.
  //
  // Two things make that safe, and both must hold or an anonymous visitor gets
  // bounced to /login the instant the shell mounts:
  //   1. Every session-requiring query in the shell is gated on
  //      `isAuthenticated` (OnboardingGate below, contexts/workspace.tsx).
  //   2. The 401 interceptor only redirects when a session cookie was actually
  //      present — api-helpers/client.ts, lib/session-presence.ts.
  //
  // /pay/* and /invite/* stay chrome-free (isAuthPage above): those are the
  // no-account payer/invite flows, not the console.
  return (
    <MobileMenuProvider>
      <Providers initialWorkspaceId={initialWorkspaceId} hasSession={hasSession}>
        {isAuthPage ? (
          children
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
