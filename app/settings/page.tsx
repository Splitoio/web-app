"use client";

import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { SettingsPageContent } from "@/app/settings/settings-page-content";
import { LockedScreen } from "@/components/shell/locked-feature";

/**
 * Auth gate only — every section on this screen (profile, wallets, settlement,
 * workspace admin, …) pulls its own data via hooks inside SettingsPageContent,
 * the same way features/friends-list and features/groups-list do for their
 * pages. Keeping this file thin avoids threading a dozen unrelated mutations
 * through props. This already reads isAuthenticated before mounting
 * SettingsPageContent, so with the shell now rendering for signed-out
 * visitors too, `/settings` was already safe from firing its data hooks —
 * only the copy for the signed-out branch needed to move onto the shared
 * LockedScreen idiom.
 */
export default function SettingsPage() {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-white/50" />
          <p className="text-white/70 text-lg">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <LockedScreen
        title="Settings"
        reason="Sign in to change your settings"
        blurb="Your account, your payout addresses, and how you get paid."
      />
    );
  }

  return <SettingsPageContent user={user} />;
}
