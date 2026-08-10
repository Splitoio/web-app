"use client";

// Create request + Created/Share screens.
// Design: .design/splito-finance.dc.html lines 526-695 (Create), 698-724 (Created/Share).
//
// ONE create experience, mounted by two routes:
//   /create        — the topbar's "+ Create", any visitor.
//   /   (app/page.tsx) — for a SIGNED-OUT visitor only; signed in, "/" is the
//                        dashboard. This is what the marketing site's CTAs land on.
// It used to live at app/create/page.tsx and a second, stripped-down copy of
// the same form lived inline in app/page.tsx for anonymous visitors. There is
// only this one now.
//
// Creating a request NEVER requires an account (the backend's POST /api/requests
// is session-optional — see createRequestSchema in request-money.controller.ts,
// which takes an anonymous `payerCount` and find-or-creates a shadow user off
// the destination address). What a signed-out visitor cannot do is the parts
// that need an identity: requesting from a group, and billing against a
// contract. Those render through components/shell/locked-feature.tsx as real,
// disabled controls with a reason — never hidden, never fake.
//
// The design mock imagines a richer product (invoices, bills, categories, notes,
// attachments, contract-backed bills, per-workspace approval thresholds, named
// payers with custom splits). The real backend (createRequestSchema in
// request-money.controller.ts, model Request in schema.prisma) only supports:
// one generic request, an even split across either an anonymous payerCount
// (1..50, no names) OR a real group's other members (named, requester
// excluded — exactly one of the two, never both), four destination pairs, an
// optional name + expiresAt, and an optional workspaceId. Blocks the design
// calls for that have no backend behavior yet (split modes beyond even,
// contract linking, approval) are rendered as visibly gated/disabled rather
// than wired to fake data — see comments below.

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Copy, Check, FileText, Users, UserPlus, Minus, Plus } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useAuthStore } from "@/stores/authStore";
import { LockedFeature, LockedButton } from "@/components/shell/locked-feature";
import { useGetSettlementPreference } from "@/features/user/hooks/use-update-profile";
import { useActiveWorkspace } from "@/contexts/workspace";
import { PERSONAL_WORKSPACE_ID } from "@/lib/workspace";
import { formatCurrency } from "@/utils/formatters";
import { QueryKeys } from "@/lib/constants";
import { getAllGroups } from "@/features/groups/api/client";
import {
  createRequest,
  type CreateRequestResponse,
  type DestinationAsset,
  type DestinationChain,
} from "@/api-helpers/requests";
import {
  A,
  G,
  O,
  P,
  R,
  B,
  T,
  MONO,
  Card,
  Toggle,
  AvatarChip,
  Icons,
  card,
  pill,
  eyebrow,
  getUserColor,
  BORDER,
  INSET,
} from "@/lib/splito-design";
import { chainLabel } from "@/components/requests/request-bits";
import { FormErrorNotice } from "@/components/requests/form-error";
import { toFormError, type FormError } from "@/lib/request-errors";

// ─── Destination options — settlement is Stellar-only (owner decision:
// XLM and USDC on Stellar). Solana was never a settlement destination beyond
// these two now-removed pairs. (This list used to have a second, narrower copy
// in app/page.tsx's guest form — that form is gone and this is the only one.) ──
const DESTINATIONS: {
  chain: DestinationChain;
  asset: DestinationAsset;
  symbol: string;
  sub: string;
  color: string;
}[] = [
  { chain: "stellar", asset: "usdc-stellar", symbol: "USDC", sub: "Stellar · stable", color: "#4E9BE8" },
  { chain: "stellar", asset: "xlm", symbol: "XLM", sub: "Stellar · native", color: A },
];

// Format-only pre-check so the button can say why it is disabled before a
// round-trip; the backend re-validates every address it is handed
// (validateAddressForChain, request-money.controller.ts). There used to be a
// second copy of this in app/page.tsx's guest form — one form now, one copy.
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

/** createRequestSchema caps `payerCount` at 50 (request-money.controller.ts). */
const MAX_PAYERS = 50;

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

/**
 * The "Bills against" block is already a disabled "Soon" affordance for a
 * business workspace. Signed out it needs a *different* reason — an account,
 * not a future release — so it gets the lock wrapper on top. A fragment when
 * unlocked, so the authenticated markup is byte-for-byte what it was.
 */
function LockedContract({ locked, children }: { locked: boolean; children: React.ReactNode }) {
  if (!locked) return <>{children}</>;
  return <LockedFeature reason="Sign in to bill against a contract">{children}</LockedFeature>;
}

function CreateForm({
  workspace,
  onCreated,
}: {
  workspace: ReturnType<typeof useActiveWorkspace>;
  onCreated: (res: CreateRequestResponse, payerCount: number) => void;
}) {
  const isPersonal = workspace.id === PERSONAL_WORKSPACE_ID;
  // Signed out, this whole screen is the logged-out console's landing page.
  // Everything that needs an identity is locked rather than hidden; everything
  // the anonymous POST /api/requests supports stays fully live.
  const { isAuthenticated } = useAuthStore();
  const { isConnected, address, walletType } = useWallet();
  // Only tells the user whether Settings has an address on file for the
  // selected chain — this form has never prefilled from it (only from a
  // connected wallet, see canPrefillWallet below), and this doesn't add that.
  // Gated: an anonymous visitor has no settlement preferences and the request
  // would 401 for nothing.
  const { data: settlementPrefs = [] } = useGetSettlementPreference({ enabled: isAuthenticated });

  const [kind, setKind] = useState<Kind>("request"); // "request" is the landing state — split is never the default
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  // Locking is the product's headline promise, so it leads as on. This value is
  // always sent on submit (see timeLockIn in the createRequest call) rather than
  // relying on the backend's User.timeLockInDefault fallback, which is false.
  const [lockIn, setLockIn] = useState(true);
  // "Request from a group" sends `groupId`, never an anonymous `payerCount` —
  // the backend accepts exactly one of the two. See canSubmit/handleSubmit.
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  // How many opaque payer slots to split "Request money" across (1..50, the
  // backend's cap). This form used to hardcode 1 and the only way to ask
  // several people was a group, which needs an account — so the anonymous
  // flow lost the capability the old landing page's stepper had. Group mode
  // ignores this: membership decides the count there.
  const [payerCount, setPayerCount] = useState(1);
  const [splitMode, setSplitMode] = useState<(typeof SPLIT_MODES)[number]>("Evenly");
  const [destIdx, setDestIdx] = useState(0);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [expiryDays, setExpiryDays] = useState<number>(14);
  const [submitting, setSubmitting] = useState(false);
  // Server-side rejection, rendered inline under the address field and pinned
  // until dismissed — never a toast. See components/requests/form-error.tsx.
  const [submitError, setSubmitError] = useState<FormError | null>(null);

  // Fetched only in "split" mode — GET /api/groups, the same endpoint and
  // query key components/groups-list.tsx already uses for the Groups page,
  // so the two share a cache. Groups are split-only; business workspaces are
  // Organizations and never appear here.
  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
    queryKey: [QueryKeys.GROUPS, "list"],
    queryFn: getAllGroups,
    // Split mode is itself locked for a signed-out visitor (there are no groups
    // without an account), so `isAuthenticated` is belt-and-braces: it keeps
    // the query from ever firing even if some future path sets kind directly.
    enabled: kind === "split" && isAuthenticated,
  });
  const groups = groupsData ?? [];
  // Groups you can actually request from float to the top, so the list never
  // opens looking dead — on a fresh account every group is solo (you're the
  // only member until you invite), which is the default first run, not an
  // edge case. Stable within each bucket, so the API's own order survives.
  const sortedGroups = [
    ...groups.filter((g) => (g.groupUsers ?? []).length > 1),
    ...groups.filter((g) => (g.groupUsers ?? []).length <= 1),
  ];
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;
  // The requester is always a member of their own group and is always
  // excluded from the payers (backend behaviour, not a guess) — so the
  // resulting payer count is members-minus-you, full stop. A group of one
  // (just the requester) yields zero payers, which the backend 400s on
  // ("This group has no other members to request from"). Such a group is never
  // selectable in the picker below — its row links to that group's edit screen
  // to invite someone instead — so `selectedGroupId` can only ever hold a group
  // with real payers and the request can't fail that way on submit.
  const selectedGroupMemberCount = selectedGroup ? (selectedGroup.groupUsers ?? []).length : 0;
  const selectedGroupPayerCount = Math.max(selectedGroupMemberCount - 1, 0);

  const dest = DESTINATIONS[destIdx];
  const parsedAmount = Number(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const addressValid = isValidAddress(dest.chain, destinationAddress);
  /** The server rejected the address itself — mark the field, not just the notice. */
  const addressRejected = submitError?.field === "destinationAddress";
  const effectivePayerCount = kind === "split" ? selectedGroupPayerCount : payerCount;
  const canSubmit =
    amountValid &&
    addressValid &&
    !submitting &&
    (kind === "request" || (!!selectedGroupId && selectedGroupPayerCount > 0));

  const canPrefillWallet =
    dest.chain === "stellar" && walletType === "stellar" && isConnected && !!address;
  const hasSettlementAddress = settlementPrefs.some(
    (p) => p.chainId === dest.chain && !!p.wallet?.address
  );

  // The design's "Bills against a contract" block, gated to business
  // workspaces. There is no contract-linking API for Requests yet (the
  // contract objects on the Members screen belong to workspace membership,
  // not to a request) — shown as a real, disabled affordance rather than
  // wired to fabricated contract data.
  //
  // Signed out there is no workspace, so `!isPersonal` alone would hide the
  // block entirely — but linking a bill to a contract is one of the things an
  // account buys, so the logged-out console shows it locked instead of
  // pretending it doesn't exist.
  const showContractLink = !isPersonal || !isAuthenticated;

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
        // Exactly one of the two — never both, never neither (the backend
        // 400s either violation).
        ...(kind === "split" ? { groupId: selectedGroupId! } : { payerCount }),
        name: title.trim() || undefined,
        expiresAt: expiresAtDate.toISOString(),
        workspaceId: isPersonal ? undefined : workspace.id,
        // Send the toggle's value explicitly. Omitting it makes the backend fall
        // back to User.timeLockInDefault (false on a fresh account), which would
        // silently create an UNLOCKED request while this screen showed "Lock the
        // rate" as on.
        timeLockIn: lockIn,
      });
      // Trust the server's count over our local guess — group mode derives it
      // from actual membership at creation time (equals links.length).
      onCreated(res, res.payerCount);
    } catch (err) {
      setSubmitError(toFormError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const perPersonAmount = amountValid ? parsedAmount / Math.max(effectivePayerCount, 1) : 0;

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
        {/* Groups belong to an account — there is nothing to list for a signed-out
            visitor and the backend rejects a `groupId` from one outright. Shown
            as the real tile, disabled, with the reason. Asking several people
            without an account is still possible: that's the payer-count stepper
            below, which sends anonymous slots instead of named members. */}
        {isAuthenticated ? (
          <TypeTile
            active={kind === "split"}
            init="SP"
            label="Request from a group"
            sub="Ask several people, split evenly"
            color={P}
            onClick={() => setKind("split")}
          />
        ) : (
          <LockedFeature reason="Sign in to request from a group">
            <TypeTile
              active={false}
              init="SP"
              label="Request from a group"
              sub="Ask several people, split evenly"
              color={P}
              onClick={() => {}}
            />
          </LockedFeature>
        )}
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

        {/* Anonymous payer slots. One link per person, each for an even share —
            no names, no account, on either side. Group mode has its own count
            (membership) and never shows this. */}
        {kind === "request" && (
          <>
            <FieldLabel>How many people</FieldLabel>
            <div
              className="flex items-center gap-3.5 flex-wrap mb-5"
              style={{
                padding: "11px 14px",
                borderRadius: 14,
                background: "rgba(34,211,238,0.05)",
                border: "1px solid rgba(34,211,238,0.18)",
              }}
            >
              <div
                className="flex items-center gap-1"
                style={{ padding: 2, borderRadius: 10, background: "rgba(255,255,255,0.06)" }}
              >
                <button
                  type="button"
                  onClick={() => setPayerCount((n) => Math.max(1, n - 1))}
                  aria-label="Fewer people"
                  className="flex items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  style={{ width: 26, height: 26 }}
                >
                  <Minus size={15} strokeWidth={2.5} />
                </button>
                <span
                  className="text-center"
                  style={{ minWidth: "2ch", fontFamily: MONO, fontSize: 13.5, fontWeight: 800, color: "#fff" }}
                >
                  {payerCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPayerCount((n) => Math.min(MAX_PAYERS, n + 1))}
                  aria-label="More people"
                  className="flex items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  style={{ width: 26, height: 26 }}
                >
                  <Plus size={15} strokeWidth={2.5} />
                </button>
              </div>
              <span style={{ fontSize: 12, color: T.muted }}>
                {payerCount === 1
                  ? "One link, one payer."
                  : `${payerCount} private links, ${formatCurrency(perPersonAmount, "USD")} each.`}
              </span>
            </div>
          </>
        )}

        {kind === "split" && (
          <>
            <FieldLabel>Request from</FieldLabel>
            {isLoadingGroups ? (
              <div className="flex items-center justify-center" style={{ padding: "20px 0" }}>
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: T.muted }} />
              </div>
            ) : groups.length === 0 ? (
              <div
                className="text-center"
                style={{
                  padding: "28px 20px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  marginBottom: 8,
                }}
              >
                <Users size={28} strokeWidth={1.5} color={T.faint} className="mx-auto" style={{ marginBottom: 10 }} />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.body }}>No groups yet</p>
                <p style={{ margin: "4px 0 14px", fontSize: 11.5, color: T.sub }}>
                  Create a group first, then come back to request from it.
                </p>
                <Link
                  href="/groups"
                  className="inline-block transition-all hover:opacity-90"
                  style={{ borderRadius: 11, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, background: A, color: "#0a0a0a" }}
                >
                  Create a group
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2 mb-2" style={{ maxHeight: 260, overflowY: "auto" }}>
                {sortedGroups.map((g) => {
                  const memberCount = (g.groupUsers ?? []).length;
                  const groupPayerCount = Math.max(memberCount - 1, 0);
                  const solo = groupPayerCount === 0;
                  const active = g.id === selectedGroupId;
                  // Three distinct treatments: selectable (neutral), selected
                  // (violet tint + check), needs-an-invite (dashed amber +
                  // "Invite" affordance). The last one is a Link to that
                  // group's own edit screen, which already hosts the invite
                  // link + add-by-email UI (components/group-invite-link.tsx) —
                  // it is never a selection, so `selectedGroupId` can never
                  // hold a solo group and canSubmit stays honest.
                  const rowStyle = {
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: active ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.03)",
                    border: solo
                      ? "1px dashed rgba(251,146,60,0.4)"
                      : `1px solid ${active ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.09)"}`,
                    cursor: "pointer",
                  } as const;
                  const rowInner = (
                    <>
                      <AvatarChip
                        init={g.name.slice(0, 2).toUpperCase()}
                        color={active ? P : solo ? O : getUserColor(g.name)}
                        size={34}
                        radius={11}
                      />
                      <div className="min-w-0 flex-1">
                        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.bright }} className="truncate">
                          {g.name}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: solo ? O : T.sub }}>
                          {solo
                            ? "Just you so far — invite someone to request from them"
                            : `${memberCount} members · ${groupPayerCount} ${groupPayerCount === 1 ? "payer" : "payers"} (you're excluded)`}
                        </p>
                      </div>
                      {solo ? (
                        <span
                          className="flex items-center gap-1.5 shrink-0"
                          style={{
                            padding: "5px 10px",
                            borderRadius: 9,
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: O,
                            background: "rgba(251,146,60,0.1)",
                          }}
                        >
                          <UserPlus size={13} strokeWidth={2.5} />
                          Invite
                        </span>
                      ) : (
                        active && <Check size={17} strokeWidth={2.5} color={P} />
                      )}
                    </>
                  );
                  return solo ? (
                    <Link
                      key={g.id}
                      href={`/groups/${g.id}/edit`}
                      className="flex items-center gap-3 text-left transition-all hover:opacity-90"
                      style={rowStyle}
                    >
                      {rowInner}
                    </Link>
                  ) : (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGroupId(g.id)}
                      className="flex items-center gap-3 text-left transition-all hover:border-white/[0.18]"
                      style={rowStyle}
                    >
                      {rowInner}
                    </button>
                  );
                })}
              </div>
            )}
            <p style={{ margin: "0 0 8px", fontSize: 11.5, color: T.dim }}>
              {selectedGroup
                ? `${selectedGroupPayerCount} ${selectedGroupPayerCount === 1 ? "person gets" : "people get"} a private link for their share — you're never one of the payers.`
                : "Everyone in the group except you gets their own private link, labelled with their name where we have one."}
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
          <LockedContract locked={!isAuthenticated}>
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
                  background: INSET,
                  flexShrink: 0,
                }}
              >
                <FileText size={14} strokeWidth={1.75} color={T.dim} />
              </span>
              <div className="flex-1 min-w-0">
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: T.body }}>No contract linked</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: T.dim }}>
                  Billing a request against a member contract is coming soon.
                </p>
              </div>
              <span style={pill(T.dim)}>Soon</span>
            </div>
          </LockedContract>
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
            {/* Informational only — doesn't gate or prefill the field. Reacts to
                the selected chain like the label above it does. Suppressed
                signed out: the preference query is disabled there, so
                `hasSettlementAddress` is false for want of an answer rather
                than because nothing is on file — and the Settings link it
                offers is itself locked. */}
            {isAuthenticated && !hasSettlementAddress && (
              <p style={{ margin: "6px 0 0", fontSize: 11.5, lineHeight: 1.4, color: T.dim }}>
                No {dest.chain === "stellar" ? "Stellar" : "Solana"} address on file — add one in{" "}
                <Link href="/settings?tab=settlement" style={{ color: A }}>
                  Settings
                </Link>
                , or type it in above.
              </p>
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
                : !addressValid
                  ? `That doesn't look like a ${dest.chain === "stellar" ? "Stellar" : "Solana"} address`
                  : kind === "split" && !selectedGroupId
                    ? "Pick a group to request from"
                    : "That group has no one else to request from — pick another"}
          </p>
        )}
      </div>
    </div>
    {/* Signed out there is no workspace — `useActiveWorkspace()` returns the
        "Personal" stand-in, and telling a stranger their link preview says
        "Personal is requesting" would misdescribe what the payer will see.
        "You" is the honest placeholder until there is an identity. */}
    <PreviewPanel
      workspaceName={isAuthenticated ? workspace.name : "You"}
      workspaceInit={isAuthenticated ? workspace.initials : "YOU"}
      workspaceColor={workspace.color}
      isSelf={!isAuthenticated}
      amount={parsedAmount || 0}
      title={title}
      destSymbol={dest.symbol}
      destChainLabel={chainLabel(dest.chain)}
      kind={kind}
      payerCount={effectivePayerCount}
      groupName={selectedGroup?.name ?? null}
      expiryDays={expiryDays}
    />
    </div>
  );
}

function PreviewPanel({
  workspaceName,
  workspaceInit,
  workspaceColor,
  isSelf,
  amount,
  title,
  destSymbol,
  destChainLabel,
  kind,
  payerCount,
  groupName,
  expiryDays,
}: {
  workspaceName: string;
  workspaceInit: string;
  workspaceColor: string;
  /** `workspaceName` is the second person ("You"), so the verb has to agree. */
  isSelf: boolean;
  amount: number;
  title: string;
  destSymbol: string;
  destChainLabel: string;
  kind: Kind;
  /** Requester excluded — see selectedGroupPayerCount in CreateForm. 0 while
   * split mode has no group selected yet. */
  payerCount: number;
  /** The selected group's name, split mode only — null until one is picked. */
  groupName: string | null;
  expiryDays: number;
}) {
  const rows: { k: string; v: string; color: string }[] = [
    { k: "Settles as", v: `${destSymbol} · ${destChainLabel}`, color: A },
    ...(kind === "split" && groupName ? [{ k: "Group", v: groupName, color: "#d4d4d4" }] : []),
    {
      k: "Payers",
      v:
        kind !== "split"
          ? payerCount === 1
            ? "Single request"
            : `${payerCount} people, evenly`
          : payerCount > 0
            ? `${payerCount} ${payerCount === 1 ? "person" : "people"}, evenly — not you`
            : "Pick a group",
      color: "#d4d4d4",
    },
    { k: "Account needed", v: "No", color: G },
    { k: "Expires", v: `in ${expiryDays} days`, color: "#d4d4d4" },
  ];

  return (
    <div className="lg:sticky lg:top-[90px] min-w-0">
      <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.soft }}>
        What the payer sees
      </p>
      <div style={{ borderRadius: 20, border: BORDER, overflow: "hidden", background: "linear-gradient(145deg,#111 0%,#0d0d0d 100%)" }}>
        <div style={{ padding: 22, textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="mx-auto mb-3" style={{ width: 42, height: 42 }}>
            <AvatarChip init={workspaceInit} color={workspaceColor} size={42} radius={13} />
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: T.muted }}>
            <span style={{ color: "#e8e8e8", fontWeight: 700 }}>{workspaceName}</span>{" "}
            {isSelf ? "are requesting" : "is requesting"}
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

function CreatedShare({
  result,
  payerCount,
  onCreateAnother,
}: {
  result: CreateRequestResponse;
  payerCount: number;
  onCreateAnother: () => void;
}) {
  const { isAuthenticated } = useAuthStore();
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
      fg: B,
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
                style={{ padding: "16px 10px", borderRadius: 15, background: "rgba(255,255,255,0.03)", border: BORDER }}
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
                  {/* `name` is null for the anonymous flow AND for a group
                      member with no name/email on file — same positional
                      fallback either way. */}
                  {p.name ?? `Person ${i + 1}`} — {formatCurrency(Number(p.shareAmount), "USD")}
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

      <div className="flex gap-2.5 items-start">
        {/* Tracking is a per-account view of a request — the link works, the
            request is real and payable, but only the signed-in requester can
            watch it. The link itself is above and needs nobody. */}
        {isAuthenticated ? (
          <Link
            href={`/requests/${result.requestId}`}
            className="flex-1 text-center transition-all hover:border-white/20 hover:text-white"
            style={{ borderRadius: 13, padding: 12, fontSize: 13, fontWeight: 700, background: INSET, color: T.body, border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Track this request
          </Link>
        ) : (
          <LockedButton
            className="flex-1"
            label="Track this request"
            reason="Sign in to track this request"
          />
        )}
        {/* Signed out, "/" IS this screen, so a Link to it would be a no-op —
            same route, same mounted component, `created` still set. Reset the
            state instead. */}
        {isAuthenticated ? (
          <Link
            href="/"
            className="flex-1 text-center transition-all hover:border-white/20 hover:text-white"
            style={{ borderRadius: 13, padding: 12, fontSize: 13, fontWeight: 700, background: INSET, color: T.body, border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Back to dashboard
          </Link>
        ) : (
          <button
            type="button"
            onClick={onCreateAnother}
            className="flex-1 text-center transition-all hover:border-white/20 hover:text-white"
            style={{ borderRadius: 13, padding: 12, fontSize: 13, fontWeight: 700, background: INSET, color: T.body, border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Create another request
          </button>
        )}
      </div>
    </div>
  );
}

export function CreateRequestExperience() {
  const workspace = useActiveWorkspace();
  const { isAuthenticated } = useAuthStore();
  const [created, setCreated] = useState<{ res: CreateRequestResponse; payerCount: number } | null>(null);

  // The shell's <Topbar/> already carries the title, but it only mounts at
  // >=1025px (app/client-layout.tsx), so this in-page header covers everything
  // below that and hides at the breakpoint where Topbar takes over. It used to
  // be `hidden sm:block`, which stacked two identical "New request" headers on
  // any desktop viewport. Same treatment as app/page.tsx's DashboardScreen and
  // app/requests/[id]/page.tsx.
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="block min-[1025px]:hidden border-b border-white/[0.07] sticky top-0 bg-[#0b0b0b]/95 backdrop-blur-xl z-10">
        <div className="flex px-4 sm:px-7 items-center h-[60px] sm:h-[70px]">
          <h1 className="text-[16px] sm:text-[20px] font-extrabold tracking-[-0.02em] text-white">
            New request
          </h1>
        </div>
      </div>
      <div className="flex-1 p-4 sm:p-7 overflow-y-auto">
        {/* One line of framing for someone who just arrived from the marketing
            site with no account: this works, right now, without signing up. */}
        {!isAuthenticated && !created && (
          <p
            className="mb-5 text-[13px]"
            style={{ color: T.muted, maxWidth: 560 }}
          >
            No account needed — fill this in and you get a link to send. Signing in
            adds the rest of the console: your requests, people, and treasury.
          </p>
        )}
        {created ? (
          <CreatedShare
            result={created.res}
            payerCount={created.payerCount}
            onCreateAnother={() => setCreated(null)}
          />
        ) : (
          <CreateForm workspace={workspace} onCreated={(res, payerCount) => setCreated({ res, payerCount })} />
        )}
      </div>
    </div>
  );
}
