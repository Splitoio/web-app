"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, PenLine, RefreshCw, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import { T, A, R, O, BORDER } from "@/lib/splito-design";
import type { Quote } from "@/api-helpers/requests";
import { assetSymbol, chainName, DEFAULT_SLIPPAGE_PCT } from "@/lib/pay-sources";
import { formatCurrency } from "@/utils/formatters";

const QUOTE_WINDOW_SECONDS = 60;

/**
 * The router's own end-to-end estimate, in words. Returns null when the
 * provider reported nothing — the row is then omitted rather than filled with
 * a guessed duration, for the same reason a fee is never synthesised.
 */
function formatEta(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
  const seconds = Math.round(ms / 1000);
  if (seconds < 90) return `~${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `~${hours}h`;
}

/**
 * Names the on-chain mechanism honestly for the converted-exact state
 * (`.specs/2026-08-07-router-alternatives.md` → "This fixes the firm-quote
 * problem"). Both are same-chain, exact-output providers, so the chain the
 * conversion happens on identifies which one — Stellar path payments enforce
 * `Destination amount` via `sendMax`; Jupiter enforces it via
 * `swapMode=ExactOut` / `otherAmountThreshold`. Falls back to a neutral label
 * rather than guessing when the chain is neither.
 */
function conversionMechanism(chain: string): string {
  if (chain === "stellar") return "a Stellar path payment";
  if (chain === "solana" || chain === "mainnet-beta") return "a Jupiter swap";
  return "an on-chain conversion";
}

/**
 * The cost breakdown, shown AFTER wallet connect and BEFORE signing — never
 * hidden, never skipped (".plans/2026-08-06-request-money.md" → "UI direction
 * — settled": "The rate lock is the product; it has to be visible at the
 * moment of commitment"). On expiry we re-quote; we never submit a stale
 * quote (design, "Edge cases, decided").
 *
 * ── Three states, driven by `isRouted` / `isEstimate` — never re-derived ──
 *
 * The test is `quote.isRouted` / `quote.isEstimate` — the server's explicit
 * statement of which path this is (contract §3, changed 2026-08-07). It is NOT
 * `quote.route == null`: `route` is a provider-supplied display label, and a
 * provider returning an empty one would make a routed payment render as direct
 * and print "exactly" over an estimate. Never re-derive the path from the
 * source/destination pair either — the server already decided.
 *
 * DIRECT (`isRouted === false`): the payer sends the exact destination asset
 * on the destination chain. Nothing converts between assets, so the amount
 * that lands IS the amount sent. This path may — and does — say "exactly".
 *
 * CONVERTED & EXACT (`isRouted === true`, `isEstimate === false`, ADDED
 * 2026-08-07 — `.specs/2026-08-07-router-alternatives.md`): a same-chain,
 * exact-output provider (Stellar path payment `sendMax`, Jupiter
 * `swapMode=ExactOut`) converts on the way. The recipient's landed amount is
 * protocol-enforced exact — guaranteed on-chain, or the transaction reverts.
 * The uncertainty moves to the PAYER's side: `sourceAmountMax` is the ceiling
 * they authorize, not an estimate. This panel says "exactly"/"guaranteed"
 * about what LANDS, "up to" about what the payer SPENDS, and never uses
 * amber estimate styling here — it is a confident state, visually closer to
 * direct than to the routed estimate below.
 *
 * ROUTED ESTIMATE (`isRouted === true`, `isEstimate === true`): a
 * third-party router (Allbridge Core) converts on the way.
 * Allbridge Core exposes *calculation* endpoints, NOT a reservable quote, and
 * documents no validity window at all (".specs/2026-08-06-router-selection.md"
 * → "⚠️ There is no firm quote"). Our 60 seconds bounds how long WE will hold
 * the number, not what the router will honour. So every amount on this path
 * is an ESTIMATE inside a slippage band, and this panel must never write
 * "exactly", "guaranteed", or "you will receive" on it. Landing outside the
 * band marks the share partially paid and shows the shortfall — it is not
 * topped up.
 */
export function QuotePanel({
  quote,
  quoteExpiry,
  sourceChain,
  sourceAsset,
  destinationChain,
  destinationAsset,
  denominationCurrency,
  amount,
  signatureKinds,
  signatureStep,
  isSubmitting,
  isRequoting,
  onConfirm,
  onExpired,
  onChangeSource,
}: {
  quote: Quote;
  quoteExpiry: string; // ISO datetime, server-supplied — never client-computed
  sourceChain: string;
  sourceAsset: string;
  destinationChain: string;
  destinationAsset: string;
  /** The currency the share is denominated in — USD in v1. */
  denominationCurrency: string;
  /** The payer's fiat share amount — drives the rate-lock note's "$X is $X" copy. */
  amount: number;
  /**
   * The `kind` of every transaction the payer must sign, IN ORDER — i.e.
   * `unsignedTransactions.map(t => t.kind)` on a routed payment, where an
   * "approve" leg can precede "transfer". Empty on the direct path, which is
   * always a single signature. Surfaced BEFORE the button so a second wallet
   * prompt is expected rather than alarming; a surprise second prompt reads as
   * a duplicate charge.
   */
  signatureKinds: string[];
  /** 1-based index of the signature currently being requested, while submitting. */
  signatureStep: number;
  isSubmitting: boolean;
  isRequoting: boolean;
  onConfirm: () => void;
  onExpired: () => void;
  /** Omitted when there is nothing else the payer could pay with. */
  onChangeSource?: () => void;
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

  // The server's own verdict on which path this is — see the file header for
  // why this is not derived from `route` or from the chain pair.
  const isRouted = quote.isRouted;
  const isEstimate = quote.isEstimate;
  // Converted, but exact-output: a same-chain provider (Stellar path payment /
  // Jupiter ExactOut) converts on the way and still guarantees the landed
  // amount. Never amber — see file header.
  const isConvertedExact = isRouted && !isEstimate;
  const srcSymbol = assetSymbol(quote.sourceAsset ?? sourceAsset);
  const dstSymbol = assetSymbol(quote.destinationAsset ?? destinationAsset);
  // Never fabricated: degrade to the calculated `sourceAmount` when the
  // backend omits the ceiling rather than inventing one.
  const sourceCeiling = isConvertedExact ? quote.sourceAmountMax : null;
  const mechanismLabel = conversionMechanism(quote.destinationChain ?? destinationChain);

  // Band shown on routed payments. Backend-supplied bps wins; otherwise the
  // design's documented ±0.5% starting tolerance. Never a made-up number.
  const slippagePct =
    quote.slippageBps != null ? quote.slippageBps / 100 : DEFAULT_SLIPPAGE_PCT;

  // Worst case inside the disclosed band. A provider-reported floor
  // (`destinationAmountMin`) is the honest number and always wins; only when
  // the provider reported none do we apply the band we ourselves committed to,
  // which is arithmetic on two figures already on screen rather than an
  // invented one.
  const destNum = Number(quote.destinationAmount);
  const worstCase =
    quote.destinationAmountMin ??
    (Number.isFinite(destNum)
      ? (destNum * (1 - slippagePct / 100)).toFixed(
          (quote.destinationAmount.split(".")[1] ?? "").length || 2
        )
      : null);

  // Full breakdown when the router gave one; the legacy headline `fee` only
  // when it did not. Never both, and never a placeholder row.
  const feeRows: { key: string; label: string; amount: string; asset: string }[] =
    quote.fees && quote.fees.length > 0
      ? quote.fees.map((f, i) => ({
          key: `${f.kind}-${i}`,
          label: f.label || f.kind,
          amount: f.amount,
          asset: assetSymbol(f.asset),
        }))
      : quote.fee
        ? [{ key: "fee", label: "Fee", amount: quote.fee, asset: dstSymbol }]
        : [];

  const etaLabel = formatEta(quote.estimatedTimeMs);
  const signatureCount = Math.max(1, signatureKinds.length);
  const multiSig = signatureCount > 1;

  return (
    <div style={{ padding: "18px 22px" }}>
      <div className="flex items-center justify-between mb-4 gap-3">
        <p
          className="text-[11px] font-bold tracking-[0.08em] uppercase"
          style={{ color: T.muted }}
        >
          {/* Lock 2 — the CONVERSION QUOTE (.specs/2026-08-06-request-money-design.md
              → "The two-lock model"), never "rate locked": that phrase is
              reserved for Lock 1 (the request's own denomination lock) below,
              and reusing it here read as the page contradicting itself when
              both are on screen at once. */}
          {isEstimate ? "Estimate holds for" : "Quote holds for"}
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
                stroke={secondsLeft <= 10 ? R : A}
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
            style={{ color: secondsLeft <= 10 ? R : T.bright }}
          >
            {isRequoting ? "…" : `0:${String(secondsLeft).padStart(2, "0")}`}
          </span>
        </div>
      </div>

      {isRequoting ? (
        <div className="flex items-center gap-2 py-6 justify-center">
          <RefreshCw className="h-4 w-4 animate-spin" style={{ color: A }} />
          <p className="text-[13px] font-medium" style={{ color: T.muted }}>
            {isEstimate
              ? "Estimate expired — recalculating…"
              : "Quote expired — getting a fresh rate…"}
          </p>
        </div>
      ) : (
        <>
          {/* Path badge — the payer should never have to infer which one they're on. */}
          <div className="flex items-center justify-between gap-2 mb-3.5">
            {isEstimate ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em]"
                style={{ background: `${O}22`, color: O }}
              >
                Routed · estimate
              </span>
            ) : isConvertedExact ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em]"
                style={{ background: "rgba(34,211,238,0.14)", color: A }}
              >
                <ShieldCheck className="h-3 w-3" /> Converted · exact
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em]"
                style={{ background: "rgba(34,211,238,0.14)", color: A }}
              >
                <Zap className="h-3 w-3" /> Direct · exact
              </span>
            )}
            {onChangeSource && (
              <button
                type="button"
                onClick={onChangeSource}
                className="text-[11.5px] font-bold underline underline-offset-2"
                style={{ color: T.muted }}
              >
                Change
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px]" style={{ color: T.muted }}>
                {sourceCeiling ? "You pay up to" : "You send"}
              </span>
              <span className="text-[15px] font-bold font-mono text-right" style={{ color: T.bright }}>
                {sourceCeiling ?? quote.sourceAmount} {srcSymbol}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px]" style={{ color: T.muted }}>
                From
              </span>
              <span className="text-[13px] font-semibold text-right" style={{ color: T.body }}>
                {chainName(quote.sourceChain ?? sourceChain)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px]" style={{ color: T.muted }}>
                Rate
              </span>
              {/* The backend's `rate` is destination-asset units per ONE unit
                  of the denomination currency (request-money.controller.ts:
                  "rate = destination-asset units per 1 fiat unit"). Labelling
                  it as a source-to-destination rate was wrong on both paths
                  and read as a tautology on the direct one. */}
              <span className="text-[13px] font-mono text-right" style={{ color: T.body }}>
                1 {denominationCurrency} = {quote.rate} {dstSymbol}
              </span>
            </div>
            {isRouted && quote.route && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px]" style={{ color: T.muted }}>
                  Route
                </span>
                <span className="text-[13px] font-semibold text-right break-all" style={{ color: T.body }}>
                  {quote.route}
                  {quote.providerId ? (
                    <span className="font-normal" style={{ color: T.dim }}> · via {quote.providerId}</span>
                  ) : null}
                </span>
              </div>
            )}
            {/* Every cost the router reported, itemised. No rows at all when it
                reported none — a placeholder here would be a made-up number in
                the one place it matters most. */}
            {feeRows.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-3">
                <span className="text-[13px]" style={{ color: T.muted }}>
                  {f.label}
                </span>
                <span className="text-[13px] font-mono text-right" style={{ color: T.body }}>
                  {f.amount} {f.asset}
                </span>
              </div>
            ))}
            {isRouted && etaLabel && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px]" style={{ color: T.muted }}>
                  Usually takes
                </span>
                <span className="text-[13px] font-mono text-right" style={{ color: T.body }}>
                  {etaLabel}
                </span>
              </div>
            )}
            {isEstimate && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px]" style={{ color: T.muted }}>
                  Tolerance
                </span>
                <span className="text-[13px] font-mono text-right" style={{ color: T.body }}>
                  ±{slippagePct}%
                </span>
              </div>
            )}

            <div
              className="flex items-center justify-between gap-3 pt-3 mt-1"
              style={{ borderTop: BORDER }}
            >
              <span className="text-[13px] font-bold" style={{ color: T.bright }}>
                {isEstimate ? "Estimated to land" : "Lands as"}
              </span>
              <span className="text-[17px] font-black font-mono text-right" style={{ color: A }}>
                {isEstimate ? "≈ " : ""}
                {quote.destinationAmount} {dstSymbol}
              </span>
            </div>

            {isEstimate && worstCase && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px]" style={{ color: T.dim }}>
                  As little as, within tolerance
                </span>
                <span className="text-[12px] font-mono text-right" style={{ color: T.dim }}>
                  {worstCase} {dstSymbol}
                </span>
              </div>
            )}
          </div>

          {/* Lock 1 — the request's own DENOMINATION lock
              (.design/splito-finance.dc.html:1546-1548;
              .specs/2026-08-06-request-money-design.md → "The two-lock
              model"). `quote.rateLocked` is the server's own verdict on
              which rate was actually charged (contract change,
              request-money.controller.ts ~line 906): true only when the
              requester's Lock-1 rate from request creation was used.
              Deliberately never says "rate locked" up here — that phrase now
              belongs solely to the Lock-2 countdown header above, and this
              note calls out "the quote above" explicitly so the two read as
              complementary (creation-time lock vs. this-minute quote), not
              as a contradiction. */}
          <div
            className="flex items-center gap-2 mt-2.5 p-2.5 rounded-xl"
            style={{
              background: quote.rateLocked ? `${A}0f` : "rgba(255,255,255,0.03)",
              border: `1px solid ${quote.rateLocked ? `${A}2e` : "rgba(255,255,255,0.06)"}`,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                flexShrink: 0,
                background: quote.rateLocked ? A : T.faint,
              }}
            />
            <p className="text-[11.5px] leading-relaxed" style={{ color: T.mid }}>
              {quote.rateLocked ? (
                <>
                  The sender locked this request&rsquo;s rate when they created it —{" "}
                  <span style={{ color: T.main, fontWeight: 700 }}>
                    {formatCurrency(amount, denominationCurrency)}
                  </span>{" "}
                  stays {formatCurrency(amount, denominationCurrency)} no matter when you pay.
                  The quote above is a separate, shorter hold on today&rsquo;s conversion.
                </>
              ) : (
                "The sender didn't lock a rate when they created this request — today's conversion is the quote above, fetched live just now."
              )}
            </p>
          </div>

          <div
            className="flex items-start gap-2 mt-2.5 p-3 rounded-xl"
            style={{
              background: isEstimate
                ? `${O}0f`
                : isConvertedExact
                  ? `${A}0f`
                  : "rgba(255,255,255,0.03)",
              border: `1px solid ${
                isEstimate ? `${O}2e` : isConvertedExact ? `${A}2e` : "rgba(255,255,255,0.06)"
              }`,
            }}
          >
            {isConvertedExact ? (
              <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: A }} />
            ) : (
              <ShieldAlert
                className="h-3.5 w-3.5 flex-shrink-0 mt-0.5"
                style={{ color: isEstimate ? O : T.dim }}
              />
            )}
            <p
              className="text-[11.5px] leading-relaxed"
              style={{ color: isEstimate ? T.mid : isConvertedExact ? T.body : T.dim }}
            >
              {isEstimate ? (
                <>
                  <strong style={{ color: O }}>This amount is an estimate, not a
                  guarantee.</strong>{" "}
                  Your {srcSymbol} is converted by a third-party router that calculates a price
                  but does not reserve one, so what lands can move by up to ±{slippagePct}% either
                  way. Our {QUOTE_WINDOW_SECONDS} seconds is how long we hold this number — not a
                  promise from the router. If it lands short of your share, your share is marked
                  partially paid and the shortfall is shown; we do not top it up.
                  {onChangeSource
                    ? ` Paying with ${dstSymbol} on ${chainName(destinationChain)} avoids all of this and lands the exact amount.`
                    : ""}
                </>
              ) : isConvertedExact ? (
                <>
                  This converts through <strong style={{ color: A }}>{mechanismLabel}</strong> —
                  the recipient receives exactly {quote.destinationAmount} {dstSymbol}, guaranteed
                  on-chain. If the price moves too far before you sign, the transaction{" "}
                  <strong style={{ color: T.bright }}>reverts rather than underpaying</strong> —
                  there is no partial fill. What varies is what you spend:{" "}
                  {sourceCeiling
                    ? `your wallet authorizes up to ${sourceCeiling} ${srcSymbol}, and only what the conversion actually needs is used.`
                    : `the amount above is what the conversion needs at today's rate.`}{" "}
                  If this quote expires before you sign we&rsquo;ll get a fresh one; we never
                  submit a stale rate.
                </>
              ) : (
                <>
                  You&rsquo;re sending the exact asset the recipient asked for, so no conversion
                  happens on the way — {quote.destinationAmount} {dstSymbol}{" "}
                  is exactly what lands, minus only the network&rsquo;s own fee. Funds go straight to their wallet: there
                  is no escrow, and each person&rsquo;s payment lands on its own, so this is not
                  all-or-nothing. If this quote expires before you sign we&rsquo;ll get a fresh
                  one; we never submit a stale rate.
                </>
              )}
            </p>
          </div>

          {isRouted && (
            <p className="text-[11px] leading-relaxed mt-2.5" style={{ color: T.dim }}>
              Funds go straight to the recipient&rsquo;s wallet — no escrow, and each person&rsquo;s
              payment lands on its own, so this is not all-or-nothing.
            </p>
          )}

          {/* MULTI-SIGNATURE, DISCLOSED BEFORE THE BUTTON. A routed payment can
              need an allowance ("approve") signed before the transfer, or —
              for a same-chain Jupiter conversion — a "swap" leg (converts
              inside the payer's OWN wallet) before the "transfer" leg that
              actually pays the recipient. Either way the wallet prompts more
              than once, and an unannounced second prompt reads as a duplicate
              charge — so the count is stated up front and the button counts
              the steps off.

              The "swap" case gets its OWN copy, not the "approve" one: an
              approve that never completes truly leaves nothing sent, but a
              swap that completes and is followed by a failed transfer is NOT
              a no-op — the payer is not out of pocket, but they now hold a
              different asset than they started with. Saying "nothing is
              sent" here would be false, and calling this atomic would be
              worse. */}
          {multiSig && (
            <div
              className="flex items-start gap-2 mt-2.5 p-3 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: BORDER,
              }}
            >
              <PenLine className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: T.muted }} />
              <p className="text-[11.5px] leading-relaxed" style={{ color: T.muted }}>
                <strong style={{ color: T.bright }}>
                  Your wallet will ask you to sign {signatureCount} times.
                </strong>{" "}
                {signatureKinds[0] === "approve" ? (
                  "The first approves the router to move your funds; the last one actually sends them. This is one payment, not " +
                  String(signatureCount) +
                  " — you are only charged once. Approve every prompt, or nothing is sent."
                ) : signatureKinds[0] === "swap" ? (
                  <>
                    The first converts {srcSymbol} inside your OWN wallet; the second sends the
                    converted amount to the recipient. <strong style={{ color: T.bright }}>These
                    two steps are not one atomic action.</strong> If the first succeeds and the
                    second fails, you are not out of pocket — but you will be holding the
                    converted asset in your wallet instead of {srcSymbol}, not a completed
                    payment. Approve every prompt to complete the payment in one go.
                  </>
                ) : (
                  `This is one payment, not ${signatureCount} — you are only charged once. Approve every prompt, or nothing is sent.`
                )}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onConfirm}
            disabled={isExpired || isSubmitting}
            className="w-full mt-4 rounded-xl py-3.5 text-[14px] font-extrabold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: A, color: "#0a0a0a" }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />{" "}
                {multiSig
                  ? `Signature ${Math.min(signatureStep, signatureCount)} of ${signatureCount}…`
                  : "Confirming…"}
              </>
            ) : multiSig ? (
              sourceCeiling
                ? `Sign ${signatureCount}× & pay up to ${sourceCeiling} ${srcSymbol}`
                : `Sign ${signatureCount}× & pay ${quote.sourceAmount} ${srcSymbol}`
            ) : sourceCeiling ? (
              `Sign & pay up to ${sourceCeiling} ${srcSymbol}`
            ) : (
              `Sign & pay ${quote.sourceAmount} ${srcSymbol}`
            )}
          </button>
        </>
      )}
    </div>
  );
}
