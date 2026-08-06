"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Card, T, A } from "@/lib/splito-design";
import type { Quote } from "@/api-helpers/requests";

const QUOTE_WINDOW_SECONDS = 60;

function assetLabel(assetId: string): string {
  // "usdc-stellar" -> "USDC"
  const [symbol] = assetId.split("-");
  return symbol.toUpperCase();
}

function chainLabel(chainId: string): string {
  return chainId.charAt(0).toUpperCase() + chainId.slice(1);
}

/**
 * The rate-lock breakdown, shown AFTER wallet connect and BEFORE signing —
 * never hidden, never skipped. Design: ".specs/2026-08-06-request-money-design.md"
 * §"The two-lock model" — lock ② is a 60-second quote on the payer's own
 * transaction. On expiry we re-quote automatically; we never submit a stale
 * quote (design, "Edge cases, decided").
 */
export function QuotePanel({
  quote,
  quoteExpiry,
  sourceChain,
  sourceAsset,
  destinationChain,
  destinationAsset,
  isSubmitting,
  isRequoting,
  onConfirm,
  onExpired,
}: {
  quote: Quote;
  quoteExpiry: string; // ISO datetime, server-supplied — never client-computed
  sourceChain: string;
  sourceAsset: string;
  destinationChain: string;
  destinationAsset: string;
  isSubmitting: boolean;
  isRequoting: boolean;
  onConfirm: () => void;
  onExpired: () => void;
}) {
  const expiryMs = useMemo(() => new Date(quoteExpiry).getTime(), [quoteExpiry]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  const secondsLeft = Math.max(0, Math.ceil((expiryMs - now) / 1000));
  const isExpired = secondsLeft <= 0;
  const pctLeft = Math.max(0, Math.min(1, (expiryMs - now) / (QUOTE_WINDOW_SECONDS * 1000)));

  useEffect(() => {
    if (isExpired && !isRequoting && !isSubmitting) {
      onExpired();
    }
    // Fire once when it crosses zero; onExpired triggers a re-quote which
    // replaces `quoteExpiry` with a fresh future timestamp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpired]);

  return (
    <Card className="p-5 sm:p-6" style={{ marginTop: 16 }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold tracking-[0.08em] uppercase" style={{ color: T.muted }}>
          Rate locked for
        </p>
        <div className="flex items-center gap-2">
          <div
            className="relative flex items-center justify-center"
            style={{ width: 22, height: 22 }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="11" cy="11" r="9" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
              <circle
                cx="11"
                cy="11"
                r="9"
                fill="none"
                stroke={secondsLeft <= 10 ? "#F87171" : A}
                strokeWidth="2.5"
                strokeDasharray={`${2 * Math.PI * 9}`}
                strokeDashoffset={`${2 * Math.PI * 9 * (1 - pctLeft)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.25s linear" }}
              />
            </svg>
          </div>
          <span
            className="text-[13px] font-mono font-bold tabular-nums"
            style={{ color: secondsLeft <= 10 ? "#F87171" : T.bright }}
          >
            {isRequoting ? "…" : `0:${String(secondsLeft).padStart(2, "0")}`}
          </span>
        </div>
      </div>

      {isRequoting ? (
        <div className="flex items-center gap-2 py-6 justify-center">
          <RefreshCw className="h-4 w-4 animate-spin" style={{ color: A }} />
          <p className="text-[13px] font-medium" style={{ color: T.muted }}>
            Quote expired — getting a fresh rate…
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: T.muted }}>
                You send
              </span>
              <span className="text-[15px] font-bold font-mono" style={{ color: T.bright }}>
                {quote.sourceAmount} {assetLabel(sourceAsset)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: T.muted }}>
                From
              </span>
              <span className="text-[13px] font-semibold" style={{ color: T.body }}>
                {chainLabel(sourceChain)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: T.muted }}>
                Rate
              </span>
              <span className="text-[13px] font-mono" style={{ color: T.body }}>
                1 {assetLabel(destinationAsset)} = {quote.rate} {assetLabel(sourceAsset)}
              </span>
            </div>
            {quote.route && (
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: T.muted }}>
                  Route
                </span>
                <span className="text-[13px] font-semibold" style={{ color: T.body }}>
                  {quote.route}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: T.muted }}>
                Fee
              </span>
              <span className="text-[13px] font-mono" style={{ color: T.body }}>
                {quote.fee ?? "included"}
              </span>
            </div>
            <div
              className="flex items-center justify-between pt-3 mt-1"
              style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="text-[13px] font-bold" style={{ color: T.bright }}>
                Lands as
              </span>
              <span className="text-[17px] font-black font-mono" style={{ color: A }}>
                {quote.destinationAmount} {assetLabel(destinationAsset)}
              </span>
            </div>
          </div>

          <div
            className="flex items-start gap-2 mt-4 p-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: T.dim }} />
            <p className="text-[11.5px] leading-relaxed" style={{ color: T.dim }}>
              Funds go directly to the recipient&rsquo;s wallet — there is no escrow and no
              all-or-nothing guarantee. If this quote expires before you sign, we&rsquo;ll get a
              fresh one automatically; we never submit a stale rate.
            </p>
          </div>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isExpired || isSubmitting}
            className="w-full mt-4 rounded-xl py-3.5 text-[14px] font-extrabold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: A, color: "#0a0a0a" }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Confirming…
              </>
            ) : (
              `Sign & pay ${quote.sourceAmount} ${assetLabel(sourceAsset)}`
            )}
          </button>
        </>
      )}
    </Card>
  );
}
