"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/formatters";
import { formatRelativeTime } from "@/lib/utils";
import { A, G, R, O, T, Card, SectionLabel, AvatarChip, Btn, Icons, FRIEND_COLORS, INSET } from "@/lib/splito-design";
import {
  getRequestDetail,
  type RequestDetailResponse,
  type RequestStatus,
} from "@/api-helpers/requests";
import { markParticipantAsPaid } from "@/features/expenses/api/client";
import { sendReminder } from "@/features/reminders/api/client";
import { usePageTitle } from "@/contexts/page-title";
import { useAuthStore } from "@/stores/authStore";
import { LockedScreen } from "@/components/shell/locked-feature";
import {
  StatusChip,
  STATUS_STYLE,
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

/** The general pay link — no `?payer=`, so the payer picks who they are (pay page's "select-payer" phase). */
function generalPayLink(token: string | null): string {
  if (!token) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/pay/${token}`;
}

/**
 * The happy-path status stepper — OPEN → PARTIALLY_PAID → SETTLED, matching
 * the design's stepper treatment (splito-finance.dc.html:754-761): completed
 * pips filled + checked, connectors behind them lit, the current pip
 * outlined, everything ahead dim. EXPIRED/CANCELLED are terminal alternates
 * off that path, not a 4th/5th pip — StatusStepper swaps to a one-line
 * terminal state for those instead of pretending they're "further along".
 */
const HAPPY_STEPS: { status: RequestStatus; label: string }[] = [
  { status: "OPEN", label: "Requested" },
  { status: "PARTIALLY_PAID", label: "Partially paid" },
  { status: "SETTLED", label: "Settled" },
];

const TERMINAL_NOTE: Partial<Record<RequestStatus, string>> = {
  EXPIRED: "The link closed before everyone paid.",
  CANCELLED: "You cancelled this request.",
};

function StatusStepper({ current }: { current: RequestStatus }) {
  const terminalNote = TERMINAL_NOTE[current];
  if (terminalNote) {
    const color = STATUS_STYLE[current]?.color ?? T.dim;
    return (
      <div
        className="flex items-center gap-3 mt-5"
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          background: `${color}0f`,
          border: `1px solid ${color}2a`,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <div>
          <p className="m-0" style={{ fontSize: 13, fontWeight: 700, color }}>
            {STATUS_STYLE[current]?.label ?? current}
          </p>
          <p className="mt-0.5 m-0" style={{ fontSize: 11.5, color: T.dim }}>
            {terminalNote}
          </p>
        </div>
      </div>
    );
  }

  const foundIndex = HAPPY_STEPS.findIndex((s) => s.status === current);
  const idx = foundIndex === -1 ? 0 : foundIndex; // defensive fallback only

  return (
    <div className="flex items-start mt-5">
      {HAPPY_STEPS.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        const lit = done || active;
        const color = lit ? (STATUS_STYLE[step.status]?.color ?? G) : T.dim;
        const isLast = i === HAPPY_STEPS.length - 1;
        return (
          <div key={step.status} className="flex items-start" style={{ flex: isLast ? "0 0 auto" : 1 }}>
            <div className="flex flex-col items-center" style={{ minWidth: 74 }}>
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: done ? color : active ? `${color}1a` : INSET,
                  border: `2px solid ${lit ? color : "rgba(255,255,255,0.14)"}`,
                  color: "#0a0a0a",
                }}
              >
                {done ? (
                  Icons.check({ size: 12 })
                ) : (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: active ? color : T.dim,
                    }}
                  />
                )}
              </div>
              <p
                className="mt-1.5 m-0 text-center"
                style={{ fontSize: 10.5, fontWeight: 700, color, whiteSpace: "nowrap" }}
              >
                {step.label}
              </p>
            </div>
            {!isLast && (
              <div
                className="flex-1"
                style={{ height: 2, margin: "11px 4px 0", background: done ? G : "rgba(255,255,255,0.08)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Built as a single string (not joined JSX text nodes) so grammar/spacing can't drift apart. */
function unpaidSummary(count: number): string {
  return count === 1
    ? "1 payer hasn't paid. Send a reminder below."
    : `${count} payers haven't paid. Send a reminder below.`;
}

/** Disabled text action — a control the design shows with no backing endpoint yet. */
function DeadAction({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <span
      title={title}
      style={{ fontSize: 12, fontWeight: 700, color: T.dim, cursor: "not-allowed" }}
    >
      {children}
    </span>
  );
}

function PayerRow({
  payer,
  requestId,
  token,
  currency,
  requestName,
  isLast,
  onChanged,
}: {
  payer: RequestDetailResponse["payers"][number];
  requestId: string;
  token: string | null;
  currency: string;
  requestName: string | null;
  isLast: boolean;
  onChanged: () => void;
}) {
  const link = payerLink(token, payer.payerId);
  const [marking, setMarking] = useState(false);
  const [confirmingPaid, setConfirmingPaid] = useState(false);
  const [nudging, setNudging] = useState(false);
  const color = FRIEND_COLORS[(payer.index - 1) % FRIEND_COLORS.length];
  // `name` is null for an anonymous (payerCount) request, or a group member
  // with no name/email on file — same positional fallback either way, and
  // the same one the create form's created-share screen already uses.
  const displayName = payer.name ?? `Person ${payer.index}`;

  const handleMarkPaid = async () => {
    if (!confirmingPaid) {
      setConfirmingPaid(true);
      return;
    }
    setMarking(true);
    try {
      await markParticipantAsPaid(requestId, payer.payerId);
      toast.success(`Marked ${displayName} as paid.`);
      onChanged();
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? "Couldn't mark as paid.";
      toast.error(message);
    } finally {
      setMarking(false);
      setConfirmingPaid(false);
    }
  };

  const handleNudge = async () => {
    setNudging(true);
    try {
      await sendReminder({
        receiverId: payer.payerId,
        reminderType: "NUDGE",
        content: `Reminder: ${formatCurrency(payer.shareAmount, currency)} is due${
          requestName ? ` for "${requestName}"` : ""
        }.`,
      });
      toast.success(`Nudged ${displayName}.`);
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? "Couldn't send the nudge.";
      toast.error(message);
    } finally {
      setNudging(false);
    }
  };

  return (
    <div
      style={{
        padding: "15px 18px",
        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-3">
        <AvatarChip init={payer.name ? payer.name.slice(0, 2).toUpperCase() : `P${payer.index}`} color={color} size={36} />
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 13.5, fontWeight: 700, color: T.bright, margin: 0 }}>
            {displayName}
          </p>
          <p className="mt-0.5" style={{ fontSize: 11.5, color: T.sub, fontWeight: 600 }}>
            {payer.isPaid ? (
              <span style={{ color: G }}>
                Paid{payer.paidAt ? ` · ${formatRelativeTime(new Date(payer.paidAt))}` : ""}
              </span>
            ) : payer.status === "FAILED" ? (
              <span style={{ color: R }}>Last attempt failed</span>
            ) : payer.status === "SUBMITTED" || payer.status === "QUOTED" ? (
              <span style={{ color: O }}>In progress</span>
            ) : (
              "Not paid yet"
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p
            className="font-mono"
            style={{ fontSize: 14, fontWeight: 800, color: payer.isPaid ? G : "#fff", margin: 0 }}
          >
            {formatCurrency(payer.shareAmount, currency)}
          </p>
        </div>
      </div>

      {payer.status === "FAILED" && !payer.isPaid && (
        <p
          className="mt-2.5"
          style={{
            margin: "10px 0 0 49px",
            padding: "9px 13px",
            borderRadius: 11,
            fontSize: 12,
            lineHeight: 1.5,
            color: T.soft,
            background: "rgba(248,113,113,0.06)",
            border: "1px solid rgba(248,113,113,0.16)",
          }}
        >
          Their last payment attempt didn&apos;t go through. They&apos;ll need to retry from their link.
        </p>
      )}

      {!payer.isPaid && (
        <div className="flex items-center gap-4 flex-wrap" style={{ marginLeft: 49, marginTop: 10 }}>
          {link && <CopyButton value={link} label="Copy link" />}
          <button
            type="button"
            onClick={handleNudge}
            disabled={nudging}
            style={{ fontSize: 12, fontWeight: 700, color: A, background: "none", border: "none", cursor: nudging ? "default" : "pointer", padding: 0 }}
          >
            {nudging ? "Nudging…" : "Nudge"}
          </button>
          <button
            type="button"
            onClick={handleMarkPaid}
            disabled={marking}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: confirmingPaid ? G : T.body,
              background: "none",
              border: "none",
              cursor: marking ? "default" : "pointer",
              padding: 0,
            }}
          >
            {marking ? "Marking…" : confirmingPaid ? "Confirm mark as paid?" : "Mark paid"}
          </button>
        </div>
      )}

      {payer.transactionHash && (
        <a
          href={payer.explorerUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 mt-2 font-mono"
          style={{ fontSize: 11, color: A, marginLeft: 49 }}
        >
          {payer.transactionHash.slice(0, 10)}…{payer.transactionHash.slice(-8)}
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

function RequestDetailScreen() {
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

  // The shell's <Topbar/> (>=1025px) shows the static "Requests" section
  // title until a dynamic screen overrides it — lib/shell-nav.ts's
  // pageMetaFor() has no entry for /requests/<id>. usePageTitle() is that
  // override hook (contexts/page-title.tsx); it no-ops while `data` is null.
  usePageTitle(
    data?.name || (data ? "Payment request" : undefined),
    data ? `${formatCurrency(data.amount, data.denominationCurrency || "USD")} · ${STATUS_STYLE[data.status]?.label ?? data.status}` : undefined
  );

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
  const unpaidPayers = data.payers.filter((p) => !p.isPaid);
  const shareLink = generalPayLink(data.token);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Below 1025px the shell's own <Topbar/> isn't mounted (app/client-layout.tsx)
          — this is the only heading in that range. At >=1025px usePageTitle()
          above puts the same title into the shell's topbar instead, so this
          stays hidden there rather than showing a second one. */}
      <div className="block min-[1025px]:hidden border-b border-white/[0.07] sticky top-0 bg-[#0b0b0b]/95 backdrop-blur-xl z-10">
        <div className="flex px-4 sm:px-7 items-center gap-3 h-[60px] sm:h-[70px]">
          <button
            type="button"
            onClick={() => router.push("/requests")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors shrink-0"
            aria-label="Back to requests"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[16px] sm:text-[20px] font-extrabold tracking-[-0.02em] text-white truncate">
            {data.name || "Request"}
          </h1>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-7 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-[22px] items-start">
          {/* ── Left column ──────────────────────────────────────────── */}
          <div className="min-w-0">
            {/* Summary */}
            <Card className="p-5 sm:p-6 mb-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap mb-2">
                    <StatusChip status={data.status} />
                    {shareLink && (
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="font-mono truncate"
                          style={{ fontSize: 11.5, color: T.dim, maxWidth: 220 }}
                          title={shareLink}
                        >
                          {shareLink.replace(/^https?:\/\//, "")}
                        </span>
                        <CopyButton value={shareLink} />
                      </span>
                    )}
                  </div>
                  <p
                    className="font-extrabold"
                    style={{ fontSize: 20, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}
                  >
                    {data.name || "Payment request"}
                  </p>
                  <p className="mt-1.5" style={{ fontSize: 12.5, color: T.sub }}>
                    Requested {formatRelativeTime(new Date(data.createdAt))}
                    {data.payerCount > 1 && ` · divided ${data.payerCount} ways`}
                    {" · settles to "}
                    {assetLabel(data.destinationAsset)} on {chainLabel(data.destinationChain)}
                  </p>
                  <div className="flex gap-3.5 mt-2.5">
                    <DeadAction title="Editing an existing request isn't supported yet — no PATCH /api/requests/:id endpoint.">
                      Edit
                    </DeadAction>
                    <DeadAction title="Duplicating a request isn't supported yet — the create flow has no prefill-from-existing endpoint.">
                      Duplicate
                    </DeadAction>
                    <DeadAction title="Cancelling a request isn't supported yet — no cancel/delete endpoint on /api/requests/:id.">
                      Cancel request
                    </DeadAction>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className="font-mono font-extrabold"
                    style={{ fontSize: 28, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}
                  >
                    {formatCurrency(data.amount, currency)}
                  </p>
                  {data.receivedAmount > 0 && (
                    <p
                      className="font-mono font-bold mt-1"
                      style={{ fontSize: 12.5, color: G, margin: "4px 0 0" }}
                    >
                      {formatCurrency(data.receivedAmount, currency)} received
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5">
                {progress && (
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>{progress}</span>
                  </div>
                )}
                <ProgressBar paidCount={data.paidCount} payerCount={data.payerCount} />
              </div>

              <StatusStepper current={data.status} />
              <p className="mt-2.5" style={{ fontSize: 11.5, color: T.dim, margin: "10px 0 0" }}>
                Personal requests skip approval. Workspace requests above the threshold don&apos;t.
              </p>
            </Card>

            {/* Payers */}
            <SectionLabel>
              {data.payerCount === 1 ? "Who this went to" : `${data.payerCount} payers`}
            </SectionLabel>
            <Card style={{ padding: 0 }}>
              {data.payers.map((p, i) => (
                <PayerRow
                  key={p.payerId}
                  payer={p}
                  requestId={data.id}
                  token={data.token}
                  currency={currency}
                  requestName={data.name}
                  isLast={i === data.payers.length - 1}
                  onChanged={load}
                />
              ))}
            </Card>
          </div>

          {/* ── Right column ─────────────────────────────────────────── */}
          <div className="min-w-0 lg:sticky lg:top-24">
            <SectionLabel>Settlement</SectionLabel>
            <Card className="p-5 mb-4">
              <div className="grid grid-cols-2 gap-y-3.5 gap-x-4">
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

            {shareLink && (
              <a
                href={shareLink}
                target="_blank"
                rel="noreferrer"
                className="block text-center mb-3"
                style={{
                  borderRadius: 12,
                  padding: 11,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: INSET,
                  color: T.body,
                  border: "1px solid rgba(255,255,255,0.1)",
                  textDecoration: "none",
                }}
              >
                Open payer view
              </a>
            )}

            <SectionLabel>Nudges</SectionLabel>
            <Card className="p-5">
              {unpaidPayers.length === 0 ? (
                <p style={{ fontSize: 12, color: T.dim, margin: 0 }}>
                  Everyone has paid — nothing to nudge.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 11.5, lineHeight: 1.5, color: T.dim, margin: "0 0 14px" }}>
                    {unpaidSummary(unpaidPayers.length)}
                  </p>
                  <div className="flex flex-col gap-2">
                    {unpaidPayers.map((p) => (
                      <NudgeRow key={p.payerId} payer={p} currency={currency} requestName={data.name} />
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function NudgeRow({
  payer,
  currency,
  requestName,
}: {
  payer: RequestDetailResponse["payers"][number];
  currency: string;
  requestName: string | null;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  // Same fallback as PayerRow above — null covers both the anonymous flow
  // and a group member with no name/email on file.
  const displayName = payer.name ?? `Person ${payer.index}`;

  const handleSend = async () => {
    setSending(true);
    try {
      await sendReminder({
        receiverId: payer.payerId,
        reminderType: "NUDGE",
        content: `Reminder: ${formatCurrency(payer.shareAmount, currency)} is due${
          requestName ? ` for "${requestName}"` : ""
        }.`,
      });
      setSent(true);
      toast.success(`Nudged ${displayName}.`);
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? "Couldn't send the nudge.";
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ fontSize: 12, color: T.body, fontWeight: 600 }}>
        {displayName} · {formatCurrency(payer.shareAmount, currency)}
      </span>
      <Btn
        variant={sent ? "ghost" : "primary"}
        disabled={sending}
        onClick={handleSend}
        style={{ padding: "6px 12px", fontSize: 11.5, borderRadius: 9 }}
      >
        {sending ? "Sending…" : sent ? "Sent" : "Nudge"}
      </Btn>
    </div>
  );
}

/**
 * The shell now renders its chrome for signed-out visitors too, so
 * `/requests/[id]` — including any real request id typed or bookmarked — is
 * reachable without a session. Gate here, above RequestDetailScreen's
 * `getRequestDetail` fetch: hooks can't be called conditionally, so the only
 * way to keep that request-detail lookup from firing for an anonymous
 * visitor is to never mount the component that owns it.
 */
export default function RequestDetailPage() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return (
      <LockedScreen
        title="Request details"
        reason="Sign in to see this request"
        blurb="Tracking a request — its payers, its status and its history — belongs to the account that created it."
      />
    );
  }
  return <RequestDetailScreen />;
}
