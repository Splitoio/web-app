"use client";

import { useState, useEffect } from "react";
import { useUpdateUser } from "@/features/user/hooks/use-update-profile";
import { Loader2 } from "lucide-react";
import { T, A, INSET } from "@/lib/splito-design";

const PLATFORM_DEFAULT_CURRENCY = "USD";

interface OnboardingModalProps {
  onComplete: () => void;
}

const labelStyle: React.CSSProperties = {
  color: "rgba(204,204,204,0.9)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 8,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: INSET,
  border: "1.5px solid rgba(255,255,255,0.09)",
  borderRadius: 14,
  padding: "12px 16px",
  color: "#fff",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  fontWeight: 500,
};

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [displayName, setDisplayName] = useState("");
  const { mutate: updateUser, isPending } = useUpdateUser();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) return;
    updateUser({ name, currency: PLATFORM_DEFAULT_CURRENCY }, { onSuccess: onComplete });
  };

  const canSubmit = displayName.trim().length > 0 && !isPending;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(20px)" }}
      />

      {/* Card — bottom sheet on mobile, centered modal on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="onboarding-sheet relative z-10 w-full sm:max-w-[460px]"
        style={{
          background: "linear-gradient(160deg, #141414 0%, #0f0f0f 100%)",
          border: "1px solid rgba(255,255,255,0.09)",
          padding: "28px 24px",
          boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
          animation: "slideUp 0.35s cubic-bezier(.32,1.2,.64,1)",
        }}
      >
        {/* Drag handle — mobile only */}
        <div
          className="sm:hidden mx-auto mb-5 h-1 w-10 rounded-full"
          style={{ background: "rgba(255,255,255,0.18)" }}
        />

        {/* Icon */}
        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: `${A}18`, border: `1px solid ${A}30` }}
        >
          <span style={{ fontSize: 22 }}>👋</span>
        </div>

        <h2
          id="onboarding-title"
          style={{ color: "#fff", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}
        >
          Welcome to Splito!
        </h2>
        <p style={{ color: T.mid, fontSize: 13, marginBottom: 24 }}>
          Set up your profile to get started. You can change this anytime.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="onboarding-display-name" style={labelStyle}>
              Your Name
            </label>
            <input
              id="onboarding-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How should we call you?"
              autoFocus
              required
              maxLength={100}
              style={inputStyle}
            />
          </div>

          {/* Default currency info */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "10px 14px",
              marginBottom: 20,
            }}
          >
            <p style={{ color: T.body, fontSize: 12 }}>
              Default currency:{" "}
              <span style={{ color: "#fff", fontWeight: 700 }}>{PLATFORM_DEFAULT_CURRENCY}</span>
            </p>
            <p style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>
              You can change this anytime in Settings.
            </p>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: "100%",
              padding: "13px",
              background: canSubmit ? A : INSET,
              color: canSubmit ? "#0a0a0a" : "#555",
              border: "none",
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 800,
              cursor: canSubmit ? "pointer" : "default",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.2s",
            }}
          >
            {isPending ? (
              <>
                <Loader2 style={{ width: 16, height: 16, animation: "spin 0.8s linear infinite" }} />
                Saving…
              </>
            ) : "Continue →"}
          </button>
        </form>
      </div>
    </div>
  );
}
