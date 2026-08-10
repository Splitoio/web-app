"use client";

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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

/**
 * ONE transition, shared by the spotlight and the card.
 *
 * The tour used to read as two disjoint events: the ring landed on the sidebar
 * item, and the text turned up roughly half a second later. That was
 * `AnimatePresence mode="wait"` around the card — it holds the incoming card
 * until the outgoing card's exit *spring* has fully settled (~500ms for an
 * opacity spring at stiffness 400) — plus a spotlight keyed per step, so it
 * never travelled between targets; it flew in from the viewport origin because
 * its `initial` omitted x/y/width/height.
 *
 * Both now animate the same properties on the same curve, started in the same
 * frame, off a rect measured in a layout effect (i.e. before paint). Change
 * this constant and both move together — never give one of them its own timing.
 */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const DURATION = 0.28;

/** Card geometry. The gap is also what the connector nub spans. */
const CARD_W = 340;
const CARD_GAP = 20;
const EDGE = 16;
/**
 * Only used for the first anchored frame, before the real card is measured.
 * Kept close to the true height (~212px at these copy lengths) so the card
 * doesn't visibly settle downward on the first spotlit step.
 */
const CARD_H_GUESS = 212;

const PANEL_BG = "linear-gradient(160deg, #141414 0%, #0f0f0f 100%)";
const PANEL_BORDER = "1px solid rgba(255,255,255,0.09)";
const PANEL_SHADOW = "0 24px 80px rgba(0,0,0,0.85)";
/** The single dimmer. See `Spotlight` for why it lives on the ring's shadow. */
const SCRIM = "rgba(0,0,0,0.72)";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

export function OnboardingTutorial({
  onComplete,
  isOrgAdmin,
}: {
  onComplete: () => void;
  /** Kept for the gate's call signature; the tour itself is organization-only. */
  mode: OnboardingMode;
  isOrgAdmin?: boolean;
}) {
  const steps = isOrgAdmin ? ORG_STEPS_ADMIN : ORG_STEPS_MEMBER;
  const reduceMotion = useReducedMotion();
  const transition = useMemo(
    () => (reduceMotion ? { duration: 0 } : { duration: DURATION, ease: EASE }),
    [reduceMotion],
  );

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardHeight, setCardHeight] = useState(CARD_H_GUESS);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const step = steps[currentStepIndex];
  const isLast = currentStepIndex === steps.length - 1;

  const handleNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      onComplete();
    }
  }, [currentStepIndex, steps.length, onComplete]);

  const handlePrev = useCallback(() => {
    setCurrentStepIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const handleSkip = useCallback(() => onComplete(), [onComplete]);

  const updateSpotlight = useCallback(() => {
    // On mobile (< 640px) skip spotlight — just show the centered card for all steps
    if (window.innerWidth < 640) {
      setTargetRect(null);
      return;
    }
    const s = steps[currentStepIndex];
    if (s.targetId) {
      const element = document.getElementById(s.targetId);
      setTargetRect(element ? element.getBoundingClientRect() : null);
    } else {
      setTargetRect(null);
    }
  }, [currentStepIndex, steps]);

  // Layout effect, NOT effect: the rect has to exist before the browser paints
  // the new step, otherwise the first painted frame still holds the previous
  // step's rect — and on welcome → first spotlit step it holds `null`, which
  // paints the *centered* card for a frame before it jumps to the sidebar.
  useLayoutEffect(() => {
    updateSpotlight();
  }, [updateSpotlight]);

  useEffect(() => {
    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);
    return () => {
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight, true);
    };
  }, [updateSpotlight]);

  // Measure the real card so it centres on the target instead of on a guess.
  // No dep array on purpose — content height changes per step; the equality
  // check is what stops the loop.
  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight;
    if (h && Math.abs(h - cardHeight) > 1) setCardHeight(h);
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Let a focused button handle its own Enter — otherwise "Skip tour" would
      // both skip and advance.
      const onButton = (e.target as HTMLElement | null)?.closest?.("button");
      if (e.key === "Escape") { e.preventDefault(); handleSkip(); }
      else if (e.key === "ArrowRight" || (e.key === "Enter" && !onButton)) { e.preventDefault(); handleNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); handlePrev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNext, handlePrev, handleSkip]);

  const isCenter = !targetRect;

  /**
   * Card position and the nub's offset inside it, both derived from the same
   * rect the spotlight animates to — so they cannot drift apart.
   */
  const anchored = useMemo(() => {
    if (!targetRect) return null;
    const left = Math.min(targetRect.right + CARD_GAP, window.innerWidth - CARD_W - EDGE);
    const centred = targetRect.top + targetRect.height / 2 - cardHeight / 2;
    const top = clamp(centred, EDGE, Math.max(EDGE, window.innerHeight - cardHeight - EDGE));
    return {
      left,
      top,
      // Where the target's vertical centre falls inside the card.
      nubY: clamp(targetRect.top + targetRect.height / 2 - top, 22, Math.max(22, cardHeight - 22)),
    };
  }, [targetRect, cardHeight]);

  const body = (
    <TourCard
      step={step}
      index={currentStepIndex}
      total={steps.length}
      isLast={isLast}
      isCenter={isCenter}
      onNext={handleNext}
      onPrev={handlePrev}
      onSkip={handleSkip}
    />
  );

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/*
        Backdrop. When a target is spotlit this goes fully transparent and the
        ring's own 9999px shadow does the dimming — otherwise the two stack and
        the "highlighted" nav item ends up dimmed by 75% like everything else,
        which is why the highlight used to read so weakly.
      */}
      <motion.div
        className="absolute inset-0 pointer-events-auto"
        initial={false}
        animate={{ backgroundColor: targetRect ? "rgba(0,0,0,0)" : SCRIM }}
        transition={transition}
        style={{ backdropFilter: targetRect ? undefined : "blur(2px)" }}
        onClick={handleSkip}
      />

      {/*
        Spotlight. Stable key — it is ONE element for the whole tour, so moving
        between steps is a continuous glide rather than a fade-out plus a
        fade-in somewhere else. Its `initial` carries the target geometry
        (slightly loosened) so the first reveal tightens onto the target instead
        of flying in from 0,0.
      */}
      <AnimatePresence>
        {targetRect && (
          <motion.div
            key="tour-spotlight"
            initial={{
              opacity: 0,
              x: targetRect.left - 14,
              y: targetRect.top - 14,
              width: targetRect.width + 28,
              height: targetRect.height + 28,
            }}
            animate={{
              opacity: 1,
              x: targetRect.left - 8,
              y: targetRect.top - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
            exit={{ opacity: 0 }}
            transition={transition}
            className="absolute rounded-xl pointer-events-none"
            style={{
              border: `2px solid ${A}`,
              boxShadow: `0 0 0 9999px ${SCRIM}, 0 0 28px ${A}55`,
              zIndex: 201,
            }}
          />
        )}
      </AnimatePresence>

      {/*
        Card. Keyed by *shape* (anchored vs centred), not by step — so across
        spotlit steps this is the same element gliding on the same curve as the
        ring above, carrying its text with it. No `mode="wait"`: the one real
        swap (centred ↔ anchored) crossfades in place rather than queueing.
      */}
      <AnimatePresence>
        {anchored ? (
          <motion.div
            key="tour-card-anchored"
            initial={{ opacity: 0, x: anchored.left, y: anchored.top }}
            animate={{ opacity: 1, x: anchored.left, y: anchored.top }}
            exit={{ opacity: 0 }}
            transition={transition}
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto absolute"
            style={{ left: 0, top: 0, width: CARD_W, zIndex: 202 }}
          >
            <div ref={cardRef} style={{ position: "relative" }}>
              {/* Connector — points back at the ring so the two read as one object. */}
              <motion.div
                aria-hidden
                initial={false}
                animate={{ y: anchored.nubY - 6 }}
                transition={transition}
                style={{
                  position: "absolute",
                  left: -6,
                  top: 0,
                  width: 12,
                  height: 12,
                  background: "#131313",
                  borderLeft: PANEL_BORDER,
                  borderBottom: PANEL_BORDER,
                  // `rotate` as a motion style, never `transform` — Framer owns
                  // the transform string and would drop a static one.
                  rotate: 45,
                  borderBottomLeftRadius: 3,
                }}
              />
              {body}
            </div>
          </motion.div>
        ) : (
          // The direct child of AnimatePresence must be the motion component —
          // a plain wrapper here means the exit animation is silently skipped.
          <motion.div
            key="tour-card-centered"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            className="pointer-events-none fixed inset-0 flex items-end sm:items-center justify-center sm:px-4"
            style={{ zIndex: 202 }}
          >
            <motion.div
              initial={{ scale: 0.97 }}
              animate={{ scale: 1 }}
              transition={transition}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto w-full sm:max-w-[420px]"
            >
              {body}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * The card body. Deliberately ONE component for both the centred and the
 * anchored placement — they used to be two near-identical copies, which is how
 * the mobile drag handle and the sheet radius ended up on only one of them.
 */
function TourCard({
  step,
  index,
  total,
  isLast,
  isCenter,
  onNext,
  onPrev,
  onSkip,
}: {
  step: Step;
  index: number;
  total: number;
  isLast: boolean;
  isCenter: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const StepIcon = STEP_ICONS[step.id] ?? Sparkles;

  return (
    <div
      className={isCenter ? "onboarding-center-card" : ""}
      style={{
        background: PANEL_BG,
        border: PANEL_BORDER,
        borderRadius: isCenter ? undefined : 24,
        padding: isCenter ? "24px 20px" : "22px",
        boxShadow: PANEL_SHADOW,
        position: "relative",
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
            <StepIcon size={16} strokeWidth={1.75} color={A} />
          </div>
          <div>
            <p style={{ color: T.dim, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {index + 1} of {total}
            </p>
            <h3 style={{ color: "#fff", fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              {step.title}
            </h3>
          </div>
        </div>
        <button
          onClick={onSkip}
          aria-label="Close tour"
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
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            style={{
              height: 4,
              borderRadius: 4,
              transition: `width ${DURATION}s cubic-bezier(${EASE.join(",")}), background-color ${DURATION}s ease`,
              width: i === index ? 20 : 6,
              background: i === index ? A : i < index ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.12)",
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {index > 0 && (
            <button
              onClick={onPrev}
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
            onClick={onSkip}
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
          onClick={onNext}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            background: A,
            color: "#0a0a0a",
            border: "none",
            borderRadius: 10, padding: "8px 16px",
            fontSize: 13, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: `0 6px 18px ${A}30`,
          }}
        >
          {isLast ? "Finish" : <>Next <ChevronRight size={13} /></>}
        </button>
      </div>
    </div>
  );
}
