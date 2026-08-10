"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { useWorkspaceSummary } from "@/features/workspaces/hooks/use-workspace-summary";
import { useGetFriends } from "@/features/friends/hooks/use-get-friends";
import { useGetAllGroups } from "@/features/groups/hooks/use-create-group";
import { useConvertedBalanceTotal } from "@/features/currencies/hooks/use-currencies";
import { formatCurrency } from "@/utils/formatters";
import { PERSONAL_WORKSPACE_ID } from "@/lib/workspace";
import {
  A,
  G,
  R,
  T,
  TYPE,
  Card,
  HeroCard,
  Eyebrow,
  Mono,
  AvatarChip,
  getUserColor,
  card,
} from "@/lib/splito-design";
import { PersonBreakdownModal, type PersonBalance, type PersonHistoryItem } from "@/components/person-breakdown-modal";
import { ActivityList } from "@/components/dashboard/activity-list";
import { PersonalDashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

type Friend = {
  id: string;
  name: string;
  email?: string | null;
  balances?: Array<{ currency: string; amount: number }>;
};

type GroupWithBalances = {
  id: string;
  name: string;
  color?: string | null;
  groupBalances?: Array<{ currency: string; amount: number; userId: string }>;
};

/**
 * One "Settle up" tile (design 179-198). Backend convention (matches
 * components/friends-list.tsx): positive net = you owe the friend, negative =
 * the friend owes you. Each tile converts its own balances to the account's
 * display currency — same per-row pattern friends-list.tsx uses — rather than
 * forcing one conversion pass up front.
 */
function SettleTile({
  friend,
  defaultCurrency,
  onOpen,
}: {
  friend: Friend;
  defaultCurrency: string;
  onOpen: () => void;
}) {
  const { total: balance } = useConvertedBalanceTotal(friend.balances ?? [], defaultCurrency);
  const owesYou = balance < 0;
  const color = getUserColor(friend.name);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="tile"
      style={{ ...card({ borderRadius: 18 }), padding: "16px 17px", cursor: "pointer", transition: "all .2s" }}
    >
      <div className="flex items-center gap-[11px] mb-3.5">
        <AvatarChip init={getInitials(friend.name)} color={color} size={34} />
        <div className="min-w-0 flex-1">
          <p
            className="truncate"
            style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.bright }}
          >
            {friend.name}
          </p>
          <p className="truncate" style={{ margin: "2px 0 0", fontSize: 11, color: T.sub }}>
            {friend.email ?? ""}
          </p>
        </div>
      </div>
      <div className="flex items-end gap-2.5">
        <div className="flex-1 min-w-0">
          <Mono style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", color: "#FDFDFDE6" }}>
            {formatCurrency(Math.abs(balance), defaultCurrency)}
          </Mono>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: owesYou ? G : R,
            }}
          >
            {owesYou ? "owes you" : "you owe"}
          </p>
        </div>
      </div>
    </div>
  );
}

/** One "Your groups" tile (design 208-218). Value is the current user's net balance in that group. */
function GroupTile({
  group,
  userId,
  defaultCurrency,
}: {
  group: GroupWithBalances;
  userId: string;
  defaultCurrency: string;
}) {
  const userBalances = (group.groupBalances ?? [])
    .filter((b) => b.userId === userId)
    .map((b) => ({ amount: b.amount, currency: b.currency }));
  const { total: balance } = useConvertedBalanceTotal(userBalances, defaultCurrency);
  const settled = Math.abs(balance) < 0.005;
  const owesYou = balance < 0;
  const color = group.color || getUserColor(group.name);

  return (
    <Link href={`/groups/${group.id}`} className="tile block" style={{ ...card({ borderRadius: 18 }), padding: "16px 17px" }}>
      <AvatarChip init={getInitials(group.name)} color={color} size={30} radius={10} />
      <p className="truncate" style={{ margin: "12px 0 0", fontSize: 13.5, fontWeight: 700, color: T.bright }}>
        {group.name}
      </p>
      <div className="flex items-baseline gap-[7px]" style={{ marginTop: 12 }}>
        <Mono style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFFE6" }}>
          {settled ? "Settled" : formatCurrency(Math.abs(balance), defaultCurrency)}
        </Mono>
        {!settled && (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: owesYou ? G : R }}>
            {owesYou ? "owed" : "you owe"}
          </span>
        )}
      </div>
    </Link>
  );
}

export function PersonalDashboard() {
  const { user } = useAuthStore();
  const defaultCurrency = user?.currency || "USD";
  const { data: summary, isLoading: summaryLoading } = useWorkspaceSummary(PERSONAL_WORKSPACE_ID);
  const { data: friends } = useGetFriends();
  const { data: groups } = useGetAllGroups();
  const [openFriend, setOpenFriend] = useState<Friend | null>(null);

  const friendsWithBalance = useMemo(() => {
    if (!friends) return [];
    return friends
      .filter((f) => (f.balances ?? []).some((b) => b.amount !== 0))
      .sort((a, b) => {
        const sa = (a.balances ?? []).reduce((s, x) => s + Math.abs(x.amount), 0);
        const sb = (b.balances ?? []).reduce((s, x) => s + Math.abs(x.amount), 0);
        return sb - sa;
      });
  }, [friends]);

  if (summaryLoading || !summary) return <PersonalDashboardSkeleton />;

  const personal = summary.personal ?? { owed: 0, lent: 0, groupCount: 0, friendCount: 0 };
  // Name the two directions explicitly — the API's field names read backwards at
  // a glance. computeOverallBalances signs a balance NEGATIVE when this user is
  // the one who paid/requested, so workspace.controller.ts buckets negatives into
  // `lent` (money owed TO you) and positives into `owed` (money YOU owe).
  const owedToYou = personal.lent;
  const youOwe = personal.owed;
  const net = owedToYou - youOwe;
  const totalMoved = owedToYou + youOwe;
  const owedPct = totalMoved > 0 ? (owedToYou / totalMoved) * 100 : 0;
  const owePct = 100 - owedPct;
  const openRequestCount = (summary.countsByStatus.OPEN ?? 0) + (summary.countsByStatus.PARTIALLY_PAID ?? 0);

  const settleUpPeople = friendsWithBalance.slice(0, 4);
  const groupTiles = (groups ?? []).slice(0, 4);

  const modalBalances: PersonBalance[] = openFriend
    ? (openFriend.balances ?? [])
        .filter((b) => b.amount !== 0)
        .map((b) => ({
          init: openFriend.id.slice(0, 2).toUpperCase(),
          cur: b.currency,
          amount: `${b.amount < 0 ? "+" : "-"}${formatCurrency(Math.abs(b.amount), b.currency)}`,
          color: b.amount < 0 ? G : R,
        }))
    : [];
  const modalItems: PersonHistoryItem[] = [];
  // Balances don't net across currencies (the modal says so) — the headline
  // figure is the largest single-currency balance, not a cross-currency sum.
  const primaryBalance = openFriend?.balances
    ? [...openFriend.balances].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0]
    : undefined;
  const personNet = primaryBalance
    ? `${primaryBalance.amount < 0 ? "+" : "-"}${formatCurrency(Math.abs(primaryBalance.amount), primaryBalance.currency)}`
    : formatCurrency(0, defaultCurrency);
  const personNetColor = primaryBalance ? (primaryBalance.amount < 0 ? G : R) : T.main;

  return (
    <div>
      <HeroCard style={{ padding: "26px 28px 22px", marginBottom: 18, position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            top: -70,
            left: -40,
            width: 260,
            height: 260,
            borderRadius: "50%",
            pointerEvents: "none",
            // A flat fill clipped by the card's overflow:hidden reads as a hard
            // vertical seam across the hero rather than a glow — fade it out.
            background: `radial-gradient(circle, ${A}1a 0%, ${A}00 70%)`,
          }}
        />
        <div className="flex items-end gap-[34px] flex-wrap" style={{ position: "relative" }}>
          <div>
            <Eyebrow color={A}>Owed to you</Eyebrow>
            <p style={{ margin: "7px 0 0", ...TYPE.hero, color: "#fff", lineHeight: 1 }}>
              {formatCurrency(owedToYou, defaultCurrency)}
            </p>
            <p style={{ margin: "7px 0 0", fontSize: 12.5, color: T.sub }}>
              {openRequestCount} open request{openRequestCount === 1 ? "" : "s"} · {personal.friendCount}{" "}
              {personal.friendCount === 1 ? "person" : "people"}
            </p>
          </div>
          <span style={{ width: 1, height: 58, background: "rgba(255,255,255,0.1)" }} />
          <div>
            <Eyebrow color={R}>You owe</Eyebrow>
            <p style={{ margin: "7px 0 0", ...TYPE.hero, color: T.soft, lineHeight: 1 }}>
              {formatCurrency(youOwe, defaultCurrency)}
            </p>
            <p style={{ margin: "7px 0 0", fontSize: 12.5, color: T.sub }}>settle any time</p>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: "right" }}>
            <Eyebrow color={T.muted}>Net position</Eyebrow>
            <p style={{ margin: "7px 0 0", ...TYPE.figure, color: net >= 0 ? G : R, lineHeight: 1 }}>
              {net >= 0 ? "+" : "-"}
              {formatCurrency(Math.abs(net), defaultCurrency)}
            </p>
          </div>
        </div>
        {totalMoved > 0 && (
          <div className="flex gap-1" style={{ marginTop: 22, height: 8, position: "relative" }}>
            <span style={{ width: `${owedPct}%`, borderRadius: 99, background: `linear-gradient(90deg,${A},${A}73)` }} />
            <span style={{ width: `${owePct}%`, borderRadius: 99, background: `${R}8c` }} />
          </div>
        )}
      </HeroCard>

      <div className="flex items-center gap-2.5 mb-3">
        <Eyebrow color={T.soft}>Settle up</Eyebrow>
        <div style={{ flex: 1 }} />
        {friendsWithBalance.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 600, color: T.dim }}>
            {friendsWithBalance.length} {friendsWithBalance.length === 1 ? "person" : "people"} with an open balance
          </span>
        )}
      </div>
      {settleUpPeople.length > 0 ? (
        <div
          className="grid gap-3 mb-[22px]"
          style={{ gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))" }}
        >
          {settleUpPeople.map((f) => (
            <SettleTile key={f.id} friend={f} defaultCurrency={defaultCurrency} onOpen={() => setOpenFriend(f)} />
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center mb-[22px]">
          <p style={{ fontSize: 13.5, color: T.muted, margin: 0 }}>You&rsquo;re all settled up.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px] items-start">
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <Eyebrow color={T.soft}>Your groups</Eyebrow>
            <div style={{ flex: 1 }} />
            <Link href="/groups" style={{ fontSize: 12, fontWeight: 700, color: A }}>
              All groups →
            </Link>
          </div>
          {groupTiles.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {groupTiles.map((g) => (
                <GroupTile key={g.id} group={g} userId={user?.id ?? ""} defaultCurrency={defaultCurrency} />
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>No groups yet.</p>
            </Card>
          )}
        </div>

        <ActivityList
          activity={summary.recentActivity}
          defaultCurrency={defaultCurrency}
          viewAllHref="/requests"
          viewAllLabel="View all requests →"
          emptyLabel="Nothing yet — create your first request."
        />
      </div>

      <PersonBreakdownModal
        open={!!openFriend}
        onClose={() => setOpenFriend(null)}
        person={
          openFriend
            ? {
                name: openFriend.name,
                sub: openFriend.email ?? undefined,
                init: getInitials(openFriend.name),
                color: getUserColor(openFriend.name),
                net: personNet,
                netColor: personNetColor,
              }
            : { name: "", init: "?", net: "" }
        }
        balances={modalBalances}
        items={modalItems}
        onRequest={() => {
          window.location.href = "/create";
        }}
        onSettle={() => {
          window.location.href = "/people";
        }}
      />
    </div>
  );
}
