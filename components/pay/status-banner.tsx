"use client";

import { CheckCircle2, Clock, ExternalLink, Loader, RefreshCw, XCircle } from "lucide-react";
import { Card, T, G, A } from "@/lib/splito-design";
import { explorerTxUrl } from "@/lib/chain-network";
import { chainName } from "@/lib/pay-sources";

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
        <>
          <p className="text-[11px] mt-3 font-mono break-all" style={{ color: T.dim }}>
            {chainName(chain)} tx: {hash}
          </p>
          {explorerTxUrl(chain, hash) && (
            <a
              href={explorerTxUrl(chain, hash)!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-[12px] font-extrabold"
              style={{ color: A }}
            >
              View on explorer <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </>
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
      <Clock className="h-10 w-10 mx-auto mb-3" style={{ color: "#FBBF24" }} />
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
