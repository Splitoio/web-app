"use client";

import { X, Loader2, ChevronDown, ChevronRight, ChevronUp, Link2, ArrowLeft, Receipt, Bell, Mail, UserX } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeIn, scaleIn, slideVariants } from "@/utils/animations";
import { toast } from "sonner";
import Image from "next/image";
import { GroupBalance, User, Request, RequestPayer } from "@/api-helpers/modelSchema";
import { useSettleDebt } from "@/features/settle/hooks/use-splits";

import { useHandleEscapeToCloseModal } from "@/hooks/useHandleEscape";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useQueryClient, useQuery, useQueries } from "@tanstack/react-query";
import { useGetFriends } from "@/features/friends/hooks/use-get-friends";
import { useReminders } from "@/features/reminders/hooks/use-reminders";
import { useGetAllGroups } from "@/features/groups/hooks/use-create-group";
import { useBalances } from "@/features/balances/hooks/use-balances";
import ResolverSelector, { Option as TokenOption } from "./ResolverSelector";
import { useOrganizedCurrencies, useGetExchangeRate, CURRENCY_QUERY_KEYS } from "@/features/currencies/hooks/use-currencies";
import { useAuthStore } from "@/stores/authStore";
import { getExchangeRate } from "@/features/currencies/api/client";
import { useWallet } from "@/hooks/useWallet";
import { useUserWallets } from "@/features/wallets/hooks/use-wallets";
import { useGetSettlementPreference, useGetUserSettlementPreference } from "@/features/user/hooks/use-update-profile";
import { A, G, R, O, P } from "@/lib/splito-design";

type ExpenseWithParticipants = Request & { expenseParticipants?: RequestPayer[] };

interface SettleDebtsModalProps {
  isOpen: boolean;
  onClose: () => void;
  balances?: GroupBalance[];
  groupId?: string;
  members?: User[];
  expenses?: ExpenseWithParticipants[];
  showIndividualView?: boolean;
  selectedFriendId?: string | null;
  defaultCurrency?: string;
  specificAmount?: number;
  specificDebtByCurrency?: Record<string, number>;
  defaultExpandedMemberId?: string | null;
  specificMemberAmounts?: Record<string, number>;
  expenseId?: string;
}

export function SettleDebtsModal({
  isOpen,
  onClose,
  balances = [],
  groupId = "",
  members: _members = [],
  expenses: _expenses = [],
  showIndividualView = false,
  selectedFriendId = null,
  defaultCurrency,
  specificAmount,
  specificDebtByCurrency,
  defaultExpandedMemberId,
  specificMemberAmounts,
  expenseId,
}: SettleDebtsModalProps) {
  const user = useAuthStore((state) => state.user);
  const {
    isConnected: walletConnected,
    isConnecting: _isConnecting,
    connectWallet,
    wallet,
    address,
    walletType: _walletType,
  } = useWallet();
  const [selectedToken, setSelectedToken] = useState<TokenOption | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [_excludedFriendIds, setExcludedFriendIds] = useState<string[]>([]);
  const [totalAmount, setTotalAmount] = useState("0");
  const [individualAmount, setIndividualAmount] = useState("0");
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [availableChainsForToken, setAvailableChainsForToken] = useState<string[]>([]);
  const [debtCurrency, setDebtCurrency] = useState<string>("USD"); // Currency of the debt
  const [fiatAmount, setFiatAmount] = useState("0"); // Original fiat amount
  const [tokenAmount, setTokenAmount] = useState("0"); // Converted token amount
  const [multiCurrencyDebts, setMultiCurrencyDebts] = useState<Array<{currency: string, amount: number, tokenAmount: number}>>([]);
  const [totalTokenAmount, setTotalTokenAmount] = useState("0"); // Total token amount for all currencies
  const [expandedRowMemberId, setExpandedRowMemberId] = useState<string | null>(null);
  const [memberChains, setMemberChains] = useState<Record<string, string>>({});

  // Multi-step settle flow state
  const [settleStep, setSettleStep] = useState(1);
  const [slideDir, setSlideDir] = useState(1);
  const [selectedSettleMemberId, setSelectedSettleMemberId] = useState<string | null>(null);

  const settleDebtMutation = useSettleDebt(groupId);

  const { sendReminder: sendReminderMutation, isSending: isReminderSending } = useReminders();
  const _queryClient = useQueryClient();
  const { data: friends } = useGetFriends();
  const { data: _groups } = useGetAllGroups();
  const { data: balanceData } = useBalances();
  const { data: organizedCurrencies } = useOrganizedCurrencies();
  const { data: walletData } = useUserWallets();
  const wallets = walletData?.accounts || [];
  const stellarWallet = wallets.find(w => w.chainId === "stellar");
  const userStellarAddress = stellarWallet?.address || null;
  const { data: mySettlementPrefs } = useGetSettlementPreference();
  const { data: recipientPrefs, isLoading: isRecipientPrefLoading } = useGetUserSettlementPreference(selectedSettleMemberId);
  const recipientPrefList = recipientPrefs?.length ? recipientPrefs : [];
  const recipientSupportedChains = new Set(recipientPrefList.map(p => p.chainId));
  useHandleEscapeToCloseModal(isOpen, onClose);

  // Exchange rate conversion for balance currencies
  const balanceCurrencies = useMemo(() => {
    const currencies = new Set<string>();
    const sourceBalances = Array.isArray(balances) ? balances : [];
    sourceBalances.forEach((b) => {
      if (b.currency && b.currency !== (defaultCurrency || "USD")) currencies.add(b.currency);
    });
    return [...currencies].filter(Boolean);
  }, [balances, defaultCurrency]);

  const balanceRateQueries = useQueries({
    queries: balanceCurrencies.map((from) => ({
      queryKey: [CURRENCY_QUERY_KEYS.EXCHANGE_RATE, from, defaultCurrency || "USD"],
      queryFn: () => getExchangeRate(from, defaultCurrency || "USD"),
      staleTime: 1000 * 60 * 5,
      enabled: !!defaultCurrency && !!from,
    })),
  });

  const balanceRateMap = useMemo(() => {
    const map: Record<string, number> = { [defaultCurrency || "USD"]: 1 };
    balanceCurrencies.forEach((c, i) => {
      const rate = balanceRateQueries[i]?.data?.rate;
      if (rate) map[c] = rate;
    });
    return map;
  }, [balanceCurrencies, balanceRateQueries, defaultCurrency]);

  // Helper functions for debt calculations
  const transformGroupBalancesToCurrencyMap = (groupBalances: GroupBalance[], userId: string): Record<string, number> => {
    const currencyMap: Record<string, number> = {};
    
    groupBalances.forEach(balance => {
      // Only include balances for the current user
      if (balance.userId === userId) {
        if (!currencyMap[balance.currency]) {
          currencyMap[balance.currency] = 0;
        }
        currencyMap[balance.currency] += balance.amount;
      }
    });

    return currencyMap;
  };

  const calculateTotalDebtsFromBalances = (balancesData: Record<string, number>) => {
    const total = Object.entries(balancesData).reduce((total, [_currency, amount]) => {
      // Only include positive amounts (debts we owe)
      if (amount > 0) {
        return total + amount;
      }
      return total;
    }, 0);
    return total;
  };

  const getDebtCurrencies = (balancesData: Record<string, number>) => {
    const result = Object.entries(balancesData)
      .filter(([_currency, amount]) => amount > 0)
      .map(([currency, amount]) => ({ currency, amount }));
    return result;
  };

  // COMMENTED OUT: Individual friend debt logic - focus only on group balances
  // const calculateTotalDebts = (friendsList: FriendWithBalances[]) => {
  //   const total = friendsList.reduce((total, friend) => {
  //     const positiveBalances = friend.balances.filter((b) => b.amount > 0);
  //     const friendTotal = positiveBalances.reduce((sum: number, balance) => {
  //       return sum + balance.amount;
  //     }, 0);
  //     return total + friendTotal;
  //   }, 0);
  //   return total;
  // };

  // Custom pricing data fetcher using the pricing API
  const fetchPricingData = async (tokenId: string, baseCurrency: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const response = await fetch(
      `${API_URL}/api/pricing/price?id=${tokenId}&baseCurrency=${baseCurrency}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch price for ${tokenId} in ${baseCurrency}`);
    }

    return await response.json();
  };

  // Fetch pricing data for multiple currencies
  const fetchMultiCurrencyPricing = async (tokenId: string, currencies: string[]) => {
    const promises = currencies.map(currency => 
      fetchPricingData(tokenId, currency.toLowerCase()).catch(error => ({
        currency,
        error: error.message,
        price: null
      }))
    );
    
    const results = await Promise.all(promises);
    return results.map((result, index) => ({
      currency: currencies[index],
      price: result.price || null,
      error: result.error || null
    }));
  };

  // Currency conversion using pricing API - get token price in debt currency
  const shouldConvert = debtCurrency !== selectedToken?.id && debtCurrency !== selectedToken?.symbol;
  const { data: tokenPriceData, isLoading: isLoadingTokenPrice, error: priceError } = useQuery({
    queryKey: ['tokenPrice', selectedToken?.id, debtCurrency],
    queryFn: () => fetchPricingData(selectedToken?.id || '', debtCurrency.toLowerCase()),
    enabled: !!selectedToken?.id && !!debtCurrency && shouldConvert,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Multi-currency pricing for group settlements (memoized to stabilize useMemo deps below)
  const groupBalancesObj = useMemo(() => {
    if (balances && typeof balances === "object" && !Array.isArray(balances)) {
      return balances as Record<string, number>;
    }
    if (balances && Array.isArray(balances) && user) {
      return transformGroupBalancesToCurrencyMap(balances as GroupBalance[], user.id);
    }
    return {};
  }, [balances, user]);

  // Memoize group debt currencies to prevent infinite loops
  const groupDebtCurrencies = useMemo(() => {
    return Object.keys(groupBalancesObj).length > 0
      ? getDebtCurrencies(groupBalancesObj)
      : [];
  }, [groupBalancesObj]);
  
  const { data: multiCurrencyPricing, isLoading: isLoadingMultiCurrency } = useQuery({
    queryKey: ['multiCurrencyPricing', selectedToken?.id, groupDebtCurrencies.map(d => d.currency).join(',')],
    queryFn: () => fetchMultiCurrencyPricing(
      selectedToken?.id || '', 
      groupDebtCurrencies.map(d => d.currency)
    ),
    enabled: !!selectedToken?.id && groupDebtCurrencies.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fallback: Use exchange rate if conversion fails
  const { data: exchangeRateData, isLoading: isLoadingRate, error: exchangeRateError } = useGetExchangeRate(
    debtCurrency,
    selectedToken?.id || ""
  );

  // Helper function to get currency symbol from organized currencies data
  const getCurrencySymbol = (currencyId: string): string => {
    if (!organizedCurrencies) return currencyId;
    
    // Check fiat currencies first
    const fiatCurrency = organizedCurrencies.fiatCurrencies?.find((c: { id?: string }) => c.id === currencyId);
    if (fiatCurrency) return fiatCurrency.symbol;
    
    // Check chain groups for crypto currencies
    for (const chainGroup of Object.values(organizedCurrencies.chainGroups || {})) {
      const cryptoCurrency = chainGroup.find((c: { id?: string; symbol?: string }) => c.id === currencyId);
      if (cryptoCurrency) return cryptoCurrency.symbol;
    }
    
    return currencyId;
  };

  // Helper function to format currency using actual symbols
  const formatCurrency = (amount: number, currencyId: string = 'USD'): string => {
    const symbol = getCurrencySymbol(currencyId);
    const decimals = currencyId === 'JPY' ? 0 : 2;
    return `${symbol}${amount.toFixed(decimals)}`;
  };

  const defCur = defaultCurrency || "USD";

  // Shows "₹500.00 ($8.00)" when currency differs from default
  const formatWithDefault = (amount: number, currencyId: string): { primary: string; secondary: string | null } => {
    const primary = formatCurrency(amount, currencyId);
    if (currencyId === defCur) return { primary, secondary: null };
    const rate = balanceRateMap[currencyId];
    if (!rate || !Number.isFinite(rate)) return { primary, secondary: null };
    const converted = amount * rate;
    return { primary, secondary: formatCurrency(converted, defCur) };
  };

  // Reset excluded friends when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setExcludedFriendIds([]);
    }
  }, [isOpen, groupId, showIndividualView, selectedFriendId, userStellarAddress]);

  // Reset expanded row and step when modal opens; auto-jump for single-expense
  useEffect(() => {
    if (isOpen) {
      setExpandedRowMemberId(null);
      setSlideDir(1);

      if (expenseId && defaultExpandedMemberId) {
        setSelectedSettleMemberId(defaultExpandedMemberId);
        setSettleStep(3);
      } else {
        setSettleStep(1);
        setSelectedSettleMemberId(null);
      }
    }
  }, [isOpen, expenseId, defaultExpandedMemberId]);

  // Auto-select recipient's preferred chain when their settlement preference loads
  useEffect(() => {
    if (recipientPrefList.length > 0 && selectedSettleMemberId && !memberChains[selectedSettleMemberId]) {
      setSelectedChain(recipientPrefList[0].chainId);
    }
  }, [recipientPrefList, selectedSettleMemberId, memberChains]);

  // Set the selected user based on selectedFriendId prop
  useEffect(() => {
    if (selectedFriendId && friends) {
      const friend = friends.find((f: { id: string }) => f.id === selectedFriendId);
      if (friend) {
        setSelectedUser(friend as unknown as User);

        // Use specific amount if provided, otherwise calculate from friend balances
        if (specificAmount !== undefined) {
          const amount = Math.abs(specificAmount);
          setFiatAmount(amount.toFixed(2));
          setIndividualAmount(amount.toFixed(2));
          // Set debt currency from the expense or specificDebtByCurrency
          if (expenseId) {
            const expense = _expenses.find((e) => e.id === expenseId);
            if (expense?.currency) setDebtCurrency(expense.currency);
          } else if (specificDebtByCurrency && Object.keys(specificDebtByCurrency).length > 0) {
            setDebtCurrency(Object.keys(specificDebtByCurrency)[0]);
          }
        } else if (specificDebtByCurrency && Object.keys(specificDebtByCurrency).length > 0) {
          // Use currency-specific debt amount - get the first currency's amount
          const firstCurrency = Object.keys(specificDebtByCurrency)[0];
          const firstCurrencyAmount = specificDebtByCurrency[firstCurrency];
          const amount = Math.abs(firstCurrencyAmount);
          setFiatAmount(amount.toFixed(2));
          setIndividualAmount(amount.toFixed(2));
          setDebtCurrency(firstCurrency);
        } else {
          // COMMENTED OUT: Calculate amount owed to this specific friend from cross-group balances
          // Focus only on group-specific debt amounts
          // const positiveBalance = friend.balances.find((b: any) => b.amount > 0);
          // if (positiveBalance) {
          //   const amount = Math.abs(positiveBalance.amount);
          //   setFiatAmount(amount.toFixed(2));
          //   setIndividualAmount(amount.toFixed(2));
          //   // Use currency from the balance data if available, otherwise default
          //   setDebtCurrency(positiveBalance.currency || defaultCurrency || "USD");
          // } else {
          //   setFiatAmount("0");
          //   setIndividualAmount("0");
          // }
          
          // Use only default amounts when no specific debt is provided
          setFiatAmount("0");
          setIndividualAmount("0");
          setDebtCurrency(defaultCurrency || "USD");
        }
      }
    } else if (!showIndividualView) {
      setSelectedUser(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- omit defaultCurrency to avoid unnecessary re-runs
  }, [selectedFriendId, friends, showIndividualView, specificAmount, specificDebtByCurrency]);

  // Calculate total debts across all groups on mount and when data changes
  useEffect(() => {
    if (groupId && balances && typeof balances === 'object' && !Array.isArray(balances)) {
      const totalOwed = calculateTotalDebtsFromBalances(balances as Record<string, number>);
      setTotalAmount(totalOwed.toFixed(2));
    } else if (groupId && Array.isArray(balances) && user) {
      const currencyMap = transformGroupBalancesToCurrencyMap(balances as GroupBalance[], user.id);
      const totalOwed = calculateTotalDebtsFromBalances(currencyMap);
      setTotalAmount(totalOwed.toFixed(2));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit defaultCurrency to avoid re-running on currency change
  }, [balanceData, balances, groupId, user]);

  // Fetch available tokens
  // eslint-disable-next-line react-hooks/exhaustive-deps -- omit selectedToken to avoid loop (we only run when !selectedToken)
  useEffect(() => {
    if (isOpen && organizedCurrencies && !selectedToken) {
      const chainCurrencies = Object.values(organizedCurrencies.chainGroups || {}).flat();
      let tokenToSelect = chainCurrencies[0];
      
      // Priority 1: Use currency from specific debt if available
      if (specificDebtByCurrency && Object.keys(specificDebtByCurrency).length > 0) {
        const debtCurrency = Object.keys(specificDebtByCurrency)[0];
        const match = chainCurrencies.find((t) => t.id === debtCurrency || t.symbol === debtCurrency);
        if (match) tokenToSelect = match;
      }
      // Priority 2: Use default currency
      else if (defaultCurrency) {
        const match = chainCurrencies.find(
          (t) => t.symbol === defaultCurrency
        );
        if (match) tokenToSelect = match;
      }
      // Priority 3: Default to XML if available
      else {
        const xmlMatch = chainCurrencies.find((t) => t.symbol === "XML");
        if (xmlMatch) tokenToSelect = xmlMatch;
      }
      
      if (tokenToSelect) {
        setSelectedToken({
          id: tokenToSelect.id,
          symbol: tokenToSelect.symbol,
          name: tokenToSelect.name,
          chainId: tokenToSelect.chainId || undefined,
          type: tokenToSelect.type,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedToken intentionally omitted to avoid loop
  }, [isOpen, organizedCurrencies, defaultCurrency, specificDebtByCurrency]);

  // Update individualAmount when selectedUser changes
  useEffect(() => {
    if (selectedUser && specificAmount === undefined) {
      // COMMENTED OUT: Only update from user balances if no specific amount is provided
      // Focus on group balances only, not individual friend balances across groups
      // const positiveBalance = (selectedUser as any).balances?.find((b: any) => b.amount > 0);
      // if (positiveBalance) {
      //   setIndividualAmount(Math.abs(positiveBalance.amount).toFixed(2));
      // } else {
      //   setIndividualAmount("0");
      // }
      
      // Use specific debt amount or group balance instead
      if (specificDebtByCurrency && Object.keys(specificDebtByCurrency).length > 0) {
        const firstCurrency = Object.keys(specificDebtByCurrency)[0];
        const amount = Math.abs(specificDebtByCurrency[firstCurrency]);
        setIndividualAmount(amount.toFixed(2));
      } else {
        setIndividualAmount("0");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- omit selectedToken to avoid loops
  }, [selectedUser, specificAmount, specificDebtByCurrency]);

  // Update token amount when pricing data is available
  useEffect(() => {
    const fiatValue = parseFloat(fiatAmount) || 0;
    
    if (!shouldConvert || fiatValue <= 0) {
      // No conversion needed or invalid amount
      setTokenAmount(fiatAmount);
      return;
    }

    if (tokenPriceData && tokenPriceData.price) {
      // Calculate token amount: fiatAmount / tokenPriceInDebtCurrency
      console.log("[SettleDebtsModal] Using pricing data:", tokenPriceData);
      const tokenAmount = fiatValue / tokenPriceData.price;
      setTokenAmount(tokenAmount.toFixed(6));
    } else if (exchangeRateData && exchangeRateData.rate && !isLoadingRate) {
      // Fallback: Calculate using exchange rate
      console.log("[SettleDebtsModal] Using exchange rate fallback:", exchangeRateData);
      const convertedAmount = fiatValue * exchangeRateData.rate;
      setTokenAmount(convertedAmount.toFixed(6));
    } else if (!isLoadingTokenPrice && !isLoadingRate) {
      // If both fail, use fiat amount as fallback
      console.log("[SettleDebtsModal] Using fiat amount fallback due to conversion failure");
      if (priceError) {
        console.error("[SettleDebtsModal] Pricing error:", priceError);
      }
      if (exchangeRateError) {
        console.error("[SettleDebtsModal] Exchange rate error:", exchangeRateError);
      }
      setTokenAmount(fiatAmount);
    }
  }, [tokenPriceData, exchangeRateData, isLoadingTokenPrice, isLoadingRate, fiatAmount, selectedToken, shouldConvert, priceError, exchangeRateError]);

  // Update multi-currency debt calculations
  useEffect(() => {
    console.log('Multi-currency calculation triggered:', {
      multiCurrencyPricing: !!multiCurrencyPricing,
      selectedToken: selectedToken?.symbol,
      groupDebtCurrencies: groupDebtCurrencies,
      showIndividualView,
      groupBalancesObj
    });

    // Prevent infinite loops - only run when we have the required data
    if (!multiCurrencyPricing || !selectedToken || groupDebtCurrencies.length === 0) {
      console.log('Early return from multi-currency calculation');
      return;
    }

    if (!showIndividualView && multiCurrencyPricing && groupDebtCurrencies.length > 0) {

      const debtsWithTokenAmounts = groupDebtCurrencies.map(debt => {
        const pricingData = multiCurrencyPricing.find(p => p.currency === debt.currency);
        let tokenAmount = 0;

        if (pricingData && pricingData.price && !pricingData.error) {
          // Convert using pricing data
          tokenAmount = debt.amount / pricingData.price;
        } else {
          // Fallback: assume 1:1 ratio or use a default conversion
          tokenAmount = debt.amount;
        }
        
        return {
          currency: debt.currency,
          amount: debt.amount,
          tokenAmount: tokenAmount
        };
      });
      
      // Only update if the data has actually changed to prevent infinite loops
      const newDebtsString = JSON.stringify(debtsWithTokenAmounts);
      const currentDebtsString = JSON.stringify(multiCurrencyDebts);
      
      // Calculate total token amount needed
      const totalTokens = debtsWithTokenAmounts.reduce((sum, debt) => sum + debt.tokenAmount, 0);
      
      if (newDebtsString !== currentDebtsString) {
        setMultiCurrencyDebts(debtsWithTokenAmounts);
        setTotalTokenAmount(totalTokens.toFixed(6));
      }
      
      if (newDebtsString !== currentDebtsString) {
        setMultiCurrencyDebts(debtsWithTokenAmounts);
        setTotalTokenAmount(totalTokens.toFixed(6));
      }

    } else if (showIndividualView && multiCurrencyPricing && groupDebtCurrencies.length > 0) {
      const debtsWithTokenAmounts = groupDebtCurrencies.map(debt => {
        const pricingEntry = multiCurrencyPricing?.find((p: { currency: string; price?: number }) => p.currency === debt.currency);
        if (!pricingEntry || !pricingEntry.price) {
          return { ...debt, tokenAmount: 0 };
        }

        const tokenAmount = debt.amount / pricingEntry.price;
        
        return {
          ...debt,
          tokenAmount,
          pricing: pricingEntry
        };
      });

      // Only update if the data has actually changed to prevent infinite loops
      const newDebtsString = JSON.stringify(debtsWithTokenAmounts);
      const currentDebtsString = JSON.stringify(multiCurrencyDebts);
      
      if (newDebtsString !== currentDebtsString) {
        setMultiCurrencyDebts(debtsWithTokenAmounts);
        
        const totalTokens = debtsWithTokenAmounts.reduce((sum, debt) => sum + (debt.tokenAmount || 0), 0);
        setTotalTokenAmount(totalTokens.toFixed(6));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- groupBalancesObj/multiCurrencyDebts are derived; omit to avoid loops
  }, [multiCurrencyPricing, groupDebtCurrencies, showIndividualView, selectedToken?.id]);

  // When fiat amount changes, update individual amount for compatibility
  useEffect(() => {
    setIndividualAmount(fiatAmount);
  }, [fiatAmount]);

  // Update available chains when selectedToken changes
  useEffect(() => {
    if (selectedToken && organizedCurrencies) {
      // Find all tokens with the same symbol (across chains)
      const chainCurrencies = Object.values(organizedCurrencies.chainGroups || {}).flat();
      const matchingTokens = chainCurrencies.filter(
        (t) => t.symbol === selectedToken.symbol
      );
      const chains = matchingTokens.map((t) => t.chainId).filter(Boolean) as string[];
      setAvailableChainsForToken(chains);
      // Auto-select if only one chain
      if (chains.length === 1) {
        setSelectedChain(chains[0]);
      } else {
        setSelectedChain(selectedToken.chainId || null);
      }
    } else {
      setAvailableChainsForToken([]);
      setSelectedChain(null);
    }
  }, [selectedToken, organizedCurrencies]);

  // When chain changes, update selectedToken to a token on that chain.
  // Prefer same-symbol; fall back to a stablecoin (USDC/USDT/DAI); else first token on chain.
  useEffect(() => {
    if (
      selectedToken &&
      selectedChain &&
      organizedCurrencies &&
      selectedToken.chainId !== selectedChain
    ) {
      const chainTokens = (organizedCurrencies.chainGroups?.[selectedChain] || []);
      if (chainTokens.length === 0) return;

      const PREF = ["USDC", "USDT", "DAI"];
      const sameSymbol = chainTokens.find((t) => t.symbol === selectedToken.symbol);
      const stable = PREF.map((s) => chainTokens.find((t) => t.symbol === s)).find(Boolean);
      const next = sameSymbol || stable || chainTokens[0];

      setSelectedToken({
        id: next.id,
        symbol: next.symbol,
        name: next.name,
        chainId: next.chainId || undefined,
        type: next.type,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when selectedChain changes to avoid loops
  }, [selectedChain]);

  // Calculate remaining total after excluding friends
  const calculateRemainingTotal = () => {
    if (groupId && balances && typeof balances === 'object' && !Array.isArray(balances)) {
      // For group context, use group balances only - no exclusions needed
      const total = calculateTotalDebtsFromBalances(balances as Record<string, number>);
      console.log("[SettleDebtsModal] Group remaining total:", total);
      return total;
    } 
    // COMMENTED OUT: Individual friend context calculation - focus only on group balances
    // else if (friends) {
    //   // For friend context, calculate with exclusions
    //   const includedFriends = friends.filter(
    //     (friend: any) => !excludedFriendIds.includes(friend.id)
    //   );
    //   const total = calculateTotalDebts(includedFriends as FriendWithBalances[]);
    //   return total;
    // }
    return 0;
  };

  // Toggle excluding a friend from settlement
  const _toggleExcludeFriend = (friendId: string) => {
    setExcludedFriendIds((prev) => {
      if (prev.includes(friendId)) {
        return prev.filter((id) => id !== friendId);
      } else {
        return [...prev, friendId];
      }
    });
  };

  // Get friends with debts for showing in the modal
  // COMMENTED OUT: Individual friend debt logic - focus only on group balances
  // const friendsWithDebts =
  //   friends?.filter((friend: any) =>
  //     friend.balances.some((balance: any) => balance.amount > 0)
  //   ) || [];

  // Get group debt breakdown for group context
  const groupDebtBreakdown = groupId && Object.keys(groupBalancesObj).length > 0
    ? getDebtCurrencies(groupBalancesObj)
    : [];

  console.log("[SettleDebtsModal] Group debt breakdown:", {
    groupId,
    groupBalancesObjKeys: Object.keys(groupBalancesObj),
    groupDebtBreakdown
  });

  const getSettlementWallet = (chain: string | null): string | null => {
    if (!chain) return null;
    const fromWallets = wallets.find(w => w.chainId === chain)?.address;
    if (fromWallets) return fromWallets;
    const raw = mySettlementPrefs;
    const prefs = Array.isArray(raw) ? raw : [];
    const pref = prefs.find(p => p.chainId === chain);
    return pref?.wallet?.address || null;
  };

  // Helper to get the correct wallet address based on selected chain
  const getUserWalletAddress = (chain?: string | null) => {
    const c = chain ?? selectedChain;
    if (c === 'stellar') {
      return address || userStellarAddress || getSettlementWallet('stellar');
    }
    return getSettlementWallet(c);
  };

  const _isWalletConnectedForChain = (chain?: string | null) => {
    const c = chain ?? selectedChain;
    if (c === 'stellar') {
      return !!(walletConnected && wallet && (address || userStellarAddress));
    }
    return !!getSettlementWallet(c);
  };

  const canProceedWithSettlement = (chain?: string | null) => {
    const c = chain ?? selectedChain;
    if (c === 'stellar') {
      // Browser wallet MUST be connected — a saved DB address alone can't sign transactions
      return !!(walletConnected && wallet && (address || userStellarAddress));
    }
    if (c === 'solana' || c === 'base') {
      return true;
    }
    return !!getSettlementWallet(c);
  };

  const handleSettleOne = async (settleWith: User) => {
    const userWalletAddress = getUserWalletAddress();
    const chainLabel = selectedChain ? selectedChain.charAt(0).toUpperCase() + selectedChain.slice(1) : "chain";
    
    if (!canProceedWithSettlement()) {
      if (selectedChain === 'stellar') {
        toast.error("Please connect your Stellar wallet first.");
        connectWallet();
        return;
      } else {
        toast.error(`Please add your ${chainLabel} wallet address in settings first.`);
        return;
      }
    }
    
    if (!userWalletAddress && selectedChain !== 'solana' && selectedChain !== 'base') {
      toast.error(`Please connect your ${chainLabel} wallet or add your wallet address in settings first.`);
      return;
    }
    
    if (!selectedToken) {
      toast.error("Please select a payment token");
      return;
    }
    // Use multi-currency total if available, otherwise use individual amount
    const amountToSettle = multiCurrencyDebts.length > 0 
      ? parseFloat(totalTokenAmount) 
      : (parseFloat(tokenAmount) || parseFloat(individualAmount));

    const payload = {
      groupId,
      address: userWalletAddress || "",
      settleWithId: settleWith.id,
      selectedTokenId: selectedToken.id,
      selectedChainId: selectedChain || undefined,
      amount: amountToSettle,
      ...(expenseId ? { expenseId } : {}),
    };
    settleDebtMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(`Successfully settled debt with ${settleWith.name}`);
        onClose();
      },
      onError: (err) => {
        console.error("[SettleDebtsModal] Error settling debt:", err);
      }
    });
  };

  const handleSettleAll = async () => {
    const userWalletAddress = getUserWalletAddress();
    const chainLabel = selectedChain ? selectedChain.charAt(0).toUpperCase() + selectedChain.slice(1) : "chain";
    
    if (!canProceedWithSettlement()) {
      if (selectedChain === 'stellar') {
        toast.error("Please connect your Stellar wallet first.");
        connectWallet();
        return;
      } else {
        toast.error(`Please add your ${chainLabel} wallet address in settings first.`);
        return;
      }
    }
    
    if (!userWalletAddress && selectedChain !== 'solana' && selectedChain !== 'base') {
      toast.error(`Please connect your ${chainLabel} wallet or add your wallet address in settings first.`);
      return;
    }
    
    if (!selectedToken) {
      toast.error("Please select a payment token");
      return;
    }

    // Use total token amount for multi-currency settlements, or regular total for single currency
    const amountToSettle = multiCurrencyDebts.length > 0 
      ? parseFloat(totalTokenAmount) 
      : parseFloat(totalAmount);

    const payload = {
      groupId,
      address: userWalletAddress || "",
      selectedTokenId: selectedToken.id,
      selectedChainId: selectedChain || undefined,
      amount: amountToSettle,
    };
    
    settleDebtMutation.mutate(payload, {
      onSuccess: () => {
        onClose();
        toast.success("Successfully settled debts");
      },
      onError: (err) => {
        console.error("[SettleDebtsModal] Error settling debts:", err);
      }
    });
  };

  const isPending = settleDebtMutation.isPending;

  // Get the selected user's balance for individual settlement
  const selectedUserBalance = selectedUser
    ? (specificAmount !== undefined 
        ? specificAmount 
        : specificDebtByCurrency && Object.keys(specificDebtByCurrency).length > 0
        ? Object.values(specificDebtByCurrency)[0] // Use specific debt amount instead of cross-group balances
        : 0) // COMMENTED OUT: (selectedUser as unknown as FriendWithBalances).balances.find() - focus on group-specific debts
    : 0;

  // Get currency-specific debts for the selected user
  const selectedUserDebtByCurrency = selectedUser && specificDebtByCurrency 
    ? specificDebtByCurrency 
    : {};

  // Check if there are any debts to settle for the selected user
  const _hasDebtsToSettle = Object.values(selectedUserDebtByCurrency).some(amount => amount !== 0);

  const displayGroupName = useMemo(() => {
    if (!groupId) return "Group";
    const groupMatch = _groups?.find((g: { id: string; name: string }) => g.id === groupId);
    return groupMatch?.name || "Group";
  }, [_groups, groupId]);

  const memberDebtRows = useMemo(() => {
    const palette = [P, G, O, A, "#F472B6", "#FBBF24"];
    const sourceBalances = Array.isArray(balances) ? balances : [];

    // Aggregate balances per member per currency first, keeping the sign
    const rawMap = new Map<string, Record<string, number>>();
    sourceBalances
      .filter((b) => b.userId === user?.id && b.amount !== 0)
      .forEach((b) => {
        const memberId = b.firendId;
        const curr = rawMap.get(memberId) || {};
        curr[b.currency] = (curr[b.currency] ?? 0) + b.amount;
        rawMap.set(memberId, curr);
      });

    if (specificMemberAmounts) {
      Object.entries(specificMemberAmounts).forEach(([memberId, amount]) => {
        if (amount !== 0 && !rawMap.has(memberId)) {
          rawMap.set(memberId, { [defaultCurrency || "USD"]: -amount });
        }
      });
    }

    // Direction must use converted net (same semantics as dashboard). Raw multi-currency sums are meaningless (e.g. USD + INR).
    const def = defaultCurrency || "USD";
    return Array.from(rawMap.entries())
      .map(([memberId, currMap], index) => {
        let netConvertedSigned = 0;
        for (const [currency, amt] of Object.entries(currMap)) {
          if (amt === 0) continue;
          const rate = balanceRateMap[currency];
          if (rate === undefined || !Number.isFinite(rate)) {
            netConvertedSigned = Number.NaN;
            break;
          }
          netConvertedSigned += amt * rate;
        }
        const direction: "owe" | "owed" = netConvertedSigned > 1e-6 ? "owe" : "owed";
        const debts = Object.entries(currMap)
          .filter(([, amt]) => amt !== 0)
          .map(([currency, amt]) => ({ currency, signed: amt, amount: Math.abs(amt) }));

        const member = _members.find((m) => m.id === memberId);
        const initials = (member?.name || member?.email || "?")
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        const color = palette[index % palette.length];
        const primaryDebt = debts[0] ?? { amount: 0, currency: def, signed: 0 };
        return {
          memberId,
          name: member?.name || member?.email || "Member",
          initials,
          color,
          debts,
          direction,
          netConvertedSigned,
          amount: Math.abs(netConvertedSigned),
          currency: def,
        };
      })
      .filter(
        (row) =>
          Number.isFinite(row.netConvertedSigned) && Math.abs(row.netConvertedSigned) > 1e-6,
      )
      .sort((a, b) => b.amount - a.amount);
  }, [balances, user?.id, _members, specificMemberAmounts, defaultCurrency, balanceRateMap]);

  // Fetch exchange rates for balance currencies that differ from defaultCurrency
  const uniqueBalanceCurrencies = useMemo(() => {
    if (!defaultCurrency) return [];
    return [...new Set(memberDebtRows.map((r) => r.currency))].filter(
      (c) => c && c !== defaultCurrency
    );
  }, [memberDebtRows, defaultCurrency]);

  const memberDebtRateQueries = useQueries({
    queries: uniqueBalanceCurrencies.map((from) => ({
      queryKey: [CURRENCY_QUERY_KEYS.EXCHANGE_RATE, from, defaultCurrency],
      queryFn: () => getExchangeRate(from, defaultCurrency ?? "USD"),
      staleTime: 1000 * 60 * 5,
      retry: 1,
    })),
  });

  const balanceRates = useMemo(() => {
    const map: Record<string, number> = {};
    uniqueBalanceCurrencies.forEach((c, i) => {
      map[c] = memberDebtRateQueries[i]?.data?.rate ?? 1;
    });
    return map;
  }, [uniqueBalanceCurrencies, memberDebtRateQueries]);

  const convertBalanceAmount = (amount: number, fromCurrency: string): number => {
    if (!fromCurrency || fromCurrency === defaultCurrency) return amount;
    return amount * (balanceRates[fromCurrency] ?? 1);
  };

  // Calculate totals split by direction (per-counterparty net in default currency — do not sum abs of mixed-currency legs)
  const totalToPay = memberDebtRows
    .filter((r) => r.direction === "owe")
    .reduce((sum, row) => sum + Math.abs(row.netConvertedSigned), 0);
  const totalToCollect = memberDebtRows
    .filter((r) => r.direction === "owed")
    .reduce((sum, row) => sum + Math.abs(row.netConvertedSigned), 0);
  const remainingTotal = totalToPay + totalToCollect;

  const SETTLE_CHAIN_META: Record<string, { icon: string; color: string }> = {
    stellar: { icon: "✦", color: G },
    solana:  { icon: "◎", color: P },
    base:    { icon: "🔵", color: "#3B82F6" },
  };

  const availableChains = organizedCurrencies?.chainGroups
    ? Object.keys(organizedCurrencies.chainGroups)
    : ["stellar", "solana", "base"];

  // Step navigation helpers
  const goToStep = useCallback((step: number) => {
    setSlideDir(step > settleStep ? 1 : -1);
    setSettleStep(step);
  }, [settleStep]);

  const handleSelectMember = useCallback((memberId: string) => {
    setSelectedSettleMemberId(memberId);
    setSlideDir(1);
    setSettleStep(2);
  }, []);

  const handleBackToStep = useCallback((step: number) => {
    setSlideDir(-1);
    setSettleStep(step);
  }, []);

  // Compute expense breakdown for selected member — both directions, each tagged
  const selectedMemberExpenses = useMemo(() => {
    if (!selectedSettleMemberId || !user || !_expenses.length) return [];

    const result: { id: string; name: string; category: string; amount: number; currency: string; date: Date; direction: "owe" | "owed" }[] = [];

    for (const e of _expenses) {
      if (e.splitType === "SETTLEMENT" || e.deletedAt) continue;

      if (e.paidBy === selectedSettleMemberId) {
        // They paid → I owe them for my share
        const myPart = e.expenseParticipants?.find(p => p.userId === user.id && !p.isPaid);
        if (myPart) {
          result.push({ id: e.id, name: e.name, category: e.category, amount: myPart.amount, currency: e.currency, date: e.expenseDate, direction: "owe" });
        }
      } else if (e.paidBy === user.id) {
        // I paid → they owe me for their share
        const theirPart = e.expenseParticipants?.find(p => p.userId === selectedSettleMemberId && !p.isPaid);
        if (theirPart) {
          result.push({ id: e.id, name: e.name, category: e.category, amount: theirPart.amount, currency: e.currency, date: e.expenseDate, direction: "owed" });
        }
      }
    }

    return result;
  }, [selectedSettleMemberId, user, _expenses]);

  const singleExpense = expenseId ? _expenses.find((e) => e.id === expenseId) : null;

  const selectedMemberRow = useMemo(() => {
    // Single-expense: build row from that expense only (not the aggregated total)
    if (expenseId && selectedSettleMemberId && singleExpense && user) {
      const member = _members.find((m) => m.id === selectedSettleMemberId);
      const aggregated = memberDebtRows.find(r => r.memberId === selectedSettleMemberId);
      const myPart = singleExpense.expenseParticipants?.find(p => p.userId === user.id && !p.isPaid);
      if (member && myPart) {
        const palette = [P, G, O, A, "#F472B6", "#FBBF24"];
        const initials = aggregated?.initials
          || (member.name || member.email || "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
        return {
          memberId: selectedSettleMemberId,
          name: member.name || member.email || "Member",
          initials,
          color: aggregated?.color || palette[0],
          debts: [{ currency: singleExpense.currency, signed: myPart.amount, amount: myPart.amount }],
          direction: "owe" as const,
          netConvertedSigned: myPart.amount,
          amount: myPart.amount,
          currency: singleExpense.currency,
        };
      }
    }

    return memberDebtRows.find(r => r.memberId === selectedSettleMemberId);
  }, [memberDebtRows, selectedSettleMemberId, expenseId, singleExpense, user, _members]);

  const isMobile = useIsMobile();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 h-screen w-screen"
          {...fadeIn}
        >
          <motion.div
            className="fixed inset-0 bg-black/70 brightness-50"
            style={isMobile ? { backdropFilter: "blur(10px)" } : undefined}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
          <div
            className={
              isMobile
                ? "modal-as-sheet-wrapper fixed inset-x-0 bottom-0 z-10 w-full max-w-[430px] mx-auto"
                : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full md:w-[90%] max-w-[500px] px-4 sm:px-0"
            }
          >
            {isMobile && <div className="modal-as-sheet-handle" />}
            {/* Settle All Debts Section - Multi-step flow */}
            {!showIndividualView && (
              <motion.div
                className={
                  isMobile
                    ? "modal-as-sheet-card relative z-10 p-5 sm:p-7"
                    : "relative z-10 rounded-[28px] p-7 border border-white/[0.09] shadow-[0_40px_100px_rgba(0,0,0,0.8)] max-h-[90vh] overflow-y-auto"
                }
                style={isMobile ? undefined : { background: "linear-gradient(160deg, #141414 0%, #0f0f0f 100%)" }}
                {...(isMobile ? { initial: { y: "100%" }, animate: { y: 0 }, transition: { type: "tween", duration: 0.32, ease: [0.34, 1.2, 0.64, 1] } } : scaleIn)}
              >
                {/* Header */}
                <div className={`flex items-center justify-between mb-5 ${isMobile ? "modal-as-sheet-title-bar pb-4" : ""}`}>
                  <div className="flex items-center gap-3">
                    {settleStep > 1 && (
                      <button
                        onClick={() => expenseId ? onClose() : handleBackToStep(settleStep - 1)}
                        className="h-9 w-9 rounded-full border border-white/10 bg-white/[0.07] grid place-items-center hover:bg-white/[0.12] transition-colors flex-shrink-0"
                      >
                        <ArrowLeft className="h-4 w-4 text-white/70" />
                      </button>
                    )}
                    <div>
                      <h2 className={`font-extrabold text-white tracking-tight ${isMobile ? "text-lg" : "text-xl"}`}>
                        {settleStep === 1 && "Settle Debts"}
                        {settleStep === 2 && `Expenses · ${selectedMemberRow?.name?.split(" ")[0] || "Member"}`}
                        {settleStep === 3 && (expenseId ? `Pay for ${singleExpense?.name || "Expense"}` : `Pay ${selectedMemberRow?.name?.split(" ")[0] || "Member"}`)}
                      </h2>
                      <p className="mt-1 text-xs text-white/55">
                        {settleStep === 1 && displayGroupName}
                        {settleStep === 2 && "Review what you owe"}
                        {settleStep === 3 && (expenseId ? `to ${selectedMemberRow?.name?.split(" ")[0] || "Member"}` : "Choose payment method")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="h-9 w-9 rounded-full border border-white/10 bg-white/[0.07] grid place-items-center hover:bg-white/[0.12] transition-colors flex-shrink-0"
                  >
                    <X className="h-4 w-4 text-white/70" />
                  </button>
                </div>

                {/* Progress bar — hidden for single-expense, 3 steps for "owe", 2 for "owed" */}
                {!expenseId && (() => {
                  const totalSteps = selectedMemberRow && selectedMemberRow.direction === "owed" ? 2 : 3;
                  return (
                    <div className="flex gap-1.5 mb-6">
                      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
                        <div
                          key={s}
                          className="flex-1 h-1 rounded-full transition-all duration-500"
                          style={{
                            background: s <= settleStep ? A : "#2a2a2a",
                            boxShadow: s <= settleStep ? "0 0 8px rgba(34,211,238,0.4)" : "none",
                          }}
                        />
                      ))}
                    </div>
                  );
                })()}

                {/* Step content with slide animation */}
                <div className="overflow-hidden">
                  <AnimatePresence mode="wait" custom={slideDir}>

                    {/* ─── Step 1: People I owe ─── */}
                    {settleStep === 1 && (
                      <motion.div
                        key="step-1"
                        custom={slideDir}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="space-y-3"
                      >
                        {memberDebtRows.filter(r => r.direction === "owe").length > 0 && (
                          <>
                            <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-white/40 px-0.5">You owe</p>
                            {memberDebtRows.filter(r => r.direction === "owe").map((row) => (
                              <button
                                key={row.memberId}
                                type="button"
                                onClick={() => handleSelectMember(row.memberId)}
                                className="w-full rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-4 py-4 flex items-center gap-3 text-left hover:bg-white/[0.06] hover:border-white/[0.14] transition-all group"
                              >
                                <div
                                  className="h-10 w-10 rounded-full border-2 grid place-items-center text-xs font-extrabold flex-shrink-0"
                                  style={{ color: row.color, borderColor: `${row.color}40`, background: `${row.color}1a` }}
                                >
                                  {row.initials}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-[14px] font-bold truncate">{row.name}</p>
                                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                                    {row.debts.filter(d => d.signed > 0).map((d) => {
                                      const fmt = formatWithDefault(d.amount, d.currency);
                                      return (
                                        <span key={d.currency} className="text-[11px] text-white/50">
                                          {fmt.primary}{fmt.secondary && <span className="text-white/30"> ({fmt.secondary})</span>}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                                <p className="text-[15px] font-extrabold tabular-nums flex-shrink-0 text-splito-r">
                                  {formatCurrency(
                                    specificMemberAmounts?.[row.memberId] !== undefined
                                      ? Math.abs(specificMemberAmounts[row.memberId])
                                      : Math.abs(row.netConvertedSigned),
                                    defaultCurrency || "USD"
                                  )}
                                </p>
                                <ChevronRight className="h-4 w-4 text-white/25 group-hover:text-white/50 transition-colors flex-shrink-0" />
                              </button>
                            ))}
                          </>
                        )}

                        {memberDebtRows.filter(r => r.direction === "owed").length > 0 && (
                          <>
                            <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-white/40 px-0.5 mt-4">Owed to you</p>
                            {memberDebtRows.filter(r => r.direction === "owed").map((row) => (
                              <button
                                key={row.memberId}
                                type="button"
                                onClick={() => handleSelectMember(row.memberId)}
                                className="w-full rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-4 py-4 flex items-center gap-3 text-left hover:bg-white/[0.06] hover:border-white/[0.14] transition-all group"
                              >
                                <div
                                  className="h-10 w-10 rounded-full border-2 grid place-items-center text-xs font-extrabold flex-shrink-0"
                                  style={{ color: row.color, borderColor: `${row.color}40`, background: `${row.color}1a` }}
                                >
                                  {row.initials}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-[14px] font-bold truncate">{row.name}</p>
                                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                                    {row.debts.filter(d => d.signed < 0).map((d) => {
                                      const fmt = formatWithDefault(d.amount, d.currency);
                                      return (
                                        <span key={d.currency} className="text-[11px] text-white/50">
                                          {fmt.primary}{fmt.secondary && <span className="text-white/30"> ({fmt.secondary})</span>}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                                <p className="text-[15px] font-extrabold tabular-nums flex-shrink-0 text-splito-g">
                                  {formatCurrency(Math.abs(row.netConvertedSigned), defaultCurrency || "USD")}
                                </p>
                                <ChevronRight className="h-4 w-4 text-white/25 group-hover:text-white/50 transition-colors flex-shrink-0" />
                              </button>
                            ))}
                          </>
                        )}

                        {memberDebtRows.length === 0 && (
                          <div className="text-center text-white/55 py-8 text-sm">
                            No outstanding debts found for this group.
                          </div>
                        )}

                        {/* Totals */}
                        {(totalToPay > 0 || totalToCollect > 0) && (
                          <div className="pt-3 mt-1 border-t border-white/[0.06] space-y-2">
                            {totalToPay > 0 && (
                              <div className="flex items-center justify-between px-0.5">
                                <span className="text-white/70 text-[13px] font-semibold">Total to pay</span>
                                <span className="text-splito-r text-[15px] font-extrabold tabular-nums">
                                  -{formatCurrency(totalToPay, defaultCurrency || "USD")}
                                </span>
                              </div>
                            )}
                            {totalToCollect > 0 && (
                              <div className="flex items-center justify-between px-0.5">
                                <span className="text-white/70 text-[13px] font-semibold">Total to collect</span>
                                <span className="text-splito-g text-[15px] font-extrabold tabular-nums">
                                  +{formatCurrency(totalToCollect, defaultCurrency || "USD")}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* ─── Step 2: Expense breakdown ─── */}
                    {settleStep === 2 && selectedMemberRow && (
                      <motion.div
                        key="step-2"
                        custom={slideDir}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="space-y-3"
                      >
                        {/* Selected person card */}
                        <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-full border-2 grid place-items-center text-xs font-extrabold flex-shrink-0"
                            style={{ color: selectedMemberRow.color, borderColor: `${selectedMemberRow.color}40`, background: `${selectedMemberRow.color}1a` }}
                          >
                            {selectedMemberRow.initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-[14px] font-bold truncate">{selectedMemberRow.name}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: selectedMemberRow.direction === "owe" ? R : G }}>
                              {selectedMemberRow.direction === "owe" ? "You owe" : "Owes you"}{" "}
                              <span className="font-extrabold">
                                {formatCurrency(Math.abs(selectedMemberRow.netConvertedSigned), defaultCurrency || "USD")}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Expense list */}
                        {selectedMemberExpenses.length > 0 ? (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-white/40 px-0.5">Expenses</p>
                            {selectedMemberExpenses.map((exp) => {
                              const catKey = (exp.category || "").toUpperCase();
                              const KNOWN_CATS: Record<string, string> = { ACCOMMODATION: "🏠", FOOD: "🍽", TRAVEL: "🚗", TRANSPORT: "🚗" };
                              const catIcon = KNOWN_CATS[catKey] || KNOWN_CATS[catKey.split(/[\s-_]/)[0]] || ((exp.category || "").trim() && exp.category !== "OTHER" ? exp.category : "🧾");
                              return (
                                <div
                                  key={exp.id}
                                  className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex items-center gap-3"
                                >
                                  <div className="h-8 w-8 rounded-[10px] bg-white/[0.06] grid place-items-center flex-shrink-0 text-[15px]">
                                    {catIcon}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white text-[13px] font-semibold truncate">{exp.name}</p>
                                    <p className="text-[10px] text-white/40 mt-0.5">
                                      {exp.date ? new Date(exp.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                                    </p>
                                  </div>
                                  <p className="text-[13px] font-extrabold tabular-nums flex-shrink-0" style={{ color: exp.direction === "owe" ? R : G }}>
                                    {exp.direction === "owed" && "+"}
                                    {(() => {
                                      const fmt = formatWithDefault(exp.amount, exp.currency);
                                      return <>{fmt.primary}{fmt.secondary && <span className="text-[11px] font-semibold text-white/35"> ({fmt.secondary})</span>}</>;
                                    })()}
                                  </p>
                                </div>
                              );
                            })}

                            {/* Net total */}
                            <div className="flex items-center justify-between pt-3 mt-1 border-t border-white/[0.06] px-0.5">
                              <span className="text-white/70 text-[13px] font-semibold">Net balance</span>
                              <span className="text-[15px] font-extrabold tabular-nums" style={{ color: selectedMemberRow.direction === "owe" ? R : G }}>
                                {selectedMemberRow.direction === "owe" ? "-" : "+"}
                                {formatCurrency(Math.abs(selectedMemberRow.netConvertedSigned), defaultCurrency || "USD")}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <p className="text-white/50 text-[13px]">No individual expenses found.</p>
                            <p className="text-white/35 text-[11px] mt-1">Balance may be from settled or adjusted amounts.</p>
                          </div>
                        )}

                        {/* Action button */}
                        {selectedMemberRow.direction === "owe" ? (
                          <button
                            className="w-full mt-2 h-12 rounded-[14px] bg-splito-a text-[#0a0a0a] font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                            onClick={() => goToStep(3)}
                          >
                            <span>Continue to Payment</span>
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            className="w-full mt-2 h-12 rounded-[14px] font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                            style={{ background: "rgba(251,191,36,0.12)", border: "1.5px solid rgba(251,191,36,0.30)", color: "#FBBF24" }}
                            disabled={isReminderSending}
                            onClick={() => sendReminderMutation({ receiverId: selectedMemberRow.memberId, reminderType: "USER", content: `Hey, you owe ${formatCurrency(Math.abs(selectedMemberRow.netConvertedSigned), defaultCurrency || "USD")} in ${displayGroupName}` })}
                          >
                            <Bell className="h-4 w-4" />
                            <span>{isReminderSending ? "Sending…" : "Send Reminder"}</span>
                          </button>
                        )}
                      </motion.div>
                    )}

                    {/* ─── Step 3: Payment method ─── */}
                    {settleStep === 3 && selectedMemberRow && (() => {
                      const row = selectedMemberRow;
                      const memberId = row.memberId;
                      return (
                        <motion.div
                          key="step-3"
                          custom={slideDir}
                          variants={slideVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          className="space-y-3"
                        >
                          {/* Amount summary */}
                          <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 flex items-center gap-3">
                            <div
                              className="h-10 w-10 rounded-full border-2 grid place-items-center text-xs font-extrabold flex-shrink-0"
                              style={{ color: row.color, borderColor: `${row.color}40`, background: `${row.color}1a` }}
                            >
                              {row.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-[14px] font-bold truncate">{row.name}</p>
                              {singleExpense && (
                                <p className="text-[11px] text-white/40 mt-0.5 truncate">for {singleExpense.name}</p>
                              )}
                            </div>
                            <p className="text-[15px] font-extrabold tabular-nums flex-shrink-0" style={{ color: row.direction === "owe" ? R : G }}>
                              {row.direction === "owe" ? "-" : "+"}
                              {(() => {
                                const amt = specificMemberAmounts?.[memberId] !== undefined
                                  ? Math.abs(specificMemberAmounts[memberId])
                                  : Math.abs(row.netConvertedSigned);
                                const cur = singleExpense?.currency || row.debts[0]?.currency || defaultCurrency || "USD";
                                const fmt = formatWithDefault(amt, cur);
                                return <>{fmt.primary}{fmt.secondary && <span className="text-[11px] font-semibold text-white/35"> ({fmt.secondary})</span>}</>;
                              })()}
                            </p>
                          </div>

                          {/* Crypto panel */}
                          {(() => {
                            const firstName = (row.name || "").split(" ")[0] || "They";

                            if (isRecipientPrefLoading) {
                              return (
                                <div className="space-y-3">
                                  <div className="h-3 w-24 rounded-full bg-white/[0.06] animate-pulse" />
                                  <div className="grid grid-cols-4 gap-2">
                                    {[1,2,3,4].map(i => (
                                      <div key={i} className="h-[72px] rounded-[14px] bg-white/[0.04] animate-pulse" />
                                    ))}
                                  </div>
                                  <div className="h-12 rounded-[14px] bg-white/[0.04] animate-pulse" />
                                </div>
                              );
                            }

                            if (recipientPrefList.length === 0) {
                              return (
                                <div className="space-y-3">
                                  <div className="rounded-[18px] overflow-hidden" style={{ border: "1px solid rgba(251,146,60,0.20)", background: "linear-gradient(135deg, rgba(251,146,60,0.06) 0%, rgba(251,146,60,0.02) 100%)" }}>
                                    <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                                      <div
                                        className="flex-shrink-0 h-10 w-10 rounded-full grid place-items-center"
                                        style={{ background: "rgba(251,146,60,0.12)", border: "1.5px solid rgba(251,146,60,0.25)" }}
                                      >
                                        <UserX className="h-[18px] w-[18px]" style={{ color: O }} />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-bold text-white/90">
                                          {firstName}{" "}hasn&apos;t set up settlements
                                        </p>
                                        <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                                          They need to configure their settlement preferences in Settings before you can pay on-chain.
                                        </p>
                                      </div>
                                    </div>
                                    <div className="px-4 pb-4 flex flex-col gap-2">
                                      <button
                                        type="button"
                                        className="w-full h-11 rounded-[12px] font-bold text-[13px] flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                                        style={{ background: "rgba(251,146,60,0.12)", border: "1.5px solid rgba(251,146,60,0.30)", color: O }}
                                        disabled={isReminderSending}
                                        onClick={() => sendReminderMutation({
                                          receiverId: memberId,
                                          reminderType: "NUDGE",
                                          content: `Hey ${firstName}! Set up your settlement preferences on Splito (Settings → Settlement) so I can pay you on-chain.`,
                                        })}
                                      >
                                        {isReminderSending ? (
                                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                                        ) : (
                                          <><Mail className="h-3.5 w-3.5" /> Nudge {firstName} to set up</>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            const defaultChainId = recipientPrefList[0].chainId;

                            return (
                              <div className="space-y-3">
                                {/* Chain selector */}
                                <p className="text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: "#ccc" }}>Chain</p>
                                <div className="grid grid-cols-4 gap-2">
                                  {availableChains.map((chain) => {
                                    const meta = SETTLE_CHAIN_META[chain] || { icon: "◆", color: "#666" };
                                    const isChainSel = (memberChains[memberId] || selectedChain || defaultChainId) === chain;
                                    const isRecipientChain = recipientSupportedChains.has(chain);
                                    return (
                                      <button
                                        key={chain}
                                        type="button"
                                        onClick={() => {
                                          setMemberChains((p) => ({ ...p, [memberId]: chain }));
                                          setSelectedChain(chain);
                                        }}
                                        className="relative flex flex-col items-center gap-1.5 py-3 rounded-[14px] border transition-all"
                                        style={{
                                          background: isChainSel ? `${meta.color}18` : "rgba(255,255,255,0.04)",
                                          borderColor: isChainSel ? `${meta.color}55` : "rgba(255,255,255,0.08)",
                                          boxShadow: isChainSel ? `0 0 14px ${meta.color}22` : "none",
                                          opacity: isRecipientChain || isChainSel ? 1 : 0.4,
                                        }}
                                      >
                                        <span style={{ color: meta.color, fontSize: 18 }}>{meta.icon}</span>
                                        <span className="text-[10px] font-bold" style={{ color: isChainSel ? meta.color : "rgba(255,255,255,0.55)" }}>
                                          {chain.charAt(0).toUpperCase() + chain.slice(1)}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Selected chain info */}
                                {(() => {
                                  const effectiveChain = memberChains[memberId] || selectedChain || defaultChainId;
                                  const matchedPref = recipientPrefList.find(p => p.chainId === effectiveChain);
                                  if (matchedPref) {
                                    const eMeta = SETTLE_CHAIN_META[effectiveChain] || { icon: "◆", color: "#666" };
                                    const eTokens = matchedPref.tokens.map(t => t.token.symbol).join(", ");
                                    const eAddr = matchedPref.wallet?.address || "";
                                    const eTrunc = eAddr.length > 14 ? `${eAddr.slice(0, 6)}…${eAddr.slice(-4)}` : eAddr;
                                    return (
                                      <div className="flex items-center gap-2.5 rounded-[12px] px-3 py-2" style={{ background: `${eMeta.color}08`, border: `1px solid ${eMeta.color}20` }}>
                                        <span style={{ fontSize: 13, color: eMeta.color }}>{eMeta.icon}</span>
                                        <p className="text-[11px] flex-1 min-w-0" style={{ color: "rgba(255,255,255,0.55)" }}>
                                          <span style={{ color: eMeta.color, fontWeight: 700 }}>{eTokens}</span>
                                          {eTrunc && <span className="font-mono" style={{ color: "rgba(255,255,255,0.30)" }}> · {eTrunc}</span>}
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}

                                {(() => {
                                  const effectiveChain = memberChains[memberId] || selectedChain || defaultChainId;
                                  if (!effectiveChain) return null;

                                  if (!recipientSupportedChains.has(effectiveChain)) {
                                    const pickedLabel = effectiveChain.charAt(0).toUpperCase() + effectiveChain.slice(1);
                                    const suggestPref = recipientPrefList[0];
                                    const suggestMeta = SETTLE_CHAIN_META[suggestPref.chainId] || { icon: "◆", color: "#666" };
                                    const suggestLabel = suggestPref.chainId.charAt(0).toUpperCase() + suggestPref.chainId.slice(1);
                                    return (
                                      <div className="rounded-[16px] overflow-hidden" style={{ border: "1px solid rgba(239,68,68,0.20)", background: "linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(239,68,68,0.02) 100%)" }}>
                                        <div className="px-4 py-3.5 flex items-start gap-3">
                                          <div className="flex-shrink-0 h-9 w-9 rounded-full grid place-items-center" style={{ background: "rgba(239,68,68,0.12)", border: "1.5px solid rgba(239,68,68,0.25)" }}>
                                            <X className="h-4 w-4" style={{ color: R }} />
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="text-[12px] font-bold" style={{ color: R }}>
                                              {firstName} can&apos;t receive on {pickedLabel}
                                            </p>
                                            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.40)", lineHeight: 1.5 }}>
                                              They accept {recipientPrefList.map(p => p.chainId.charAt(0).toUpperCase() + p.chainId.slice(1)).join(", ")}.
                                            </p>
                                          </div>
                                        </div>
                                        <div className="px-4 pb-3.5 flex gap-2">
                                          <button
                                            type="button"
                                            className="flex-1 h-10 rounded-[12px] font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
                                            style={{ background: `${suggestMeta.color}15`, border: `1.5px solid ${suggestMeta.color}35`, color: suggestMeta.color }}
                                            onClick={() => {
                                              setMemberChains((p) => ({ ...p, [memberId]: suggestPref.chainId }));
                                              setSelectedChain(suggestPref.chainId);
                                            }}
                                          >
                                            {suggestMeta.icon} Use {suggestLabel}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  }

                                  const member = _members.find((m) => m.id === memberId);
                                  if (!canProceedWithSettlement(effectiveChain)) {
                                    return (
                                      <div>
                                        {effectiveChain === "stellar" && (
                                          <button
                                            type="button"
                                            className="w-full py-3 rounded-[14px] bg-white/[0.06] border border-white/10 text-white text-sm font-semibold hover:bg-white/[0.1] transition-colors"
                                            onClick={connectWallet}
                                          >
                                            Connect Stellar Wallet
                                          </button>
                                        )}
                                        {(effectiveChain === "solana" || effectiveChain === "base") && (
                                          <p className="text-xs text-amber-400 mt-2 text-center">
                                            Add your {effectiveChain.charAt(0).toUpperCase() + effectiveChain.slice(1)} wallet address in Settings first.
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }

                                  return (
                                    <button
                                      type="button"
                                      disabled={isPending}
                                      className="w-full py-3 rounded-[14px] text-sm font-extrabold transition-opacity hover:opacity-90 disabled:opacity-50"
                                      style={{ background: A, color: "#0a0a0a" }}
                                      onClick={() => member && handleSettleOne(member)}
                                    >
                                      {isPending ? (
                                        <span className="flex items-center justify-center gap-2">
                                          <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                                        </span>
                                      ) : "Settle Now"}
                                    </button>
                                  );
                                })()}

                              </div>
                            );
                          })()}

                        </motion.div>
                      );
                    })()}

                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* Settle Individual Debt Section - Only shown when a friend's button is clicked */}
            {showIndividualView && (
              <motion.div
                className={
                  isMobile
                    ? "modal-as-sheet-card relative z-10 p-5 sm:p-7"
                    : "relative z-10 rounded-[28px] p-7 border border-white/[0.09] shadow-[0_40px_100px_rgba(0,0,0,0.8)] max-h-[90vh] overflow-y-auto"
                }
                style={isMobile ? undefined : { background: "linear-gradient(160deg, #141414 0%, #0f0f0f 100%)" }}
                {...(isMobile ? { initial: { y: "100%" }, animate: { y: 0 }, transition: { type: "tween", duration: 0.32, ease: [0.34, 1.2, 0.64, 1] } } : scaleIn)}
              >
                <div className={`flex items-center justify-between mb-5 ${isMobile ? "modal-as-sheet-title-bar pb-4" : ""}`}>
                  <div>
                    <h2 className={`font-extrabold text-white tracking-tight ${isMobile ? "text-lg" : "text-xl"}`}>
                      Settle {selectedUser ? (selectedUser.name || "Member").split(" ")[0] : "Debt"}
                    </h2>
                    <p className="mt-1.5 text-xs text-white/55">Individual settlement</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="h-9 w-9 rounded-full border border-white/10 bg-white/[0.07] grid place-items-center hover:bg-white/[0.12] transition-colors flex-shrink-0"
                  >
                    <X className="h-4 w-4 text-white/70" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[#ccc] text-[11px] font-bold tracking-[0.08em] uppercase mb-2 block">
                      Choose Payment Token
                    </label>

                    <div className="relative mb-4">
                      <ResolverSelector
                        value={selectedToken || undefined}
                        onChange={(option) => setSelectedToken(option || null)}
                      />
                    </div>

                    {availableChainsForToken.length > 1 && (
                      <div className="mb-4">
                        <label className="text-[#ccc] text-[11px] font-bold tracking-[0.08em] uppercase mb-2 block">
                          Select Chain
                        </label>
                        <select
                          value={selectedChain || ''}
                          onChange={e => setSelectedChain(e.target.value)}
                          className="w-full rounded-[14px] px-4 py-3 bg-white/[0.05] border-[1.5px] border-white/[0.09] text-white text-[14px] outline-none font-inherit"
                        >
                          {availableChainsForToken.map(chain => (
                            <option key={chain} value={chain} className="bg-[#141414]">
                              {chain.charAt(0).toUpperCase() + chain.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="relative space-y-3">
                      {/* Token Amount to Send */}
                      {selectedToken && (
                        <div>
                          <label className="text-[#ccc] text-[11px] font-bold tracking-[0.08em] uppercase mb-2 block">
                            Amount {(isLoadingTokenPrice || isLoadingRate || isLoadingMultiCurrency) && "(Converting...)"} <span className="text-splito-a">({selectedToken?.symbol})</span>
                          </label>
                          <div className="w-full flex items-center bg-white/[0.05] border-[1.5px] border-white/[0.09] rounded-[14px] px-4 py-3 text-white">
                            <span className="text-splito-a text-[20px] font-extrabold mr-2 min-w-[24px]">
                              {selectedToken?.symbol === 'USD' ? '$' : selectedToken?.symbol[0]}
                            </span>
                            <input
                              type="text"
                              value={multiCurrencyDebts.length > 0 ? totalTokenAmount : (tokenAmount || fiatAmount)}
                              onChange={(e) => {
                                if (multiCurrencyDebts.length === 0) {
                                  setFiatAmount(e.target.value);
                                  setIndividualAmount(e.target.value);
                                }
                              }}
                              className="bg-transparent outline-none text-[26px] font-[800] w-full font-inherit"
                              placeholder="0.00"
                              readOnly={multiCurrencyDebts.length > 0 || (isLoadingTokenPrice || isLoadingRate || isLoadingMultiCurrency)}
                            />
                            <span className="text-[14px] font-bold text-white/50 ml-2">
                              {selectedToken?.symbol || "Token"}
                            </span>
                          </div>
                          
                          {/* Conversion Breakdown Dropdown */}
                          {multiCurrencyDebts.length > 0 && (
                            <details className="mt-3 group">
                              <summary className="cursor-pointer text-[13px] text-white/70 hover:text-white transition-colors flex items-center gap-2 font-medium list-none [&::-webkit-details-marker]:hidden">
                                <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
                                Conversion Breakdown
                              </summary>
                              <div className="mt-2 p-3 bg-white/[0.03] border border-white/[0.06] rounded-[14px]">
                                {multiCurrencyDebts.map((debt, index) => (
                                  <div key={index} className="flex justify-between items-center text-[12px] py-1">
                                    <span className="text-white/80">
                                      {formatCurrency(debt.amount, debt.currency)}
                                    </span>
                                    <span className="text-splito-g font-bold">
                                      {debt.tokenAmount.toFixed(6)} {selectedToken?.symbol}
                                    </span>
                                  </div>
                                ))}
                                <div className="border-t border-white/[0.08] mt-2 pt-2">
                                  <div className="flex justify-between items-center text-[13px] font-bold">
                                    <span className="text-white">Total:</span>
                                    <span className="text-splito-g">
                                      {totalTokenAmount} {selectedToken?.symbol}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </details>
                          )}
                          
                          {/* Show pricing info only for single currency conversions */}
                          {multiCurrencyDebts.length === 0 && (tokenPriceData || exchangeRateData) && (
                            <div className="text-xs text-white/60 mt-1">
                              {tokenPriceData ? (
                                <>
                                  Price: 1 {selectedToken?.symbol} = {getCurrencySymbol(debtCurrency)}{tokenPriceData.price?.toFixed(6)}
                                  <br />
                                  Rate: 1 {getCurrencySymbol(debtCurrency)} = {(1/tokenPriceData.price)?.toFixed(6)} {selectedToken?.symbol}
                                </>
                              ) : exchangeRateData ? (
                                <>
                                  Rate: 1 {getCurrencySymbol(debtCurrency)} = {exchangeRateData.rate?.toFixed(6)} {selectedToken?.symbol}
                                  {priceError && " (Using fallback rate)"}
                                </>
                              ) : null}
                            </div>
                          )}
                          
                          {multiCurrencyDebts.length === 0 && priceError && !exchangeRateData && !isLoadingTokenPrice && !isLoadingRate && (
                            <div className="text-xs text-yellow-400 mt-1">
                              Unable to fetch current exchange rate - using fallback conversion
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {!selectedUser && (
                    <div className="text-center text-white/60 py-4 text-[13px]">
                      Select a user to settle individual debt
                    </div>
                  )}

                  {selectedUser && (
                    <div className="flex items-center gap-3 sm:gap-4 p-4 mt-2 bg-white/[0.03] border border-white/[0.08] rounded-[18px]">
                      <div className="h-[46px] w-[46px] overflow-hidden rounded-full border-2 border-white/[0.1]">
                        <Image
                          src={
                            selectedUser.image ||
                            `https://api.dicebear.com/9.x/identicon/svg?seed=${selectedUser.id}`
                          }
                          alt={selectedUser.name || "User"}
                          width={46}
                          height={46}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = `https://api.dicebear.com/9.x/identicon/svg?seed=${selectedUser.id}`;
                          }}
                        />
                      </div>
                      <div className="flex-[1]">
                        <p className="text-[14px] text-white font-[700] mb-0.5">
                          {selectedUser.name}
                        </p>
                        <p className="text-[12px] text-white/60 font-[500]">
                          You owe{" "}
                          {(() => {
                            return multiCurrencyDebts.length > 0 ? (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {multiCurrencyDebts.map((debt, idx) => (
                                  <span key={idx} className="text-splito-g font-[800] font-mono">
                                    {formatCurrency(debt.amount, debt.currency)}
                                    {idx < multiCurrencyDebts.length - 1 && ", "}
                                  </span>
                                ))}
                                <span className="text-white/60 ml-1 font-[400] font-sans">
                                  worth {totalTokenAmount} {selectedToken?.symbol || "tokens"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-splito-g font-[800] font-mono ml-1">
                                {formatCurrency(Math.abs(selectedUserBalance), defaultCurrency)}
                              </span>
                            );
                          })()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Show wallet connection component for any chain if not connected */}
                {!canProceedWithSettlement() && (
                  <div className="mt-4">
                    {(selectedChain === 'solana' || selectedChain === 'base') && (
                      <p className="text-xs text-amber-400 text-center py-2">
                        Add your {selectedChain.charAt(0).toUpperCase() + selectedChain.slice(1)} wallet address in Settings → Wallet first.
                      </p>
                    )}
                  </div>
                )}

                {canProceedWithSettlement() ? (
                  <button
                    className="w-full mt-6 h-12 rounded-[14px] bg-splito-a text-[#0a0a0a] font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => selectedUser && handleSettleOne(selectedUser)}
                    disabled={
                      isPending ||
                      !selectedUser ||
                      (multiCurrencyDebts.length > 0 ? parseFloat(totalTokenAmount) <= 0 : (parseFloat(tokenAmount) <= 0 && parseFloat(fiatAmount) <= 0)) ||
                      !selectedToken ||
                      (isLoadingTokenPrice || isLoadingRate || isLoadingMultiCurrency)
                    }
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Sending…</span>
                      </>
                    ) : (
                      <>
                        <span>Review &amp; Confirm</span>
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    {selectedChain === 'stellar' && (
                      <button
                        className="w-full mt-5 h-11 rounded-xl bg-white/[0.06] border border-white/10 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white/[0.1] transition-colors"
                        onClick={connectWallet}
                      >
                        <span>Connect Stellar Wallet</span>
                      </button>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
