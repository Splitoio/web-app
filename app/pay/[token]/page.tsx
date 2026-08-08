"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { T, Card, INSET } from "@/lib/splito-design";
import {
  getRequestByToken,
  getSupportedSources,
  getPaymentAttempt,
  createRequestQuote,
  submitRequestPayment,
  type GetRequestResponse,
  type QuoteRequestResponse,
  type SubmitRequestResponse,
  type PublicPaymentAttemptResponse,
} from "@/api-helpers/requests";
import {
  directSourceFor,
  isDirectSource,
  type PaySource,
} from "@/lib/pay-sources";
import {
  AmountHero,
} from "@/components/pay/amount-hero";
import { PayerPicker } from "@/components/pay/payer-picker";
import { WalletConnect, type ConnectedWallet } from "@/components/pay/wallet-connect";
import { SourcePicker } from "@/components/pay/source-picker";
import { QuotePanel } from "@/components/pay/quote-panel";
import { SummaryPanel } from "@/components/pay/summary-panel";
import { PayActionErrorNotice, type PayActionError } from "@/components/pay/action-error";
import {
  PaymentConfirmed,
  PaymentFailed,
  PaymentRouting,
  PaymentStuck,
  RequestClosed,
} from "@/components/pay/status-banner";
import {
  signAndBroadcastSolanaUnsignedTx,
  signRoutedTransactions,
  signStellarUnsignedTx,
} from "@/components/pay/pay-wallet";

/** "allbridge" -> "Allbridge" — display only, never used to decide a path. */
function humanizeProvider(id: string | null | undefined): string | null {
  if (!id) return null;
  return id.charAt(0).toUpperCase() + id.slice(1);
}

const WIDE_PHASES = new Set([
  "connect-wallet",
  "select-source",
  "quoting",
  "ready",
  "requoting",
  "submitting",
]);

function RouteHint({ text, spinner }: { text: string; spinner?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2" style={{ padding: "18px 22px" }}>
      {spinner && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: T.muted }} />}
      <p className="text-[11.5px] text-center" style={{ color: T.dim }}>
        {text}
      </p>
    </div>
  );
}

type Phase =
  | "loading"
  | "not-found"
  | "closed"
  | "already-paid"
  | "select-payer"
  | "connect-wallet"
  | "select-source"
  | "quoting"
  | "ready"
  | "requoting"
  | "submitting"
  | "confirmed"
  | "failed"
  // Contract §4: submit's ROUTING status. Broadcast on the source chain,
  // nothing settled. Distinct from `stuck`, which only §5 can declare.
  | "routing"
  | "stuck";

const STATUS_POLL_MS = 6000;

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "Something went wrong. Please try again.";
}

/**
 * Turns a failed quote/submit call into payer-facing copy plus a retryable
 * flag. Neither endpoint ships a machine-readable `reason` field the way
 * POST /requests does (checked in backend/src/controllers/request-money.
 * controller.ts — quoteRequest/submitRequest only ever send `{ error }`), so
 * this branches on HTTP status instead: 404/409 mean the request or attempt
 * itself moved on (deleted, expired, already paid, already in flight
 * elsewhere) and retrying the SAME step cannot succeed. Everything else
 * (5xx, 502 from the router, a network failure with no status at all) is
 * assumed transient. "Quote has expired" (submitRequest's own 400 for a
 * stale server-side quote) is special-cased because its fix isn't "resubmit",
 * it's "get a new quote".
 */
function classifyRecoverable(
  err: unknown,
  fallbackTitle: string
): { title: string; detail?: string; retryable: boolean; expiredQuote: boolean } {
  const code = (err as { code?: number })?.code;
  const message = errorMessage(err);

  if (/quote has expired/i.test(message)) {
    return {
      title: "Your quote expired.",
      detail: "Rates only hold for a short window — get a fresh one and you're set.",
      retryable: true,
      expiredQuote: true,
    };
  }
  if (code === 404) {
    return {
      title: "This payment link isn't valid anymore.",
      detail: "Reload the page to see its current status.",
      retryable: false,
      expiredQuote: false,
    };
  }
  if (code === 409) {
    return {
      title: "This payment can't continue from here.",
      detail: message,
      retryable: false,
      expiredQuote: false,
    };
  }
  return {
    title: fallbackTitle,
    detail: "This is usually temporary — try again.",
    retryable: true,
    expiredQuote: false,
  };
}

export default function PayRequestPage() {
  const params = useParams();
  const token = params?.token as string;
  const searchParams = useSearchParams();
  const payerParam = searchParams.get("payer");

  const [phase, setPhase] = useState<Phase>("loading");
  const [request, setRequest] = useState<GetRequestResponse | null>(null);
  const [closedReason, setClosedReason] = useState<"EXPIRED" | "CANCELLED" | "SETTLED" | "not-found">(
    "not-found"
  );
  const [selectedPayerId, setSelectedPayerId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  // No hardcoded starting list: until the server answers, the only source we
  // can honestly offer is the request's own destination pair (always quotable,
  // routing on or off). GET /sources then replaces it wholesale.
  const [sources, setSources] = useState<PaySource[]>([]);
  const [selectedSource, setSelectedSource] = useState<PaySource | null>(null);
  const [quote, setQuote] = useState<QuoteRequestResponse | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitRequestResponse | null>(null);
  // Set independently of `submitResult` because the STUCK state is often
  // reached WITHOUT a submit response — see handleConfirmSign.
  const [stuckHash, setStuckHash] = useState<string | null>(null);
  // The attempt being tracked, and the last §5 read of it. `attemptId` is set
  // the moment we sign, NOT when submit returns — if submit never answers we
  // still need something to poll.
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<PublicPaymentAttemptResponse | null>(null);
  // 1-based wallet-prompt counter for routed multi-signature payments.
  const [signatureStep, setSignatureStep] = useState(1);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  // Recoverable failure from a quote/sign/submit step, rendered inline in the
  // SummaryPanel's route slot — see components/pay/action-error.tsx. Cleared
  // at the start of every fresh attempt (requestQuote, handleConfirmSign) so
  // a retry never leaves a stale message sitting over a new in-flight step.
  const [actionError, setActionError] = useState<PayActionError | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRequest = useCallback(async () => {
    try {
      const data = await getRequestByToken(token);
      setRequest(data);
      // Guaranteed-quotable baseline, derived from this request rather than
      // guessed. GET /sources widens it if routing is on.
      setSources((current) => (current.length ? current : [directSourceFor(data)]));

      if (data.status === "EXPIRED" || data.status === "CANCELLED" || data.status === "SETTLED") {
        setClosedReason(data.status);
        setPhase("closed");
        return;
      }

      const preselected = payerParam
        ? data.payers.find((p) => p.payerId === payerParam)
        : data.payers.length === 1
          ? data.payers[0]
          : null;

      if (preselected) {
        if (preselected.status === "CONFIRMED") {
          setSelectedPayerId(preselected.payerId);
          setPhase("already-paid");
        } else {
          setSelectedPayerId(preselected.payerId);
          setPhase("connect-wallet");
        }
      } else {
        setPhase("select-payer");
      }
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      setClosedReason(code === 410 ? "EXPIRED" : "not-found");
      setPhase(code === 410 ? "closed" : "not-found");
    }
  }, [token, payerParam]);

  useEffect(() => {
    if (!token) return;
    loadRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // What the payer may pay WITH — server-owned and request-specific
  // (contract §2b). Failure keeps the direct pair set above rather than
  // widening to a guess, so the payer can always still pay.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getSupportedSources(token)
      .then((res) => {
        if (!cancelled && res?.sources?.length) setSources(res.sources);
      })
      .catch(() => {
        // Never block the payer on it; the direct pair is already offered.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  /**
   * Poll the ATTEMPT (contract §5), not the request.
   *
   * The request-level endpoint only reports whether a payer's share is paid;
   * it cannot tell in-flight from stuck, carries no destination hash, and has
   * no recovery copy. §5 has all three, so it is the only thing worth polling
   * once a payment is in flight — and STUCK now comes from here alone, never
   * from submit.
   */
  const checkStatus = useCallback(async () => {
    if (!attemptId) return;
    setIsChecking(true);
    try {
      const data = await getPaymentAttempt(token, attemptId);
      setAttempt(data);
      setLastCheckedAt(Date.now());

      // CONFIRMED = direct success, DELIVERED = routed success. Both are paid.
      if (data.status === "CONFIRMED" || data.status === "DELIVERED") {
        setPhase("confirmed");
      } else if (data.status === "FAILED") {
        setPhase("failed");
      } else if (data.status === "STUCK") {
        setPhase("stuck");
      } else if (data.status === "BROADCAST" || data.status === "ROUTING") {
        // STUCK -> ROUTING is a legal backend transition: a transfer that was
        // stuck and started moving again must stop saying it is stuck.
        setPhase((current) => (current === "stuck" ? "routing" : current));
      }
    } catch {
      // Transient network errors shouldn't flip the UI or claim an outcome.
    } finally {
      setIsChecking(false);
    }
  }, [attemptId, token]);

  // Poll while the payment is in flight or stuck — the backend resolves both
  // without the payer doing anything, and the page must reflect it without a
  // manual reload.
  useEffect(() => {
    if ((phase !== "stuck" && phase !== "routing") || !attemptId) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    checkStatus();
    pollRef.current = setInterval(checkStatus, STATUS_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, attemptId, token]);

  const requestQuote = useCallback(
    async (w: ConnectedWallet, source: PaySource) => {
      if (!request || !selectedPayerId) return;
      setActionError(null);
      try {
        const q = await createRequestQuote(token, {
          payerId: selectedPayerId,
          sourceAddress: w.address,
          sourceChain: source.chain,
          sourceAsset: source.asset,
        });
        setQuote(q);
        setPhase("ready");
      } catch (err) {
        const info = classifyRecoverable(err, "Couldn't get a rate for this payment.");
        setActionError({
          title: info.title,
          detail: info.detail,
          // Same wallet, same source — re-running the quote is a one-click
          // retry, not a reconnect. `w`/`source` are this call's own
          // arguments, still valid when the button fires later.
          onRetry: info.retryable ? () => requestQuote(w, source) : undefined,
        });
        setPhase("select-source");
      }
    },
    [request, selectedPayerId, token]
  );

  /** Sources the connected wallet can actually sign for. */
  const signableSources = useMemo(
    () => (wallet ? sources.filter((s) => s.chain === wallet.chain) : []),
    [sources, wallet]
  );

  const handleWalletConnected = useCallback(
    (w: ConnectedWallet) => {
      setWallet(w);

      const available = sources.filter((s) => s.chain === w.chain);
      const direct = request
        ? available.find((s) =>
            isDirectSource(s, request.destinationChain, request.destinationAsset)
          )
        : undefined;

      // Direct path is the happy path: if the payer already holds exactly what
      // was asked for, they never see a source picker or a word about routing.
      if (direct) {
        setSelectedSource(direct);
        setPhase("quoting");
        requestQuote(w, direct);
        return;
      }

      // Exactly one thing they could pay with — a picker with one option is a
      // speed bump, not a choice. Quote it and let the panel disclose it.
      if (available.length === 1) {
        setSelectedSource(available[0]);
        setPhase("quoting");
        requestQuote(w, available[0]);
        return;
      }

      setSelectedSource(null);
      setPhase("select-source");
    },
    [sources, request, requestQuote]
  );

  const handleSourceSelected = useCallback(
    (source: PaySource) => {
      if (!wallet) return;
      setSelectedSource(source);
      setPhase("quoting");
      requestQuote(wallet, source);
    },
    [wallet, requestQuote]
  );

  const handleSwitchWallet = useCallback(() => {
    setWallet(null);
    setSelectedSource(null);
    setQuote(null);
    setActionError(null);
    setPhase("connect-wallet");
  }, []);

  const handleQuoteExpired = useCallback(() => {
    if (!wallet || !selectedSource) return;
    setPhase("requoting");
    requestQuote(wallet, selectedSource);
  }, [wallet, selectedSource, requestQuote]);

  const handleConfirmSign = useCallback(async () => {
    if (!wallet || !quote) return;

    // `quote.chain` — NOT the request's destination chain and not the wallet's
    // own idea of itself — is what selects the adapter. Contract §3 (changed
    // 2026-08-07): it is the destination chain when direct and the SOURCE
    // chain when routed. Signing a routed payment with the destination
    // adapter would hand a source-chain payload to the wrong wallet.
    const signingChain = quote.chain;
    if (wallet.chain !== signingChain) {
      // Not retryable as-is: signing again on the same wallet fails the same
      // way every time. The fix is the "Switch wallet" control already in
      // the left column, so this notice explains the mismatch and points at
      // it rather than offering a dead-end "Try again".
      setActionError({
        title: "Wrong wallet for this payment.",
        detail: `This payment must be signed on ${signingChain}, but your wallet is connected to ${wallet.chain}. Use "Switch wallet" above to connect the right one.`,
      });
      return;
    }

    setActionError(null);
    setPhase("submitting");
    setSignatureStep(1);
    // Set BEFORE signing: if submit never answers we still have something to
    // poll, and the attempt already exists server-side from the quote call.
    setAttemptId(quote.paymentAttemptId);

    // Whether the funds leave the payer's wallet before our server is
    // involved. True for every routed leg (the browser broadcasts on the
    // source chain) and for direct Solana (contract §0.2). When it is true, a
    // later failure can NEVER be reported as "nothing left your wallet".
    const clientBroadcast = quote.isRouted || signingChain === "solana";

    // ── Step 1: sign. On the direct path a throw here means nothing left the
    // wallet. On a routed multi-leg payment a throw after an "approve" leg
    // also means no funds moved — an allowance is not a payment. ──
    let signedTx: string;
    try {
      if (quote.isRouted) {
        // ORDERED ARRAY (contract §3): approve may precede transfer, so the
        // payer can be prompted more than once. Returns the transfer leg's id.
        const legs = quote.unsignedTransactions;
        if (!legs?.length) {
          throw new Error("The router returned no transaction to sign");
        }
        signedTx = await signRoutedTransactions(
          {
            chain: signingChain,
            address: wallet.address,
            stellarKit: wallet.stellarKit,
            onStep: (step) => setSignatureStep(step),
          },
          legs
        );
      } else if (signingChain === "stellar") {
        if (!wallet.stellarKit) throw new Error("Stellar wallet not connected");
        signedTx = await signStellarUnsignedTx(wallet.stellarKit, quote.unsignedTx);
      } else {
        // NOTE: on Solana the client signs AND broadcasts (contract §0.2).
        // Once this resolves, funds have moved.
        signedTx = await signAndBroadcastSolanaUnsignedTx(wallet.address, quote.unsignedTx);
      }
    } catch (err) {
      // Nothing left the wallet on this path — the throw happened before or
      // during signing. Retry re-runs handleConfirmSign from the top with
      // the same quote and wallet still in state, i.e. it re-prompts the
      // wallet rather than restarting the flow.
      setActionError({
        title: "Signing didn't go through.",
        detail: errorMessage(err),
        onRetry: () => handleConfirmSign(),
      });
      setPhase("ready");
      return;
    }

    // ── Step 2: hand it to the server. What a failure MEANS depends on who
    // broadcast. Submit's union is CONFIRMED | FAILED | ROUTING — STUCK is no
    // longer returned here at all (contract §4, changed 2026-08-07). ──
    try {
      const result = await submitRequestPayment(token, {
        paymentAttemptId: quote.paymentAttemptId,
        signedTx,
      });
      setSubmitResult(result);

      if (result.status === "CONFIRMED") {
        setPhase("confirmed");
      } else if (result.status === "ROUTING") {
        // Broadcast on the source chain, nothing settled. Poll §5 from here;
        // that poll is the only thing that can declare STUCK.
        setStuckHash(result.hash ?? signedTx);
        setPhase("routing");
      } else if (clientBroadcast) {
        // FAILED, but the funds already left the payer's wallet before our
        // server saw anything. "Nothing left your wallet" would be false, so
        // this is STUCK-with-a-hash: on-chain, outcome not yet known.
        setStuckHash(signedTx);
        setPhase("stuck");
      } else {
        setPhase("failed");
      }
    } catch (err) {
      const code = (err as { code?: number })?.code;

      if (clientBroadcast) {
        // Already on-chain regardless of what the server said.
        setStuckHash(signedTx);
        setPhase("stuck");
        return;
      }

      if (code == null) {
        // Direct Stellar, and we never got a response: the server may or may
        // not have broadcast the signed XDR. We genuinely do not know. STUCK
        // with no hash says exactly that.
        setStuckHash(null);
        setPhase("stuck");
        return;
      }

      // Direct Stellar with a real HTTP status: the server answered and
      // rejected it before broadcasting. Nothing left the wallet; retry is safe.
      const info = classifyRecoverable(err, "Couldn't submit your payment.");
      setActionError({
        title: info.title,
        detail: info.detail,
        onRetry: !info.retryable
          ? undefined
          : info.expiredQuote
            ? // The stored quote is stale server-side — resubmitting the same
              // signedTx would just fail again. Get a fresh quote instead,
              // for the same wallet/source already selected.
              () => {
                if (wallet && selectedSource) {
                  setPhase("quoting");
                  requestQuote(wallet, selectedSource);
                }
              }
            : () => handleConfirmSign(),
      });
      setPhase("ready");
    }
  }, [wallet, quote, token, selectedSource, requestQuote]);

  const handleRetryAfterFailure = useCallback(() => {
    setQuote(null);
    setSubmitResult(null);
    setStuckHash(null);
    setActionError(null);
    // A retry is a NEW attempt — keeping the old id would poll a dead one and
    // re-render its terminal state over the fresh quote.
    setAttemptId(null);
    setAttempt(null);
    setSignatureStep(1);
    if (wallet && selectedSource) {
      setPhase("quoting");
      requestQuote(wallet, selectedSource);
    } else if (wallet) {
      setPhase("select-source");
    } else {
      setPhase("connect-wallet");
    }
  }, [wallet, selectedSource, requestQuote]);

  const payerShare = request?.payers.find((p) => p.payerId === selectedPayerId)?.shareAmount;

  // "Paid"/"already-paid" is the design's separate full-page receipt state
  // (.design/splito-finance.dc.html:1578-1623) — no top header row, more top
  // padding instead. Every other phase gets the guest-checkout header
  // (logo, "Paying as guest", "Back to app") from the "isPay" screen.
  const isReceipt = phase === "confirmed" || phase === "already-paid";
  const isWide = !!request && !!selectedPayerId && WIDE_PHASES.has(phase);

  return (
    <div className="min-h-screen w-full flex flex-col items-center" style={{ background: "#0b0b0b" }}>
      {!isReceipt && (
        <div
          className="w-full flex items-center gap-3 px-4 sm:px-6"
          style={{ maxWidth: 1060, height: 72, flexShrink: 0 }}
        >
          <Image src="/logo.svg" alt="Splito" width={88} height={22} className="h-[22px] w-auto opacity-85" />
          <div className="flex-1" />
          <span className="text-[12px]" style={{ color: T.dim }}>
            Paying as guest
          </span>
          <Link
            href="/"
            className="text-[12.5px] font-bold transition-all"
            style={{
              borderRadius: 11,
              padding: "8px 15px",
              background: INSET,
              color: T.body,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            Back to app
          </Link>
        </div>
      )}

      <div
        className="w-full flex-1 flex flex-col justify-center px-4 sm:px-6"
        style={{ maxWidth: isWide ? 1060 : 520, paddingTop: isReceipt ? 70 : 12, paddingBottom: 60 }}
      >
        {phase === "loading" && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: T.muted }} />
          </div>
        )}

        {phase === "not-found" && <RequestClosed reason="not-found" />}
        {phase === "closed" && <RequestClosed reason={closedReason} />}

        {phase === "already-paid" && request && (
          <PaymentConfirmed
            hash={null}
            chain={request.destinationChain}
            quote={null}
            requesterName={request.requesterName}
            amount={payerShare ?? request.amount}
          />
        )}

        {phase === "select-payer" && request && (
          <>
            <AmountHero
              requesterName={request.requesterName}
              amount={request.amount}
              requestName={request.name}
              paidCount={request.paidCount}
              totalCount={request.totalCount}
            />
            <div className="mt-4">
              <PayerPicker
                payers={request.payers}
                onSelect={(payerId) => {
                  setSelectedPayerId(payerId);
                  setPhase("connect-wallet");
                }}
              />
            </div>
          </>
        )}

        {isWide && request && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
            <div className="flex flex-col gap-4">
              {phase === "connect-wallet" && (
                <Card className="p-6">
                  <WalletConnect onConnected={handleWalletConnected} />
                </Card>
              )}

              {/* Design 1482-1575 keeps the picked chain/token tiles visible in
                  the left column even once chosen, not collapsed away — the
                  wallet address readout plus a PERSISTENT SourcePicker (not
                  gated to only the "select-source" phase) is that for us:
                  it's real content (what you're paying with, and — when
                  there's more than one option — the ability to change it),
                  not filler. Excluded during "submitting" so a click can't
                  race a signature already in flight. */}
              {wallet &&
                (phase === "select-source" ||
                  phase === "quoting" ||
                  phase === "ready" ||
                  phase === "requoting" ||
                  phase === "submitting") && (
                  <div className="flex items-center justify-between gap-3 px-1">
                    <p className="text-[11.5px] font-mono truncate" style={{ color: T.dim }}>
                      {wallet.address}
                    </p>
                    <button
                      type="button"
                      onClick={handleSwitchWallet}
                      disabled={phase === "submitting"}
                      className="text-[11.5px] font-bold underline underline-offset-2 flex-shrink-0 disabled:opacity-40"
                      style={{ color: T.muted }}
                    >
                      Switch wallet
                    </button>
                  </div>
                )}

              {/* Unconditional on phase: a quote failure lands on
                  "select-source", a signing/submit failure stays on "ready" —
                  this is the one slot that's visible across all of them. */}
              {actionError && (
                <PayActionErrorNotice error={actionError} onDismiss={() => setActionError(null)} />
              )}

              {wallet &&
                sources.length > 0 &&
                (phase === "select-source" ||
                  phase === "quoting" ||
                  phase === "ready" ||
                  phase === "requoting") && (
                  <SourcePicker
                    sources={sources}
                    destinationChain={request.destinationChain}
                    destinationAsset={request.destinationAsset}
                    connectedChain={wallet.chain}
                    selected={selectedSource}
                    onSelect={handleSourceSelected}
                    onSwitchWallet={handleSwitchWallet}
                  />
                )}
            </div>

            <SummaryPanel
              requesterName={request.requesterName}
              amount={payerShare ?? request.amount}
              requestName={request.name}
              paidCount={request.paidCount}
              totalCount={request.totalCount}
              source={selectedSource}
              destinationChain={request.destinationChain}
              destinationAsset={request.destinationAsset}
              isRouted={quote?.quote.isRouted ?? null}
              providerName={humanizeProvider(quote?.quote.providerId)}
            >
              {phase === "connect-wallet" && (
                <RouteHint text="Connect a wallet on the left to see your route and total." />
              )}
              {phase === "select-source" && (
                <RouteHint text="Choose what to pay with to see your total." />
              )}
              {phase === "quoting" && <RouteHint spinner text="Getting your rate…" />}
              {quote &&
                selectedSource &&
                (phase === "ready" || phase === "requoting" || phase === "submitting") && (
                  <QuotePanel
                    quote={quote.quote}
                    quoteExpiry={quote.quoteExpiry}
                    sourceChain={selectedSource.chain}
                    sourceAsset={selectedSource.asset}
                    destinationChain={request.destinationChain}
                    destinationAsset={request.destinationAsset}
                    denominationCurrency={request.denominationCurrency}
                    amount={payerShare ?? request.amount}
                    // Direct is always one signature; a routed payment signs
                    // the array in order and may need an approve leg first.
                    signatureKinds={(quote.unsignedTransactions ?? []).map((t) => t.kind)}
                    signatureStep={signatureStep}
                    isSubmitting={phase === "submitting"}
                    isRequoting={phase === "requoting"}
                    onConfirm={handleConfirmSign}
                    onExpired={handleQuoteExpired}
                    onChangeSource={
                      signableSources.length > 1
                        ? () => {
                            setQuote(null);
                            setPhase("select-source");
                          }
                        : undefined
                    }
                  />
                )}
            </SummaryPanel>
          </div>
        )}

        {phase === "confirmed" && request && (
          <PaymentConfirmed
            // Once a routed payment lands, the DESTINATION hash is the one
            // that proves arrival; before we have it (direct path) the
            // payer's own transaction is the destination transaction.
            hash={attempt?.destinationTxHash ?? submitResult?.hash ?? attempt?.sourceTxHash ?? null}
            chain={
              attempt?.destinationTxHash
                ? request.destinationChain
                : (selectedSource?.chain ?? request.destinationChain)
            }
            quote={quote?.quote ?? null}
            requesterName={request.requesterName}
            amount={payerShare ?? request.amount}
          />
        )}
        {phase === "failed" && <PaymentFailed onRetry={handleRetryAfterFailure} />}
        {phase === "routing" && request && (
          <PaymentRouting
            hash={attempt?.sourceTxHash ?? stuckHash}
            // The payer signed and broadcast on the SOURCE chain.
            chain={quote?.chain ?? selectedSource?.chain ?? wallet?.chain ?? request.destinationChain}
            destinationChain={request.destinationChain}
            message={submitResult?.message ?? null}
            onCheckNow={checkStatus}
            isChecking={isChecking}
            lastCheckedAt={lastCheckedAt}
          />
        )}
        {phase === "stuck" && request && (
          <PaymentStuck
            hash={attempt?.sourceTxHash ?? stuckHash}
            // The hash we hold is the one the payer's own wallet produced, so
            // it belongs to the SOURCE chain, not the destination.
            chain={quote?.chain ?? selectedSource?.chain ?? wallet?.chain ?? request.destinationChain}
            isRouted={
              attempt?.isRouted ??
              quote?.isRouted ??
              (!!selectedSource &&
                !isDirectSource(selectedSource, request.destinationChain, request.destinationAsset))
            }
            // Server-owned copy from §5 — rendered verbatim when present.
            recovery={attempt?.recovery ?? null}
            onCheckNow={checkStatus}
            isChecking={isChecking}
            lastCheckedAt={lastCheckedAt}
          />
        )}
      </div>
    </div>
  );
}
