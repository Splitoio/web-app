"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useGetUser, useUpdateUser } from "@/features/user/hooks/use-update-profile";
import { OnboardingModal } from "./onboarding-modal";
import { OnboardingTutorial, type OnboardingMode } from "./onboarding-tutorial";
import { isAuthRoute } from "@/lib/middleware-session";
import { useActiveWorkspace, useWorkspaces } from "@/contexts/workspace";

export function OnboardingGate() {
  const pathname = usePathname();
  const { data: userData, isLoading } = useGetUser();
  const { mutate: updateUser } = useUpdateUser();
  const [showTutorial, setShowTutorial] = useState(false);

  // Never the URL — every route is shared between personal and business now.
  const workspace = useActiveWorkspace();
  const { isLoading: workspacesLoading } = useWorkspaces();

  /**
   * There is EXACTLY ONE onboarding tour, and business opt-in is what arms it.
   *
   * A consumer signup sees no business framing at all: the personal surface is
   * "amount, currency, get link", and business only exists for someone who has
   * put themselves inside a business workspace. So the trigger is simply
   * "the active workspace is a business one", gated once per account on
   * `onboardedOrgInOrg`. In practice that first fires on the first business
   * workspace the user lands in — the one they created, or the one they were
   * invited into — and never again, whether they finished it or skipped it.
   *
   * (The old account-level "no-org" tour, which pitched "Splito for Business"
   * to fresh signups on the personal dashboard, is deleted along with its
   * `onboardedOrgNoOrg` flag. The sidebar's "New workspace" entry is the only
   * path into business now.)
   */
  const isBusinessWorkspace = workspace.kind === "business";

  const isOrgAdminUser =
    isBusinessWorkspace && ["OWNER", "ADMIN"].includes(workspace.role?.toUpperCase() ?? "");

  // The tutorial component is organization-only; `mode` is now just the key it
  // animates on. Personal still has NO first-run tour — see below.
  const mode: OnboardingMode = "organization";

  const isAuthPage = isAuthRoute(pathname ?? "");
  const hasNoDisplayName =
    !userData?.name || (typeof userData.name === "string" && userData.name.trim() === "");
  const nameIsEmail =
    userData?.email &&
    userData?.name &&
    String(userData.name).trim().toLowerCase() === String(userData.email).trim().toLowerCase();

  const isNewProfile = userData && (hasNoDisplayName || nameIsEmail);

  useEffect(() => {
    if (!userData?.id || isAuthPage || isLoading) return;
    // The workspace list decides `kind`, so it must have landed before anything
    // is shown — the pre-load default is personal.
    if (workspacesLoading) return;
    if (isNewProfile) return;

    // There is still NO personal first-run tour. First run is "amount,
    // currency, get link" — a request form that needs no explanation, and the
    // old 5-step tour taught groups/friends/balances, i.e. exactly the framing
    // the product moved off. See .specs/2026-08-06-request-money-design.md
    // ("What gets deleted from app/"; "Rules that protect the framing" #3).
    if (!isBusinessWorkspace) return;

    setShowTutorial(!userData.onboardedOrgInOrg);
  }, [userData, isNewProfile, isLoading, isAuthPage, workspacesLoading, isBusinessWorkspace]);

  const handleTutorialComplete = () => {
    setShowTutorial(false);
    // Persist to the backend so the tour never shows again across devices or on
    // a second workspace. Skip means skip.
    updateUser({ onboardedOrgInOrg: true });
  };

  if (isAuthPage || isLoading || !userData) return null;

  if (isNewProfile) {
    return <OnboardingModal onComplete={() => setShowTutorial(isBusinessWorkspace)} />;
  }

  if (showTutorial && isBusinessWorkspace) {
    return (
      <OnboardingTutorial
        mode={mode}
        isOrgAdmin={isOrgAdminUser}
        onComplete={handleTutorialComplete}
      />
    );
  }

  return null;
}
