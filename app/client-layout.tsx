"use client";

import Image from "next/image";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { MobileMenuToggle } from "@/components/mobile-menu-toggle";
import { MobileMenuProvider } from "@/contexts/mobile-menu";
import { Providers } from "@/components/providers";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { OnboardingGate } from "@/components/onboarding-gate";
import { PersonalMobileNav } from "@/components/personal-mobile-nav";
import { OrganizationMobileNav } from "@/components/organization-mobile-nav";
import { isAuthRoute } from "@/lib/middleware-session";
import { useAuthStore } from "@/stores/authStore";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // "/pay" is the public, no-account payer flow — never mount the
  // authenticated chrome (Sidebar, OnboardingGate) there, since those fire
  // session-requiring queries that 401 an anonymous visitor straight to
  // /login. See .plans/2026-08-06-request-money.md "NO AUTH, EVER".
  //
  // Deliberately NOT using lib/middleware-session.ts's isPublicRoute() here:
  // that also covers "/" and "/contract/view" / "/sign", which DO want the
  // authenticated chrome (Sidebar is global nav, every page — see
  // .plans/2026-08-06-request-money.md). Only /login-style auth pages and
  // /pay are chrome-free. If you add a new no-chrome route, check
  // components/AuthProvider.tsx and api-helpers/client.ts too — they source
  // from lib/middleware-session.ts and may need the route added there instead.
  const isAuthPage = isAuthRoute(pathname ?? "") || pathname?.startsWith("/pay");
  const isOrganizationMode = pathname?.includes("/organization");
  const isPersonalMode = !isOrganizationMode;

  // "/" is the anonymous-first create-request screen (see
  // .specs/2026-08-06-request-money-design.md "Accounts": no account is ever
  // required to request or pay). A stranger with no session must not see the
  // signed-in app shell — sidebar, bottom nav — since that's furniture for an
  // account they don't have. This reuses the existing isAuthenticated flag
  // rather than adding a sixth route list; it's a chrome decision layered on
  // top of lib/middleware-session.ts's route classification, not a new
  // classification of its own. Once a session exists, "/" renders the full
  // chrome exactly as every other personal-mode route does.
  const { isAuthenticated } = useAuthStore();
  const isAnonymousLanding = pathname === "/" && !isAuthenticated;

  return (
    <MobileMenuProvider>
      <Providers>
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
            {isPersonalMode && <PersonalMobileNav />}
            {isOrganizationMode && <OrganizationMobileNav />}
            <div className="min-[1025px]:pl-[226px] min-h-screen flex flex-col">
              <main className="flex-1 bg-[#0b0b0b] min-h-screen relative flex flex-col min-w-0">
                <div
                  className={cn(
                    "w-full flex-1 flex flex-col min-w-0",
                    "max-[1024px]:max-w-[430px] max-[1024px]:mx-auto max-[1024px]:pb-[88px]"
                  )}
                >
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
