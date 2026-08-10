"use client";

import { GroupInfoHeader } from "@/components/group-info-header";
import { useAuthStore } from "@/stores/authStore";
import { useParams } from "next/navigation";
import { useState } from "react";
import { SettleDebtsModal } from "@/components/settle-debts-modal";
import { AddMemberModal } from "@/components/add-member-modal";
import {
  useGetGroupById,
  useMarkAsPaid,
} from "@/features/groups/hooks/use-create-group";
import { AddExpenseModal } from "@/components/add-expense-modal";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useReminders } from "@/features/reminders/hooks/use-reminders";
import { useGetAllCurrencies } from "@/features/currencies/hooks/use-currencies";
import axios from "axios";
import Link from "next/link";
import { toast } from "sonner";
import {
  GroupLayoutProvider,
  type GroupLayoutContextValue,
} from "@/contexts/group-layout-context";
import { useGetSettlementPreference } from "@/features/user/hooks/use-update-profile";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function GroupLayoutInner({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const groupId = typeof params.id === "string" ? params.id : params.id?.[0] ?? "";
  const { user } = useAuthStore();
  const { data: group, isLoading } = useGetGroupById(groupId);
  const { sendReminder, isSending } = useReminders();
  const { data: allCurrencies } = useGetAllCurrencies();

  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [settleFriendId, setSettleFriendId] = useState<string | null>(null);
  const [settleSpecificAmount, setSettleSpecificAmount] = useState<number | undefined>(undefined);
  const [settleSpecificMemberAmounts, setSettleSpecificMemberAmounts] = useState<Record<string, number> | undefined>(undefined);
  const [settleExpenseId, setSettleExpenseId] = useState<string | undefined>(undefined);
  const [settlementBannerDismissed, setSettlementBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("settlement-banner-dismissed") === "true";
  });
  const { data: settlementPref, isLoading: isSettlementLoading } = useGetSettlementPreference();

  const getCurrencySymbol = (currencyId: string): string => {
    const currency = allCurrencies?.currencies?.find((c) => c.id === currencyId);
    return currency?.symbol || currencyId;
  };

  const formatCurrency = (amount: number, currencyId: string): string => {
    const symbol = getCurrencySymbol(currencyId);
    const decimals = currencyId === "JPY" ? 0 : 2;
    return `${symbol}${amount.toFixed(decimals)}`;
  };

  const markAsPaidMutation = useMarkAsPaid();

  const handleSendReminder = (receiverId: string, splitId: string) => {
    sendReminder({
      receiverId,
      reminderType: "SPLIT",
      splitId,
      content: "Please settle your balance in the group.",
    });
  };

  const handleSettleFriendClick = (friendId: string) => {
    setSettleFriendId(friendId);
    setIsSettleModalOpen(true);
  };

  const getSpecificDebtAmount = (friendId: string) => {
    if (!group || !user) return 0;
    const balance = group.groupBalances.find(
      (b) => b.userId === user.id && b.firendId === friendId
    );
    return balance ? balance.amount : 0;
  };

  const getSpecificDebtByCurrency = (friendId: string) => {
    if (!group || !user) return {};
    const balances = group.groupBalances.filter(
      (b) => b.userId === user.id && b.firendId === friendId
    );
    const debtByCurrency: Record<string, number> = {};
    balances.forEach((b) => {
      if (b.amount !== 0) {
        debtByCurrency[b.currency] = (debtByCurrency[b.currency] ?? 0) + b.amount;
      }
    });
    return debtByCurrency;
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/groups/${groupId}/members/${memberId}`, {
        withCredentials: true,
      });
      toast.success("Member removed from group");
      window.location.reload();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error || "Failed to remove member");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-white/50" />
          <p className="text-mobile-base sm:text-base text-white/70">
            Loading group details...
          </p>
        </div>
      </div>
    );
  }

  if (!group) return null;
  if (!user) return null;

  const isAdmin = group.createdBy?.id === user.id;

  const contextValue = {
    groupId,
    group,
    isLoading,
    isAdmin,
    openAddMember: () => setIsAddMemberModalOpen(true),
    openAddExpense: () => setIsAddExpenseModalOpen(true),
    openSettle: (friendId?: string | null, specificAmount?: number, specificMemberAmounts?: Record<string, number>, expenseId?: string) => {
      setSettleFriendId(friendId ?? null);
      setSettleSpecificAmount(specificAmount);
      setSettleSpecificMemberAmounts(specificMemberAmounts);
      setSettleExpenseId(expenseId);
      setIsSettleModalOpen(true);
    },
    settleFriendId,
    settleSpecificAmount,
    settleSpecificMemberAmounts,
    settleExpenseId,
    getSpecificDebtAmount,
    getSpecificDebtByCurrency,
    handleSettleFriendClick,
    handleSendReminder,
    handleRemoveMember,
    markAsPaidMutation: markAsPaidMutation as GroupLayoutContextValue["markAsPaidMutation"],
    isSending,
    formatCurrency,
  };

  return (
    <GroupLayoutProvider value={contextValue}>
      <div className="w-full">
        <GroupInfoHeader
          groupId={groupId}
          onAddExpenseClick={() => setIsAddExpenseModalOpen(true)}
          group={group}
        />

        <div className="p-4 pt-0 sm:pt-0 sm:p-7">
          {!isSettlementLoading && (!settlementPref || settlementPref.length === 0) && !settlementBannerDismissed && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" />
              <p className="flex-1 text-mobile-sm sm:text-sm text-yellow-200">
                You haven&apos;t set a settlement preference yet — others won&apos;t be able to pay you.{" "}
                <Link href="/settings" className="underline text-yellow-400 hover:text-yellow-300">
                  Set it up
                </Link>
              </p>
              <button
                onClick={() => {
                  setSettlementBannerDismissed(true);
                  sessionStorage.setItem("settlement-banner-dismissed", "true");
                }}
                className="shrink-0 rounded-md p-1 text-yellow-400 hover:bg-yellow-500/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {children}
        </div>

        <SettleDebtsModal
          isOpen={isSettleModalOpen}
          onClose={() => {
            setIsSettleModalOpen(false);
            setSettleFriendId(null);
            setSettleSpecificAmount(undefined);
            setSettleSpecificMemberAmounts(undefined);
            setSettleExpenseId(undefined);
          }}
          balances={group.groupBalances}
          groupId={groupId}
          members={group.groupUsers.map((u) => u.user)}
          expenses={group.expenses}
          defaultCurrency={user?.currency || "USD"}
          showIndividualView={false}
          defaultExpandedMemberId={settleFriendId}
          specificAmount={settleSpecificAmount}
          specificMemberAmounts={settleSpecificMemberAmounts}
          expenseId={settleExpenseId}
        />

        <AddMemberModal
          isOpen={isAddMemberModalOpen}
          onClose={() => setIsAddMemberModalOpen(false)}
          groupId={groupId}
        />

        <AddExpenseModal
          isOpen={isAddExpenseModalOpen}
          onClose={() => setIsAddExpenseModalOpen(false)}
          groupId={groupId}
          members={group.groupUsers.map((m) => m.user)}
          defaultCurrency={user?.currency || "USD"}
        />
      </div>
    </GroupLayoutProvider>
  );
}

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  return <GroupLayoutInner>{children}</GroupLayoutInner>;
}
