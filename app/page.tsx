"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  Minus,
  Plus,
  Copy,
  Check,
  Share2,
  ArrowRight,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useAuthStore } from "@/stores/authStore";
import { formatCurrency } from "@/utils/formatters";
import { formatRelativeTime } from "@/lib/utils";
import {
  createRequest,
  listRequests,
  type CreateRequestPayerLink,
  type DestinationAsset,
  type DestinationChain,
  type RequestListItem,
} from "@/api-helpers/requests";
import { A, Card, SectionLabel, T, Icons } from "@/lib/splito-design";
import { StatusChip, progressLabel } from "@/components/requests/request-bits";

// ─── Chain destinations — Stellar and Solana only. Exact lowercase literals
// per the API contract (.specs/2026-08-06-request-money-api-contract.md §0.1).
const CHAINS: { chain: DestinationChain; asset: DestinationAsset; label: string }[] = [
  { chain: "stellar", asset: "usdc-stellar", label: "Stellar" },
  { chain: "solana", asset: "usdc-solana", label: "Solana" },
];

function isValidAddress(chain: DestinationChain, address: string): boolean {
  const trimmed = address.trim();
  if (!trimmed) return false;
  if (chain === "stellar") return /^G[A-Z2-7]{55}$/.test(trimmed);
  // Solana: base58, roughly 32-44 chars.
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
}

/**
 * The signed-in requester's most recent requests. Real data from
 * GET /api/requests — the previous groups-derived version showed nothing
 * because this product never creates groups. Capped at 4; the full list
 * lives at /requests.
 */
const RECENT_COUNT = 4;

function useRecentRequests(userId: string | null, reloadKey: number) {
  const [items, setItems] = useState<RequestListItem[]>([]);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }
    let cancelled = false;
    listRequests({ limit: RECENT_COUNT })
      .then((res) => {
        if (!cancelled) setItems(res.requests);
      })
      .catch(() => {
        // A failed history fetch must never break the create form — the
        // section simply stays hidden.
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  return items;
}

/**
 * One inline "blank" in the fill-in-the-sentence create form.
 *
 * Height is FIXED (h-10 / sm:h-[46px]) and the content is centred inside it
 * with `leading-none`. It used to be `py-1.5` on top of the paragraph's
 * inherited 1.9 line-height, so each pill grew to 67px inside a 53px line box
 * and consecutive lines' pills touched edge to edge. Padding now hangs off the
 * fixed height, so every pill on the screen is exactly the same height and sits
 * on the same baseline regardless of what it contains.
 *
 * `px` is a prop rather than a className override because the previous caller
 * passed `p-0.5`, which collided with the base `px-3 py-1.5` and silently made
 * the chain pill a different height from the others.
 */
function SentenceField({
  children,
  px = "px-3",
  gap = "gap-1.5",
}: {
  children: React.ReactNode;
  px?: string;
  gap?: string;
}) {
  return (
    <span
      className={`inline-flex h-10 sm:h-[46px] items-center rounded-xl align-middle leading-none ${px} ${gap}`}
      style={{
        // The old rgba(34,211,238,0.08) fill was invisible against the #0e0e0e
        // card — only the border read, so the pills looked like empty boxes.
        background: "rgba(34,211,238,0.17)",
        border: "1px solid rgba(34,211,238,0.42)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {children}
    </span>
  );
}

function CreateRequestForm({
  onCreated,
}: {
  onCreated: (payers: CreateRequestPayerLink[]) => void;
}) {
  const { isConnected, address, walletType } = useWallet();
  const [amount, setAmount] = useState("500");
  const [payerCount, setPayerCount] = useState(1);
  const [chainIdx, setChainIdx] = useState(0);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const destination = CHAINS[chainIdx];
  const parsedAmount = Number(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const addressValid = isValidAddress(destination.chain, destinationAddress);
  const canSubmit = amountValid && payerCount >= 1 && addressValid && !submitting;

  const canPrefillWallet =
    destination.chain === "stellar" && walletType === "stellar" && isConnected && !!address;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await createRequest({
        amount: parsedAmount,
        denominationCurrency: "USD",
        destinationAsset: destination.asset,
        destinationChain: destination.chain,
        destinationAddress: destinationAddress.trim(),
        payerCount,
        name: name.trim() || undefined,
      });
      onCreated(res.links);
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Could not create the request. Please try again.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 sm:p-9">
      {/* leading is set so the line box always clears the fixed 40/46px pill
          height with breathing room — 22*2.05 = 45.1 on mobile, 28*1.95 = 54.6
          on desktop. Drop it below the pill height and consecutive rows touch. */}
      <p
        className="text-[22px] sm:text-[28px] leading-[2.05] sm:leading-[1.95] font-semibold"
        style={{ color: T.body }}
      >
        <span className="whitespace-nowrap">
          Ask for{" "}
          <SentenceField gap="gap-1">
            <span style={{ color: T.muted }}>$</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="bg-transparent outline-none font-mono font-extrabold"
              // Sized to the value, not a fixed 5.5ch — "500" left ~42px of dead
              // space inside the pill. +0.5ch keeps the caret from clipping.
              style={{ color: "#fff", width: `${Math.max(amount.length, 1) + 0.5}ch` }}
              aria-label="Amount in US dollars"
            />
          </SentenceField>
        </span>
        <br />
        <span className="whitespace-nowrap">
          from{" "}
          <SentenceField px="px-1.5" gap="gap-0.5">
            <button
              type="button"
              onClick={() => setPayerCount((n) => Math.max(1, n - 1))}
              className="flex h-7 w-6 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Fewer people"
            >
              <Minus size={17} strokeWidth={2.5} />
            </button>
            <span className="font-mono font-extrabold min-w-[1.2ch] text-center" style={{ color: "#fff" }}>
              {payerCount}
            </span>
            <button
              type="button"
              onClick={() => setPayerCount((n) => Math.min(50, n + 1))}
              className="flex h-7 w-6 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="More people"
            >
              <Plus size={17} strokeWidth={2.5} />
            </button>
          </SentenceField>{" "}
          {payerCount === 1 ? "person" : "people"}
        </span>
        <br />
        <span className="whitespace-nowrap">
          receive{" "}
          <SentenceField>
            <span className="font-mono font-extrabold" style={{ color: "#fff" }}>
              USDC
            </span>
          </SentenceField>
        </span>{" "}
        {/* "on" and the chain pill are one nowrap unit: at 390px the pill used
            to wrap alone and orphan the word "on" at the end of the line. */}
        <span className="whitespace-nowrap">
          on{" "}
          <SentenceField px="px-1">
            {CHAINS.map((c, i) => (
              <button
                key={c.chain}
                type="button"
                onClick={() => setChainIdx(i)}
                className="flex h-8 sm:h-9 items-center rounded-lg px-3 font-mono font-extrabold text-[16px] sm:text-[19px] leading-none transition-colors"
                style={{
                  background: i === chainIdx ? A : "transparent",
                  color: i === chainIdx ? "#0a0a0a" : T.muted,
                }}
              >
                {c.label}
              </button>
            ))}
          </SentenceField>
        </span>
      </p>

      <div className="mt-6 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <label className="block text-[11px] font-bold tracking-[0.08em] uppercase mb-2" style={{ color: T.muted }}>
          {destination.label} address to receive at
        </label>
        <input
          value={destinationAddress}
          onChange={(e) => setDestinationAddress(e.target.value)}
          placeholder={destination.chain === "stellar" ? "G..." : "Solana wallet address"}
          className="w-full rounded-xl px-4 py-3 text-[14px] font-mono outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${destinationAddress && !addressValid ? "#F87171" : "rgba(255,255,255,0.1)"}`,
            color: T.bright,
          }}
        />
        {canPrefillWallet && address !== destinationAddress && (
          <button
            type="button"
            onClick={() => setDestinationAddress(address ?? "")}
            className="text-[12px] font-semibold mt-2"
            style={{ color: A }}
          >
            Use connected wallet ({address?.slice(0, 6)}…{address?.slice(-4)})
          </button>
        )}
        <p className="text-[11.5px] mt-2" style={{ color: T.dim }}>
          This can&rsquo;t be changed once the link is created — a new address means a new request.
        </p>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What's this for? (optional)"
          className="w-full rounded-xl px-4 py-3 text-[14px] mt-3 outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: T.bright,
          }}
        />
      </div>

      {/* Disabled affordance, not a dimmer. `disabled:opacity-50` on a #22D3EE
          fill just read as a dull button and gave no reason — the real blocker
          is almost always the missing destination address. Disabled renders as
          an outline with a live hint underneath; the accent hex is unchanged
          and submission still requires a valid address. */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full mt-6 flex items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-extrabold transition-all enabled:hover:opacity-90 disabled:cursor-not-allowed"
        style={
          canSubmit || submitting
            ? { background: A, color: "#0a0a0a", border: "1px solid transparent" }
            : {
                background: "transparent",
                color: "rgba(34,211,238,0.65)",
                border: "1px dashed rgba(34,211,238,0.45)",
              }
        }
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Get link <ArrowRight size={16} />
          </>
        )}
      </button>
      {!canSubmit && !submitting && (
        <p className="text-[12px] font-semibold mt-2.5 text-center" style={{ color: T.dim }}>
          {!amountValid
            ? "Enter an amount to get your link"
            : !destinationAddress.trim()
              ? `Enter a ${destination.label} address above to get your link`
              : `That doesn’t look like a ${destination.label} address`}
        </p>
      )}
    </Card>
  );
}

/** Copy + share affordance for a single link. Reused for both the N=1 case
 * (rendered large, standalone) and each row in the N>1 case (rendered small). */
function CopyShareRow({
  link,
  size = "lg",
}: {
  link: string;
  size?: "lg" | "sm";
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy the link manually.");
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url: link, title: "Payment request" });
        return;
      } catch {
        // user cancelled or share unsupported — fall through to copy
      }
    }
    handleCopy();
  };

  if (size === "sm") {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-extrabold transition-all hover:opacity-90"
          style={{ background: A, color: "#0a0a0a" }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-extrabold border transition-all hover:bg-white/5"
          style={{ borderColor: "rgba(255,255,255,0.14)", color: T.bright }}
        >
          <Share2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-extrabold transition-all hover:opacity-90"
        style={{ background: A, color: "#0a0a0a" }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <button
        type="button"
        onClick={handleShare}
        className="flex items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-extrabold border transition-all hover:bg-white/5"
        style={{ borderColor: "rgba(255,255,255,0.14)", color: T.bright }}
      >
        <Share2 size={16} />
        Share
      </button>
    </div>
  );
}

function LinkCreated({
  payers,
  onCreateAnother,
}: {
  payers: CreateRequestPayerLink[];
  onCreateAnother: () => void;
}) {
  const isSingle = payers.length <= 1;

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(payers.map((p, i) => `Person ${i + 1} (${formatCurrency(Number(p.shareAmount), "USD")}): ${p.link}`).join("\n"));
      toast.success("All links copied");
    } catch {
      toast.error("Couldn't copy — copy each link individually.");
    }
  };

  return (
    <Card className="p-6 sm:p-9 text-center">
      <div
        className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)" }}
      >
        <Check size={26} style={{ color: A }} />
      </div>
      <p className="text-[18px] font-extrabold mb-1" style={{ color: T.bright }}>
        {isSingle ? "Your link is ready" : `${payers.length} links are ready`}
      </p>
      <p className="text-[13px] mb-6" style={{ color: T.muted }}>
        {isSingle
          ? "Send it to get paid. That link is the whole thing."
          : "Send each person their own link."}
      </p>

      {isSingle ? (
        <>
          <div
            className="rounded-xl px-4 py-3 mb-3 text-[13px] font-mono break-all text-left"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: T.body }}
          >
            {payers[0]?.link}
          </div>
          <CopyShareRow link={payers[0]?.link ?? ""} />
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2 mb-4 text-left">
            {payers.map((p, i) => (
              <div
                key={p.payerId}
                className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-bold" style={{ color: T.bright }}>
                    Person {i + 1} — {formatCurrency(Number(p.shareAmount), "USD")}
                  </p>
                  <p className="text-[11px] font-mono truncate mt-0.5" style={{ color: T.dim }}>
                    {p.link}
                  </p>
                </div>
                <CopyShareRow link={p.link} size="sm" />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleCopyAll}
            className="text-[13px] font-semibold"
            style={{ color: A }}
          >
            Copy all links
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onCreateAnother}
        className="text-[13px] font-semibold mt-5 block mx-auto"
        style={{ color: T.muted }}
      >
        Create another request
      </button>
    </Card>
  );
}

export default function Page() {
  const { user } = useAuthStore();
  const [createdLinks, setCreatedLinks] = useState<CreateRequestPayerLink[] | null>(null);
  // Bumped after a successful create so the Recent list picks the new one up.
  const [reloadKey, setReloadKey] = useState(0);
  const recentRequests = useRecentRequests(user?.id ?? null, reloadKey);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="hidden sm:block border-b border-white/[0.07] sticky top-0 bg-[#0b0b0b]/95 backdrop-blur-xl z-10">
        <div className="flex px-7 items-center h-[70px]">
          <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-white">
            Request money
          </h1>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-7 overflow-y-auto">
        <div className="sm:hidden mb-5">
          <h1 className="text-[26px] font-black tracking-[-0.04em] text-white">
            <span className="text-[#22D3EE]">splito</span>
          </h1>
        </div>

        <div className="max-w-xl mx-auto">
          {createdLinks ? (
            <LinkCreated payers={createdLinks} onCreateAnother={() => setCreatedLinks(null)} />
          ) : (
            <CreateRequestForm
              onCreated={(links) => {
                setCreatedLinks(links);
                setReloadKey((k) => k + 1);
              }}
            />
          )}

          {/* Recent — rendered only when there is something real to show.
              An empty section here is worse than no section. */}
          {user && recentRequests.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <SectionLabel>Recent</SectionLabel>
                <Link
                  href="/requests"
                  className="text-[12px] font-semibold"
                  style={{ color: A, marginBottom: 14 }}
                >
                  See all
                </Link>
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 20,
                  overflow: "hidden",
                }}
              >
                {recentRequests.map((r, i) => {
                  const progress = progressLabel(r.paidCount, r.payerCount);
                  return (
                    <Link
                      key={r.id}
                      href={`/requests/${r.id}`}
                      className="flex items-center gap-3 transition-colors hover:bg-white/[0.03]"
                      style={{
                        padding: "14px 16px",
                        borderBottom:
                          i < recentRequests.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="font-mono font-extrabold"
                            style={{ fontSize: 14, color: T.bright }}
                          >
                            {formatCurrency(r.amount, r.denominationCurrency || "USD")}
                          </span>
                          <StatusChip status={r.status} />
                        </div>
                        <p
                          className="truncate"
                          style={{ fontSize: 11.5, color: T.sub, marginTop: 3, fontWeight: 600 }}
                        >
                          {r.name ? `${r.name} · ` : ""}
                          {progress ?? formatRelativeTime(new Date(r.createdAt))}
                        </p>
                      </div>
                      <span style={{ color: T.dim }}>{Icons.chevR({ size: 15 })}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
