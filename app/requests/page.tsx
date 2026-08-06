"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { formatRelativeTime } from "@/lib/utils";
import { A, T, Card, Icons } from "@/lib/splito-design";
import { listRequests, type RequestListItem } from "@/api-helpers/requests";
import {
  StatusChip,
  ProgressBar,
  progressLabel,
  assetLabel,
  chainLabel,
} from "@/components/requests/request-bits";

function RequestRow({ item }: { item: RequestListItem }) {
  const progress = progressLabel(item.paidCount, item.payerCount);
  const currency = item.denominationCurrency || "USD";

  return (
    <Link
      href={`/requests/${item.id}`}
      className="block transition-colors hover:bg-white/[0.03]"
      style={{ padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-mono font-extrabold"
              style={{ fontSize: 17, color: "#fff", letterSpacing: "-0.02em" }}
            >
              {formatCurrency(item.amount, currency)}
            </span>
            <StatusChip status={item.status} />
          </div>
          {item.name && (
            <p className="truncate mt-1" style={{ fontSize: 13, color: T.body }}>
              {item.name}
            </p>
          )}
          <p className="mt-1" style={{ fontSize: 11.5, color: T.sub, fontWeight: 600 }}>
            {assetLabel(item.destinationAsset)} on {chainLabel(item.destinationChain)}
            {" · "}
            {formatRelativeTime(new Date(item.createdAt))}
          </p>
        </div>
        <span className="shrink-0 mt-1" style={{ color: T.dim }}>
          {Icons.chevR({ size: 16 })}
        </span>
      </div>

      {progress && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 600 }}>{progress}</span>
            {item.receivedAmount > 0 && (
              <span className="font-mono" style={{ fontSize: 11.5, color: T.muted }}>
                {formatCurrency(item.receivedAmount, currency)} in
              </span>
            )}
          </div>
          <ProgressBar paidCount={item.paidCount} payerCount={item.payerCount} />
        </div>
      )}
    </Link>
  );
}

export default function RequestsPage() {
  const [items, setItems] = useState<RequestListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await listRequests({ limit: 100 });
      setItems(res.requests);
    } catch {
      setError("Couldn't load your requests.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="hidden sm:block border-b border-white/[0.07] sticky top-0 bg-[#0b0b0b]/95 backdrop-blur-xl z-10">
        <div className="flex px-7 items-center justify-between h-[70px]">
          <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-white">Requests</h1>
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-extrabold transition-all hover:opacity-90"
            style={{ background: A, color: "#0a0a0a" }}
          >
            New request
          </Link>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-7 overflow-y-auto">
        <div className="sm:hidden flex items-center justify-between mb-5">
          <h1 className="text-[24px] font-black tracking-[-0.03em] text-white">Requests</h1>
          <Link
            href="/"
            className="rounded-xl px-3.5 py-2 text-[12.5px] font-extrabold"
            style={{ background: A, color: "#0a0a0a" }}
          >
            New
          </Link>
        </div>

        <div className="max-w-xl mx-auto">
          {items === null && !error && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} />
            </div>
          )}

          {error && (
            <Card className="p-6 text-center">
              <p style={{ fontSize: 13.5, color: T.body }}>{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setItems(null);
                  load();
                }}
                className="text-[13px] font-semibold mt-3"
                style={{ color: A }}
              >
                Try again
              </button>
            </Card>
          )}

          {items !== null && items.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-[16px] font-extrabold mb-1.5" style={{ color: T.bright }}>
                Nothing here yet
              </p>
              <p className="text-[13px] mb-6" style={{ color: T.muted }}>
                Every request you create shows up here with its links and who has paid.
              </p>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-extrabold transition-all hover:opacity-90"
                style={{ background: A, color: "#0a0a0a" }}
              >
                Create a request <ArrowRight size={16} />
              </Link>
            </Card>
          )}

          {items !== null && items.length > 0 && (
            <Card style={{ padding: 0 }}>
              <div style={{ marginBottom: -1 }}>
                {items.map((item) => (
                  <RequestRow key={item.id} item={item} />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
