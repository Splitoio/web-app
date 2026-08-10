"use client";

import { useAuthStore } from "@/stores/authStore";
import { useSessionStatus } from "@/contexts/session";
import { SettingsPageContent } from "@/app/settings/settings-page-content";
import {
  LockedScreen,
  ScreenSpinner,
  SessionErrorScreen,
} from "@/components/shell/locked-feature";

/**
 * Auth gate only — every section on this screen (profile, wallets, settlement,
 * workspace admin, …) pulls its own data via hooks inside SettingsPageContent,
 * the same way features/friends-list and features/groups-list do for their
 * pages. Keeping this file thin avoids threading a dozen unrelated mutations
 * through props.
 *
 * Written out rather than using <GatedScreen/> because SettingsPageContent
 * takes a non-null `user` prop, and narrowing it here is honest where a cast
 * inside a `children` element would not be.
 *
 * The three not-signed-in outcomes are distinct on purpose (contexts/session.tsx):
 * an anonymous visitor is told to sign in, a failed /api/users/me is NOT — that
 * visitor has a session and hearing "sign in to change your settings" because
 * the backend blipped is a lie the 5-minute staleTime would make stick.
 */
export default function SettingsPage() {
  const status = useSessionStatus();
  const user = useAuthStore((s) => s.user);

  if (status === "anonymous") {
    return (
      <LockedScreen
        title="Settings"
        reason="Sign in to change your settings"
        blurb="Your account, your payout addresses, and how you get paid."
      />
    );
  }

  if (status === "error") return <SessionErrorScreen title="Settings" />;

  // "authenticated" always carries a user; the guard is what lets the prop stay
  // non-null without an assertion.
  if (status === "loading" || !user) return <ScreenSpinner />;

  return <SettingsPageContent user={user} />;
}
