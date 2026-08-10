"use client";

import { X } from "lucide-react";
import { R, T } from "@/lib/splito-design";

/**
 * A recoverable failure on the pay flow, rendered inline where the failed
 * step lives (the SummaryPanel's route slot) — NOT a toast. This is the
 * public payer surface: no account, one shot at the link, so an error that
 * auto-dismisses in 4s before they've read it just means they stare at a
 * frozen page with no idea what happened. Mirrors
 * components/requests/form-error.tsx's shape (role="alert", dismissible)
 * with one addition: an optional "Try again" that re-runs the step that
 * failed in place, instead of dropping the payer back to reconnect a wallet
 * or re-pick a source they already chose.
 */
export interface PayActionError {
  /** One short payer-facing sentence — never raw provider/server prose. */
  title: string;
  /** Optional supporting line — plain language, no operator detail. */
  detail?: string;
  /**
   * Present only when the failed step can be safely re-run as-is (transient
   * network/quote/signing failures). Absent for terminal outcomes (request
   * no longer payable, already paid) where retrying the same step cannot
   * succeed and offering it would be a dead end.
   */
  onRetry?: () => void;
}

export function PayActionErrorNotice({
  error,
  onDismiss,
}: {
  error: PayActionError;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl px-3.5 py-3"
      style={{ background: "rgba(248,113,113,0.10)", border: `1px solid rgba(248,113,113,0.35)` }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold leading-snug" style={{ color: R }}>
          {error.title}
        </p>
        {error.detail && (
          <p className="text-[12px] leading-snug mt-1" style={{ color: T.muted }}>
            {error.detail}
          </p>
        )}
        {error.onRetry && (
          <button
            type="button"
            onClick={error.onRetry}
            className="mt-2 rounded-lg px-3 py-1.5 text-[12px] font-extrabold transition-all hover:opacity-90"
            style={{ background: "rgba(255,255,255,0.08)", color: T.bright }}
          >
            Try again
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="shrink-0 rounded-md p-0.5 transition-colors hover:bg-white/10"
        style={{ color: T.dim }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
