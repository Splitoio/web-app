"use client";

import { useSessionStatus } from "@/contexts/session";
import { useActiveWorkspace, useIsResolvingWorkspace } from "@/contexts/workspace";
import { usePageTitle } from "@/contexts/page-title";
import { ScreenSpinner, SessionErrorScreen } from "@/components/shell/locked-feature";
import { CreateRequestExperience } from "@/components/create/create-request-experience";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import { BusinessDashboard } from "@/components/dashboard/business-dashboard";
import { BusinessDashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

/**
 * The signed-in dashboard — hero/settle-up/groups/activity for the personal
 * workspace, or the treasury/approval or revenue arrangement for a business
 * one (contexts/workspace.tsx decides which, never the URL). Design 145-241
 * and 244-369 have no in-page title row — the shell's <Topbar/> (title +
 * "+ Create") is it. But Topbar only mounts at >=1025px (client-layout.tsx),
 * so below that this is the only heading; `min-[1025px]:hidden` keeps it from
 * doubling up with Topbar once that breakpoint hits. Matches the same
 * treatment in app/requests/[id]/page.tsx. No CTA here — the shell's
 * "+ Create" already covers the primary action at >=1025px, and no page in
 * this app duplicates it below that either (see app/requests/page.tsx).
 */
function DashboardScreen({ kind }: { kind: "personal" | "business" | null }) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="block min-[1025px]:hidden border-b border-white/[0.07] sticky top-0 bg-[#0b0b0b]/95 backdrop-blur-xl z-10">
        <div className="flex px-4 sm:px-7 items-center h-[60px] sm:h-[70px]">
          <h1 className="text-[16px] sm:text-[20px] font-extrabold tracking-[-0.02em] text-white truncate">
            Dashboard
          </h1>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-7 overflow-y-auto">
        {/* kind === null: the cookie names a workspace the list hasn't returned
            yet. Guessing "personal" here mounts PersonalDashboard, which fires
            /workspaces/personal/summary for an account whose active workspace
            is a business one. Only "personal" resolves without the list, so an
            unresolved id is always a business one — show its skeleton. */}
        {kind === null ? (
          <BusinessDashboardSkeleton />
        ) : kind === "business" ? (
          <BusinessDashboard />
        ) : (
          <PersonalDashboard />
        )}
      </div>
    </div>
  );
}

/**
 * "/" is two screens behind one URL.
 *
 * SIGNED IN  → the dashboard, exactly as before.
 * SIGNED OUT → the real console, in the full shell (sidebar, topbar, mobile
 *              nav — see app/client-layout.tsx), showing the create-request
 *              screen. This is where the marketing site's CTAs land.
 *
 * This replaced a stripped-down, chrome-free anonymous card that lived here.
 * The visitor now sees the product they are being sold: creating a request
 * still needs no account (POST /api/requests is session-optional), and
 * everything that DOES need one renders as a disabled control with a reason
 * next to it (components/shell/locked-feature.tsx) rather than being hidden.
 *
 * The branch is on the session already held client-side (useAuthStore), never
 * a blocking fetch — components/AuthProvider.tsx never gates "/" behind the
 * session request either.
 */
export default function Page() {
  const status = useSessionStatus();
  const workspace = useActiveWorkspace();
  const isResolvingWorkspace = useIsResolvingWorkspace();

  // <Topbar/> titles "/" from lib/shell-nav.ts, which only knows it as
  // "Dashboard". Signed out the body is the create screen, so say so. Passing
  // null otherwise leaves pageMetaFor() alone (contexts/page-title.tsx).
  usePageTitle(
    status === "anonymous" ? "New request" : null,
    "Ask in any currency, get paid in the one you want"
  );

  // A cookie exists but GET /api/users/me failed. We cannot tell which of the
  // two screens below is the right one, and guessing "signed out" would greet a
  // signed-in user with a guest console telling them to sign in. Say what
  // actually happened and offer a retry.
  if (status === "error") return <SessionErrorScreen title="your dashboard" />;

  if (status === "authenticated") {
    return <DashboardScreen kind={isResolvingWorkspace ? null : workspace.kind} />;
  }

  // "loading" cannot reach here — AuthProvider holds the spinner for "/" whenever
  // a session cookie exists — but if that ever changes, showing the create screen
  // to a signed-in user is the wrong default, so wait rather than guess.
  if (status === "loading") return <ScreenSpinner />;

  return <CreateRequestExperience />;
}
