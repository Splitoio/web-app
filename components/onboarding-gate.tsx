"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useGetUser, useUpdateUser } from "@/features/user/hooks/use-update-profile";
import { useGetAllOrganizations } from "@/features/business/hooks/use-organizations";
import { OnboardingModal } from "./onboarding-modal";
import { OnboardingTutorial, type OnboardingMode, type OrganizationOnboardingPhase } from "./onboarding-tutorial";
import { APP_MODE } from "@/lib/app-mode";
import { isAuthRoute } from "@/lib/middleware-session";

function isOrgAdmin(
  org: { userId: string; groupUsers?: { userId: string; role?: string | null }[] },
  currentUserId: string
): boolean {
  if (org.userId === currentUserId) return true;
  const membership = org.groupUsers?.find((gu) => gu.userId === currentUserId);
  return membership?.role === "ADMIN";
}

export function OnboardingGate() {
  const pathname = usePathname();
  const { data: userData, isLoading } = useGetUser();
  const { mutate: updateUser } = useUpdateUser();
  const { data: organizations = [], isFetched: orgsFetched } = useGetAllOrganizations({
    enabled: (APP_MODE === "organization" || pathname?.startsWith("/organization")) && !!userData?.id,
  });
  const [showTutorial, setShowTutorial] = useState(false);

  const mode: OnboardingMode =
    APP_MODE === "organization" || pathname?.startsWith("/organization")
      ? "organization"
      : "personal";

  const isOrgAdminUser = useMemo(() => {
    if (mode !== "organization" || !userData?.id || organizations.length === 0) return false;
    const orgIdMatch = pathname?.match(/^\/organization\/([^/]+)/);
    const currentOrgId = orgIdMatch?.[1] ?? organizations[0]?.id;
    const org = currentOrgId ? organizations.find((o) => o.id === currentOrgId) : organizations[0];
    return org ? isOrgAdmin(org, userData.id) : false;
  }, [mode, userData?.id, organizations, pathname]);

  const organizationPhase: OrganizationOnboardingPhase | null = useMemo(() => {
    if (mode !== "organization") return null;
    const inOrgRoute = pathname?.match(/^\/organization\/([^/]+)(?:\/|$)/);
    return inOrgRoute ? "in-org" : "no-org";
  }, [mode, pathname]);

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
    if (mode === "organization" && !orgsFetched) return;
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
  }, [userData, isNewProfile, isLoading, isAuthPage, mode, orgsFetched, organizationPhase]);

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
