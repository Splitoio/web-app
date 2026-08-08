"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { staggerContainer, slideUp } from "@/utils/animations";
import { useConvertedBalanceTotal } from "@/features/currencies/hooks/use-currencies";
import { avatarChip, getUserColor, G, R, T } from "@/lib/splito-design";
import { formatRelativeTime } from "@/lib/utils";

type GroupItem = {
  id: string;
  name: string;
  color?: string | null;
  groupBalances?: { userId: string; currency: string; amount: number }[];
  groupUsers?: { user: { id: string; name?: string | null } }[];
  expenses?: { amount: number; currency: string; splitType?: string; paidBy?: string }[];
  updatedAt: Date;
};

/**
 * Group tile — design lines 1238-1256: overlapping member-avatar stack,
 * name, sub, balance figure + tag. Same net-balance math as before, just
 * presented as a grid tile instead of a list row.
 */
function GroupTile({
  group,
  user,
  defaultCurrency,
  formatCurrency,
}: {
  group: GroupItem;
  user: { id: string } | null;
  defaultCurrency: string;
  formatCurrency: (amount: number, currency: string) => string;
}) {
  const balances = group.groupBalances || [];
  const userBalances = balances.filter((b) => b.userId === user?.id);
  const byCurrency: Record<string, number> = {};
  userBalances.forEach((b) => {
    byCurrency[b.currency] = (byCurrency[b.currency] ?? 0) + b.amount;
  });
  const oweItems = Object.entries(byCurrency)
    .filter(([, a]) => a > 0)
    .map(([currency, amount]) => ({ amount, currency }));
  const owedItems = Object.entries(byCurrency)
    .filter(([, a]) => a < 0)
    .map(([currency, amount]) => ({ amount: Math.abs(amount), currency }));

  const { total: oweTotal, isLoading: loadOwe } = useConvertedBalanceTotal(oweItems, defaultCurrency);
  const { total: owedTotal, isLoading: loadOwed } = useConvertedBalanceTotal(owedItems, defaultCurrency);
  const converting = loadOwe || loadOwed;

  const net = (owedTotal ?? 0) - (oweTotal ?? 0);
  const color = net > 0 ? G : net < 0 ? R : T.dim;
  const prefix = net > 0 ? "+" : net < 0 ? "-" : "";

  const memberCount = (group.groupUsers ?? []).length;
  const expenseCount = Array.isArray(group.expenses) ? group.expenses.length : 0;
  const ago = formatRelativeTime(group.updatedAt instanceof Date ? group.updatedAt : new Date(group.updatedAt));
  const avatarMembers = (group.groupUsers ?? []).slice(0, 4);

  return (
    <motion.div variants={slideUp}>
      <Link
        href={`/groups/${group.id}`}
        className="tile block transition-all"
        style={{
          padding: "18px 20px",
          borderRadius: 20,
          background: "linear-gradient(145deg,#111 0%,#0d0d0d 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-center mb-3">
          {avatarMembers.length === 0 ? (
            <span style={{ ...avatarChip(T.dim, 28), fontSize: 9, border: "2px solid #0f0f0f" }}>
              {group.name.slice(0, 2).toUpperCase()}
            </span>
          ) : (
            avatarMembers.map((gu) => (
              <span
                key={gu.user.id}
                style={{
                  ...avatarChip(getUserColor(gu.user.name ?? null), 28),
                  fontSize: 9,
                  marginRight: -7,
                  border: "2px solid #0f0f0f",
                }}
              >
                {(gu.user.name ?? "?")[0].toUpperCase()}
              </span>
            ))
          )}
        </div>
        <p
          className="truncate"
          style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: T.bright }}
        >
          {group.name}
        </p>
        <p className="truncate" style={{ margin: "4px 0 0", fontSize: 12, color: T.sub }}>
          {memberCount} {memberCount === 1 ? "member" : "members"} · {expenseCount} request
          {expenseCount !== 1 ? "s" : ""}
        </p>
        <div className="flex items-baseline" style={{ gap: 8, marginTop: 10 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 800,
              fontFamily: "var(--font-dm-mono,monospace)",
              color: converting ? T.dim : color,
            }}
          >
            {converting ? "…" : net === 0 ? "Settled" : `${prefix}${formatCurrency(Math.abs(net), defaultCurrency)}`}
          </p>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: T.dim }}>{ago}</p>
        </div>
      </Link>
    </motion.div>
  );
}

export interface GroupsListContentProps {
  filteredGroups: GroupItem[];
  user: { id: string; name?: string | null } | null;
  defaultCurrency: string;
  formatCurrency: (amount: number, currency: string) => string;
  getCurrencySymbol: (id: string) => string;
  totalOweFormatted: string;
  totalOwedFormatted: string;
  unsettledCount: number;
  totalGroupsCount: number;
  currencyCount: number;
}

export function GroupsListContent(props: GroupsListContentProps) {
  const { filteredGroups, user, defaultCurrency, formatCurrency } = props;

  return (
    <div>
      {filteredGroups.length === 0 ? (
        <div
          style={{
            padding: "50px 20px",
            textAlign: "center",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20,
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 600, color: T.muted }}>No groups found</p>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5"
        >
          {filteredGroups.map((group) => (
            <GroupTile
              key={group.id}
              group={group}
              user={user}
              defaultCurrency={defaultCurrency}
              formatCurrency={formatCurrency}
            />
          ))}
          <motion.button
            variants={slideUp}
            type="button"
            onClick={() => document.dispatchEvent(new CustomEvent("open-create-group-modal"))}
            className="flex items-center justify-center"
            style={{
              padding: "18px 20px",
              borderRadius: 20,
              border: "1px dashed rgba(255,255,255,0.14)",
              color: T.dim,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              minHeight: 132,
              background: "none",
              fontFamily: "inherit",
            }}
          >
            + New group
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
