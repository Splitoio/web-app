"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useGetUser, useUpdateUser } from "@/features/user/hooks/use-update-profile";
import { OnboardingModal } from "./onboarding-modal";
import { OnboardingTutorial, type OnboardingMode, type OrganizationOnboardingPhase } from "./onboarding-tutorial";
import { isAuthRoute } from "@/lib/middleware-session";
import { useActiveWorkspace, useWorkspaces } from "@/contexts/workspace";

export function OnboardingGate() {
  const pathname = usePathname();
  const { data: userData, isLoading } = useGetUser();
  const { mutate: updateUser } = useUpdateUser();
  const [showTutorial, setShowTutorial] = useState(false);

  // Which tour to run is a property of the active workspace, not the URL —
  // every route is shared between personal and business now.
  const workspace = useActiveWorkspace();
  const { businessCount, isLoading: workspacesLoading } = useWorkspaces();

  const mode: OnboardingMode = workspace.kind === "business" ? "organization" : "personal";

  const isOrgAdminUser = useMemo(
    () => mode === "organization" && ["OWNER", "ADMIN"].includes(workspace.role?.toUpperCase() ?? ""),
    [mode, workspace.role]
  );

  const organizationPhase: OrganizationOnboardingPhase | null = useMemo(() => {
    if (mode !== "organization") return null;
    return businessCount > 0 ? "in-org" : "no-org";
  }, [mode, businessCount]);

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
    if (mode === "organization" && workspacesLoading) return;
    if (isNewProfile) return;

    // Personal mode has NO first-run tour. First run is "amount, currency, get
    // link" — a request form that needs no explanation, and the old 5-step tour
    // taught groups/friends/balances, i.e. exactly the framing the product moved
    // off. See .specs/2026-08-06-request-money-design.md ("What gets deleted
    // from app/" — the existing first-run flow; "Rules that protect the
    // framing" #3). The organization surface keeps its tour.
    if (mode === "personal") return;

    if (mode === "organization" && organizationPhase) {
      const seen =
        organizationPhase === "no-org"
          ? userData.onboardedOrgNoOrg
          : userData.onboardedOrgInOrg;
      setShowTutorial(!seen);
    }
  }, [userData, isNewProfile, isLoading, isAuthPage, mode, workspacesLoading, organizationPhase]);

  const handleTutorialComplete = () => {
    setShowTutorial(false);

    // Persist to backend so the tutorial never shows again across devices.
    // Organization-only — personal mode has no tour, so no flag to set.
    if (mode === "organization") {
      if (organizationPhase === "no-org") {
        updateUser({ onboardedOrgNoOrg: true });
      } else {
        updateUser({ onboardedOrgInOrg: true });
      }
    }
  };

  if (isAuthPage || isLoading || !userData) return null;

  if (isNewProfile) {
    return (
      <OnboardingModal
        onComplete={() => setShowTutorial(mode === "organization")}
      />
    );
  }

  if (showTutorial) {
    return (
      <OnboardingTutorial
        mode={mode}
        isOrgAdmin={mode === "organization" ? isOrgAdminUser : undefined}
        organizationPhase={mode === "organization" ? organizationPhase ?? undefined : undefined}
        onComplete={handleTutorialComplete}
      />
    );
  }

  return null;
}
