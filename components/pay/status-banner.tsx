"use client";

import { CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";
import { Card, T, G } from "@/lib/splito-design";

/**
 * Terminal / in-flight payment states. STUCK is mandatory before launch per
 * the design doc (".specs/2026-08-06-request-money-design.md" — "STUCK is
 * mandatory and is the state teams forget") — it must have a visible
 * "we're on it" path, not be treated as a rare edge case handled later.
 */
export function PaymentConfirmed({ hash, chain }: { hash: string | null; chain: string }) {
  return (
    <Card className="p-6 sm:p-8 text-center" style={{ marginTop: 16 }}>
      <CheckCircle2 className="h-10 w-10 mx-auto mb-3" style={{ color: G }} />
      <p className="text-[16px] font-extrabold" style={{ color: T.bright }}>
        Payment sent
      </p>
      <p className="text-[13px] mt-1.5" style={{ color: T.muted }}>
        Your payment landed directly in the recipient&rsquo;s wallet. No further action needed.
      </p>
      {hash && (
        <p className="text-[11px] mt-3 font-mono break-all" style={{ color: T.dim }}>
          {chain} tx: {hash}
        </p>
      )}
    </Card>
  );
}

export function PaymentFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="p-6 sm:p-8 text-center" style={{ marginTop: 16 }}>
      <XCircle className="h-10 w-10 mx-auto mb-3" style={{ color: "#F87171" }} />
      <p className="text-[16px] font-extrabold" style={{ color: T.bright }}>
        Payment failed
      </p>
      <p className="text-[13px] mt-1.5" style={{ color: T.muted }}>
        Your funds were not sent. Nothing left your wallet.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-xl px-5 py-2.5 text-[13px] font-extrabold transition-all hover:opacity-90"
        style={{ background: "rgba(255,255,255,0.08)", color: T.bright }}
      >
        Try again
      </button>
    </Card>
  );
}

export function PaymentStuck({ hash, chain }: { hash: string | null; chain: string }) {
  return (
    <Card className="p-6 sm:p-8 text-center" style={{ marginTop: 16 }}>
      <Clock className="h-10 w-10 mx-auto mb-3" style={{ color: "#FBBF24" }} />
      <p className="text-[16px] font-extrabold" style={{ color: T.bright }}>
        We&rsquo;re on it
      </p>
      <p className="text-[13px] mt-1.5 max-w-sm mx-auto" style={{ color: T.muted }}>
        Your transaction left your wallet but hasn&rsquo;t confirmed at the destination yet.
        This can happen with cross-chain routing. We&rsquo;re actively monitoring it — you
        don&rsquo;t need to resubmit or contact anyone. This page will update automatically
        once it resolves.
      </p>
      {hash && (
        <p className="text-[11px] mt-3 font-mono break-all" style={{ color: T.dim }}>
          {chain} tx: {hash}
        </p>
      )}
      <div className="flex items-center justify-center gap-1.5 mt-4 text-[11px]" style={{ color: T.dim }}>
        <RefreshCw className="h-3 w-3 animate-spin" />
        Checking status…
      </div>
    </Card>
  );
}

export function RequestClosed({ reason }: { reason: "EXPIRED" | "CANCELLED" | "SETTLED" | "not-found" }) {
  const copy: Record<string, { title: string; body: string }> = {
    EXPIRED: {
      title: "This request has expired",
      body: "The requester will need to send a new link.",
    },
    CANCELLED: {
      title: "This request was cancelled",
      body: "No payment is needed here.",
    },
    SETTLED: {
      title: "This request is fully paid",
      body: "Everyone who owed on this request has paid. Nothing more to do.",
    },
    "not-found": {
      title: "We couldn't find this request",
      body: "Check the link — it may have been copied incorrectly.",
    },
  };
  const c = copy[reason];
  return (
    <Card className="p-6 sm:p-8 text-center">
      <p className="text-[16px] font-extrabold" style={{ color: T.bright }}>
        {c.title}
      </p>
      <p className="text-[13px] mt-1.5" style={{ color: T.muted }}>
        {c.body}
      </p>
    </Card>
  );
}
