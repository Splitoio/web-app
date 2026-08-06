"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { T } from "@/lib/splito-design";
import {
  getRequestByToken,
  createRequestQuote,
  submitRequestPayment,
  type GetRequestResponse,
  type QuoteRequestResponse,
  type SubmitRequestResponse,
} from "@/api-helpers/requests";
import {
  AmountHero,
} from "@/components/pay/amount-hero";
import { PayerPicker } from "@/components/pay/payer-picker";
import { WalletConnect, type ConnectedWallet } from "@/components/pay/wallet-connect";
import { QuotePanel } from "@/components/pay/quote-panel";
import {
  PaymentConfirmed,
  PaymentFailed,
  PaymentStuck,
  RequestClosed,
} from "@/components/pay/status-banner";
import {
  signAndBroadcastSolanaUnsignedTx,
  signStellarUnsignedTx,
} from "@/components/pay/pay-wallet";

type Phase =
  | "loading"
  | "not-found"
  | "closed"
  | "already-paid"
  | "select-payer"
  | "connect-wallet"
  | "quoting"
  | "ready"
  | "requoting"
  | "submitting"
  | "confirmed"
  | "failed"
  | "stuck";

const STATUS_POLL_MS = 6000;

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "Something went wrong. Please try again.";
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
  const [quote, setQuote] = useState<QuoteRequestResponse | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitRequestResponse | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRequest = useCallback(async () => {
    try {
      const data = await getRequestByToken(token);
      setRequest(data);

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

  // Poll while STUCK — the poller resolves this without the payer doing anything.
  useEffect(() => {
    if (phase !== "stuck" || !selectedPayerId) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const data = await getRequestByToken(token);
        const payer = data.payers.find((p) => p.payerId === selectedPayerId);
        if (payer?.status === "CONFIRMED") {
          setPhase("confirmed");
        } else if (payer?.status === "FAILED") {
          setPhase("failed");
        }
      } catch {
        // keep polling silently — transient network errors shouldn't flip the UI
      }
    }, STATUS_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [phase, selectedPayerId, token]);

  const requestQuote = useCallback(
    async (w: ConnectedWallet) => {
      if (!request || !selectedPayerId) return;
      const sourceChain = w.chain;
      const sourceAsset = w.chain === "stellar" ? "usdc-stellar" : "usdc-solana";
      try {
        const q = await createRequestQuote(token, {
          payerId: selectedPayerId,
          sourceAddress: w.address,
          sourceChain,
          sourceAsset,
        });
        setQuote(q);
        setPhase("ready");
      } catch (err) {
        toast.error(errorMessage(err));
        setPhase("connect-wallet");
      }
    },
    [request, selectedPayerId, token]
  );

  const handleWalletConnected = useCallback(
    (w: ConnectedWallet) => {
      setWallet(w);
      setPhase("quoting");
      requestQuote(w);
    },
    [requestQuote]
  );

  const handleQuoteExpired = useCallback(() => {
    if (!wallet) return;
    setPhase("requoting");
    requestQuote(wallet);
  }, [wallet, requestQuote]);

  const handleConfirmSign = useCallback(async () => {
    if (!wallet || !quote) return;
    setPhase("submitting");
    try {
      let signedTx: string;
      if (wallet.chain === "stellar") {
        if (!wallet.stellarKit) throw new Error("Stellar wallet not connected");
        signedTx = await signStellarUnsignedTx(wallet.stellarKit, quote.unsignedTx);
      } else {
        signedTx = await signAndBroadcastSolanaUnsignedTx(wallet.address, quote.unsignedTx);
      }

      const result = await submitRequestPayment(token, {
        paymentAttemptId: quote.paymentAttemptId,
        signedTx,
      });
      setSubmitResult(result);
      if (result.status === "CONFIRMED") setPhase("confirmed");
      else if (result.status === "STUCK") setPhase("stuck");
      else setPhase("failed");
    } catch (err) {
      toast.error(errorMessage(err));
      // Back to the quote screen — the countdown will force a re-quote if it
      // has since expired; otherwise the payer can just try signing again.
      setPhase("ready");
    }
  }, [wallet, quote, token]);

  const handleRetryAfterFailure = useCallback(() => {
    setQuote(null);
    setSubmitResult(null);
    if (wallet) {
      setPhase("quoting");
      requestQuote(wallet);
    } else {
      setPhase("connect-wallet");
    }
  }, [wallet, requestQuote]);

  const payerShare = request?.payers.find((p) => p.payerId === selectedPayerId)?.shareAmount;

  // Vertically centred: this is a single-purpose screen a payer lands on cold,
  // and top-anchoring it left ~60% of the viewport empty below the card.
  // flex-col + justify-center centres it when it fits and still scrolls
  // normally once the quote panel makes the content taller than the viewport.
  return (
    <div className="min-h-screen w-full bg-[#0b0b0b] flex flex-col justify-center">
    <div className="w-full max-w-md mx-auto px-4 py-10 sm:py-12">
      {phase === "loading" && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: T.muted }} />
        </div>
      )}

      {phase === "not-found" && <RequestClosed reason="not-found" />}
      {phase === "closed" && <RequestClosed reason={closedReason} />}

      {phase === "already-paid" && request && (
        <>
          <AmountHero
            requesterName={request.requesterName}
            amount={payerShare ?? request.amount}
            requestName={request.name}
            paidCount={request.paidCount}
            totalCount={request.totalCount}
          />
          <PaymentConfirmed hash={null} chain={request.destinationChain} />
        </>
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

      {request &&
        selectedPayerId &&
        (phase === "connect-wallet" ||
          phase === "quoting" ||
          phase === "ready" ||
          phase === "requoting" ||
          phase === "submitting") && (
          <>
            <AmountHero
              requesterName={request.requesterName}
              amount={payerShare ?? request.amount}
              requestName={request.name}
              paidCount={request.paidCount}
              totalCount={request.totalCount}
            />

            {phase === "connect-wallet" && (
              <div className="mt-5">
                <WalletConnect onConnected={handleWalletConnected} />
              </div>
            )}

            {phase === "quoting" && (
              <div className="flex items-center justify-center gap-2 py-8">
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: T.muted }} />
                <p className="text-[13px]" style={{ color: T.muted }}>
                  Getting your rate…
                </p>
              </div>
            )}

            {quote && (phase === "ready" || phase === "requoting" || phase === "submitting") && (
              <QuotePanel
                quote={quote.quote}
                quoteExpiry={quote.quoteExpiry}
                sourceChain={wallet?.chain ?? quote.chain}
                sourceAsset={wallet?.chain === "stellar" ? "usdc-stellar" : "usdc-solana"}
                destinationChain={request.destinationChain}
                destinationAsset={request.destinationAsset}
                isSubmitting={phase === "submitting"}
                isRequoting={phase === "requoting"}
                onConfirm={handleConfirmSign}
                onExpired={handleQuoteExpired}
              />
            )}
          </>
        )}

      {phase === "confirmed" && request && (
        <PaymentConfirmed hash={submitResult?.hash ?? null} chain={request.destinationChain} />
      )}
      {phase === "failed" && <PaymentFailed onRetry={handleRetryAfterFailure} />}
      {phase === "stuck" && request && (
        <PaymentStuck hash={submitResult?.hash ?? null} chain={request.destinationChain} />
      )}
    </div>
    </div>
  );
}
