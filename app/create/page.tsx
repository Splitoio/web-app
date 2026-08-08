"use client";

// Create request + Created/Share screens.
// Design: .design/splito-finance.dc.html lines 526-695 (Create), 698-724 (Created/Share).
//
// The design mock imagines a richer product (invoices, bills, categories, notes,
// attachments, contract-backed bills, per-workspace approval thresholds, named
// payers with custom splits). The real backend (createRequestSchema in
// request-money.controller.ts, model Request in schema.prisma) only supports:
// one generic request, an even split across an anonymous payerCount, four
// destination pairs, an optional name + expiresAt, and an optional
// workspaceId. Blocks the design calls for that have no backend behavior yet
// (split modes beyond even, contract linking, approval) are rendered as
// visibly gated/disabled rather than wired to fake data — see comments below.

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Minus, Plus, Copy, Check } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useActiveWorkspace } from "@/contexts/workspace";
import { PERSONAL_WORKSPACE_ID } from "@/lib/workspace";
import { formatCurrency } from "@/utils/formatters";
import {
  createRequest,
  type CreateRequestResponse,
  type DestinationAsset,
  type DestinationChain,
} from "@/api-helpers/requests";
import {
  A,
  G,
  P,
  R,
  T,
  MONO,
  Card,
  Toggle,
  AvatarChip,
  Icons,
  card,
  pill,
  eyebrow,
} from "@/lib/splito-design";
import { chainLabel } from "@/components/requests/request-bits";
import { FormErrorNotice } from "@/components/requests/form-error";
import { toFormError, type FormError } from "@/lib/request-errors";

// ─── Destination options — the four pairs asset-config.ts actually supports ──
const DESTINATIONS: {
  chain: DestinationChain;
  asset: DestinationAsset;
  symbol: string;
  sub: string;
  color: string;
}[] = [
  { chain: "stellar", asset: "usdc-stellar", symbol: "USDC", sub: "Stellar · stable", color: "#4E9BE8" },
  { chain: "stellar", asset: "xlm", symbol: "XLM", sub: "Stellar · native", color: A },
  { chain: "solana", asset: "usdc-solana", symbol: "USDC", sub: "Solana · stable", color: "#4E9BE8" },
  { chain: "solana", asset: "sol", symbol: "SOL", sub: "Solana · native", color: P },
];

// Mirrors the validator in app/page.tsx (guest create flow) — small enough,
// and pure, that duplicating it here is cheaper than exporting across the
// anonymous/authenticated boundary for one shared regex pair.
function isValidAddress(chain: DestinationChain, address: string): boolean {
  const trimmed = address.trim();
  if (!trimmed) return false;
  if (chain === "stellar") return /^G[A-Z2-7]{55}$/.test(trimmed);
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
}

type Kind = "request" | "split";

// Design offers 5 named split modes (Evenly/Percentage/Exact/Shares/
// Adjustment) — SplitTypeSchema's 6th value, SETTLEMENT, marks a settle-up
// transaction after the fact, not a way to divide a new request, so it has no
// place on this form. Only EQUAL ("Evenly") is wired: createRequestSchema
// takes a payerCount, not per-payer amounts, so the backend can only divide
// evenly today. The rest render as visibly disabled rather than pretending to
// collect a percentage/exact amount that goes nowhere.
const SPLIT_MODES = ["Evenly", "Percentage", "Exact", "Shares", "Adjustment"] as const;

const EXPIRY_OPTIONS = [7, 14, 30] as const;

function TypeTile({
  active,
  init,
  label,
  sub,
  color,
  onClick,
}: {
  active: boolean;
  init: string;
  label: string;
  sub: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left transition-all hover:border-white/[0.18]"
      style={{
        padding: "14px 13px",
        borderRadius: 15,
        background: active ? `${color}0f` : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? `${color}55` : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 800,
          marginBottom: 10,
          background: `${color}1f`,
          color,
        }}
      >
        {init}
      </span>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: active ? "#fff" : T.body }}>{label}</p>
      <p style={{ margin: "3px 0 0", fontSize: 10.5, lineHeight: 1.4, color: T.dim }}>{sub}</p>
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ ...eyebrow(), marginBottom: 8 }}>{children}</p>;
}

function CreateForm({
  workspace,
  onCreated,
}: {
  workspace: ReturnType<typeof useActiveWorkspace>;
  onCreated: (res: CreateRequestResponse, payerCount: number) => void;
}) {
  const isPersonal = workspace.id === PERSONAL_WORKSPACE_ID;
  const { isConnected, address, walletType } = useWallet();

  const [kind, setKind] = useState<Kind>("request"); // "request" is the landing state — split is never the default
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  // Locking is the product's headline promise, so it leads as on. This value is
  // always sent on submit (see timeLockIn in the createRequest call) rather than
  // relying on the backend's User.timeLockInDefault fallback, which is false.
  const [lockIn, setLockIn] = useState(true);
  const [payerCount, setPayerCount] = useState(2);
  const [splitMode, setSplitMode] = useState<(typeof SPLIT_MODES)[number]>("Evenly");
  const [destIdx, setDestIdx] = useState(0);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [expiryDays, setExpiryDays] = useState<number>(14);
  const [submitting, setSubmitting] = useState(false);
  // Server-side rejection, rendered inline under the address field and pinned
  // until dismissed — never a toast. See components/requests/form-error.tsx.
  const [submitError, setSubmitError] = useState<FormError | null>(null);

  const dest = DESTINATIONS[destIdx];
  const parsedAmount = Number(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const addressValid = isValidAddress(dest.chain, destinationAddress);
  /** The server rejected the address itself — mark the field, not just the notice. */
  const addressRejected = submitError?.field === "destinationAddress";
  const effectivePayerCount = kind === "split" ? payerCount : 1;
  const canSubmit = amountValid && addressValid && !submitting;

  const canPrefillWallet =
    dest.chain === "stellar" && walletType === "stellar" && isConnected && !!address;

  // The design's "Bills against a contract" block, gated to business
  // workspaces. There is no contract-linking API for Requests yet (the
  // contract objects on the Members screen belong to workspace membership,
  // not to a request) — shown as a real, disabled affordance rather than
  // wired to fabricated contract data.
  const showContractLink = !isPersonal;

  // The design's approval-required notice. Workspace has no approval
  // threshold field yet (lib/workspace.ts) and Requests have no approval
  // workflow — kept as a real conditional, permanently false, until that
  // ships. Never render a false "needs approval" claim in the meantime.
  const needsApproval = false;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const expiresAtDate = new Date(Date.now() + expiryDays * 86400000);
      const res = await createRequest({
        amount: parsedAmount,
        denominationCurrency: "USD",
        destinationAsset: dest.asset,
        destinationChain: dest.chain,
        destinationAddress: destinationAddress.trim(),
        payerCount: effectivePayerCount,
        name: title.trim() || undefined,
        expiresAt: expiresAtDate.toISOString(),
        workspaceId: isPersonal ? undefined : workspace.id,
        // Send the toggle's value explicitly. Omitting it makes the backend fall
        // back to User.timeLockInDefault (false on a fresh account), which would
        // silently create an UNLOCKED request while this screen showed "Lock the
        // rate" as on.
        timeLockIn: lockIn,
      });
      onCreated(res, effectivePayerCount);
    } catch (err) {
      setSubmitError(toFormError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const perPersonAmount = amountValid ? parsedAmount / Math.max(payerCount, 1) : 0;

  return (
    <div className="grid gap-6 items-start lg:grid-cols-[1.4fr_1fr]">
    <div className="min-w-0">
      <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.soft }}>
        What kind of money movement?
      </p>
      <div className="grid gap-2.5 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
        <TypeTile
          active={kind === "request"}
          init="RQ"
          label="Request money"
          sub="One link, ask anyone"
          color={A}
          onClick={() => setKind("request")}
        />
        <TypeTile
          active={kind === "split"}
          init="SP"
          label="Request from a group"
          sub="Ask several people, split evenly"
          color={P}
          onClick={() => setKind("split")}
        />
      </div>

      <div style={{ ...card({ background: "linear-gradient(145deg,#111 0%,#0d0d0d 100%)" }), padding: 24 }}>
        <FieldLabel>Amount</FieldLabel>
        <div
          className="flex items-center gap-3 mb-1.5"
          style={{
            padding: "16px 18px",
            borderRadius: 16,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        >
          <span
            style={{
              padding: "5px 10px",
              borderRadius: 8,
              fontSize: 11.5,
              fontWeight: 700,
              fontFamily: MONO,
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            USD
          </span>
          <span style={{ fontSize: 30, fontWeight: 500, color: "#555", fontFamily: MONO }}>$</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              color: "#fff",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              fontFamily: MONO,
              padding: 0,
              outline: "none",
            }}
          />
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: T.sub }}>
          Denominated in USD. The payer sees a live crypto quote at pay time.
        </p>

        <div
          className="flex items-start gap-3.5 mb-5"
          style={{
            padding: "13px 16px",
            borderRadius: 14,
            background: "rgba(34,211,238,0.05)",
            border: "1px solid rgba(34,211,238,0.18)",
          }}
        >
          <div className="flex-1 min-w-0">
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: A }}>Lock the rate</p>
            <p style={{ margin: "3px 0 0", fontSize: 11.5, lineHeight: 1.5, color: T.muted }}>
              {lockIn
                ? "Rate frozen when you send. You receive the fiat amount you asked for, whatever the token does."
                : "Rate quoted when they pay. You carry any price movement in between."}
            </p>
          </div>
          <Toggle on={lockIn} onChange={setLockIn} label="Lock the rate" />
        </div>

        <FieldLabel>{kind === "split" ? "What's it for" : "What is this for"}</FieldLabel>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is this for?"
          style={{
            width: "100%",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.09)",
            background: "rgba(255,255,255,0.03)",
            padding: "13px 16px",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            marginBottom: 20,
            outline: "none",
          }}
        />

        {kind === "split" && (
          <>
            <FieldLabel>Who pays</FieldLabel>
            <div
              className="flex items-center gap-3 mb-2"
              style={{
                padding: "12px 15px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.09)",
              }}
            >
              <button
                type="button"
                onClick={() => setPayerCount((n) => Math.max(2, n - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                style={{ color: T.muted }}
                aria-label="Fewer people"
              >
                <Minus size={16} strokeWidth={2.5} />
              </button>
              <span
                className="flex-1 text-center"
                style={{ fontFamily: MONO, fontWeight: 800, fontSize: 15, color: "#fff" }}
              >
                {payerCount} {payerCount === 1 ? "person" : "people"}
              </span>
              <button
                type="button"
                onClick={() => setPayerCount((n) => Math.min(50, n + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                style={{ color: T.muted }}
                aria-label="More people"
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 11.5, color: T.dim }}>
              No names collected — each person gets their own private link. Dividing the same request
              into named shares isn&rsquo;t supported yet.
            </p>

            <div
              className="flex items-center gap-3.5 mb-2 flex-wrap"
              style={{
                padding: "13px 16px",
                borderRadius: 14,
                background: "rgba(167,139,250,0.06)",
                border: "1px solid rgba(167,139,250,0.2)",
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 700, color: P }}>Divide</span>
              <div className="flex gap-0.5 flex-wrap" style={{ padding: 2, borderRadius: 9, background: "rgba(255,255,255,0.06)" }}>
                {SPLIT_MODES.map((m) => {
                  const active = m === "Evenly";
                  const selected = splitMode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={!active}
                      onClick={() => active && setSplitMode(m)}
                      title={active ? undefined : "Coming soon"}
                      style={{
                        padding: "5px 11px",
                        borderRadius: 7,
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: active ? "pointer" : "not-allowed",
                        background: selected ? P : "transparent",
                        color: selected ? "#0a0a0a" : active ? T.muted : T.faint,
                        opacity: active ? 1 : 0.55,
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
              <div className="flex-1" />
              <span style={{ fontSize: 12.5, color: T.muted, fontFamily: MONO }}>
                {formatCurrency(perPersonAmount, "USD")} each
              </span>
            </div>
          </>
        )}

        {showContractLink && (
          <>
            <FieldLabel>Bills against</FieldLabel>
            <div
              className="flex items-center gap-3 mb-2"
              style={{
                padding: "12px 15px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px dashed rgba(255,255,255,0.15)",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  background: "rgba(255,255,255,0.05)",
                  flexShrink: 0,
                }}
              >
                📄
              </span>
              <div className="flex-1 min-w-0">
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: T.body }}>No contract linked</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: T.dim }}>
                  Billing a request against a member contract is coming soon.
                </p>
              </div>
              <span style={pill(T.dim)}>Soon</span>
            </div>
          </>
        )}

        <div style={{ height: 1, margin: "22px 0", background: "rgba(255,255,255,0.07)" }} />

        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.soft }}>
          Settle into
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: T.sub }}>
          What lands in your wallet, whatever the payer sends.
        </p>
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {DESTINATIONS.map((d, i) => {
            const active = i === destIdx;
            return (
              <button
                key={`${d.chain}-${d.asset}`}
                type="button"
                onClick={() => {
                  setDestIdx(i);
                  // The rejection was about the previously selected asset/chain.
                  setSubmitError(null);
                }}
                className="flex items-center gap-3 text-left transition-all hover:border-white/[0.18]"
                style={{
                  padding: "14px 16px",
                  borderRadius: 15,
                  background: active ? "rgba(34,211,238,0.07)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 800,
                    flexShrink: 0,
                    background: `${d.color}2a`,
                    color: d.color,
                  }}
                >
                  {d.symbol[0]}
                </span>
                <div className="min-w-0">
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: active ? A : "#e8e8e8" }}>{d.symbol}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: T.sub }}>{d.sub}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <div>
            <FieldLabel>Link expires</FieldLabel>
            <div className="flex gap-1 p-0.5" style={{ borderRadius: 13, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)" }}>
              {EXPIRY_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setExpiryDays(d)}
                  className="flex-1"
                  style={{
                    padding: "9px 0",
                    borderRadius: 11,
                    fontSize: 12.5,
                    fontWeight: 700,
                    fontFamily: MONO,
                    background: expiryDays === d ? "rgba(255,255,255,0.1)" : "transparent",
                    color: expiryDays === d ? "#fff" : T.dim,
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>{dest.chain === "stellar" ? "Stellar" : "Solana"} address to receive at</FieldLabel>
            <input
              value={destinationAddress}
              // Editing the address is the user acting on the error, so retire it.
              onChange={(e) => {
                setDestinationAddress(e.target.value);
                if (addressRejected) setSubmitError(null);
              }}
              placeholder={dest.chain === "stellar" ? "G..." : "Solana wallet address"}
              style={{
                width: "100%",
                padding: "12px 15px",
                borderRadius: 13,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${
                  (destinationAddress && !addressValid) || addressRejected ? R : "rgba(255,255,255,0.09)"
                }`,
                fontSize: 13,
                color: T.body,
                fontFamily: MONO,
                outline: "none",
              }}
            />
            {submitError && (
              <FormErrorNotice error={submitError} onDismiss={() => setSubmitError(null)} />
            )}
          </div>
        </div>
        {canPrefillWallet && address !== destinationAddress && (
          <button
            type="button"
            onClick={() => setDestinationAddress(address ?? "")}
            className="text-[12px] font-semibold -mt-3 mb-5 block"
            style={{ color: A }}
          >
            Use connected wallet ({address?.slice(0, 6)}…{address?.slice(-4)})
          </button>
        )}

        {needsApproval && (
          <div
            className="flex items-center gap-3 mb-5"
            style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: "rgba(52,211,153,0.12)",
              }}
            >
              {Icons.shield({ size: 15 })}
            </span>
            <div className="flex-1">
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: G }}>Needs one approval before it goes out</p>
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.sub }}>Above the threshold for this workspace.</p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 transition-all enabled:hover:opacity-90 disabled:cursor-not-allowed"
          style={{
            borderRadius: 13,
            padding: 13,
            fontSize: 14,
            fontWeight: 800,
            background: canSubmit || submitting ? A : "rgba(34,211,238,0.12)",
            color: canSubmit || submitting ? "#0a0a0a" : "rgba(34,211,238,0.55)",
          }}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : kind === "split" ? (
            "Create group links"
          ) : (
            "Create request link"
          )}
        </button>
        {!canSubmit && !submitting && (
          <p className="text-center" style={{ fontSize: 12, fontWeight: 600, color: T.dim, marginTop: 10 }}>
            {!amountValid
              ? "Enter an amount to get your link"
              : !destinationAddress.trim()
                ? `Enter a ${dest.chain === "stellar" ? "Stellar" : "Solana"} address above to get your link`
                : `That doesn't look like a ${dest.chain === "stellar" ? "Stellar" : "Solana"} address`}
          </p>
        )}
      </div>
    </div>
    <PreviewPanel
      workspaceName={workspace.name}
      workspaceInit={workspace.initials}
      workspaceColor={workspace.color}
      amount={parsedAmount || 0}
      title={title}
      destSymbol={dest.symbol}
      destChainLabel={chainLabel(dest.chain)}
      kind={kind}
      payerCount={payerCount}
      expiryDays={expiryDays}
    />
    </div>
  );
}

function PreviewPanel({
  workspaceName,
  workspaceInit,
  workspaceColor,
  amount,
  title,
  destSymbol,
  destChainLabel,
  kind,
  payerCount,
  expiryDays,
}: {
  workspaceName: string;
  workspaceInit: string;
  workspaceColor: string;
  amount: number;
  title: string;
  destSymbol: string;
  destChainLabel: string;
  kind: Kind;
  payerCount: number;
  expiryDays: number;
}) {
  const rows: { k: string; v: string; color: string }[] = [
    { k: "Settles as", v: `${destSymbol} · ${destChainLabel}`, color: A },
    { k: "Payers", v: kind === "split" ? `${payerCount} people, evenly` : "Single request", color: "#d4d4d4" },
    { k: "Account needed", v: "No", color: G },
    { k: "Expires", v: `in ${expiryDays} days`, color: "#d4d4d4" },
  ];

  return (
    <div className="lg:sticky lg:top-[90px] min-w-0">
      <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.soft }}>
        What the payer sees
      </p>
      <div style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", background: "linear-gradient(145deg,#111 0%,#0d0d0d 100%)" }}>
        <div style={{ padding: 22, textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="mx-auto mb-3" style={{ width: 42, height: 42 }}>
            <AvatarChip init={workspaceInit} color={workspaceColor} size={42} radius={13} />
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: T.muted }}>
            <span style={{ color: "#e8e8e8", fontWeight: 700 }}>{workspaceName}</span> is requesting
          </p>
          <p style={{ margin: "10px 0 2px", fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", fontFamily: MONO }}>
            {formatCurrency(amount || 0, "USD")}
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.soft }}>{title || "Untitled"}</p>
        </div>
        <div style={{ padding: "14px 20px" }}>
          {rows.map((r) => (
            <div key={r.k} className="flex justify-between" style={{ padding: "6px 0" }}>
              <span style={{ fontSize: 12, color: T.sub }}>{r.k}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: r.color, fontFamily: MONO }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CreatedShare({ result, payerCount }: { result: CreateRequestResponse; payerCount: number }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const primaryLink = result.links[0]?.link ?? "";
  const isSingle = payerCount <= 1;

  const handleCopy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy — select and copy the link manually.");
    }
  };

  const shareTiles = [
    {
      init: "W",
      label: "WhatsApp",
      bg: "rgba(52,211,153,0.14)",
      fg: G,
      onClick: () => window.open(`https://wa.me/?text=${encodeURIComponent(primaryLink)}`, "_blank"),
    },
    {
      init: "@",
      label: "Email",
      bg: "rgba(34,211,238,0.14)",
      fg: A,
      onClick: () => window.open(`mailto:?subject=${encodeURIComponent("Payment request")}&body=${encodeURIComponent(primaryLink)}`),
    },
    {
      init: "T",
      label: "Telegram",
      bg: "rgba(129,140,248,0.14)",
      fg: "#818CF8",
      onClick: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(primaryLink)}`, "_blank"),
    },
    {
      init: "QR",
      label: "QR code",
      bg: "rgba(167,139,250,0.14)",
      fg: P,
      onClick: () => setShowQr((v) => !v),
    },
  ];

  return (
    <div className="max-w-[720px] mx-auto">
      <div style={{ textAlign: "center", padding: "12px 0 26px" }}>
        <div
          className="mx-auto mb-4 flex items-center justify-center"
          style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)" }}
        >
          <span style={{ color: G }}>{Icons.check({ size: 25 })}</span>
        </div>
        <h2 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff" }}>
          {isSingle ? "Your request is live" : `${result.links.length} links are ready`}
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted }}>
          Payable with USDC, XLM and SOL on Stellar or Solana. No account needed to pay it.
        </p>
      </div>

      {isSingle ? (
        <>
          <div className="flex gap-2.5 mb-5">
            <div
              className="flex-1 flex items-center"
              style={{
                padding: "14px 18px",
                borderRadius: 15,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                fontFamily: MONO,
                fontSize: 14,
                color: T.body,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {primaryLink}
            </div>
            <button
              type="button"
              onClick={() => handleCopy(primaryLink)}
              className="flex items-center gap-2 transition-all hover:opacity-90"
              style={{ borderRadius: 15, padding: "14px 22px", fontSize: 13.5, fontWeight: 700, background: A, color: "#0a0a0a" }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
            {shareTiles.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={t.onClick}
                className="flex flex-col items-center gap-2.5 transition-all hover:border-white/[0.18]"
                style={{ padding: "16px 10px", borderRadius: 15, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    background: t.bg,
                    color: t.fg,
                  }}
                >
                  {t.init}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.body }}>{t.label}</span>
              </button>
            ))}
          </div>

          {showQr && (
            <Card className="p-6 mb-6 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(primaryLink)}`}
                alt="QR code for the request link"
                width={220}
                height={220}
                className="mx-auto rounded-xl"
              />
              <p style={{ marginTop: 12, fontSize: 12, color: T.sub }}>Scan to open the payer link.</p>
            </Card>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-2 mb-6 text-left">
          {result.links.map((p, i) => (
            <div
              key={p.payerId}
              className="flex items-center justify-between gap-3"
              style={{ padding: "13px 16px", borderRadius: 15, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <div className="min-w-0">
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.bright }}>
                  Person {i + 1} — {formatCurrency(Number(p.shareAmount), "USD")}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, fontFamily: MONO, color: T.dim }} className="truncate">
                  {p.link}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(p.link)}
                className="flex items-center gap-1.5 shrink-0 transition-all hover:opacity-90"
                style={{ borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700, background: A, color: "#0a0a0a" }}
              >
                <Copy size={13} />
                Copy
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2.5">
        <Link
          href={`/requests/${result.requestId}`}
          className="flex-1 text-center transition-all hover:border-white/20 hover:text-white"
          style={{ borderRadius: 13, padding: 12, fontSize: 13, fontWeight: 700, background: "rgba(255,255,255,0.05)", color: T.body, border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Track this request
        </Link>
        <Link
          href="/"
          className="flex-1 text-center transition-all hover:border-white/20 hover:text-white"
          style={{ borderRadius: 13, padding: 12, fontSize: 13, fontWeight: 700, background: "rgba(255,255,255,0.05)", color: T.body, border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

export default function CreatePage() {
  const workspace = useActiveWorkspace();
  const [created, setCreated] = useState<{ res: CreateRequestResponse; payerCount: number } | null>(null);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="hidden sm:block border-b border-white/[0.07] sticky top-0 bg-[#0b0b0b]/95 backdrop-blur-xl z-10">
        <div className="flex px-7 items-center h-[70px]">
          <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-white">New request</h1>
        </div>
      </div>
      <div className="flex-1 p-4 sm:p-7 overflow-y-auto">
        {created ? (
          <CreatedShare result={created.res} payerCount={created.payerCount} />
        ) : (
          <CreateForm workspace={workspace} onCreated={(res, payerCount) => setCreated({ res, payerCount })} />
        )}
      </div>
    </div>
  );
}
