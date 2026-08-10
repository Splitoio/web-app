"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DetailGroup } from "@/features/groups/api/client";
import { useAuthStore } from "@/stores/authStore";
import { formatCurrency } from "@/utils/formatters";
import { useConvertedBalanceTotal } from "@/features/currencies/hooks/use-currencies";
import { useGroupLayout } from "@/contexts/group-layout-context";
import { usePageTitle } from "@/contexts/page-title";
import { cn } from "@/lib/utils";
import {
  Btn,
  T,
  A,
  G,
  R,
  MONO,
  heroCard,
  eyebrow,
  avatarChip,
  getUserColor,
} from "@/lib/splito-design";

/**
 * Group detail hero (design lines 1262-1276): back link → hero card (avatar,
 * name, description, member-avatar stack, balance figure, Request/Add-someone
 * actions) → tab strip. "Request from this group" is the headline action —
 * it opens the same add-expense flow as before (the real, working mechanism
 * for asking this group's members for money), just relabeled; splitting stays
 * one tab away, never the default copy.
 */
export function GroupInfoHeader({
  groupId,
  group,
  onAddExpenseClick,
}: {
  groupId: string;
  group: DetailGroup;
  onAddExpenseClick: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { openAddMember, isAdmin } = useGroupLayout();
  const defaultCurrency = user?.currency || "USD";

  // Compute balance arrays (use empty when no group so hooks are unconditional)
  const balancesByCurrency = (() => {
    if (!group?.groupBalances) return {} as Record<string, number>;
    const userBalances = group.groupBalances.filter(
      (balance) => balance.userId === user?.id
    );
    const currencyMap: Record<string, number> = {};
    userBalances.forEach((balance) => {
      if (!currencyMap[balance.currency]) {
        currencyMap[balance.currency] = 0;
      }
      currencyMap[balance.currency] += balance.amount;
    });
    return currencyMap;
  })();
  const owed: { currency: string; amount: number }[] = [];
  const owe: { currency: string; amount: number }[] = [];
  Object.entries(balancesByCurrency).forEach(([currency, amount]) => {
    if (amount > 0) {
      owed.push({ currency, amount });
    } else if (amount < 0) {
      owe.push({ currency, amount: Math.abs(amount) });
    }
  });

  // owed = positive balances = amounts the current user OWES (debts)
  // owe  = negative balances (abs) = amounts the current user IS OWED (credits)
  const { total: totalOwedToUser, isLoading: loadingOwe } = useConvertedBalanceTotal(
    owe,
    defaultCurrency
  );
  const { total: totalUserOwes, isLoading: loadingOwed } = useConvertedBalanceTotal(
    owed,
    defaultCurrency
  );
  const converting = loadingOwe || loadingOwed;

  const memberCountForTitle = group?.groupUsers?.length ?? 0;
  usePageTitle(
    group?.name,
    `${memberCountForTitle} member${memberCountForTitle !== 1 ? "s" : ""} in this group`
  );

  if (!group) return null;

  const memberCount = group.groupUsers?.length ?? 0;
  const net = converting ? null : totalOwedToUser - totalUserOwes;
  const isOwedToUser = net !== null && net > 0;
  const isUserOwes = net !== null && net < 0;
  const netAmount = net !== null ? Math.abs(net) : 0;
  const balanceLabel = isOwedToUser ? "You're owed" : isUserOwes ? "You owe" : "All settled";
  const balanceColor = isUserOwes ? R : G;

  const groupColor = group.color || getUserColor(group.name);
  const groupInit = (group.name || "?").trim().slice(0, 2).toUpperCase();
  const avatarMembers = (group.groupUsers ?? []).slice(0, 4);

  const tabs = [
    { label: "Balances", href: `/groups/${groupId}/balances` },
    { label: "Requests", href: `/groups/${groupId}/requests` },
    { label: "Activity", href: `/groups/${groupId}/activity` },
    ...(isAdmin ? [{ label: "Settings", href: `/groups/${groupId}/edit` }] : []),
  ];

  return (
    <div className="px-4 pt-4 sm:px-7 sm:pt-6">
      <Link
        href="/groups"
        className="inline-block mb-3.5"
        style={{ fontSize: 12.5, fontWeight: 700, color: T.sub, cursor: "pointer" }}
      >
        ← Groups
      </Link>

      <div className="p-5 sm:p-6 mb-4" style={heroCard()}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-[18px]">
          <div className="flex items-start gap-4 sm:gap-[18px] flex-1 min-w-0">
            <span style={{ ...avatarChip(groupColor, 58, 18), fontSize: 20, flexShrink: 0 }}>
              {groupInit}
            </span>
            <div className="flex-1 min-w-0">
              <h2
                className="truncate"
                style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: T.white }}
              >
                {group.name}
              </h2>
              <p style={{ margin: "6px 0 10px", fontSize: 13, color: T.sub }}>
                {group.description?.trim() ||
                  `${memberCount} member${memberCount !== 1 ? "s" : ""} in this group`}
              </p>
              <div className="flex items-center">
                {avatarMembers.map((gu) => (
                  <span
                    key={gu.user.id}
                    style={{
                      ...avatarChip(getUserColor(gu.user.name), 28),
                      fontSize: 9.5,
                      marginRight: -7,
                      border: "2px solid #101010",
                    }}
                  >
                    {(gu.user.name ?? "?")[0].toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right flex-shrink-0">
            <p style={eyebrow(T.muted)}>{converting ? "Balance" : balanceLabel}</p>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: converting ? T.dim : balanceColor,
                fontFamily: MONO,
              }}
            >
              {converting ? "…" : formatCurrency(netAmount, defaultCurrency)}
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 mt-5">
          <button
            type="button"
            onClick={onAddExpenseClick}
            className="flex-1 sm:flex-initial rounded-xl text-[13px] font-bold transition-opacity hover:opacity-90"
            style={{ padding: "10px 18px", background: A, color: "#0a0a0a" }}
          >
            Request from this group
          </button>
          <Btn variant="ghost" onClick={openAddMember} className="flex-1 sm:flex-initial" style={{ justifyContent: "center" }}>
            Add someone
          </Btn>
        </div>
      </div>

      <div
        className="flex rounded-[13px] w-full sm:w-fit mb-4"
        style={{ gap: 3, padding: 3, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex-1 sm:flex-initial rounded-[10px] text-center transition-all",
                isActive ? "text-white font-bold" : "font-semibold"
              )}
              style={{
                padding: "8px 18px",
                fontSize: 12.5,
                background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
