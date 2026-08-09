"use client";

import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Home, Utensils, Car, Receipt } from "lucide-react";
import { useGroupLayout } from "@/contexts/group-layout-context";
import { useAuthStore } from "@/stores/authStore";
import { useDeleteExpense, useMarkParticipantAsPaid } from "@/features/expenses/hooks/use-create-expense";
import { DualAmount } from "@/components/dual-amount";
import {
  Card,
  SectionLabel,
  Avatar,
  Tag,
  Btn,
  Icons,
  G,
  R,
  A,
  T,
  getUserColor,
} from "@/lib/splito-design";

type ExpenseWithParticipants = {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  paidBy: string;
  expenseDate: Date | string;
  createdAt: Date | string;
  splitType?: string;
  expenseParticipants?: { userId: string; amount: number; isPaid?: boolean }[];
};

const CATEGORY_ICON_PROPS = { size: 20, strokeWidth: 1.75, color: T.soft };
const CATEGORY_STYLES: Record<string, { bg: string; icon: ReactNode }> = {
  ACCOMMODATION: { bg: "rgba(255,255,255,0.06)", icon: <Home {...CATEGORY_ICON_PROPS} /> },
  FOOD: { bg: "rgba(255,255,255,0.06)", icon: <Utensils {...CATEGORY_ICON_PROPS} /> },
  TRAVEL: { bg: "rgba(255,255,255,0.06)", icon: <Car {...CATEGORY_ICON_PROPS} /> },
  TRANSPORT: { bg: "rgba(255,255,255,0.06)", icon: <Car {...CATEGORY_ICON_PROPS} /> },
};

function getCategoryStyle(category: string): { bg: string; icon: ReactNode } {
  const key = (category || "").toUpperCase();
  const known = CATEGORY_STYLES[key] || CATEGORY_STYLES[key.split(/[\s-_]/)[0]];
  if (known) return known;
  // If not a known keyword, treat it as a raw (possibly user-entered) category glyph
  const trimmed = (category || "").trim();
  if (trimmed && trimmed !== "OTHER") return { bg: "rgba(255,255,255,0.06)", icon: trimmed };
  return { bg: "rgba(255,255,255,0.06)", icon: <Receipt {...CATEGORY_ICON_PROPS} /> };
}

function formatDateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

function ExpenseRow({
  expense,
  groupUsers,
  currentUserId,
  currentUserName,
  onNotify,
  onSettle,
  onDelete,
  onMarkAsPaid,
  isLast,
}: {
  expense: ExpenseWithParticipants;
  groupUsers: { user: { id: string; name: string | null; image: string | null } }[];
  currentUserId: string;
  currentUserName: string | null;
  onNotify: () => void;
  onSettle: () => void;
  onDelete: () => void;
  onMarkAsPaid: (userId: string) => void;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const paidByUser = groupUsers.find((gu) => gu.user.id === expense.paidBy)?.user;
  const paidByName =
    expense.paidBy === currentUserId ? (currentUserName || "You") : (paidByUser?.name ?? "Someone");

  const participants = expense.expenseParticipants ?? [];
  const owingParticipants = participants.filter((p) => p.amount > 0);
  const settledCount = owingParticipants.filter((p) => p.isPaid).length;
  const settledLabel = `${settledCount}/${owingParticipants.length} settled`;

  const myParticipant = participants.find((p) => p.userId === currentUserId);
  const myShare = myParticipant?.amount ?? 0;
  const myIsPaid = myParticipant?.isPaid ?? false;
  const iAmPayer = expense.paidBy === currentUserId;
  const isInvolved = iAmPayer || participants.some((p) => p.userId === currentUserId);
  const pending = participants.filter((p) => p.amount > 0 && !p.isPaid).reduce((a, p) => a + p.amount, 0);

  const categoryStyle = getCategoryStyle(expense.category);

  const statusLine: { node: React.ReactNode; color: string } | null = (() => {
    if (!isInvolved) return null;
    if (myShare > 0 && !iAmPayer && !myIsPaid)
      return { node: <>you owe <DualAmount amount={myShare} currency={expense.currency} /></>, color: R };
    if (myShare > 0 && !iAmPayer && myIsPaid) return { node: "paid ✓", color: G };
    if (iAmPayer && pending > 0)
      return { node: <>owed <DualAmount amount={pending} currency={expense.currency} /></>, color: G };
    if (iAmPayer && pending === 0) return { node: "all settled ✓", color: G };
    return null;
  })();

  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
      <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full text-left transition-colors hover:bg-white/[0.02]"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "18px 20px",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            background: "rgba(20,20,20,1)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            flexShrink: 0,
          }}
        >
          {categoryStyle.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p style={{ fontWeight: 700, fontSize: 15, color: T.bright, marginBottom: 2 }}>
            {expense.name}
            </p>
            <p style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>
              Paid by {paidByName} · {settledLabel}
            </p>
          </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginRight: 8 }}>
          <p
            style={{
              fontWeight: 800,
              fontSize: 17,
              color: T.bright,
              fontFamily: "'DM Mono',monospace",
            }}
          >
            <DualAmount
              amount={expense.amount}
              currency={expense.currency}
              secondaryStyle={{ fontWeight: 600, fontSize: 13, color: T.muted }}
            />
          </p>
          {statusLine && (
            <p style={{ fontSize: 12, color: statusLine.color, fontWeight: 600, marginTop: 2 }}>
              {statusLine.node}
            </p>
          )}
        </div>
        <span
          className="sm:!flex  !hidden"
          style={{
            color: T.dim,
            display: "flex",
            transition: "transform 0.2s",
            transform: expanded ? "rotate(180deg)" : "none",
          }}
        >
          {Icons.chevD()}
        </span>
      </button>
      {expanded && (
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(0,0,0,0.2)",
            padding: "18px 22px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <SectionLabel className="!mb-2">Breakdown</SectionLabel>
          <div style={{ marginBottom: 16 }}>
            {participants
              .filter((p) => p.amount > 0)
              .map((p) => {
                const u = groupUsers.find((gu) => gu.user.id === p.userId)?.user;
                const name = p.userId === currentUserId ? (currentUserName || "You") : (u?.name ?? "Someone");
                const isSettled = !!p.isPaid;
                return (
                  <div
                    key={p.userId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar
                        init={u ? (u.name ?? "?")[0].toUpperCase() : "?"}
                        size={28}
                        color={getUserColor(u?.name || "?")}
                      />
                      <span style={{ color: T.body, fontSize: 13, fontWeight: 500 }}>{name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          color: isSettled ? G : R,
                          fontSize: 13,
                          fontWeight: 700,
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        <DualAmount
                          amount={p.amount}
                          currency={expense.currency}
                          secondaryStyle={{ fontWeight: 500, fontSize: 11, color: T.muted }}
                        />
                      </span>
                      {isInvolved && (
                        <Tag color={isSettled ? G : R}>
                          {isSettled ? "settled" : "pending"}
                        </Tag>
                      )}
                      {iAmPayer && !isSettled && p.userId !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => onMarkAsPaid(p.userId)}
                          style={{
                            background: "rgba(34,211,153,0.1)",
                            border: "1px solid rgba(34,211,153,0.25)",
                            borderRadius: 8,
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            color: G,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            fontFamily: "inherit",
                            transition: "all 0.15s",
                          }}
                        >
                          Mark paid
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          {isInvolved && (
            <div style={{ display: "flex", gap: 8, paddingTop: 16 }}>
              {!iAmPayer && myShare > 0 && !myIsPaid && (
                <Btn variant="ghost" onClick={onSettle} className="splito-sbtn" style={{ padding: "8px 16px", fontSize: 12 }}>
                  <Icons.check /> Pay
                </Btn>
              )}
              {iAmPayer && pending > 0 && (
                <Btn variant="ghost" onClick={onNotify} className="splito-abtn" style={{ padding: "8px 16px", fontSize: 12 }}>
                  <Icons.bell /> Notify
                </Btn>
              )}
              {iAmPayer && (
                <Btn variant="danger" onClick={onDelete} style={{ padding: "8px 14px", fontSize: 12 }}>
                  <Icons.trash size={14} /> Delete
                </Btn>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GroupRequestsPage() {
  const { user } = useAuthStore();
  const [expenseToDelete, setExpenseToDelete] = useState<{ id: string; name: string } | null>(null);
  const {
    group,
    openSettle,
    handleSendReminder,
    openAddExpense,
    openAddMember,
  } = useGroupLayout();
  const deleteExpenseMutation = useDeleteExpense(group?.id ?? "");
  const markPaidMutation = useMarkParticipantAsPaid(group?.id ?? "");

  const expenses = (group?.expenses ?? []) as ExpenseWithParticipants[];
  const nonSettlement = useMemo(
    () => expenses.filter((e) => e.splitType !== "SETTLEMENT"),
    [expenses]
  );

  const byDate = useMemo(() => {
    const map = new Map<string, ExpenseWithParticipants[]>();
    const sorted = [...nonSettlement].sort(
      (a, b) =>
        new Date(b.expenseDate ?? b.createdAt).getTime() -
        new Date(a.expenseDate ?? a.createdAt).getTime()
    );
    for (const e of sorted) {
      const key = formatDateKey(e.expenseDate ?? e.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [nonSettlement]);

  if (!group || !user) return null;

  return (
    <div className="space-y-6">
      {byDate.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          {/* mx-auto centres the icon — Tailwind preflight makes svg display:block,
              so the parent's text-align alone (which centred the old emoji) no
              longer does; same idiom as pay/status-banner.tsx. */}
          <Receipt size={40} strokeWidth={1.5} color={T.faint} className="mx-auto" style={{ marginBottom: 18 }} />
          <p style={{ fontSize: 18, fontWeight: 800, color: T.body, marginBottom: 8 }}>
            No requests yet
          </p>
          <p style={{ fontSize: 14, color: T.sub }}>Request money from the group to get started</p>
          <button
            type="button"
            onClick={openAddExpense}
            className="mt-4 inline-flex items-center gap-2 rounded-xl text-[13px] font-extrabold text-[#0a0a0a] transition-opacity hover:opacity-90"
            style={{ background: A, padding: "10px 18px", gap: 6 }}
          >
            <Icons.plus /> Request money
          </button>
        </div>
      ) : (
        byDate.map(([dateLabel, dateExpenses]) => (
          <section key={dateLabel} style={{ marginBottom: 24 }}>
            <SectionLabel>{dateLabel}</SectionLabel>
            <Card
              style={{
                padding: 0,
              }}
            >
              {dateExpenses.map((expense, idx) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  groupUsers={group.groupUsers}
                  currentUserId={user.id}
                  currentUserName={user.name ?? null}
                  isLast={idx === dateExpenses.length - 1}
                  onNotify={() => {
                    const firstOwer = expense.expenseParticipants?.find((p) => p.amount > 0);
                    if (firstOwer) handleSendReminder(firstOwer.userId, expense.id);
                  }}
                  onSettle={() => {
                    const myParticipation = expense.expenseParticipants?.find(
                      (p) => p.userId === user.id && !p.isPaid && p.amount > 0
                    );
                    if (myParticipation && expense.paidBy !== user.id) {
                      openSettle(expense.paidBy, myParticipation.amount, undefined, expense.id);
                    } else {
                      openSettle();
                    }
                  }}
                  onMarkAsPaid={(userId) => {
                    if (markPaidMutation.isPending) return;
                    markPaidMutation.mutate({ expenseId: expense.id, userId });
                  }}
                  onDelete={() => {
                    if (!group?.id) {
                      toast.error("Group not found");
                      return;
                    }
                    if (deleteExpenseMutation.isPending) return;
                    setExpenseToDelete({ id: expense.id, name: expense.name });
                  }}
                />
              ))}
            </Card>
          </section>
        ))
      )}

      {expenseToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 !mt-0"
          onClick={() => {
            if (!deleteExpenseMutation.isPending) setExpenseToDelete(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f10] p-5 sm:p-6 shadow-[0_20px_80px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg sm:text-xl font-semibold text-white">Delete request</h3>
            <p className="mt-3 text-sm sm:text-base text-white/70">
              Delete &quot;{expenseToDelete.name}&quot;? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                disabled={deleteExpenseMutation.isPending}
                className="rounded-lg px-4 py-2 text-sm text-white/70 hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteExpenseMutation.mutate(expenseToDelete.id, {
                    onSuccess: () => setExpenseToDelete(null),
                  });
                }}
                disabled={deleteExpenseMutation.isPending}
                className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                {deleteExpenseMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
