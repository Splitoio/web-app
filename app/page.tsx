"use client";

import { useMemo, useState } from "react";
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
import { useGetAllGroups } from "@/features/groups/hooks/use-create-group";
import { formatCurrency } from "@/utils/formatters";
import { formatRelativeTime } from "@/lib/utils";
import { DualAmount } from "@/components/dual-amount";
import {
  createRequest,
  type CreateRequestPayerLink,
  type DestinationAsset,
  type DestinationChain,
} from "@/api-helpers/requests";
import { A, Card, SectionLabel, T } from "@/lib/splito-design";

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

/** Recent activity from groups' expenses — the only history data available
 * today for an authenticated user until a dedicated requests-list endpoint
 * exists. Kept as a flat list, not the groups/friends dashboard, so this
 * screen never leads with splitting framing. */
function useRecentActivity(
  groups: {
    name: string;
    expenses?: { id: string; name: string; amount: number; currency: string; paidBy: string; createdAt: Date; splitType: string }[];
    groupUsers?: { user: { id: string; name?: string | null } }[];
  }[],
  userId: string | null
) {
  return useMemo(() => {
    if (!userId || !groups?.length) return [];
    const items: {
      id: string;
      lead: string;
      label: string | null;
      amount: number;
      currency: string;
      subtext: string;
      date: Date;
    }[] = [];
    for (const group of groups) {
      const expenses = group.expenses ?? [];
      const groupUsers = group.groupUsers ?? [];
      const paidByName = (paidBy: string) =>
        paidBy === userId ? "You" : (groupUsers.find((gu) => gu.user.id === paidBy)?.user?.name ?? "Someone");
      for (const exp of expenses) {
        const date = exp.createdAt instanceof Date ? exp.createdAt : new Date(exp.createdAt);
        items.push({
          id: exp.id,
          lead: exp.splitType === "SETTLEMENT" ? `${paidByName(exp.paidBy)} settled` : `${paidByName(exp.paidBy)} requested`,
          label: exp.splitType === "SETTLEMENT" ? null : exp.name,
          amount: Math.abs(exp.amount),
          currency: exp.currency || "USD",
          subtext: `${formatRelativeTime(date)} · ${group.name}`,
          date,
        });
      }
    }
    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    return items.slice(0, 8);
  }, [groups, userId]);
}

function SentenceField({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 align-middle ${className}`}
      style={{
        background: "rgba(34,211,238,0.08)",
        border: "1px solid rgba(34,211,238,0.28)",
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
      <p
        className="text-[22px] sm:text-[28px] leading-[1.9] font-semibold"
        style={{ color: T.body }}
      >
        Ask for{" "}
        <SentenceField>
          <span style={{ color: T.muted }}>$</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            className="bg-transparent outline-none font-mono font-extrabold w-[5.5ch]"
            style={{ color: "#fff" }}
            aria-label="Amount in US dollars"
          />
        </SentenceField>
        <br />
        <span className="sm:whitespace-nowrap">
          from{" "}
          <SentenceField>
            <button
              type="button"
              onClick={() => setPayerCount((n) => Math.max(1, n - 1))}
              className="opacity-70 hover:opacity-100"
              aria-label="Fewer people"
            >
              <Minus size={14} />
            </button>
            <span className="font-mono font-extrabold min-w-[1.5ch] text-center" style={{ color: "#fff" }}>
              {payerCount}
            </span>
            <button
              type="button"
              onClick={() => setPayerCount((n) => Math.min(50, n + 1))}
              className="opacity-70 hover:opacity-100"
              aria-label="More people"
            >
              <Plus size={14} />
            </button>
          </SentenceField>{" "}
          {payerCount === 1 ? "person" : "people"}
        </span>
        <br />
        <span className="sm:whitespace-nowrap">
        receive{" "}
        <SentenceField>
          <span className="font-mono font-extrabold" style={{ color: "#fff" }}>
            USDC
          </span>
        </SentenceField>{" "}
        on{" "}
        <SentenceField className="p-0.5">
          {CHAINS.map((c, i) => (
            <button
              key={c.chain}
              type="button"
              onClick={() => setChainIdx(i)}
              className="rounded-lg px-2.5 py-1 font-mono font-extrabold text-[15px] sm:text-[17px] transition-colors"
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

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full mt-6 flex items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-extrabold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: A, color: "#0a0a0a" }}
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Get link <ArrowRight size={16} />
          </>
        )}
      </button>
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
  const { data: groups = [] } = useGetAllGroups();
  const recentActivity = useRecentActivity(groups, user?.id ?? null);

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
            <CreateRequestForm onCreated={setCreatedLinks} />
          )}

          {user && recentActivity.length > 0 && (
            <div className="mt-8">
              <SectionLabel>Recent</SectionLabel>
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 20,
                  overflow: "hidden",
                }}
              >
                {recentActivity.map((a, i) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3"
                    style={{
                      padding: "14px 16px",
                      borderBottom: i < recentActivity.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: A,
                        flexShrink: 0,
                        marginTop: 5,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13, color: T.body, lineHeight: 1.5 }}>
                        {a.lead}
                        {a.label && (
                          <>
                            {" "}
                            <span style={{ color: T.bright, fontWeight: 600 }}>{a.label}</span>
                          </>
                        )}{" "}
                        <DualAmount
                          amount={a.amount}
                          currency={a.currency}
                          style={{ fontWeight: 700, color: T.bright }}
                          secondaryStyle={{ fontWeight: 500, color: T.muted }}
                        />
                      </p>
                      <p style={{ fontSize: 11, color: T.sub, marginTop: 3, fontWeight: 600 }}>{a.subtext}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
