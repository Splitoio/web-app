"use client";

import React from "react";
import { Plus } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getAllGroups } from "@/features/groups/api/client";
import { useQuery } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/constants";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { ApiError } from "@/types/api-error";
import { useGetAllCurrencies, useConvertedBalanceTotal } from "@/features/currencies/hooks/use-currencies";
import { useAuthStore } from "@/stores/authStore";
import { G, T, Btn } from "@/lib/splito-design";
import { GroupsListContent } from "@/components/groups-list-content";

export function GroupsList({ searchQuery = "" }: { searchQuery?: string }) {
  const {
    data: groupsData,
    isLoading: isGroupsLoading,
    error,
  } = useQuery({
    queryKey: [QueryKeys.GROUPS, "PERSONAL"],
    queryFn: () => getAllGroups({ type: "PERSONAL" }),
  });
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: allCurrencies } = useGetAllCurrencies();
  const defaultCurrency = user?.currency || "USD";

  const filteredGroups = useMemo(() => {
    if (!groupsData) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groupsData;
    return groupsData.filter((g) => g.name.toLowerCase().includes(q));
  }, [groupsData, searchQuery]);

  // Aggregate owe/owed across all groups for net balance + unsettled count
  const { totalOweItems, totalOwedItems, unsettledCount, currencyCount } = useMemo(() => {
    if (!user || !groupsData) return { totalOweItems: [] as { amount: number; currency: string }[], totalOwedItems: [] as { amount: number; currency: string }[], unsettledCount: 0, currencyCount: 0 };
    const oweItems: { amount: number; currency: string }[] = [];
    const owedItems: { amount: number; currency: string }[] = [];
    let unsettled = 0;
    const currenciesUsed = new Set<string>();
    groupsData.forEach((group) => {
      const balances = group.groupBalances || [];
      const userBalances = balances.filter((b) => b.userId === user.id);
      const byCurrency: Record<string, number> = {};
      userBalances.forEach((b) => {
        byCurrency[b.currency] = (byCurrency[b.currency] ?? 0) + b.amount;
      });
      let groupHasBalance = false;
      Object.entries(byCurrency).forEach(([curr, amount]) => {
        if (amount > 0) { oweItems.push({ amount, currency: curr }); groupHasBalance = true; currenciesUsed.add(curr); }
        else if (amount < 0) { owedItems.push({ amount: Math.abs(amount), currency: curr }); groupHasBalance = true; currenciesUsed.add(curr); }
      });
      if (groupHasBalance) unsettled++;
    });
    return { totalOweItems: oweItems, totalOwedItems: owedItems, unsettledCount: unsettled, currencyCount: currenciesUsed.size };
  }, [groupsData, user]);

  const { total: totalOwe } = useConvertedBalanceTotal(totalOweItems, defaultCurrency);
  const { total: totalOwed } = useConvertedBalanceTotal(totalOwedItems, defaultCurrency);

  // Helper function to get currency symbol from the currencies data
  const getCurrencySymbol = (currencyId: string): string => {
    const currency = allCurrencies?.currencies?.find(c => c.id === currencyId);
    return currency?.symbol || currencyId;
  };

  // Helper function to format currency using actual symbols from API
  const formatCurrency = (amount: number, currencyId: string): string => {
    const symbol = getCurrencySymbol(currencyId);
    // For currencies like JPY, don't show decimals
    const decimals = currencyId === 'JPY' ? 0 : 2;
    return `${symbol}${amount.toFixed(decimals)}`;
  };

  const totalOweFormatted = formatCurrency(totalOwe, defaultCurrency);
  const totalOwedFormatted = formatCurrency(totalOwed, defaultCurrency);

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

  if (isGroupsLoading || !groupsData) {
    return (
      <div className="flex items-center justify-center py-8 sm:py-12">
        <div className="text-mobile-base sm:text-base text-white/50">
          Loading groups...
        </div>
      </div>
    );
  }

  if (groupsData.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <p style={{ fontSize: 48, marginBottom: 18 }}>👥</p>
        <p style={{ fontSize: 18, fontWeight: 800, color: T.body, marginBottom: 8 }}>
          No groups yet
        </p>
        <p style={{ fontSize: 14, color: T.sub, marginBottom: 24 }}>
          Create a group to start requesting money together — rent, trips, anything shared
        </p>
        {/* Btn renders as a flex element, so textAlign on the parent can't centre
            it — the flex wrapper is what keeps this CTA centred in the empty state. */}
        <div className="flex justify-center">
          <Btn
            variant="primary"
            onClick={() =>
              document.dispatchEvent(new CustomEvent("open-create-group-modal"))
            }
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New Group
          </Btn>
        </div>
      </div>
    );
  }

  return React.createElement(GroupsListContent, {
    filteredGroups,
    user,
    defaultCurrency,
    formatCurrency,
    getCurrencySymbol,
    totalOweFormatted,
    totalOwedFormatted,
    unsettledCount,
    totalGroupsCount: groupsData.length,
    currencyCount,
  });
}
