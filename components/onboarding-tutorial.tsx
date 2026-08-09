"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  X,
  Hand,
  LayoutDashboard,
  FileText,
  Wallet,
  BarChart3,
  ClipboardList,
  User,
  PartyPopper,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { T, A } from "@/lib/splito-design";
import { navItemId } from "@/lib/shell-nav";

interface Step {
  id: string;
  title: string;
  content: string;
  targetId: string;
  position: "top" | "bottom" | "left" | "right" | "center";
}

// There is deliberately NO personal-mode tour. The personal surface is the
// request form — amount, currency, get link — which needs no explanation, and
// the tour that used to live here taught groups/friends/balances (the framing
// the product moved off) while pointing at sidebar targets that no longer
// exist. See .specs/2026-08-06-request-money-design.md → "What gets deleted
// from app/" and "Rules that protect the framing". This component is now
// organization-only.

// There is deliberately NO tour for an account with no business workspace
// either. Business framing must not reach a consumer signup before they have
// opted in by creating a workspace — the sidebar's "New workspace" entry is
// that opt-in, and these tours only run once the user is inside one.

const ORG_STEPS_ADMIN: Step[] = [
  {
    id: "welcome",
    title: "You're in your organization",
    content: "Manage invoices, income streams, contracts, activity, and team members from here.",
    targetId: "",
    position: "center",
  },
  {
    id: "dashboard",
    title: "Organization Dashboard",
    content: "A bird's-eye view of your team, invoices, income streams, and contracts.",
    targetId: navItemId("/"),
    position: "right",
  },
  {
    id: "invoices",
    title: "Invoices",
    content: "Members raise invoices here — approve or decline them as the admin.",
    targetId: navItemId("/requests"),
    position: "right",
  },
  {
    id: "streams",
    title: "Income Streams",
    content: "Log and track income streams for your organization — the same totals your dashboard reads.",
    // Income streams have no standalone nav destination anymore — they live
    // on the Treasury page (app/treasury/page.tsx: useGetStreamsByOrganization
    // + LogIncomeModal), so that's what this step now spotlights.
    targetId: navItemId("/treasury"),
    position: "right",
  },
  {
    id: "members",
    title: "Members",
    content: "Invite people, manage their roles and permissions, and create and track contracts with compensation and scope of work.",
    // Contracts have no standalone nav destination — they're created and
    // managed from the Members page (app/members/page.tsx: useCreateContract,
    // ContractDetailModal) alongside team management, so this single step
    // covers both rather than spotlighting the same nav item twice.
    targetId: navItemId("/members"),
    position: "right",
  },
  {
    id: "finish",
    title: "You're ready!",
    content: "Start by creating contracts, adding members, or setting up income streams.",
    targetId: "",
    position: "center",
  },
];

const ORG_STEPS_MEMBER: Step[] = [
  {
    id: "welcome",
    title: "You're in your organization",
    content: "Raise invoices and view your contracts here. Admins can approve invoices and manage the team.",
    targetId: "",
    position: "center",
  },
  {
    id: "invoices",
    title: "Invoices",
    content: "Raise invoices linked to your contracts. Admins will approve or decline them.",
    targetId: navItemId("/requests"),
    position: "right",
  },
  {
    id: "contracts",
    title: "Contracts",
    content: "View and sign contracts assigned to you.",
    // Same repoint as the admin tour's contracts step — contracts live on
    // the Members page, which members can see (only /approvals is admin-only,
    // see navGroupsFor in lib/shell-nav.ts).
    targetId: navItemId("/members"),
    position: "right",
  },
  {
    id: "finish",
    title: "You're ready!",
    content: "Raise an invoice or open a contract to get started.",
    targetId: "",
    position: "center",
  },
];

/** "personal" is still a valid *gate* mode — it simply renders no tutorial. */
export type OnboardingMode = "personal" | "organization";

// Step icon map
const STEP_ICONS: Record<string, LucideIcon> = {
  welcome: Hand,
  dashboard: LayoutDashboard,
  invoices: FileText,
  streams: Wallet,
  activity: BarChart3,
  contracts: ClipboardList,
  members: User,
  finish: PartyPopper,
};

export function OnboardingTutorial({
  onComplete,
  mode,
  isOrgAdmin,
}: {
  onComplete: () => void;
  mode: OnboardingMode;
  isOrgAdmin?: boolean;
}) {
  const steps = isOrgAdmin ? ORG_STEPS_ADMIN : ORG_STEPS_MEMBER;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const handleNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      onComplete();
    }
  }, [currentStepIndex, steps.length, onComplete]);

  const handlePrev = () => {
    if (currentStepIndex > 0) setCurrentStepIndex(currentStepIndex - 1);
  };

  const handleSkip = () => onComplete();

  const updateSpotlight = useCallback(() => {
    // On mobile (< 640px) skip spotlight — just show the centered card for all steps
    if (window.innerWidth < 640) {
      setTargetRect(null);
      return;
    }
    const step = steps[currentStepIndex];
    if (step.targetId) {
      const element = document.getElementById(step.targetId);
      setTargetRect(element ? element.getBoundingClientRect() : null);
    } else {
      setTargetRect(null);
    }
  }, [currentStepIndex, steps]);

  useEffect(() => {
    updateSpotlight();
    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight);
    return () => {
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight);
    };
  }, [updateSpotlight]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, []);

  const step = steps[currentStepIndex];
  const isLast = currentStepIndex === steps.length - 1;
  const isCenter = !targetRect;

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* Dim backdrop */}
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(2px)" }}
        onClick={handleSkip}
      />

      {/* Spotlight ring around target element */}
      <AnimatePresence>
        {targetRect && (
          <motion.div
            key={step.id + "-spotlight"}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: targetRect.left - 8,
              y: targetRect.top - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="absolute rounded-xl pointer-events-none"
            style={{
              border: `2px solid ${A}`,
              boxShadow: `0 0 0 9999px rgba(0,0,0,0.65), 0 0 24px ${A}40`,
              zIndex: 201,
            }}
          />
        )}
      </AnimatePresence>

      {/* Card — centered wrapper handles positioning; motion.div only animates opacity/scale */}
      <AnimatePresence mode="wait">
        {isCenter ? (
          // Static wrapper centers the card — Framer Motion only does opacity/scale (no y that fights centering)
          <div
            key={`${mode}-${currentStepIndex}-wrap`}
            className="pointer-events-none fixed inset-0 flex items-end sm:items-center justify-center sm:px-4"
            style={{ zIndex: 202 }}
          >
            <motion.div
              key={`${mode}-${currentStepIndex}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto w-full sm:max-w-[420px]"
            >
          <div
            className={isCenter ? "onboarding-center-card" : ""}
            style={{
              background: "linear-gradient(160deg, #141414 0%, #0f0f0f 100%)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: isCenter ? undefined : 24,
              padding: isCenter ? "24px 20px" : "22px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.85)",
            }}
          >
            {/* Drag handle on mobile for centered steps */}
            {isCenter && (
              <div
                className="sm:hidden mx-auto mb-4 h-1 w-10 rounded-full"
                style={{ background: "rgba(255,255,255,0.15)" }}
              />
            )}

            {/* Step icon + title row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
                  style={{ background: `${A}18`, border: `1px solid ${A}28` }}
                >
                  {(() => {
                    const StepIcon = STEP_ICONS[step.id] ?? Sparkles;
                    return <StepIcon size={16} strokeWidth={1.75} color={A} />;
                  })()}
                </div>
                <div>
                  <p style={{ color: T.dim, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {currentStepIndex + 1} of {steps.length}
                  </p>
                  <h3 style={{ color: "#fff", fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                    {step.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={handleSkip}
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.50)",
                  width: 28, height: 28,
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <X size={13} />
              </button>
            </div>

            {/* Content */}
            <p style={{ color: T.body, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              {step.content}
            </p>

            {/* Progress dots */}
            <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 16 }}>
              {steps.map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 4,
                    borderRadius: 4,
                    transition: "all 0.25s",
                    width: i === currentStepIndex ? 20 : 6,
                    background: i === currentStepIndex ? A : "rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            </div>

            {/* Navigation */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {currentStepIndex > 0 && (
                  <button
                    onClick={handlePrev}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.09)",
                      color: "rgba(255,255,255,0.6)",
                      borderRadius: 10, padding: "7px 12px",
                      fontSize: 12, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <ChevronLeft size={13} /> Back
                  </button>
                )}
                <button
                  onClick={handleSkip}
                  style={{
                    background: "none", border: "none",
                    color: "rgba(255,255,255,0.3)",
                    fontSize: 12, fontWeight: 500,
                    cursor: "pointer", fontFamily: "inherit",
                    padding: "7px 8px",
                  }}
                >
                  Skip tour
                </button>
              </div>

              <button
                onClick={handleNext}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: A,
                  color: "#0a0a0a",
                  border: "none",
                  borderRadius: 10, padding: "8px 16px",
                  fontSize: 13, fontWeight: 800,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "opacity 0.2s",
                }}
              >
                {isLast ? "Finish" : <>Next <ChevronRight size={13} /></>}
              </button>
            </div>
          </div>
            </motion.div>
          </div>
        ) : (
          // Positioned card next to spotlight target
          <motion.div
            key={`${mode}-${currentStepIndex}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto absolute"
            style={{
              left: targetRect ? Math.min(targetRect.right + 20, window.innerWidth - 360) : 0,
              top: targetRect ? Math.max(16, Math.min(
                targetRect.top + targetRect.height / 2 - 120,
                window.innerHeight - 340
              )) : 0,
              width: 340,
              zIndex: 202,
            }}
          >
            <div
              style={{
                background: "linear-gradient(160deg, #141414 0%, #0f0f0f 100%)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 24,
                padding: "22px",
                boxShadow: "0 24px 80px rgba(0,0,0,0.85)",
              }}
            >
              {/* Step icon + title row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
                    style={{ background: `${A}18`, border: `1px solid ${A}28` }}
                  >
                    {(() => {
                    const StepIcon = STEP_ICONS[step.id] ?? Sparkles;
                    return <StepIcon size={16} strokeWidth={1.75} color={A} />;
                  })()}
                  </div>
                  <div>
                    <p style={{ color: T.dim, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {currentStepIndex + 1} of {steps.length}
                    </p>
                    <h3 style={{ color: "#fff", fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                      {step.title}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={handleSkip}
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.50)",
                    width: 28, height: 28,
                    borderRadius: "50%",
                    cursor: "pointer",
                    fontSize: 14,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <X size={13} />
                </button>
              </div>

              <p style={{ color: T.body, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
                {step.content}
              </p>

              <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 16 }}>
                {steps.map((_, i) => (
                  <div key={i} style={{ height: 4, borderRadius: 4, transition: "all 0.25s", width: i === currentStepIndex ? 20 : 6, background: i === currentStepIndex ? A : "rgba(255,255,255,0.15)" }} />
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {currentStepIndex > 0 && (
                    <button onClick={handlePrev} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      <ChevronLeft size={13} /> Back
                    </button>
                  )}
                  <button onClick={handleSkip} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", padding: "7px 8px" }}>
                    Skip tour
                  </button>
                </div>
                <button onClick={handleNext} style={{ display: "flex", alignItems: "center", gap: 5, background: A, color: "#0a0a0a", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  {isLast ? "Finish" : <>Next <ChevronRight size={13} /></>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
