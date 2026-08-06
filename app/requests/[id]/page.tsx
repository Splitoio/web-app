"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { formatRelativeTime } from "@/lib/utils";
import { A, T, Card, SectionLabel } from "@/lib/splito-design";
import { getRequestDetail, type RequestDetailResponse } from "@/api-helpers/requests";
import {
  StatusChip,
  ProgressBar,
  progressLabel,
  assetLabel,
  chainLabel,
  CopyButton,
  expiryLabel,
} from "@/components/requests/request-bits";

/** Per-payer link — the only link that exists. Rebuilt from the token + payerId. */
function payerLink(token: string | null, payerId: string): string {
  if (!token) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/pay/${token}?payer=${payerId}`;
}

function PayerRow({
  payer,
  token,
  currency,
  isLast,
}: {
  payer: RequestDetailResponse["payers"][number];
  token: string | null;
  currency: string;
  isLast: boolean;
}) {
  const link = payerLink(token, payer.payerId);

  return (
    <div
      style={{
        padding: "15px 18px",
        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p style={{ fontSize: 13.5, fontWeight: 700, color: T.bright }}>
            Person {payer.index}
            <span className="font-mono ml-2" style={{ color: "#fff" }}>
              {formatCurrency(payer.shareAmount, currency)}
            </span>
          </p>
          <p className="mt-1" style={{ fontSize: 11.5, color: T.sub, fontWeight: 600 }}>
            {payer.isPaid ? (
              <span style={{ color: "#34D399" }}>
                Paid{payer.paidAt ? ` · ${formatRelativeTime(new Date(payer.paidAt))}` : ""}
              </span>
            ) : payer.status === "FAILED" ? (
              <span style={{ color: "#F87171" }}>Last attempt failed</span>
            ) : payer.status === "SUBMITTED" || payer.status === "QUOTED" ? (
              <span style={{ color: "#FBBF24" }}>In progress</span>
            ) : (
              "Not paid yet"
            )}
          </p>
        </div>
        {!payer.isPaid && link && <CopyButton value={link} label="Copy link" />}
      </div>

      {link && (
        <p
          className="mt-2 font-mono truncate"
          style={{ fontSize: 11, color: T.dim }}
          title={link}
        >
          {link}
        </p>
      )}

      {payer.transactionHash && (
        <a
          href={payer.explorerUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 mt-2 font-mono"
          style={{ fontSize: 11, color: A }}
        >
          {payer.transactionHash.slice(0, 10)}…{payer.transactionHash.slice(-8)}
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<RequestDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getRequestDetail(id));
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      setError(
        code === 403
          ? "This request belongs to someone else."
          : code === 404
            ? "That request no longer exists."
            : "Couldn't load this request."
      );
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p style={{ fontSize: 14, color: T.body }}>{error}</p>
        <Link href="/requests" className="text-[13px] font-semibold mt-3" style={{ color: A }}>
          Back to requests
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} />
      </div>
    );
  }

  const currency = data.denominationCurrency || "USD";
  const progress = progressLabel(data.paidCount, data.payerCount);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="hidden sm:block border-b border-white/[0.07] sticky top-0 bg-[#0b0b0b]/95 backdrop-blur-xl z-10">
        <div className="flex px-7 items-center gap-3 h-[70px]">
          <button
            type="button"
            onClick={() => router.push("/requests")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Back to requests"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-white">
            {data.name || "Request"}
          </h1>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-7 overflow-y-auto">
        <div className="sm:hidden mb-4">
          <Link
            href="/requests"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
            style={{ color: T.muted }}
          >
            <ArrowLeft size={15} /> Requests
          </Link>
        </div>

        <div className="max-w-xl mx-auto">
          {/* Summary */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className="font-mono font-extrabold"
                  style={{ fontSize: 30, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.1 }}
                >
                  {formatCurrency(data.amount, currency)}
                </p>
                {data.name && (
                  <p className="mt-1.5" style={{ fontSize: 13.5, color: T.body }}>
                    {data.name}
                  </p>
                )}
              </div>
              <StatusChip status={data.status} />
            </div>

            <div className="mt-4">
              {progress && (
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>{progress}</span>
                    {data.receivedAmount > 0 && (
                      <span className="font-mono" style={{ fontSize: 12, color: T.muted }}>
                        {formatCurrency(data.receivedAmount, currency)} received
                      </span>
                    )}
                  </div>
                  <ProgressBar paidCount={data.paidCount} payerCount={data.payerCount} />
                </>
              )}
            </div>

            <div
              className="mt-5 pt-5 grid grid-cols-2 gap-y-3.5 gap-x-4"
              style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div>
                <p style={{ fontSize: 10.5, color: T.muted, fontWeight: 700, letterSpacing: "0.06em" }}>
                  RECEIVING
                </p>
                <p className="mt-1 font-mono font-bold" style={{ fontSize: 13, color: T.bright }}>
                  {assetLabel(data.destinationAsset)} · {chainLabel(data.destinationChain)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10.5, color: T.muted, fontWeight: 700, letterSpacing: "0.06em" }}>
                  LINK EXPIRES
                </p>
                <p className="mt-1 font-bold" style={{ fontSize: 13, color: T.bright }}>
                  {expiryLabel(data.expiresAt)}
                </p>
              </div>
              <div className="col-span-2 min-w-0">
                <p style={{ fontSize: 10.5, color: T.muted, fontWeight: 700, letterSpacing: "0.06em" }}>
                  DESTINATION ADDRESS
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p
                    className="font-mono truncate"
                    style={{ fontSize: 12, color: T.body }}
                    title={data.destinationAddress ?? ""}
                  >
                    {data.destinationAddress ?? "—"}
                  </p>
                  {data.destinationAddress && <CopyButton value={data.destinationAddress} />}
                </div>
                <p className="mt-1.5" style={{ fontSize: 11, color: T.dim }}>
                  Fixed for this request — a different address means a new request.
                </p>
              </div>
            </div>
          </Card>

          {/* Payers */}
          <div className="mt-7">
            <SectionLabel>
              {data.payerCount === 1 ? "Who this went to" : `${data.payerCount} people`}
            </SectionLabel>
            <Card style={{ padding: 0 }}>
              {data.payers.map((p, i) => (
                <PayerRow
                  key={p.payerId}
                  payer={p}
                  token={data.token}
                  currency={currency}
                  isLast={i === data.payers.length - 1}
                />
              ))}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
