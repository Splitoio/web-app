"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Clock, ExternalLink, Loader, RefreshCw, XCircle } from "lucide-react";
import { Card, T, G, A, R, O, MONO, eyebrow } from "@/lib/splito-design";
import { explorerTxUrl } from "@/lib/chain-network";
import { assetSymbol, chainName } from "@/lib/pay-sources";
import { formatCurrency } from "@/utils/formatters";
import type { Quote } from "@/api-helpers/requests";

/**
 * Terminal / in-flight payment states. STUCK is mandatory before launch per
 * the design doc (".specs/2026-08-06-request-money-design.md" — "STUCK is
 * mandatory and is the state teams forget") — it must have a visible
 * "we're on it" path, not be treated as a rare edge case handled later.
 */

/**
 * The "Paid" / receipt screen (.design/splito-finance.dc.html:1578-1623).
 *
 * `quote` is the same Quote object the pay screen already fetched — this
 * never re-derives an amount or fee, only re-renders what was already quoted
 * and confirmed. It is null on the "already paid" cold-open (a payer who
 * opens a settled link never had a quote in THIS browser session), in which
 * case the receipt/breakdown cards are omitted rather than filled with
 * guesses and `amount` (the share, always known from the request) drives the
 * headline instead.
 */
export function PaymentConfirmed({
  hash,
  chain,
  quote,
  requesterName,
  amount,
}: {
  hash: string | null;
  chain: string;
  quote: Quote | null;
  requesterName: string | null;
  /** Fallback share amount for the headline when there is no quote. */
  amount?: number | null;
}) {
  const [pdfRequested, setPdfRequested] = useState(false);
  const srcSymbol = quote ? assetSymbol(quote.sourceAsset) : null;
  const dstSymbol = quote ? assetSymbol(quote.destinationAsset) : null;
  const totalSent = quote ? (quote.sourceAmountMax ?? quote.sourceAmount) : null;
  const explorer = explorerTxUrl(chain, hash);

  const receiptRows = quote
    ? [
        { k: "Sent", v: `${totalSent} ${srcSymbol}`, color: T.body },
        { k: "Received", v: `${quote.destinationAmount} ${dstSymbol}`, color: G },
        { k: "Network", v: chainName(chain), color: T.body },
      ]
    : [];

  const feeRows =
    quote?.fees && quote.fees.length > 0
      ? quote.fees.map((f, i) => ({
          key: `${f.kind}-${i}`,
          label: f.label || f.kind,
          amount: f.amount,
          asset: assetSymbol(f.asset),
        }))
      : quote?.fee
        ? [{ key: "fee", label: "Fee", amount: quote.fee, asset: dstSymbol! }]
        : [];

  const headline = quote
    ? `${quote.destinationAmount} ${dstSymbol} landed on ${chainName(chain)}.`
    : amount != null
      ? `Your ${formatCurrency(amount, "USD")} share has already been paid.`
      : "Your payment landed directly in the recipient’s wallet.";

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            margin: "0 auto 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `${G}1f`,
            border: `1px solid ${G}40`,
          }}
        >
          <CheckCircle2 style={{ color: G }} className="h-7 w-7" />
        </div>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: T.white }}>
          Paid
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted }}>{headline}</p>
      </div>

      {receiptRows.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          {receiptRows.map((r) => (
            <div
              key={r.k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <span style={{ fontSize: 12.5, color: T.muted }}>{r.k}</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: r.color }}>
                {r.v}
              </span>
            </div>
          ))}
          {explorer && (
            <div style={{ padding: "12px 20px" }}>
              <a
                href={explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] font-extrabold"
                style={{ color: A }}
              >
                View on explorer <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </Card>
      )}

      {feeRows.length > 0 && (
        <>
          <p style={{ ...eyebrow(T.soft), marginBottom: 12 }}>Cost breakdown</p>
          <Card style={{ padding: "18px 20px", marginBottom: 20 }}>
            {feeRows.map((f) => (
              <div
                key={f.key}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}
              >
                <span style={{ fontSize: 12, color: T.sub }}>{f.label}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: MONO, color: T.body }}>
                  {f.amount} {f.asset}
                </span>
              </div>
            ))}
            <div style={{ height: 1, margin: "10px 0", background: "rgba(255,255,255,0.07)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.main }}>Total charged</span>
              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: MONO, color: T.white }}>
                {totalSent} {srcSymbol}
              </span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 11.5, lineHeight: 1.5, color: T.dim }}>
              Visible to you and the recipient only.
            </p>
          </Card>
        </>
      )}

      <div
        style={{
          padding: 22,
          borderRadius: 20,
          background: "linear-gradient(135deg,rgba(34,211,238,0.1) 0%,rgba(34,211,238,0.02) 100%)",
          border: "1px solid rgba(34,211,238,0.25)",
        }}
      >
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.bright }}>
          This receipt disappears when you close the tab
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.6, color: T.mid }}>
          Claim it to a free account to keep proof of payment
          {requesterName ? `, save ${requesterName} as a contact,` : ""} and pay their next request
          in two taps.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-[13px] font-bold"
            style={{ background: A, color: "#0a0a0a" }}
          >
            Claim this receipt
          </Link>
          <button
            type="button"
            onClick={() => {
              setPdfRequested(true);
              toast("PDF export is coming soon.");
            }}
            disabled={pdfRequested}
            className="rounded-xl px-4.5 py-2.5 text-[13px] font-bold disabled:opacity-50"
            style={{ color: T.sub }}
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export function PaymentFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="p-6 sm:p-8 text-center" style={{ marginTop: 16 }}>
      <XCircle className="h-10 w-10 mx-auto mb-3" style={{ color: R }} />
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

/**
 * ROUTING — contract §4's third submit status, and a state that did not exist
 * before routing.
 *
 * The payer's SOURCE-chain transaction was broadcast and nothing has settled.
 * This is NOT stuck (nothing is wrong yet) and NOT confirmed (the funds are not
 * there), and conflating it with either is the lie this screen exists to avoid.
 * The pay page polls §5 from here; a routed payment reaches STUCK only when
 * that poll says so, never straight from submit.
 */
export function PaymentRouting({
  hash,
  chain,
  message,
  destinationChain,
  onCheckNow,
  isChecking,
  lastCheckedAt,
}: {
  /** SOURCE-chain tx id the payer broadcast. */
  hash: string | null;
  /** The chain that hash lives on — the SOURCE chain, not the destination. */
  chain: string;
  /** Server-supplied explanation (submit's `message`). Rendered verbatim. */
  message: string | null;
  destinationChain: string;
  onCheckNow: () => void;
  isChecking: boolean;
  lastCheckedAt: number | null;
}) {
  const explorer = explorerTxUrl(chain, hash);

  return (
    <Card className="p-6 sm:p-8 text-center" style={{ marginTop: 16 }}>
      <Loader className="h-10 w-10 mx-auto mb-3 animate-spin" style={{ color: A }} />
      <p className="text-[16px] font-extrabold" style={{ color: T.bright }}>
        Sent — now bridging to {chainName(destinationChain)}
      </p>
      <p className="text-[13px] mt-2 max-w-sm mx-auto leading-relaxed" style={{ color: T.muted }}>
        {message ??
          `Your transaction was broadcast on ${chainName(chain)}. The funds have left your wallet and are on their way to the recipient — they have not arrived yet, and we won't say they have until they do.`}
      </p>
      <p className="text-[12px] mt-2 max-w-sm mx-auto leading-relaxed" style={{ color: T.dim }}>
        Don&rsquo;t send it again — that would pay twice. You can safely close this page and come
        back to the same link.
      </p>

      {hash && (
        <div className="mt-4 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1"
            style={{ color: T.dim }}
          >
            {chainName(chain)} transaction
          </p>
          <p className="text-[11px] font-mono break-all" style={{ color: T.soft }}>
            {hash}
          </p>
          {explorer && (
            <a
              href={explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2.5 text-[12px] font-extrabold"
              style={{ color: A }}
            >
              View on explorer <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onCheckNow}
        disabled={isChecking}
        className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-extrabold transition-all hover:opacity-90 disabled:opacity-60"
        style={{ background: "rgba(255,255,255,0.08)", color: T.bright }}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? "animate-spin" : ""}`} />
        {isChecking ? "Checking…" : "Check now"}
      </button>

      <p className="mt-3 text-[11px]" style={{ color: T.dim }}>
        {lastCheckedAt
          ? `We check every few seconds automatically. Last checked ${new Date(lastCheckedAt).toLocaleTimeString()}.`
          : "We check every few seconds automatically."}
      </p>
    </Card>
  );
}

/**
 * STUCK — funds left the payer and have not arrived.
 *
 * Reachable two ways, and the copy differs because what is KNOWN differs:
 *  - `hash` present: the transaction is on-chain. Funds definitely left. We
 *    can prove it with an explorer link, and we cannot yet say they arrived.
 *  - `hash` null: we lost contact with our own server after the payer signed,
 *    so we do not know whether it was broadcast at all. Saying either "sent"
 *    or "safe" would be a claim we cannot support.
 *
 * Neither variant says the funds are lost, and neither says they are safe.
 * Design: ".specs/2026-08-06-request-money-design.md" → States → "`STUCK` is
 * mandatory and is the state teams forget."
 */
export function PaymentStuck({
  hash,
  chain,
  isRouted,
  recovery,
  onCheckNow,
  isChecking,
  lastCheckedAt,
}: {
  hash: string | null;
  chain: string;
  /** Routing is one CAUSE of stuck, not the only one — don't blame it on a
   *  direct payment that simply hasn't confirmed. */
  isRouted: boolean;
  /**
   * The `recovery` object from contract §5 — the ONLY place STUCK now comes
   * from. Its `message` and support `contact` are server-owned copy, rendered
   * verbatim so the recovery path stated to the payer is the one operations
   * actually run, not a second copy of it that can drift.
   */
  recovery: { message: string; contact: string } | null;
  onCheckNow: () => void;
  isChecking: boolean;
  /** epoch ms of the last completed status poll, or null before the first. */
  lastCheckedAt: number | null;
}) {
  const explorer = explorerTxUrl(chain, hash);

  return (
    <Card className="p-6 sm:p-8 text-center" style={{ marginTop: 16 }}>
      <Clock className="h-10 w-10 mx-auto mb-3" style={{ color: O }} />
      <p className="text-[16px] font-extrabold" style={{ color: T.bright }}>
        {hash ? "Your funds left — we're tracking it" : "We lost track of this payment"}
      </p>
      <p className="text-[13px] mt-2 max-w-sm mx-auto leading-relaxed" style={{ color: T.muted }}>
        {recovery ? (
          recovery.message
        ) : hash ? (
          <>
            Your transaction is on {chainName(chain)}, and you can see it below. It has not
            confirmed at the destination yet
            {isRouted ? ", which can happen when a payment is routed between chains" : ""}. We
            don&rsquo;t know yet whether it will arrive, and we won&rsquo;t say it has until it
            does. Don&rsquo;t send it again — that would pay twice.
          </>
        ) : (
          <>
            You signed, but we couldn&rsquo;t reach our server afterwards, so we can&rsquo;t tell
            you yet whether it was submitted. Check your wallet&rsquo;s own history before doing
            anything else — if the transaction is there, it went out; if it isn&rsquo;t, nothing
            left. Don&rsquo;t send it again until you&rsquo;ve looked.
          </>
        )}
      </p>

      {hash && (
        <div className="mt-4 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1"
            style={{ color: T.dim }}
          >
            {chainName(chain)} transaction
          </p>
          <p className="text-[11px] font-mono break-all" style={{ color: T.soft }}>
            {hash}
          </p>
          {explorer && (
            <a
              href={explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2.5 text-[12px] font-extrabold"
              style={{ color: A }}
            >
              View on explorer <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onCheckNow}
        disabled={isChecking}
        className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-extrabold transition-all hover:opacity-90 disabled:opacity-60"
        style={{ background: "rgba(255,255,255,0.08)", color: T.bright }}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? "animate-spin" : ""}`} />
        {isChecking ? "Checking…" : "Check status"}
      </button>

      <p className="mt-3 text-[11px]" style={{ color: T.dim }}>
        {lastCheckedAt
          ? `We check every few seconds automatically. Last checked ${new Date(lastCheckedAt).toLocaleTimeString()}.`
          : "We check every few seconds automatically."}
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed max-w-sm mx-auto" style={{ color: T.dim }}>
        This page updates itself when it resolves — you can safely leave it open, or come back to
        this same link later.
      </p>
      {recovery?.contact && (
        <p className="mt-2 text-[11.5px]" style={{ color: T.muted }}>
          Need a human?{" "}
          <a
            href={`mailto:${recovery.contact}`}
            className="font-extrabold underline underline-offset-2"
            style={{ color: A }}
          >
            {recovery.contact}
          </a>
        </p>
      )}
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
