"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import { staggerContainer, slideUp } from "@/utils/animations";
import { useGetFriends } from "@/features/friends/hooks/use-get-friends";
import { ApiError } from "@/types/api-error";
import { avatarChip, getUserColor, Card, G, R, T, Btn, BORDER } from "@/lib/splito-design";
import { SettleDebtsModal } from "@/components/settle-debts-modal";
import { useAuthStore } from "@/stores/authStore";
import { useGetAllGroups } from "@/features/groups/hooks/use-create-group";
import { useConvertedBalanceTotal } from "@/features/currencies/hooks/use-currencies";
import { formatCurrency } from "@/utils/formatters";
import { formatRelativeTime } from "@/lib/utils";
import {
  PersonBreakdownModal,
  type PersonBalance,
  type PersonHistoryItem,
} from "@/components/person-breakdown-modal";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

type Friend = {
  id: string;
  name: string;
  email?: string | null;
  balances?: Array<{ currency: string; amount: number }>;
  expenses?: Array<{
    id: string;
    name: string;
    category: string;
    amount: number;
    currency: string;
    createdAt: Date | string;
  }>;
};

/**
 * People / Contacts screen (design 1397-1417): helper text + Add-by-email /
 * Invite-a-friend actions → 3-col grid of contact tiles, each opening the
 * shared PersonBreakdownModal. Same friends data + settle-up flow as before,
 * just presented as tiles instead of rows.
 */
export function FriendsList({
  search = "",
  onAddFriendClick,
}: { search?: string; onAddFriendClick?: () => void }) {
  const { data: friends, isLoading, error } = useGetFriends();
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: groups = [] } = useGetAllGroups();
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [openFriendId, setOpenFriendId] = useState<string | null>(null);
  const defaultCurrency = user?.currency || "USD";

  useEffect(() => {
    if (error) {
      const apiError = error as ApiError;
      const statusCode =
        apiError.response?.status || apiError.status || apiError.code;

      if (statusCode === 401) {
        Cookies.remove("sessionToken");
        router.push("/login");
        toast.error("Session expired. Please log in again.");
      } else if (error) {
        toast.error("An unexpected error occurred.");
      }
    }
  }, [error, router]);

  // Find the group that has a balance with this friend
  const getGroupForFriend = (friendId: string) => {
    const sharedGroups = groups.filter((g) =>
      (g.groupUsers ?? []).some(
        (gu: { userId?: string; user?: { id: string } }) =>
          gu.userId === friendId || gu.user?.id === friendId
      )
    );
    return (
      sharedGroups.find((g) =>
        (g.groupBalances ?? []).some(
          (b) => b.firendId === friendId && b.amount !== 0
        )
      ) ?? sharedGroups[0] ?? null
    );
  };

  const handleSettleFriendClick = (friendId: string) => {
    setSelectedFriendId(friendId);
    setIsSettleModalOpen(true);
  };

  const selectedGroup = selectedFriendId ? getGroupForFriend(selectedFriendId) : null;
  const selectedFriend = selectedFriendId ? friends?.find((f) => f.id === selectedFriendId) : null;
  const openFriend = openFriendId ? friends?.find((f) => f.id === openFriendId) ?? null : null;

  const searchLower = search.trim().toLowerCase();
  const filtered =
    friends?.filter(
      (f) =>
        !searchLower ||
        f.name.toLowerCase().includes(searchLower) ||
        (f.email ?? "").toLowerCase().includes(searchLower)
    ) ?? [];

  if (isLoading) {
    return (
      <Card style={{ padding: "28px" }}>
        <p style={{ color: T.body, fontSize: 14, textAlign: "center", margin: 0 }}>
          Loading friends...
        </p>
      </Card>
    );
  }

  if (!friends?.length) {
    return (
      <Card
        style={{
          padding: "48px 28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <p style={{ color: T.bright, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          No one here yet
        </p>
        <p style={{ color: T.muted, fontSize: 14, marginBottom: 24, maxWidth: 360 }}>
          Add people to request money from them and settle up together.
        </p>
        <Btn variant="primary" onClick={() => onAddFriendClick?.()}>
          <UserPlus size={18} strokeWidth={1.5} />
          Add Someone
        </Btn>
      </Card>
    );
  }

  return (
    <div>
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "50px 20px",
            textAlign: "center",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20,
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 600, color: T.muted }}>
            No one matches &quot;{search}&quot;
          </p>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5"
        >
          {filtered.map((friend) => (
            <ContactTile
              key={friend.id}
              friend={friend}
              defaultCurrency={defaultCurrency}
              onOpen={() => setOpenFriendId(friend.id)}
            />
          ))}
        </motion.div>
      )}

      {openFriend && (
        <PersonModal
          friend={openFriend}
          defaultCurrency={defaultCurrency}
          onClose={() => setOpenFriendId(null)}
          onRequest={() => {
            setOpenFriendId(null);
            router.push("/create");
          }}
          onSettle={() => {
            setOpenFriendId(null);
            handleSettleFriendClick(openFriend.id);
          }}
        />
      )}

      {selectedGroup && (
        <SettleDebtsModal
          isOpen={isSettleModalOpen}
          onClose={() => {
            setIsSettleModalOpen(false);
            setSelectedFriendId(null);
          }}
          showIndividualView={false}
          groupId={selectedGroup.id}
          balances={selectedGroup.groupBalances ?? []}
          members={(selectedGroup.groupUsers ?? []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (gu: any) => gu.user ?? { id: "", name: null }
          )}
          expenses={(selectedFriend?.expenses ?? []) as never[]}
          defaultCurrency={defaultCurrency}
          defaultExpandedMemberId={selectedFriendId}
        />
      )}
    </div>
  );
}

function ContactTile({
  friend,
  defaultCurrency,
  onOpen,
}: {
  friend: Friend;
  defaultCurrency: string;
  onOpen: () => void;
}) {
  const balances = friend.balances ?? [];
  const { total: balance, isLoading } = useConvertedBalanceTotal(balances, defaultCurrency);
  const color = getUserColor(friend.name);
  const init = getInitials(friend.name);

  // Backend convention: positive = you owe friend, negative = friend owes you
  const statColor = isLoading ? T.dim : balance === 0 ? T.dim : balance < 0 ? G : R;
  const statText = isLoading
    ? "…"
    : balance === 0
      ? "Settled up"
      : balance < 0
        ? `Owes you ${formatCurrency(Math.abs(balance), defaultCurrency)}`
        : `You owe ${formatCurrency(Math.abs(balance), defaultCurrency)}`;

  return (
    <motion.div variants={slideUp}>
      <button
        type="button"
        onClick={onOpen}
        className="tile flex items-center text-left w-full transition-all"
        style={{
          gap: 13,
          padding: "16px 18px",
          borderRadius: 20,
          background: "linear-gradient(145deg,#111 0%,#0d0d0d 100%)",
          border: BORDER,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span style={{ ...avatarChip(color, 40), fontSize: 12, flexShrink: 0 }}>{init}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate" style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.bright }}>
            {friend.name}
          </p>
          <p className="truncate" style={{ margin: "3px 0 0", fontSize: 11.5, fontWeight: 600, color: statColor }}>
            {statText}
          </p>
        </div>
      </button>
    </motion.div>
  );
}

function PersonModal({
  friend,
  defaultCurrency,
  onClose,
  onRequest,
  onSettle,
}: {
  friend: Friend;
  defaultCurrency: string;
  onClose: () => void;
  onRequest: () => void;
  onSettle: () => void;
}) {
  const color = getUserColor(friend.name);
  const init = getInitials(friend.name);
  const rawBalances = friend.balances ?? [];
  const { total: net, isLoading } = useConvertedBalanceTotal(rawBalances, defaultCurrency);

  const balances: PersonBalance[] = rawBalances
    .filter((b) => b.amount !== 0)
    .map((b) => ({
      init: b.currency.slice(0, 2).toUpperCase(),
      cur: b.currency,
      amount: `${b.amount > 0 ? "-" : "+"}${formatCurrency(Math.abs(b.amount), b.currency)}`,
      sub: b.amount > 0 ? "you owe" : "owes you",
      color: b.amount > 0 ? R : G,
    }));

  const items: PersonHistoryItem[] = [...(friend.expenses ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      title: e.name,
      meta: formatRelativeTime(new Date(e.createdAt)),
      amount: formatCurrency(e.amount, e.currency),
    }));

  return (
    <PersonBreakdownModal
      open
      onClose={onClose}
      person={{
        name: friend.name,
        sub: friend.email ?? undefined,
        init,
        color,
        netLabel: isLoading ? "Balance" : net === 0 ? "All settled" : net < 0 ? "Owes you" : "You owe",
        net: isLoading ? "…" : formatCurrency(Math.abs(net), defaultCurrency),
        netColor: isLoading ? T.dim : net === 0 ? T.main : net < 0 ? G : R,
      }}
      balances={balances}
      items={items}
      onRequest={onRequest}
      onSettle={onSettle}
    />
  );
}
