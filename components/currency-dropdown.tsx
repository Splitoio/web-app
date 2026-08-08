"use client";

import { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, Map } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOrganizedCurrencies } from "@/features/currencies/hooks/use-currencies";
import type { Currency } from "@/features/currencies/api/client";
import { A, G, P, T, INSET } from "@/lib/splito-design";
import { Icons } from "@/lib/splito-design";

// Flag emoji for fiat currencies: explicit map for codes that don't match country (e.g. EUR, CHF)
const FIAT_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  THB: "🇹🇭",
  INR: "🇮🇳",
  AUD: "🇦🇺",
  CAD: "🇨🇦",
  SGD: "🇸🇬",
  CHF: "🇨🇭",
  CNY: "🇨🇳",
  KRW: "🇰🇷",
  MXN: "🇲🇽",
  BRL: "🇧🇷",
  VND: "🇻🇳",
  HKD: "🇭🇰",
  NZD: "🇳🇿",
  ZAR: "🇿🇦",
  PHP: "🇵🇭",
  IDR: "🇮🇩",
  MYR: "🇲🇾",
  AED: "🇦🇪",
  SAR: "🇸🇦",
  EGP: "🇪🇬",
  NGN: "🇳🇬",
  PKR: "🇵🇰",
  BDT: "🇧🇩",
  TRY: "🇹🇷",
  RUB: "🇷🇺",
  PLN: "🇵🇱",
  CZK: "🇨🇿",
  HUF: "🇭🇺",
  RON: "🇷🇴",
  SEK: "🇸🇪",
  NOK: "🇳🇴",
  DKK: "🇩🇰",
  ILS: "🇮🇱",
  CLP: "🇨🇱",
  COP: "🇨🇴",
  PEN: "🇵🇪",
  ARS: "🇦🇷",
  UAH: "🇺🇦",
};

/** Convert ISO 3166-1 alpha-2 country code to flag emoji (e.g. VN -> 🇻🇳) */
function countryCodeToFlag(cc: string): string {
  if (!cc || cc.length !== 2) return "";
  const a = cc.toUpperCase().charCodeAt(0) - 65;
  const b = cc.toUpperCase().charCodeAt(1) - 65;
  if (a < 0 || a > 25 || b < 0 || b > 25) return "";
  return String.fromCodePoint(0x1f1e6 + a, 0x1f1e6 + b);
}

const getCurrencyFlag = (c: Currency): string => {
  if (c.type !== "FIAT") return "";
  const byId = FIAT_FLAGS[c.id] || FIAT_FLAGS[c.symbol];
  if (byId) return byId;
  // ISO 4217: many currency codes use first 2 letters as country code (e.g. VND -> VN)
  const id = (c.id || c.symbol || "").toUpperCase();
  if (id.length >= 2) return countryCodeToFlag(id.slice(0, 2)) || "💱";
  return "💱";
};

// Chain ID → display name and icon for section headers (Fiat, Aptos, Solana, Stellar, Base, etc.)
const CHAIN_DISPLAY: Record<string, { name: string; icon: string; color: string }> = {
  stellar: { name: "Stellar", icon: "✦", color: G },
  Stellar: { name: "Stellar", icon: "✦", color: G },
  solana: { name: "Solana", icon: "◎", color: P },
  Solana: { name: "Solana", icon: "◎", color: P },
  base: { name: "Base", icon: "🔵", color: "#3B82F6" },
  Base: { name: "Base", icon: "🔵", color: "#3B82F6" },
  aptos: { name: "Aptos", icon: "⬡", color: A },
  Aptos: { name: "Aptos", icon: "⬡", color: A },
  "8453": { name: "Base", icon: "🔵", color: "#3B82F6" },
};

const CHAIN_ORDER = ["Stellar", "Solana", "Base", "Aptos"];

function getChainDisplay(chainId: string): { name: string; icon: string; color: string } {
  const key = chainId.toString();
  return (
    CHAIN_DISPLAY[key] ||
    CHAIN_DISPLAY[key.toLowerCase()] || { name: chainId, icon: "◆", color: T.mid }
  );
}

const dropdownVariants = {
  hidden: {
    opacity: 0,
    y: -6,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.98,
  },
};

type Props = {
  selectedCurrencies: string[];
  setSelectedCurrencies: (currencies: string[]) => void;
  showFiatCurrencies?: boolean;
  filterCurrencies?: (currency: Currency) => boolean;
  mode?: "single" | "multi";
  placeholder?: string;
  disableChainCurrencies?: boolean;
  compact?: boolean;
  size?: "default" | "lg";
};

export default function CurrencyDropdown({
  selectedCurrencies,
  setSelectedCurrencies,
  showFiatCurrencies = true,
  filterCurrencies,
  mode = "multi",
  placeholder,
  disableChainCurrencies = false,
  compact = false,
  size = "default",
}: Props) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currencyTab, setCurrencyTab] = useState<"fiat" | "crypto">("fiat");
  const triggerRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (activeDropdown !== "currency") {
      setDropdownRect(null);
      setSearchQuery("");
      setCurrencyTab("fiat");
      return;
    }

    const updateRect = () => {
      if (!triggerRef.current) return;
      const el = triggerRef.current;
      const rect = el.getBoundingClientRect();
      const maxHeight = 320;
      setDropdownRect({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight: maxHeight,
      });
    };

    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [activeDropdown]);

  // Close on click outside
  useLayoutEffect(() => {
    if (activeDropdown !== "currency") return;
    const handleClick = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if ((e.target as Element).closest("[data-currency-dropdown-portal]")) return;
      setActiveDropdown(null);
    };
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [activeDropdown]);

  const { data: organizedCurrencies, isLoading: isLoadingCurrencies } =
    useOrganizedCurrencies();

  const fiatCurrencies = organizedCurrencies?.fiatCurrencies || [];
  const chainGroups = organizedCurrencies?.chainGroups || {};
  const chainCurrencies = Object.values(chainGroups).flat();

  // Apply filter if provided
  const filteredFiatCurrencies = filterCurrencies
    ? fiatCurrencies.filter(filterCurrencies)
    : fiatCurrencies;
  const filteredChainCurrencies = filterCurrencies
    ? chainCurrencies.filter(filterCurrencies)
    : chainCurrencies;

  const currencies = [...filteredChainCurrencies, ...filteredFiatCurrencies];

  // Build ordered list of chain IDs for section headers (Stellar, Solana, Aptos, Base, etc.)
  const orderedChainIds = (() => {
    const ids = Object.keys(chainGroups);
    const byName = (a: string, b: string) => {
      const nameA = getChainDisplay(a).name;
      const nameB = getChainDisplay(b).name;
      const iA = CHAIN_ORDER.indexOf(nameA);
      const iB = CHAIN_ORDER.indexOf(nameB);
      if (iA !== -1 && iB !== -1) return iA - iB;
      if (iA !== -1) return -1;
      if (iB !== -1) return 1;
      return nameA.localeCompare(nameB);
    };
    return ids.sort(byName);
  })();

  const toggleDropdown = (dropdown: string) => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  const toggleCurrencySelection = (currencyId: string) => {
    if (mode === "single") {
      setSelectedCurrencies([currencyId]);
      setActiveDropdown(null);
    } else {
      // Multi-select mode
      if (selectedCurrencies.includes(currencyId)) {
        setSelectedCurrencies(
          selectedCurrencies.filter((id) => id !== currencyId)
        );
      } else {
        setSelectedCurrencies([...selectedCurrencies, currencyId]);
      }
    }
  };

  const removeCurrency = (currencyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newCurrencies = selectedCurrencies.filter((id) => id !== currencyId);
    setSelectedCurrencies(newCurrencies);
  };

  const matchesSearch = (c: Currency, q: string) => {
    if (!q.trim()) return true;
    const lower = q.toLowerCase().trim();
    return [c.id, c.symbol, c.name].some(
      (s) => s && String(s).toLowerCase().includes(lower)
    );
  };

  const renderCurrencyRow = (
    currency: Currency,
    isFiat: boolean,
    isSelected: boolean
  ) => (
    <button
      key={currency.id}
      type="button"
      onClick={() => toggleCurrencySelection(currency.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: "pointer",
        background: isSelected ? "rgba(34,211,238,0.06)" : "transparent",
        width: "100%",
        textAlign: "left",
        fontFamily: "inherit",
        transition: "background 0.15s",
        border: "none",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ fontSize: 17, color: "#fff" }}>
        {isFiat ? getCurrencyFlag(currency) : "◆"}
      </span>
      <span
        style={{
          fontWeight: 700,
          fontSize: 13,
          color: isSelected ? "#fff" : T.body,
          minWidth: isFiat ? 36 : 44,
        }}
      >
        {isFiat ? currency.id : currency.symbol}
      </span>
      <span
        style={{
          color: T.sub,
          fontSize: 12,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {currency.name}
      </span>
      {currency.symbol && (
        <span style={{ color: T.sub, fontSize: 12, flexShrink: 0 }}>
          {currency.symbol}
        </span>
      )}
      {isSelected && (
        <span style={{ color: A, fontSize: 14, fontWeight: 700, flexShrink: 0 }}>✓</span>
      )}
    </button>
  );

  const renderCurrencyDropdown = () => {
    if (isLoadingCurrencies) {
      return (
        <div
          style={{
            padding: "16px 18px",
            color: T.muted,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Loader2
            style={{ width: 16, height: 16, flexShrink: 0 }}
            className="animate-spin"
          />
          <span>Loading currencies...</span>
        </div>
      );
    }

    const fiatList = filteredFiatCurrencies.filter((c) =>
      matchesSearch(c, searchQuery)
    );
    // Per-chain filtered lists for sectioned display
    const chainLists: { chainId: string; tokens: Currency[] }[] = orderedChainIds
      .map((chainId) => {
        const tokens = (chainGroups[chainId] || []).filter(
          (c) =>
            (filterCurrencies ? filterCurrencies(c) : true) &&
            matchesSearch(c, searchQuery)
        );
        return { chainId, tokens };
      })
      .filter((g) => g.tokens.length > 0);
    const cryptoList = filteredChainCurrencies.filter((c) =>
      matchesSearch(c, searchQuery)
    );

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxHeight: 280,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: T.muted, display: "flex" }}>
            <Icons.search />
          </span>
          <input
            type="text"
            autoFocus
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: 13,
              outline: "none",
              width: "100%",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Tabs: Fiat | Crypto */}
        {showFiatCurrencies && !disableChainCurrencies && (
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              padding: "0 4px",
            }}
          >
            <button
              type="button"
              onClick={() => setCurrencyTab("fiat")}
              style={{
                flex: 1,
                padding: "10px 12px",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${currencyTab === "fiat" ? A : "transparent"}`,
                color: currencyTab === "fiat" ? "#fff" : T.muted,
                fontSize: 13,
                fontWeight: currencyTab === "fiat" ? 700 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: 14 }}>💵</span>
              Fiat
            </button>
            <button
              type="button"
              onClick={() => setCurrencyTab("crypto")}
              style={{
                flex: 1,
                padding: "10px 12px",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${currencyTab === "crypto" ? A : "transparent"}`,
                color: currencyTab === "crypto" ? "#fff" : T.muted,
                fontSize: 13,
                fontWeight: currencyTab === "crypto" ? 700 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: 14 }}>🔗</span>
              Crypto
            </button>
          </div>
        )}

        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
          {showFiatCurrencies && !disableChainCurrencies ? (
            /* Tabs visible: show content by active tab */
            currencyTab === "fiat" ? (
              <>
                {fiatList.length > 0 ? (
                  fiatList.map((currency) =>
                    renderCurrencyRow(
                      currency,
                      true,
                      selectedCurrencies.includes(currency.id)
                    )
                  )
                ) : searchQuery.trim() ? (
                  <div style={{ padding: "12px 16px", color: T.sub, fontSize: 12 }}>
                    No matching fiat currencies
                  </div>
                ) : (
                  <div style={{ padding: "12px 16px", color: T.sub, fontSize: 12 }}>
                    No fiat currencies
                  </div>
                )}
              </>
            ) : (
              <>
                {chainLists.map(({ chainId, tokens }) => {
                  const { name: chainName, icon: chainIcon, color: chainColor } =
                    getChainDisplay(chainId);
                  return (
                    <div key={chainId}>
                      <div
                        style={{
                          padding: "10px 16px 4px",
                          color: T.dim,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span style={{ color: "#fff" }}>{chainIcon}</span>
                        {chainName}
                      </div>
                      {tokens.map((currency) =>
                        renderCurrencyRow(
                          currency,
                          false,
                          selectedCurrencies.includes(currency.id)
                        )
                      )}
                    </div>
                  );
                })}
                {chainLists.length === 0 && searchQuery.trim() && (
                  <div style={{ padding: "12px 16px", color: T.sub, fontSize: 12 }}>
                    No matching crypto
                  </div>
                )}
              </>
            )
          ) : (
            /* No tabs: single list (fiat-only or crypto-only) */
            <>
              {showFiatCurrencies && (
                <>
                  {fiatList.length > 0 ? (
                    fiatList.map((currency) =>
                      renderCurrencyRow(
                        currency,
                        true,
                        selectedCurrencies.includes(currency.id)
                      )
                    )
                  ) : searchQuery.trim() ? (
                    <div style={{ padding: "12px 16px", color: T.sub, fontSize: 12 }}>
                      No matching fiat currencies
                    </div>
                  ) : null}
                </>
              )}
              {!disableChainCurrencies && chainLists.map(({ chainId, tokens }) => {
                const { name: chainName, icon: chainIcon, color: chainColor } =
                  getChainDisplay(chainId);
                return (
                  <div key={chainId}>
                    <div
                      style={{
                        padding: "10px 16px 4px",
                        color: T.dim,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span style={{ color: "#fff" }}>{chainIcon}</span>
                      {chainName}
                    </div>
                    {tokens.map((currency) =>
                      renderCurrencyRow(
                        currency,
                        false,
                        selectedCurrencies.includes(currency.id)
                      )
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  };

  const defaultPlaceholder =
    mode === "single" ? "Select currency..." : "Select Payment Token...";

  const isOpen = activeDropdown === "currency";
  const selected =
    selectedCurrencies.length > 0
      ? currencies.find((c) => c.id === selectedCurrencies[0])
      : null;

  return (
    <div className="relative" ref={triggerRef} style={compact ? { flexShrink: 0 } : undefined}>
      <button
        type="button"
        onClick={() => toggleDropdown("currency")}
        style={compact ? {
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(255,255,255,0.08)",
          border: `1px solid ${isOpen ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 10,
          padding: "8px 10px",
          cursor: "pointer",
          transition: "all 0.2s",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
        } : {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: size === "lg" ? 46 : 40,
          background: size === "lg" ? INSET : "rgba(255,255,255,0.04)",
          border: `1px solid ${isOpen ? "rgba(255,255,255,0.3)" : (size === "lg" ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.1)")}`,
          borderRadius: size === "lg" ? 12 : 8,
          padding: size === "lg" ? "0 16px" : "0 12px",
          cursor: "pointer",
          transition: "all 0.2s",
          fontFamily: "inherit",
        }}
      >
        {compact ? (
          <>
            <span style={{ fontSize: 15 }} aria-hidden>
              {selected && selected.type === "FIAT" && getCurrencyFlag(selected)
                ? getCurrencyFlag(selected)
                : "💱"}
            </span>
            <span style={{ color: T.bright, fontSize: 14, fontWeight: 700 }}>
              {isLoadingCurrencies
                ? "…"
                : selected
                  ? selected.type === "FIAT" ? selected.id : selected.symbol
                  : placeholder || "Currency"}
            </span>
            <span style={{ color: T.muted, fontSize: 10, marginLeft: 2 }}>▾</span>
          </>
        ) : mode === "single" ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flex: 1,
              minWidth: 0,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize:
                  selected &&
                  selected.type === "FIAT" &&
                  getCurrencyFlag(selected)
                    ? 18
                    : undefined,
              }}
              aria-hidden
            >
              {selected &&
              selected.type === "FIAT" &&
              getCurrencyFlag(selected) ? (
                getCurrencyFlag(selected)
              ) : (
                <Map size={18} strokeWidth={1.8} style={{ color: T.muted }} />
              )}
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "left",
                flex: 1,
                minWidth: 0,
              }}
            >
              {isLoadingCurrencies ? (
                <span style={{ color: T.muted }}>Loading currencies...</span>
              ) : selected ? (
                <span style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ color: T.bright }}>
                    {selected.type === "FIAT" ? selected.id : selected.symbol}
                  </span>
                  <span style={{ color: T.muted, margin: "0 6px" }}>·</span>
                  <span style={{ color: T.muted }}>{selected.name}</span>
                </span>
              ) : (
                <span style={{ color: T.muted }}>
                  {placeholder || defaultPlaceholder}
                </span>
              )}
            </span>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              flex: 1,
              minWidth: 0,
            }}
          >
            {isLoadingCurrencies ? (
              <span style={{ color: T.muted, fontSize: 13 }}>
                Loading currencies...
              </span>
            ) : selectedCurrencies.length > 0 ? (
              selectedCurrencies.map((currencyId) => {
                const c = currencies.find((x) => x.id === currencyId);
                if (!c) return null;
                return (
                  <div
                    key={currencyId}
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      padding: "4px 8px 4px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 12,
                        color: "#fff",
                      }}
                    >
                      {c.type === "FIAT" ? c.id : c.symbol}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => removeCurrency(currencyId, e)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "rgba(255,255,255,0.7)",
                        cursor: "pointer",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })
            ) : (
              <span style={{ color: T.muted, fontSize: 13 }}>
                {placeholder || defaultPlaceholder}
              </span>
            )}
          </div>
        )}
        {!compact && (
          <span
            style={{
              color: T.muted,
              fontSize: 12,
              transition: "transform 0.2s",
              display: "inline-block",
              transform: isOpen ? "rotate(180deg)" : "none",
              marginLeft: 8,
              flexShrink: 0,
            }}
          >
            ▾
          </span>
        )}
      </button>

      {typeof document !== "undefined" &&
        activeDropdown === "currency" &&
        dropdownRect &&
        createPortal(
          <AnimatePresence>
            <motion.div
              data-currency-dropdown-portal
              variants={dropdownVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{
                position: "fixed",
                top: dropdownRect.top,
                left: dropdownRect.left,
                width: dropdownRect.width,
                maxHeight: dropdownRect.maxHeight,
                zIndex: 200,
                background: "#141414",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 18,
                overflow: "hidden",
                boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
              }}
            >
              {renderCurrencyDropdown()}
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
