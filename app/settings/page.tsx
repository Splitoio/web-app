"use client";

import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { SettingsPageContent } from "@/app/settings/settings-page-content";

/**
 * Auth gate only — every section on this screen (profile, wallets, settlement,
 * workspace admin, …) pulls its own data via hooks inside SettingsPageContent,
 * the same way features/friends-list and features/groups-list do for their
 * pages. Keeping this file thin avoids threading a dozen unrelated mutations
 * through props.
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-white/70 text-lg">
          You need to be logged in to view this page. Redirecting...
        </div>
      </div>
    );
  }

  return <SettingsPageContent user={user} />;
}
