"use client";

// Small shared presentation bits for the requester-facing screens
// (/requests and /requests/[id]). Kept out of lib/splito-design.tsx on
// purpose — that module has 37 importers and is not the place for
// product-specific vocabulary.

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { A, P, G, T } from "@/lib/splito-design";
import type { RequestStatus } from "@/api-helpers/requests";

/** Human label for a destination asset id, e.g. "usdc-stellar" → "USDC". */
export const ASSET_LABELS: Record<string, string> = {
  "usdc-stellar": "USDC",
  "usdc-solana": "USDC",
  xlm: "XLM",
  sol: "SOL",
};

export const CHAIN_LABELS: Record<string, string> = {
  stellar: "Stellar",
  solana: "Solana",
};

export function assetLabel(asset: string | null): string {
  if (!asset) return "—";
  return ASSET_LABELS[asset] ?? asset.toUpperCase();
}

export function chainLabel(chain: string | null): string {
  if (!chain) return "—";
  return CHAIN_LABELS[chain] ?? chain[0].toUpperCase() + chain.slice(1);
}

export const STATUS_STYLE: Record<RequestStatus, { label: string; color: string }> = {
  OPEN: { label: "Open", color: A },
  PARTIALLY_PAID: { label: "Partly paid", color: "#FBBF24" },
  SETTLED: { label: "Paid", color: G },
  EXPIRED: { label: "Expired", color: "#888" },
  CANCELLED: { label: "Cancelled", color: "#888" },
};

export function StatusChip({ status }: { status: RequestStatus }) {
  const s = STATUS_STYLE[status] ?? { label: status, color: T.muted };
  return (
    <span
      style={{
        fontSize: 10,
        padding: "3px 9px",
        borderRadius: 99,
        fontWeight: 700,
        background: `${s.color}1a`,
        color: s.color,
        border: `1px solid ${s.color}2a`,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

/**
 * "in 6 days" / "Expired". lib/utils.ts's formatRelativeTime only handles the
 * PAST — a future date comes back as "just now" — so expiry gets its own
 * forward-looking formatter rather than a wrong-looking reuse.
 */
export function expiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return "—";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `in ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `in ${hr}h`;
  const day = Math.floor(hr / 24);
  return `in ${day} days`;
}

/** "2 of 4 paid" — omitted entirely for a single payer, where the status chip already says it. */
export function progressLabel(paidCount: number, payerCount: number): string | null {
  if (payerCount <= 1) return null;
  return `${paidCount} of ${payerCount} paid`;
}

/**
 * The /requests list table's title-column subtitle. There is no split/invoice
 * flag in the data (see api-helpers/requests.ts RequestListItem) — payerCount
 * is the only real signal for "this got split", so it drives both this and
 * listRowType below.
 */
export function listRowMeta(payerCount: number, paidCount: number, destinationChain: string | null): string {
  if (payerCount > 1) return `divided ${payerCount} ways · ${paidCount} paid`;
  return `1 payer · ${chainLabel(destinationChain)}`;
}

/**
 * Type pill for the list table. Personal workspaces frame a multi-payer
 * request as a "Group request"; business workspaces frame the same shape as
 * an "Expense" (cost shared across members) vs. an "Invoice" (billed to one
 * party) — there is no dedicated Payout/Bill/Payroll type in the data, so
 * those design vocabulary words are not reachable from this endpoint.
 */
export function listRowType(
  payerCount: number,
  isBusiness: boolean
): { label: string; color: string } {
  const multi = payerCount > 1;
  if (isBusiness) return multi ? { label: "Expense", color: P } : { label: "Invoice", color: A };
  return multi ? { label: "Group request", color: P } : { label: "Request", color: A };
}

export function ProgressBar({ paidCount, payerCount }: { paidCount: number; payerCount: number }) {
  const pct = payerCount > 0 ? Math.round((paidCount / payerCount) * 100) : 0;
  return (
    <div
      style={{
        height: 4,
        borderRadius: 99,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      <div style={{ width: `${pct}%`, height: "100%", background: A, borderRadius: 99 }} />
    </div>
  );
}

/** Copy-to-clipboard button. `label` shows next to the icon when given. */
export function CopyButton({
  value,
  label,
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-extrabold transition-all hover:opacity-90 shrink-0 ${className}`}
      style={{ background: A, color: "#0a0a0a" }}
      aria-label={label ? undefined : "Copy link"}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {label ? (copied ? "Copied" : label) : null}
    </button>
  );
}
