"use client";

import type React from "react";
import { useGroups, type Split, type Debt } from "@/stores/groups";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { User } from "@/api-helpers/modelSchema";
import { useCreateExpense } from "@/features/expenses/hooks/use-create-expense";
import type { CreateExpenseParams } from "@/features/expenses/hooks/use-create-expense";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/constants";
import {
  useGetAllCurrencies,
  useGetFiatCurrencies,
} from "@/features/currencies/hooks/use-currencies";
import { CurrencyType } from "@/api-helpers/types";
import ResolverSelector from "./ResolverSelector";
import axios from "axios";
import CurrencyDropdown from "./currency-dropdown";
import TimeLockToggle from "./ui/TimeLockToggle";
import { motion, AnimatePresence } from "framer-motion";
import { fadeIn, scaleIn } from "@/utils/animations";
import { Card, A, G, P, O, T, getUserColor, BORDER, INSET } from "@/lib/splito-design";
import { useGroupLayoutOptional } from "@/contexts/group-layout-context";
import { useIsMobile } from "@/hooks/useIsMobile";

const CATEGORY_OPTIONS: { emoji: string; api: string }[] = [
  { emoji: "🍽", api: "FOOD" },
  { emoji: "🏠", api: "ACCOMMODATION" },
  { emoji: "🚗", api: "TRAVEL" },
  { emoji: "✈️", api: "TRAVEL" },
  { emoji: "🛒", api: "OTHER" },
  { emoji: "🎟", api: "OTHER" },
  { emoji: "🎵", api: "OTHER" },
  { emoji: "💊", api: "OTHER" },
  { emoji: "🏄", api: "OTHER" },
  { emoji: "⚡️", api: "OTHER" },
];

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: User[];
  groupId: string;
  defaultCurrency?: string;
}

interface ExpenseFormData {
  name: string;
  description: string;
  amount: string;
  splitType: string;
  currency: string;
  currencyType: CurrencyType;
  chainId?: string;
  tokenId?: string;
  timeLockIn: boolean;
  paidBy: string;
  category: string;
  /** Emoji of the selected category (so only one icon is highlighted when multiple share the same api) */
  categoryEmoji: string;
}

// Define an interface for the expense payload (matches CreateExpenseParams)
type ExpensePayload = CreateExpenseParams;

type Option = import("./ResolverSelector").Option;

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
function useAllChainsTokens() {
  const [options, setOptions] = useState<Option[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/multichain/all-chains-tokens`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: any) => {
        if (cancelled || data == null) return;
        const chains = Array.isArray(data) ? data : data.chainsWithTokens || [];
        const opts: Option[] = [];
        chains.forEach((chain: any) => {
          (chain.tokens || []).forEach((token: any) => {
            opts.push({
              id: token.id || token.symbol,
              symbol: token.symbol,
              name: token.name,
              chainId: chain.chainId,
              type: token.type,
            });
          });
        });
        setOptions(opts);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return options;
}

export function AddExpenseModal({
  isOpen,
  onClose,
  members,
  groupId,
  defaultCurrency = "USD",
}: AddExpenseModalProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  // Fetch supported currencies
  const { data: fiatCurrencies, isLoading: isLoadingFiat } =
    useGetFiatCurrencies();
  const { data: allCurrencies, isLoading: isLoadingAll } =
    useGetAllCurrencies();

  // Helper function to get currency symbol from the currencies data
  const getCurrencySymbol = (currencyId: string): string => {
    const currency = allCurrencies?.currencies?.find(
      (c) => c.id === currencyId
    );
    return currency?.symbol || currencyId;
  };

  // Helper function to format currency using actual symbols from API
  const formatCurrency = (amount: number, currencyId: string): string => {
    const symbol = getCurrencySymbol(currencyId);
    // For currencies like JPY, don't show decimals
    const decimals = currencyId === "JPY" ? 0 : 2;
    return `${symbol}${amount.toFixed(decimals)}`;
  };

  // Helper function to get currency placeholder using actual symbols
  const getCurrencyPlaceholder = (currencyId: string): string => {
    const symbol = getCurrencySymbol(currencyId);
    const amount = currencyId === "JPY" ? "5000" : "50";
    return `${symbol}${amount}`;
  };

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState<ExpenseFormData>({
    name: "",
    description: "",
    amount: "",
    splitType: "equal",
    currency: defaultCurrency,
    currencyType: "FIAT",
    timeLockIn: false,
    paidBy: user?.id || "",
    category: "OTHER",
    categoryEmoji: CATEGORY_OPTIONS[4].emoji, // 🛒 first "OTHER" option
  });

  const [lockPrice, setLockPrice] = useState(true);
  const [splits, setSplits] = useState<Split[]>([]);
  const [percentages, setPercentages] = useState<{ [key: string]: number }>({});
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [touchedCustom, setTouchedCustom] = useState<Set<string>>(new Set());
  const [touchedPercentage, setTouchedPercentage] = useState<Set<string>>(new Set());
  const expenseMutation = useCreateExpense(groupId);

  const groupCtx = useGroupLayoutOptional();
  const groupName = groupCtx?.group?.name ?? "Group";

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFormData((prev) => ({ ...prev, currency: defaultCurrency, currencyType: "FIAT" }));
      setSelectedParticipants(new Set(members.map((m) => m.id)));
      setTouchedCustom(new Set());
      setTouchedPercentage(new Set());
    }
  }, [isOpen, defaultCurrency, members]);

  const allChainTokenOptions = useAllChainsTokens();
  const [resolver, setResolver] = useState<Option | undefined>(undefined);

  // Set default paid by user when the component loads
  useEffect(() => {
    if (user && members.length > 0) {
      setFormData((prev) => ({
        ...prev,
        paidBy: user.id,
      }));
    }
  }, [user, members]);

  const toggleParticipant = (id: string) => {
    setSelectedParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    setTouchedCustom(new Set());
    setTouchedPercentage(new Set());
  }, [formData.splitType, selectedParticipants]);

  useEffect(() => {
    const allMemberIds = members.map((m) => m.id);
    const total = Number(formData.amount);

    if (formData.splitType === "equal") {
      const activeIds = allMemberIds.filter((id) => selectedParticipants.has(id));
      const equalAmount = activeIds.length > 0 ? total / activeIds.length : 0;
      setSplits(allMemberIds.map((id) => ({
        address: id,
        amount: selectedParticipants.has(id) ? equalAmount : 0,
      })));
    }
  }, [members, formData.amount, formData.splitType, formData.paidBy, selectedParticipants]);

  useEffect(() => {
    const allMemberIds = members.map((m) => m.id);
    const total = Number(formData.amount);

    if (formData.splitType === "percentage") {
      const activeIds = allMemberIds.filter((id) => selectedParticipants.has(id));
      const equalPct = activeIds.length > 0 ? 100 / activeIds.length : 0;
      setSplits(allMemberIds.map((id) => ({
        address: id,
        amount: selectedParticipants.has(id) ? (total * equalPct) / 100 : 0,
        percentage: selectedParticipants.has(id) ? equalPct : 0,
      })));
    }

    if (formData.splitType === "custom") {
      const activeIds = allMemberIds.filter((id) => selectedParticipants.has(id));
      const perPerson = activeIds.length > 0 ? total / activeIds.length : 0;
      setSplits(allMemberIds.map((id) => ({
        address: id,
        amount: selectedParticipants.has(id) ? perPerson : 0,
      })));
    }
  }, [members, formData.splitType, formData.paidBy, selectedParticipants]);

  const updateCustomSplit = (id: string, amount: number) => {
    const newTouched = new Set(touchedCustom);
    newTouched.add(id);
    setTouchedCustom(newTouched);

    setSplits((current) => {
      const total = Number(formData.amount);
      const touchedSum = current
        .filter((s) => s.address !== id && newTouched.has(s.address) && selectedParticipants.has(s.address))
        .reduce((sum, s) => sum + s.amount, 0);
      const remaining = total - amount - touchedSum;
      const untouched = current.filter(
        (s) => s.address !== id && !newTouched.has(s.address) && selectedParticipants.has(s.address)
      );
      const perUntouched = untouched.length > 0 ? Math.max(0, remaining / untouched.length) : 0;

      return current.map((split) => {
        if (split.address === id) return { ...split, amount };
        if (!selectedParticipants.has(split.address)) return { ...split, amount: 0 };
        if (newTouched.has(split.address)) return split;
        return { ...split, amount: perUntouched };
      });
    });
  };

  const updatePercentage = (id: string, percentage: number) => {
    const newTouched = new Set(touchedPercentage);
    newTouched.add(id);
    setTouchedPercentage(newTouched);

    setPercentages((current) => {
      const touchedSum = Object.entries(current)
        .filter(([k]) => k !== id && newTouched.has(k) && selectedParticipants.has(k))
        .reduce((sum, [, v]) => sum + v, 0);
      const remaining = 100 - percentage - touchedSum;
      const untouchedIds = Object.keys(current).filter(
        (k) => k !== id && !newTouched.has(k) && selectedParticipants.has(k)
      );
      const perUntouched = untouchedIds.length > 0 ? Math.max(0, remaining / untouchedIds.length) : 0;

      const updated: { [key: string]: number } = {};
      for (const k of Object.keys(current)) {
        if (k === id) updated[k] = percentage;
        else if (!selectedParticipants.has(k)) updated[k] = 0;
        else if (newTouched.has(k)) updated[k] = current[k];
        else updated[k] = perUntouched;
      }
      return updated;
    });

    setSplits((current) => {
      const touchedPctSum = [...newTouched]
        .filter((k) => k !== id && selectedParticipants.has(k))
        .reduce((sum, k) => sum + (percentages[k] ?? 0), 0);
      const remaining = 100 - percentage - touchedPctSum;
      const untouched = current.filter(
        (s) => s.address !== id && !newTouched.has(s.address) && selectedParticipants.has(s.address)
      );
      const perUntouched = untouched.length > 0 ? Math.max(0, remaining / untouched.length) : 0;
      const total = Number(formData.amount);

      return current.map((split) => {
        if (split.address === id) {
          return { ...split, amount: (total * percentage) / 100, percentage };
        }
        if (!selectedParticipants.has(split.address)) {
          return { ...split, amount: 0, percentage: 0 };
        }
        if (newTouched.has(split.address)) return split;
        return { ...split, amount: (total * perUntouched) / 100, percentage: perUntouched };
      });
    });
  };

  const calculateDebts = (splits: Split[], paidBy: string): Debt[] => {
    const debts: Debt[] = [];
    const payer = splits.find((s) => s.address === paidBy);

    if (!payer) return debts;

    splits.forEach((split) => {
      if (split.address !== paidBy && split.amount > 0) {
        debts.push({
          from: split.address,
          to: paidBy,
          amount: split.amount,
        });
      }
    });

    return debts;
  };

  const validateSplits = () => {
    const totalSplit = splits.reduce((sum, split) => sum + split.amount, 0);
    return Math.abs(totalSplit - Number(formData.amount)) < 0.01;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.amount ||
      !formData.currency ||
      !formData.paidBy ||
      !groupId ||
      !splits.length
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate split amounts
    if (!validateSplits()) {
      toast.error("Split amounts must equal the total amount");
      return;
    }

    // Ensure proper fields are included based on currency type
    if (
      formData.currencyType === "TOKEN" &&
      (!formData.chainId || !formData.tokenId)
    ) {
      toast.error("Please select both blockchain and token for token expenses");
      return;
    }

    const payload: ExpensePayload = {
      category: formData.categoryEmoji || formData.category || "OTHER",
      name: formData.name || "Expense",
      description: formData.description || "",
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      currencyType: formData.currencyType,
      timeLockIn: formData.timeLockIn,
      paidBy: formData.paidBy,
      splitType: formData.splitType === "custom" ? "EXACT" : formData.splitType.toUpperCase(),
      participants: splits
        .filter((split) => split.amount > 0)
        .map((split) => ({
          userId: split.address,
          amount: split.amount,
        })),
      groupId: groupId,
    };

    // Add optional fields based on currency type
    if (formData.currencyType === "TOKEN") {
      payload.chainId = formData.chainId;
      payload.tokenId = formData.tokenId;
    }

    expenseMutation.mutate(payload, {
      onSuccess: async (data: any) => {
        // If a resolver is selected, set accepted tokens for this expense
        if (resolver && data?.expense?.id) {
          if (!resolver.id || !resolver.chainId) {
            toast.error("Please select a valid token resolver (not fiat)");
            return;
          }
          try {
            await axios.put(
              `${API_URL}/api/expenses/${data.expense.id}/accepted-tokens`,
              {
                acceptedTokenIds: [resolver.id],
              },
              { withCredentials: true }
            );
          } catch (err) {
            toast.error("Failed to set accepted token for this expense");
          }
        }

        toast.success("Request sent");

        // refetch the specific group data
        queryClient.invalidateQueries({
          queryKey: [QueryKeys.GROUPS, groupId],
        });

        // refetch the general groups list and balances
        queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS] });
        queryClient.invalidateQueries({ queryKey: [QueryKeys.EXPENSES] });
        queryClient.invalidateQueries({ queryKey: [QueryKeys.BALANCES] });

        onClose();
      },
      onError: (error) => {
        toast.error(
          error.message || "Failed to send request. Please try again."
        );
        console.error("Error adding expense:", error);
      },
    });
  };

  useEffect(() => {
    if (formData.splitType !== "percentage") return;

    const allMemberIds = members.map((m) => m.id);
    const activeIds = allMemberIds.filter((id) => selectedParticipants.has(id));
    const equalPercentage = activeIds.length > 0 ? 100 / activeIds.length : 0;

    const initialPercentages = Object.fromEntries(
      allMemberIds.map((id) => [id, selectedParticipants.has(id) ? equalPercentage : 0])
    );
    setPercentages(initialPercentages);
  }, [members, formData.splitType, formData.paidBy, selectedParticipants]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Find user details for the paid by dropdown
  const getPaidByUserName = (userId: string) => {
    const member = members.find((m) => m.id === userId);
    return member?.name || "You";
  };

  // When currency is selected (step 1), sync currencyType, chainId, tokenId from API currency
  const handleCurrencySelect = (currencies: string[]) => {
    const currencyId = currencies[0] || "";
    const currency = allCurrencies?.currencies?.find((c) => c.id === currencyId);
    setFormData((prev) => {
      const next = { ...prev, currency: currencyId };
      if (currency) {
        next.currencyType = currency.type === "FIAT" ? "FIAT" : "TOKEN";
        if (next.currencyType === "TOKEN") {
          next.chainId = currency.chainId ?? undefined;
          next.tokenId = currency.id;
        } else {
          next.chainId = undefined;
          next.tokenId = undefined;
        }
      }
      return next;
    });
  };

  const isCrypto = formData.currencyType === "TOKEN";
  const isStablecoin = isCrypto && (() => {
    const id = formData.currency.toUpperCase();
    const symbol = getCurrencySymbol(formData.currency).toUpperCase();
    const STABLECOINS = ["USDC", "USDT", "DAI", "BUSD", "TUSD", "FRAX", "USDP", "GUSD", "LUSD", "USDD", "SUSD"];
    return STABLECOINS.some((s) => id.includes(s) || symbol.includes(s));
  })();
  const canProceedStep1 =
    formData.currency !== "" &&
    formData.amount !== "" &&
    Number(formData.amount) > 0 &&
    formData.paidBy !== "";
  const canProceedStep2 = validateSplits() && !(
    formData.splitType === "equal" &&
    (selectedParticipants.size === 0 ||
      (selectedParticipants.size === 1 && user?.id != null && selectedParticipants.has(user.id)))
  );
  const equalOnlySelf =
    formData.splitType === "equal" &&
    (selectedParticipants.size === 0 ||
      (selectedParticipants.size === 1 && user?.id != null && selectedParticipants.has(user.id)));
  const canSubmit = validateSplits() && !equalOnlySelf;

  // Only allow tokens (with chainId) as resolver
  const handleResolverChange = (option: Option | undefined) => {
    if (option && !option.chainId) {
      toast.error("Please select a blockchain token as resolver (not fiat)");
      setResolver(undefined);
      return;
    }
    setResolver(option);
  };

  const inp = {
    width: "100%",
    background: INSET,
    border: "1.5px solid rgba(255,255,255,0.09)",
    borderRadius: 14,
    padding: "12px 16px",
    color: "#fff",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  };
  const lbl = {
    color: T.label,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    marginBottom: 8,
    display: "block",
  };
  const StepBackBtn = ({ onClick }: { onClick: () => void }) => {
  return (
      <button
        type="button"
        onClick={onClick}
        style={{
          flex: 1,
          padding: 13,
          background: INSET,
          color: T.body,
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 14,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        ←
      </button>
    );
  };
  const PrimaryBtn = ({
    children,
    onClick,
    disabled = false,
    style = {},
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    style?: React.CSSProperties;
  }) => {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
          flex: 2,
          padding: 13,
          background: disabled ? INSET : A,
          color: disabled ? "#555" : "#0a0a0a",
          border: "none",
          borderRadius: 14,
          fontSize: 14,
          fontWeight: 800,
          cursor: disabled ? "default" : "pointer",
          fontFamily: "inherit",
          transition: "all 0.2s",
          ...style,
        }}
      >
        {children}
      </button>
    );
  };

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
            exit={{ opacity: 0 }}
          />
          <div
            className={
              isMobile
                ? "modal-as-sheet-wrapper fixed inset-x-0 bottom-0 z-10 w-full max-w-[430px] mx-auto"
                : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[460px] px-6"
            }
          >
            {isMobile && (
              <div className="flex justify-center flex-shrink-0" style={{ padding: "8px 0 4px" }}>
                <div style={{ width: 40, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.15)" }} />
              </div>
            )}
            <motion.div
              onClick={(e) => e.stopPropagation()}
              {...(isMobile ? { initial: { y: "100%" }, animate: { y: 0 }, transition: { type: "tween", duration: 0.32, ease: [0.34, 1.2, 0.64, 1] } } : scaleIn)}
              className={isMobile ? "modal-as-sheet-card px-5 sm:px-7 pt-0 pb-8" : ""}
              style={
                isMobile
                  ? undefined
                  : {
                      background: "linear-gradient(160deg, #141414 0%, #0f0f0f 100%)",
                      border: "1px solid rgba(255,255,255,0.09)",
                      borderRadius: 28,
                      width: "100%",
                      maxWidth: 460,
                      padding: "28px 28px 32px",
                      maxHeight: "90vh",
                      overflowY: "auto",
                      boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
                    }
              }
            >
        <div
          className={isMobile ? "modal-as-sheet-title-bar" : ""}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: isMobile ? 16 : 24,
            ...(isMobile && { paddingTop: 20 }),
          }}
        >
          <div>
            <p
              style={{
                color: "#fff",
                fontSize: isMobile ? 18 : 20,
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              Request money
            </p>
            <p style={{ color: T.mid, fontSize: 12, marginTop: 3 }}>{groupName}</p>
            <div style={{ display: "flex", gap: 5, marginTop: 12 }}>
              {[1, 2, 3].map((s) => (
              <div
                key={s}
                  style={{
                    height: 3,
                    width: 26,
                    borderRadius: 99,
                    background: step >= s ? A : "#2a2a2a",
                    transition: "background 0.3s",
                    boxShadow: step >= s ? `0 0 8px ${A}88` : "none",
                  }}
              />
            ))}
          </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: T.soft,
              width: 34,
              height: 34,
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Amount + Currency + Paid by */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                <label style={lbl}>Amount</label>
                <div
                  style={{
                    background: INSET,
                    border: "1.5px solid rgba(255,255,255,0.09)",
                    borderRadius: 14,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", padding: "14px 16px" }}>
                    <span
                      style={{
                        color: A,
                        fontSize: 20,
                        fontWeight: 800,
                        marginRight: 10,
                        flexShrink: 0,
                      }}
                    >
                      {getCurrencySymbol(formData.currency)}
                    </span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          amount: e.target.value,
                        }))
                      }
                      style={{
                        background: "none",
                        border: "none",
                        color: "#fff",
                        fontSize: 26,
                        fontWeight: 800,
                        outline: "none",
                        width: "100%",
                        fontFamily: "inherit",
                      }}
                      autoFocus
                    />
                  </div>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
                  <div style={{ padding: "4px 6px" }}>
                    <CurrencyDropdown
                      selectedCurrencies={
                        formData.currency ? [formData.currency] : []
                      }
                      setSelectedCurrencies={handleCurrencySelect}
                      showFiatCurrencies={true}
                      disableChainCurrencies={false}
                      mode="single"
                      placeholder="Select currency..."
                    />
                  </div>
                </div>
                </div>
                <div>
                <label style={lbl}>PAID BY</label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${Math.min(members.length, 4)}, 1fr)`,
                    gap: 8,
                  }}
                >
                  {members.map((member) => {
                    const init =
                      member.id === user?.id
                        ? "Y"
                        : (member.name || "?")
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase();
                    const isSelected = formData.paidBy === member.id;
                    const memberColor = getUserColor(member.id === user?.id ? (user?.name || member.name) : member.name);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, paidBy: member.id }))
                        }
                        style={{
                          padding: "10px 4px",
                          background: isSelected ? `${memberColor}12` : "rgba(255,255,255,0.04)",
                          border: isSelected
                            ? `2px solid ${memberColor}`
                            : BORDER,
                          borderRadius: 14,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                          transition: "all 0.2s",
                          boxShadow: isSelected ? `0 0 14px ${memberColor}44` : "none",
                        }}
                      >
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            background: isSelected ? memberColor : `${memberColor}1a`,
                            border: isSelected ? "none" : `2px solid ${memberColor}40`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 800,
                            color: isSelected ? "#0a0a0a" : memberColor,
                          }}
                        >
                          {init}
                        </div>
                        <span
                          style={{
                            color: isSelected ? memberColor : T.sub,
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {member.id === user?.id
                            ? "You"
                            : (member.name || "?").split(" ")[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                </div>
              <PrimaryBtn
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                style={{ flex: "none" }}
              >
                {canProceedStep1 ? "Continue →" : "Enter amount & select payer"}
              </PrimaryBtn>
            </div>
          )}

          {/* Step 2: Split method + participants (excluding payer) + Lock In */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={lbl}>SPLIT METHOD</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["equal", "custom", "percentage"] as const).map((type) => {
                    const sel = formData.splitType === type;
                    const label =
                      type === "equal"
                        ? "Equal"
                        : type === "custom"
                          ? "Custom"
                          : "Percentage";
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, splitType: type }))
                        }
                        style={{
                          flex: 1,
                          padding: "10px 4px",
                          background: sel ? `${A}14` : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${sel ? A + "44" : "rgba(255,255,255,0.08)"}`,
                          borderRadius: 14,
                          color: sel ? A : T.muted,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          fontFamily: "inherit",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={lbl}>Participants</label>
                <Card
                  style={{
                    padding: 0,
                    overflow: "hidden",
                    background: "linear-gradient(145deg, #111 0%, #0d0d0d 100%)",
                    border: BORDER,
                    boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  <div
                    style={{
                      maxHeight: 240,
                      overflowY: "auto",
                    }}
                  >
                    {members.map((member, index) => {
                        const split = splits.find((s) => s.address === member.id);
                        const amount = split?.amount || 0;
                        const percentage = percentages[member.id] ?? 0;
                        const isEqual = formData.splitType === "equal";
                        const init =
                          member.id === user?.id
                            ? "Y"
                            : (member.name || "?")
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase();
                        const participantColors = [P, G, O, "#F472B6", "#FBBF24", A];
                        const memberColor = participantColors[index % participantColors.length];
                        const displayName =
                          member.id === user?.id
                            ? "You"
                            : (() => {
                                const parts = (member.name || "?").trim().split(/\s+/);
                                if (parts.length >= 2) {
                                  return `${parts[0]} ${parts[1][0]}.`;
                                }
                                return parts[0] || "?";
                              })();
                        return (
                          <div
                            key={member.id}
                            onClick={() => toggleParticipant(member.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "14px 18px",
                              borderBottom: "1px solid rgba(255,255,255,0.06)",
                              gap: 12,
                              cursor: "pointer",
                              userSelect: "none",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                minWidth: 0,
                                flex: 1,
                                opacity: !selectedParticipants.has(member.id) ? 0.4 : 1,
                                transition: "opacity 0.2s",
                              }}
                            >
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleParticipant(member.id); }}
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 6,
                                  border: `2px solid ${selectedParticipants.has(member.id) ? A : "rgba(255,255,255,0.2)"}`,
                                  background: selectedParticipants.has(member.id) ? A : "transparent",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                  transition: "all 0.2s",
                                  padding: 0,
                                }}
                              >
                                {selectedParticipants.has(member.id) && (
                                  <span style={{ color: "#0a0a0a", fontSize: 13, fontWeight: 800, lineHeight: 1 }}>✓</span>
                                )}
                              </button>
                              <div
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: "50%",
                                  background: `${memberColor}1a`,
                                  border: `2px solid ${memberColor}33`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: memberColor,
                                  flexShrink: 0,
                                }}
                              >
                                {init}
                              </div>
                              <span
                                style={{
                                  color: T.bright,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {displayName}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                flexShrink: 0,
                              }}
                            >
                              {isEqual ? (
                                <span
                                  style={{
                                    color: T.body,
                                    fontSize: 14,
                                    fontWeight: 700,
                                    fontFamily: "monospace",
                                  }}
                                >
                                  {formatCurrency(amount, formData.currency)}
                                </span>
                              ) : formData.splitType === "percentage" ? (
                                <>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={percentage || ""}
                                    disabled={!selectedParticipants.has(member.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      const value = Number(e.target.value);
                                      if (value >= 0 && value <= 100) {
                                        updatePercentage(member.id, value);
                                      }
                                    }}
                                    style={{
                                      width: 52,
                                      padding: "6px 8px",
                                      background: "rgba(255,255,255,0.06)",
                                      border: BORDER,
                                      borderRadius: 8,
                                      color: "#fff",
                                      fontSize: 12,
                                      textAlign: "right",
                                      outline: "none",
                                      fontFamily: "inherit",
                                      opacity: selectedParticipants.has(member.id) ? 1 : 0.3,
                                    }}
                                  />
                                  <span style={{ color: T.sub, fontSize: 12, width: 16 }}>%</span>
                                </>
                              ) : (
                                <>
                                  <span
                                    style={{
                                      color: T.sub,
                                      fontSize: 12,
                                      marginRight: 2,
                                    }}
                                  >
                                    {getCurrencySymbol(formData.currency)}
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={amount || ""}
                                    disabled={!selectedParticipants.has(member.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) =>
                                      updateCustomSplit(
                                        member.id,
                                        Number(e.target.value)
                                      )
                                    }
                                    style={{
                                      width: 68,
                                      padding: "6px 8px",
                                      background: "rgba(255,255,255,0.06)",
                                      border: BORDER,
                                      borderRadius: 8,
                                      color: "#fff",
                                      fontSize: 13,
                                      fontWeight: 600,
                                      textAlign: "right",
                                      outline: "none",
                                      fontFamily: "inherit",
                                      opacity: selectedParticipants.has(member.id) ? 1 : 0.3,
                                    }}
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </Card>
              </div>
              {(formData.splitType === "custom" ||
                formData.splitType === "percentage") && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    gap: 8,
                  }}
                >
                  <span style={{ color: T.body, fontSize: 12, fontWeight: 600 }}>
                    Total split
                  </span>
                  <span
                    style={{
                      color: canSubmit ? A : "#ef4444",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {formatCurrency(
                      splits.reduce((sum, s) => sum + (s.amount || 0), 0),
                      formData.currency
                    )}{" "}
                    / {formatCurrency(Number(formData.amount), formData.currency)}
                    {formData.splitType === "percentage" &&
                      ` (${Object.values(percentages).reduce((a, b) => a + b, 0).toFixed(0)}%)`}
                  </span>
                </div>
              )}
              {isCrypto && !isStablecoin && (
                <div>
                  <TimeLockToggle
                    value={formData.timeLockIn}
                    onChange={(val) =>
                      setFormData((prev) => ({ ...prev, timeLockIn: val }))
                    }
                    label="Lock exchange rate (Fix the value at current exchange rate)"
                  />
                </div>
              )}
              {isCrypto && (
                <div>
                  <label style={lbl}>Settle in</label>
                  <ResolverSelector
                    value={resolver}
                    onChange={handleResolverChange}
                  />
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <StepBackBtn onClick={() => setStep(1)} />
                <PrimaryBtn
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                >
                  Continue →
                </PrimaryBtn>
                </div>
            </div>
            )}

          {/* Step 3: Description + Category + Submit */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                <label style={lbl}>Description</label>
                  <input
                  placeholder="e.g. Dinner, Hotel, Taxi…"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                  style={inp}
                  autoFocus
                  />
                </div>
                <div>
                <label style={lbl}>Category</label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: 8,
                  }}
                >
                  {CATEGORY_OPTIONS.map(({ emoji, api }) => {
                    const sel = formData.categoryEmoji === emoji;
                    return (
                      <button
                        key={emoji + api}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            category: api,
                            categoryEmoji: emoji,
                          }))
                        }
                        style={{
                          background: sel ? `${A}15` : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${sel ? A + "44" : "rgba(255,255,255,0.08)"}`,
                          borderRadius: 14,
                          padding: "12px 0",
                          fontSize: 20,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          boxShadow: sel ? `0 0 12px ${A}22` : "none",
                        }}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <StepBackBtn onClick={() => setStep(2)} />
                <button
                    type="submit"
                  disabled={!canSubmit || !formData.name.trim() || expenseMutation.isPending}
                  style={{
                    flex: 2,
                    padding: 13,
                    background:
                      !canSubmit || !formData.name.trim() || expenseMutation.isPending
                        ? INSET
                        : A,
                    color:
                      !canSubmit || !formData.name.trim() || expenseMutation.isPending ? "#555" : "#0a0a0a",
                    border: "none",
                    borderRadius: 14,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor:
                      canSubmit && formData.name.trim() && !expenseMutation.isPending
                        ? "pointer"
                        : "default",
                    fontFamily: "inherit",
                    transition: "all 0.2s",
                  }}
                >
                  {expenseMutation.isPending ? "Sending…" : !formData.name.trim() ? "Enter a description" : "Send request ✓"}
                </button>
              </div>
            </div>
          )}
          </form>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
