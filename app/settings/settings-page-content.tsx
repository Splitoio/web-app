"use client";

import React from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { Currency } from "@/features/currencies/api/client";
import type { SettlementPreference } from "@/features/user/api/client";
import CurrencyDropdown from "@/components/currency-dropdown";
import { ChangePasswordModal } from "@/components/change-password-modal";
import type { User } from "@/api-helpers/modelSchema/UserSchema";
import { Card, Btn, T, Icons, A, getUserColor } from "@/lib/splito-design";
import {
  StellarWalletsKit,
  allowAllModules,
  XBULL_ID,
} from "@creit.tech/stellar-wallets-kit";
import { STELLAR_WALLET_NETWORK } from "@/lib/chain-network";

export interface SettingsPageContentProps {
  user: User;
  displayName: string;
  setDisplayName: (v: string) => void;
  preferredCurrency: string;
  setPreferredCurrency: (v: string) => void;
  onCurrencyChange?: (v: string) => void;
  hasChanges: boolean;
  handleSaveChanges: () => void;
  isUpdatatingUser: boolean;
  isUploadingImage: boolean;
  uploadProgress: number;
  uploadError: string;
  handleImageUpload: (file: File) => void;
  onLogout?: () => void;
  isLoggingOut?: boolean;
  // NOTE: there is deliberately no stat row here. The old "Groups / Friends /
  // Settled" counters were the visual centrepiece of this screen and framed the
  // product as bill-splitting. There is no requests-created/paid/received
  // endpoint yet, so rather than invent numbers the row is simply gone; add it
  // back only when a real requests summary exists to populate it.
  settlementPrefs: SettlementPreference[];
  isLoadingPref: boolean;
  isSavingPref: boolean;
  isRemovingPref: boolean;
  isUpdatingWallet: boolean;
  onSaveSettlementPref: (data: { tokenIds: string[]; chainId: string; walletAddress: string }, onSuccess?: () => void) => void;
  onRemoveSettlementPref: (chainId: string) => void;
  onUpdateSettlementWallet: (walletAddress: string, chainId: string, onSuccess?: () => void) => void;
  allCurrencies: Currency[];
  currencyDisplay: "both" | "real" | "converted";
  onCurrencyDisplayChange: (mode: "both" | "real" | "converted") => void;
}

const CURRENCY_FLAG: Record<string, string> = {
  USD: "\u{1F1FA}\u{1F1F8}", EUR: "\u{1F1EA}\u{1F1FA}", GBP: "\u{1F1EC}\u{1F1E7}", JPY: "\u{1F1EF}\u{1F1F5}",
  INR: "\u{1F1EE}\u{1F1F3}", CNY: "\u{1F1E8}\u{1F1F3}", AUD: "\u{1F1E6}\u{1F1FA}", CAD: "\u{1F1E8}\u{1F1E6}", CHF: "\u{1F1E8}\u{1F1ED}",
};

const CHAIN_META: Record<string, { color: string; icon: string; label: string }> = {
  stellar:  { color: "#34D399", icon: "\u2726",     label: "Stellar" },
  solana:   { color: "#A78BFA", icon: "\u25CE",     label: "Solana" },
  base:     { color: "#3B82F6", icon: "\u{1F535}",  label: "Base" },
};

function getChainMeta(chainId: string) {
  return CHAIN_META[chainId] || CHAIN_META[chainId.toLowerCase()] || { color: "#666", icon: "\u25C6", label: chainId };
}

// ─── Shared primitives ───────────────────────────────────────────────────────

function Row({ children, style = {}, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div role={onClick ? "button" : undefined} onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "17px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", ...style }}>
      {children}
    </div>
  );
}

function SLabel({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ color: T.soft, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14, marginTop: 28, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)", ...style }}>{children}</div>;
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div onClick={onChange} role="switch" aria-checked={on} style={{ width: 50, height: 30, borderRadius: 99, background: on ? A : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "all 0.25s", flexShrink: 0 }}>
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: on ? 23 : 3, transition: "left 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
    </div>
  );
}

const CURRENCY_DISPLAY_OPTS: Array<{ id: "both" | "real" | "converted"; label: string }> = [
  { id: "real", label: "Original" },
  { id: "converted", label: "My currency" },
  { id: "both", label: "Both" },
];

function Segmented({ value, onChange, fullWidth = false }: { value: "both" | "real" | "converted"; onChange: (v: "both" | "real" | "converted") => void; fullWidth?: boolean }) {
  return (
    <div style={{ display: "inline-flex", width: fullWidth ? "100%" : undefined, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 3, gap: 2 }}>
      {CURRENCY_DISPLAY_OPTS.map((opt) => {
        const sel = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              flex: fullWidth ? 1 : undefined,
              padding: "7px 14px", borderRadius: 9, border: "none",
              background: sel ? A : "transparent",
              color: sel ? "#0a0a0a" : T.body,
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function MobileCard({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden", ...style }}>{children}</div>;
}

function MobileRow({ children, last = false, onClick }: { children: React.ReactNode; last?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} role={onClick ? "button" : undefined} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.06)", cursor: onClick ? "pointer" : undefined }}>
      {children}
    </div>
  );
}

function MSLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "#666", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, marginTop: 28 }}>{children}</p>;
}

function AvatarUpload({ id, size, isUploadingImage, uploadProgress, uploadError, handleImageUpload, userColor, userInitial, userImage }: {
  id: string; size: number; isUploadingImage: boolean; uploadProgress: number; uploadError: string; handleImageUpload: (file: File) => void; userColor: string; userInitial: string; userImage?: string | null;
}) {
  return (
    <div style={{ position: "relative" }}>
      <label htmlFor={id} style={{ cursor: isUploadingImage ? "not-allowed" : "pointer", display: "block" }}>
        <div style={{ width: size, height: size, borderRadius: "50%", background: `${userColor}1a`, border: `2.5px solid ${userColor}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 800, color: userColor, overflow: "hidden" }}>
          {userImage ? <Image src={userImage} alt="Profile" width={size} height={size} className="h-full w-full object-cover" /> : <span>{userInitial}</span>}
        </div>
        {isUploadingImage && (
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.7)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <Loader2 className="h-5 w-5 animate-spin text-white" /><span style={{ fontSize: 10, color: "#fff" }}>{uploadProgress}%</span>
          </div>
        )}
        <button type="button" style={{ position: "absolute", bottom: 0, right: 0, width: size * 0.3, height: size * 0.3, borderRadius: "50%", background: "#1e1e1e", border: "2px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", cursor: isUploadingImage ? "not-allowed" : "pointer", color: T.body }} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.click(); }}>
          {Icons.camera({ size: Math.round(size * 0.15) })}
        </button>
        <input id={id} type="file" accept="image/png, image/jpeg" className="hidden" disabled={isUploadingImage} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file); }} />
      </label>
      {uploadError && <p style={{ fontSize: 11, color: "#F87171", marginTop: 4, textAlign: "center" }}>{uploadError}</p>}
    </div>
  );
}

// ─── Settlement Preference Display ───────────────────────────────────────────

function SettlementPrefItem({ pref, isRemoving, onEdit, onEditWallet, onRemove, isLast }: {
  pref: SettlementPreference; isRemoving: boolean; onEdit: () => void; onEditWallet: () => void; onRemove: () => void; isLast: boolean;
}) {
  const meta = getChainMeta(pref.chainId);
  const tokenSymbols = pref.tokens.map((t) => t.token.symbol).join(", ");
  const addr = pref.wallet?.address || "";
  const truncated = addr.length > 16 ? `${addr.slice(0, 8)}\u2026${addr.slice(-6)}` : addr;

  return (
    <Row style={{ borderBottom: isLast ? "none" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${meta.color}18`, border: `1.5px solid ${meta.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, color: "#fff" }}>{meta.icon}</div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.bright }}>{tokenSymbols} <span style={{ color: T.muted, fontWeight: 500, fontSize: 13 }}>on {pref.chain.name}</span></p>
          {pref.wallet && <p style={{ fontSize: 11, color: T.muted, fontFamily: "monospace", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={addr}>{truncated}</p>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
        <button onClick={onEditWallet} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 10, padding: "7px 14px", color: T.body, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Edit Wallet</button>
        <button onClick={onEdit} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 10, padding: "7px 14px", color: T.body, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Change</button>
        <button onClick={onRemove} disabled={isRemoving} style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 10, padding: "7px 10px", color: "#F87171", fontSize: 11, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center" }}>{Icons.trash({})}</button>
      </div>
    </Row>
  );
}

function SettlementPrefDisplay({ prefs, isLoading, isRemoving, onEdit, onEditWallet, onRemove, onAdd }: {
  prefs: SettlementPreference[]; isLoading: boolean; isRemoving: boolean;
  onEdit: (chainId: string) => void; onEditWallet: (chainId: string) => void; onRemove: (chainId: string) => void; onAdd: () => void;
}) {
  if (isLoading) return <Row style={{ borderBottom: "none", justifyContent: "center" }}><Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} /></Row>;

  if (prefs.length === 0) {
    return (
      <Row style={{ borderBottom: "none", cursor: "pointer" }} onClick={onAdd}>
        <p style={{ color: T.muted, fontSize: 13 }}>No payout wallet set yet.</p>
        <span style={{ color: A, fontSize: 13, fontWeight: 700 }}>+ Add</span>
      </Row>
    );
  }

  return (
    <>
      {prefs.map((pref, i) => (
        <SettlementPrefItem
          key={pref.chainId}
          pref={pref}
          isRemoving={isRemoving}
          onEdit={() => onEdit(pref.chainId)}
          onEditWallet={() => onEditWallet(pref.chainId)}
          onRemove={() => onRemove(pref.chainId)}
          isLast={i === prefs.length - 1 && prefs.length >= 4}
        />
      ))}
      {prefs.length < 4 && (
        <Row style={{ borderBottom: "none", cursor: "pointer" }} onClick={onAdd}>
          <p style={{ color: T.muted, fontSize: 13 }}>Add another chain</p>
          <span style={{ color: A, fontSize: 13, fontWeight: 700 }}>+ Add</span>
        </Row>
      )}
    </>
  );
}

// ─── Settlement Preference Modal ─────────────────────────────────────────────

function SettlementPrefModal({ isOpen, onClose, onSave, isSaving, allCurrencies, initialChainId, initialTokenIds, initialWalletAddress, mode, onUpdateWallet, isUpdatingWallet, existingChainIds = [] }: {
  isOpen: boolean; onClose: () => void;
  onSave: (data: { tokenIds: string[]; chainId: string; walletAddress: string }) => void;
  isSaving: boolean; allCurrencies: Currency[];
  initialChainId?: string; initialTokenIds?: string[]; initialWalletAddress?: string;
  mode: "add" | "edit-wallet";
  onUpdateWallet: (walletAddress: string) => void; isUpdatingWallet: boolean;
  existingChainIds?: string[];
}) {
  const [selectedChainId, setSelectedChainId] = React.useState<string>("");
  const [selectedTokenIds, setSelectedTokenIds] = React.useState<Set<string>>(new Set());
  const [walletAddress, setWalletAddress] = React.useState("");
  const [isConnecting, setIsConnecting] = React.useState(false);
  const walletKitRef = React.useRef<StellarWalletsKit | null>(null);

  // Derive unique chains from crypto currencies
  const cryptoTokens = allCurrencies.filter((c) => c.type !== "FIAT" && c.chainId);
  const chainIds = [...new Set(cryptoTokens.map((c) => c.chainId!))];

  const meta = getChainMeta(selectedChainId);

  // Init StellarWalletsKit once
  React.useEffect(() => {
    if (!walletKitRef.current) {
      walletKitRef.current = new StellarWalletsKit({
        // Driven by NEXT_PUBLIC_CHAIN_NETWORK, mirroring the backend's CHAIN_NETWORK.
        network: STELLAR_WALLET_NETWORK,
        selectedWalletId: XBULL_ID,
        modules: allowAllModules(),
      });
    }
    return () => { walletKitRef.current = null; };
  }, []);

  // Reset state on open
  React.useEffect(() => {
    if (isOpen) {
      if (mode === "edit-wallet") {
        setWalletAddress(initialWalletAddress || "");
        setSelectedChainId(initialChainId || "");
      } else {
        const availableChain = initialChainId || chainIds.find((c) => !existingChainIds.includes(c)) || chainIds[0] || "";
        setSelectedChainId(availableChain);
        const chainTokens = cryptoTokens.filter((c) => c.chainId === availableChain);
        if (initialTokenIds?.length) {
          setSelectedTokenIds(new Set(initialTokenIds));
        } else {
          setSelectedTokenIds(new Set(chainTokens.map((c) => c.id)));
        }
        setWalletAddress(initialWalletAddress || "");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // When chain changes (not on initial load), pre-select all tokens for the new chain
  const handleChainChange = (chainId: string) => {
    setSelectedChainId(chainId);
    const chainTokens = cryptoTokens.filter((c) => c.chainId === chainId);
    setSelectedTokenIds(new Set(chainTokens.map((c) => c.id)));
    setWalletAddress("");
  };

  const handleConnectStellar = async () => {
    if (isConnecting || !walletKitRef.current) return;
    setIsConnecting(true);
    try {
      await walletKitRef.current.openModal({
        onWalletSelected: async (sel) => {
          if (!sel || !walletKitRef.current) { setIsConnecting(false); return; }
          walletKitRef.current.setWallet(sel.id);
          const resp = await walletKitRef.current.getAddress();
          const pk = typeof resp === "object" && resp !== null ? resp.address : resp;
          if (pk && typeof pk === "string") {
            setWalletAddress(pk);
            toast.success("Stellar wallet connected");
          }
          setIsConnecting(false);
        },
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect Stellar wallet");
      setIsConnecting(false);
    }
  };

  const handleConnectSolana = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const phantom = (window as unknown as Record<string, unknown>).phantom as Record<string, unknown> | undefined;
      const provider = phantom?.solana as { isPhantom?: boolean; connect: () => Promise<{ publicKey: { toString: () => string } }> } | undefined;
      if (!provider?.isPhantom) {
        toast.error("Phantom wallet not found. Install it from phantom.app");
        setIsConnecting(false);
        return;
      }
      const resp = await provider.connect();
      const addr = resp.publicKey.toString();
      if (addr) { setWalletAddress(addr); toast.success("Solana wallet connected"); }
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect Solana wallet");
    } finally { setIsConnecting(false); }
  };

  const handleConnectBase = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const eth = (window as unknown as Record<string, unknown>).ethereum as { request: (args: { method: string }) => Promise<string[]> } | undefined;
      if (!eth) {
        toast.error("No EVM wallet found. Install MetaMask or Coinbase Wallet.");
        setIsConnecting(false);
        return;
      }
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (accounts?.[0]) { setWalletAddress(accounts[0]); toast.success("Base wallet connected"); }
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect wallet");
    } finally { setIsConnecting(false); }
  };

  const canSave = mode === "edit-wallet"
    ? walletAddress.trim().length > 0
    : selectedChainId && selectedTokenIds.size > 0 && walletAddress.trim().length > 0;

  const handleSave = () => {
    if (mode === "edit-wallet") { onUpdateWallet(walletAddress.trim()); }
    else { onSave({ tokenIds: [...selectedTokenIds], chainId: selectedChainId, walletAddress: walletAddress.trim() }); }
  };

  const isWorking = mode === "edit-wallet" ? isUpdatingWallet : isSaving;
  const connectSupported = ["stellar", "solana", "base"].includes(selectedChainId);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-lg rounded-[28px] p-7 shadow-2xl z-10"
            style={{ background: "linear-gradient(160deg, #141414 0%, #0f0f0f 100%)", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 40px 100px rgba(0,0,0,0.8)", maxHeight: "90vh", overflowY: "auto" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <p style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
                {mode === "edit-wallet" ? "Edit Wallet" : "Where you get paid"}
              </p>
              <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#bbb", width: 34, height: 34, borderRadius: "50%", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>&times;</button>
            </div>
            <p style={{ color: T.muted, fontSize: 13, marginBottom: 22, lineHeight: 1.5 }}>
              {mode === "edit-wallet"
                ? "Update the wallet address where you\u2019ll receive payments."
                : "Choose a chain, the assets you’ll accept, and the wallet address your requests get paid into."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* ── CHAIN SELECTOR ── */}
              {mode !== "edit-wallet" && (
                <div>
                  <label style={{ color: "#ccc", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10, display: "block" }}>Chain</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {chainIds.map((cid) => {
                      const m = getChainMeta(cid);
                      const sel = selectedChainId === cid;
                      const alreadyUsed = existingChainIds.includes(cid) && cid !== initialChainId;
                      return (
                        <button key={cid} onClick={() => !alreadyUsed && handleChainChange(cid)} disabled={alreadyUsed} style={{
                          padding: "12px 6px", background: sel ? `${m.color}18` : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${sel ? `${m.color}55` : "rgba(255,255,255,0.08)"}`,
                          borderRadius: 16, cursor: alreadyUsed ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                          transition: "all 0.2s", fontFamily: "inherit", boxShadow: sel ? `0 0 16px ${m.color}22` : "none",
                          opacity: alreadyUsed ? 0.35 : 1,
                        }}>
                          <span style={{ fontSize: 20, color: "#fff" }}>{m.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: sel ? m.color : "#999" }}>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── TOKEN MULTI-SELECT DROPDOWN ── */}
              {mode !== "edit-wallet" && selectedChainId && (
                <div>
                  <label style={{ color: "#ccc", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10, display: "block" }}>
                    Currencies on {meta.label}
                  </label>
                  <CurrencyDropdown
                    selectedCurrencies={[...selectedTokenIds]}
                    setSelectedCurrencies={(ids) => setSelectedTokenIds(new Set(ids))}
                    mode="multi"
                    showFiatCurrencies={false}
                    filterCurrencies={(c: Currency) => c.chainId === selectedChainId}
                  />
                </div>
              )}

              {/* ── WALLET ADDRESS (input with inline connect button) ── */}
              {(mode === "edit-wallet" || selectedChainId) && (
                <div>
                  <label style={{ color: "#ccc", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10, display: "block" }}>
                    Wallet Address <span style={{ color: "#F87171" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)}
                      style={{
                        width: "100%", background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.09)",
                        borderRadius: 14, padding: connectSupported ? "14px 140px 14px 16px" : "14px 16px",
                        color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit",
                      }}
                      placeholder={`Enter ${meta.label} wallet address`}
                      autoFocus={mode === "edit-wallet"}
                    />
                    {connectSupported && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedChainId === "stellar") handleConnectStellar();
                          else if (selectedChainId === "solana") handleConnectSolana();
                          else if (selectedChainId === "base") handleConnectBase();
                        }}
                        disabled={isConnecting}
                        style={{
                          position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                          background: A, border: "none", borderRadius: 10, padding: "8px 14px",
                          color: "#0a0a0a", fontSize: 12, fontWeight: 800, cursor: isConnecting ? "default" : "pointer",
                          fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
                          whiteSpace: "nowrap", transition: "all 0.2s",
                        }}
                      >
                        {isConnecting ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" />Connecting</>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"/></svg>
                            Connect
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 7, alignItems: "center", paddingLeft: 2 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.dim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <p style={{ color: T.muted, fontSize: 11, lineHeight: 1.4 }}>Settlements owed to you will be sent to this wallet in the selected currencies.</p>
              </div>

              {/* Save */}
              <button onClick={handleSave} disabled={!canSave || isWorking} style={{
                width: "100%", padding: "15px",
                background: canSave && !isWorking ? A : "rgba(255,255,255,0.05)",
                color: canSave && !isWorking ? "#0a0a0a" : "#555",
                border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800,
                cursor: canSave && !isWorking ? "pointer" : "default",
                fontFamily: "inherit", transition: "all 0.2s",
              }}>
                {isWorking ? "Saving..." : mode === "edit-wallet" ? "Update Wallet" : "Save Preference"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Mobile Settlement Pref Display ──────────────────────────────────────────

function MobileSettlementPrefItem({ pref, isLast, onEdit, onEditWallet, onRemove }: {
  pref: SettlementPreference; isLast: boolean; onEdit: () => void; onEditWallet: () => void; onRemove: () => void;
}) {
  const meta = getChainMeta(pref.chainId);
  const tokenSymbols = pref.tokens.map((t) => t.token.symbol).join(", ");
  const addr = pref.wallet?.address || "";
  const truncated = addr.length > 14 ? `${addr.slice(0, 6)}\u2026${addr.slice(-4)}` : addr;

  return (
    <>
      <MobileRow>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${meta.color}18`, border: `1.5px solid ${meta.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, color: "#fff" }}>{meta.icon}</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{tokenSymbols} <span style={{ color: T.muted, fontWeight: 500, fontSize: 12 }}>on {pref.chain.name}</span></p>
            {pref.wallet && <p style={{ fontSize: 11, color: T.muted, fontFamily: "monospace", marginTop: 2 }}>{truncated}</p>}
          </div>
        </div>
        <span style={{ color: T.dim, fontSize: 18 }}>&rsaquo;</span>
      </MobileRow>
      <MobileRow last={isLast}>
        <div style={{ display: "flex", gap: 8, width: "100%" }}>
          <button onClick={onEditWallet} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 10, padding: "10px", color: T.body, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Edit Wallet</button>
          <button onClick={onEdit} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 10, padding: "10px", color: T.body, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Change</button>
          <button onClick={onRemove} style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 10, padding: "10px 14px", color: "#F87171", fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center" }}>{Icons.trash({})}</button>
        </div>
      </MobileRow>
    </>
  );
}

function MobileSettlementPref({ prefs, isLoading, onEdit, onEditWallet, onRemove, onAdd }: {
  prefs: SettlementPreference[]; isLoading: boolean;
  onEdit: (chainId: string) => void; onEditWallet: (chainId: string) => void; onRemove: (chainId: string) => void; onAdd: () => void;
}) {
  if (isLoading) return <MobileRow last><div style={{ display: "flex", justifyContent: "center", width: "100%" }}><Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} /></div></MobileRow>;

  if (prefs.length === 0) {
    return (
      <MobileRow last onClick={onAdd}>
        <p style={{ color: T.muted, fontSize: 13 }}>No payout wallet set yet.</p>
        <span style={{ color: A, fontSize: 13, fontWeight: 700 }}>+ Add</span>
      </MobileRow>
    );
  }

  return (
    <>
      {prefs.map((pref, i) => (
        <MobileSettlementPrefItem
          key={pref.chainId}
          pref={pref}
          isLast={i === prefs.length - 1 && prefs.length >= 4}
          onEdit={() => onEdit(pref.chainId)}
          onEditWallet={() => onEditWallet(pref.chainId)}
          onRemove={() => onRemove(pref.chainId)}
        />
      ))}
      {prefs.length < 4 && (
        <MobileRow last onClick={onAdd}>
          <p style={{ color: T.muted, fontSize: 13 }}>Add another chain</p>
          <span style={{ color: A, fontSize: 13, fontWeight: 700 }}>+ Add</span>
        </MobileRow>
      )}
    </>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function SettingsPageContent(props: SettingsPageContentProps) {
  const {
    user, displayName, setDisplayName, preferredCurrency, setPreferredCurrency,
    onCurrencyChange, hasChanges: _hasChanges, handleSaveChanges, isUpdatatingUser,
    isUploadingImage, uploadProgress, uploadError, handleImageUpload,
    onLogout, isLoggingOut = false,
    settlementPrefs, isLoadingPref, isSavingPref, isRemovingPref, isUpdatingWallet,
    onSaveSettlementPref, onRemoveSettlementPref, onUpdateSettlementWallet,
    allCurrencies,
    currencyDisplay, onCurrencyDisplayChange,
  } = props;

  const [notificationsOn, setNotificationsOn] = React.useState(true);
  const [editingProfile, setEditingProfile] = React.useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false);
  const [prefModalOpen, setPrefModalOpen] = React.useState(false);
  const [prefModalMode, setPrefModalMode] = React.useState<"add" | "edit-wallet">("add");
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = React.useState(false);
  const [activeChainId, setActiveChainId] = React.useState<string | null>(null);

  const activePref = activeChainId ? settlementPrefs.find((p) => p.chainId === activeChainId) : null;

  const userEmail = user?.email ?? "";
  const userInitial = (displayName || user?.name || "Y").charAt(0).toUpperCase();
  const userColor = getUserColor(user?.name || "You");
  const currencyFlag = CURRENCY_FLAG[preferredCurrency] ?? "\u{1F4B1}";

  const openPrefModalForChain = (mode: "add" | "edit-wallet", chainId?: string) => {
    setActiveChainId(chainId ?? null);
    setPrefModalMode(mode);
    setPrefModalOpen(true);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      {/* Sticky header */}
      <div className="hidden sm:block" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", position: "sticky", top: 0, background: "rgba(11,11,11,0.95)", backdropFilter: "blur(20px)", zIndex: 40 }}>
        <div className="flex items-center" style={{ padding: "0 28px", height: 70 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>Settings</h1>
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="sm:hidden flex-1 overflow-y-auto px-4 pb-10">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 28, paddingBottom: 24 }}>
          <AvatarUpload id="profile-upload-mobile" size={90} isUploadingImage={isUploadingImage} uploadProgress={uploadProgress} uploadError={uploadError} handleImageUpload={handleImageUpload} userColor={userColor} userInitial={userInitial} userImage={user.image} />
          <p style={{ color: "#fff", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 16, marginBottom: 3 }}>{displayName || "You"}</p>
          <p style={{ color: T.muted, fontSize: 14, fontWeight: 500, marginBottom: 18 }}>{userEmail || "you@email.com"}</p>
          {editingProfile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 260, marginBottom: 4 }}>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 12, padding: "11px 14px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit", width: "100%", fontWeight: 500 }} />
              <button onClick={() => { handleSaveChanges(); setEditingProfile(false); }} disabled={isUpdatatingUser} style={{ background: A, border: "none", borderRadius: 12, padding: "12px", color: "#0a0a0a", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{isUpdatatingUser ? "Saving\u2026" : "Save"}</button>
              <button onClick={() => setEditingProfile(false)} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setEditingProfile(true)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "10px 25px", color: "#fff", fontWeight: 500, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Edit Profile</button>
          )}
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginTop: 4, marginBottom: 4 }} />

        <MSLabel>Preferences</MSLabel>
        <MobileCard>
          <MobileRow>
            <div><p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Notifications</p><p style={{ fontSize: 13, color: T.muted, marginTop: 2, fontWeight: 500 }}>Email &amp; push reminders</p></div>
            <Toggle on={notificationsOn} onChange={() => setNotificationsOn((p) => !p)} />
          </MobileRow>
          <MobileRow>
            <div><p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Default Currency</p><p style={{ fontSize: 13, color: T.muted, marginTop: 2, fontWeight: 500 }}>{preferredCurrency || "USD"}</p></div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.muted }}><span style={{ fontSize: 20 }}>{currencyFlag}</span><span style={{ fontSize: 16 }}>&rsaquo;</span></div>
          </MobileRow>
          <MobileRow>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Show amounts in</p>
              <p style={{ fontSize: 13, color: T.muted, marginTop: 2, fontWeight: 500 }}>When a request was made in a currency you don’t hold</p>
              <div style={{ marginTop: 12 }}>
                <Segmented value={currencyDisplay} onChange={onCurrencyDisplayChange} fullWidth />
              </div>
            </div>
          </MobileRow>
          <MobileRow last>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Language</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.muted }}><span style={{ fontSize: 14, fontWeight: 500 }}>English</span><span style={{ fontSize: 16 }}>&rsaquo;</span></div>
          </MobileRow>
        </MobileCard>

        <MSLabel>Where you get paid</MSLabel>
        <MobileCard>
          <MobileSettlementPref
            prefs={settlementPrefs}
            isLoading={isLoadingPref}
            onEdit={(chainId) => openPrefModalForChain("add", chainId)}
            onEditWallet={(chainId) => openPrefModalForChain("edit-wallet", chainId)}
            onRemove={(chainId) => { setActiveChainId(chainId); setIsRemoveConfirmOpen(true); }}
            onAdd={() => openPrefModalForChain("add")}
          />
        </MobileCard>

        <MSLabel>Security</MSLabel>
        <MobileCard>
          <MobileRow last onClick={() => setIsChangePasswordOpen(true)}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Change Password</p>
            <span style={{ color: T.muted, fontSize: 18 }}>&rsaquo;</span>
          </MobileRow>
        </MobileCard>

        <button type="button" onClick={() => !isLoggingOut && onLogout?.()} disabled={isLoggingOut} style={{ width: "100%", marginTop: 24, padding: "18px", borderRadius: 20, background: "rgba(200,40,40,0.15)", border: "1px solid rgba(248,113,113,0.2)", color: "#F87171", fontSize: 17, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", opacity: isLoggingOut ? 0.7 : 1 }}>Sign Out</button>
        <div style={{ height: 40 }} />
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden sm:block flex-1 overflow-y-auto px-7 pt-6 pb-10" style={{ maxWidth: 660 }}>
        <SLabel>Profile</SLabel>
        <Card style={{ padding: "22px", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22, paddingBottom: 22, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <AvatarUpload id="profile-upload" size={64} isUploadingImage={isUploadingImage} uploadProgress={uploadProgress} uploadError={uploadError} handleImageUpload={handleImageUpload} userColor={userColor} userInitial={userInitial} userImage={user.image} />
            <div>
              <p style={{ color: T.bright, fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em" }}>{displayName || "You"}</p>
              <p style={{ color: T.muted, fontSize: 12, fontWeight: 500, marginTop: 2 }}>{userEmail || "you@email.com"}</p>
            </div>
          </div>
          <Row><span style={{ color: T.body, fontSize: 14, fontWeight: 600 }}>Display Name</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit", width: 220, fontWeight: 500 }} /></Row>
          <Row style={{ borderBottom: "none" }}><span style={{ color: T.body, fontSize: 14, fontWeight: 600 }}>Email</span><input value={userEmail} onChange={() => {}} style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit", width: 220, fontWeight: 500 }} /></Row>
          <div style={{ paddingTop: 18, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleSaveChanges} disabled={isUpdatatingUser} style={{ background: A, border: "none", borderRadius: 12, padding: "10px 22px", color: "#0a0a0a", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Save Changes</button>
          </div>
        </Card>

        <SLabel>Preferences</SLabel>
        <Card style={{ padding: "0 22px" }}>
          <Row><div><p style={{ color: T.bright, fontSize: 14, fontWeight: 600 }}>Notifications</p><p style={{ color: T.muted, fontSize: 12, marginTop: 2, fontWeight: 500 }}>Email reminders and updates</p></div><Toggle on={notificationsOn} onChange={() => setNotificationsOn((p) => !p)} /></Row>
          <Row style={{ alignItems: "center" }}>
            <p style={{ color: T.bright, fontSize: 14, fontWeight: 600 }}>Default Currency</p>
            <div style={{ minWidth: 220 }}>
              <CurrencyDropdown selectedCurrencies={preferredCurrency ? [preferredCurrency] : []} setSelectedCurrencies={(currencies) => { const c = currencies[0] || ""; setPreferredCurrency(c); onCurrencyChange?.(c); }} mode="single" showFiatCurrencies={true} filterCurrencies={(currency: Currency) => currency.symbol !== "ETH" && currency.symbol !== "USDC"} disableChainCurrencies={true} />
            </div>
          </Row>
          <Row style={{ borderBottom: "none", alignItems: "center" }}>
            <div>
              <p style={{ color: T.bright, fontSize: 14, fontWeight: 600 }}>Show amounts in</p>
              <p style={{ color: T.muted, fontSize: 12, marginTop: 2, fontWeight: 500 }}>When a request was made in a currency you don’t hold</p>
            </div>
            <Segmented value={currencyDisplay} onChange={onCurrencyDisplayChange} />
          </Row>
        </Card>

        <SLabel>Where you get paid</SLabel>
        <Card style={{ padding: "0 22px" }}>
          <SettlementPrefDisplay
            prefs={settlementPrefs}
            isLoading={isLoadingPref}
            isRemoving={isRemovingPref}
            onEdit={(chainId) => openPrefModalForChain("add", chainId)}
            onEditWallet={(chainId) => openPrefModalForChain("edit-wallet", chainId)}
            onRemove={(chainId) => { setActiveChainId(chainId); setIsRemoveConfirmOpen(true); }}
            onAdd={() => openPrefModalForChain("add")}
          />
        </Card>

        <SLabel>Security</SLabel>
        <Card style={{ padding: "0 22px" }}>
          <Row style={{ borderBottom: "none", cursor: "pointer" }} onClick={() => setIsChangePasswordOpen(true)}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ color: T.body, display: "flex" }}>{Icons.shield({})}</span><p style={{ color: T.bright, fontSize: 14, fontWeight: 600 }}>Change Password</p></div>
            <span style={{ color: T.dim, display: "flex" }}>{Icons.chevR({})}</span>
          </Row>
        </Card>

        <SLabel>Account</SLabel>
        <Card style={{ padding: "0 22px" }}>
          <Row style={{ borderBottom: "none", cursor: onLogout && !isLoggingOut ? "pointer" : undefined, opacity: isLoggingOut ? 0.7 : 1 }} onClick={() => !isLoggingOut && onLogout?.()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ color: "#F87171", display: "flex" }}>{Icons.logout({})}</span><p style={{ color: "#F87171", fontSize: 14, fontWeight: 700 }}>Sign Out</p></div>
            <span style={{ color: T.dim, display: "flex" }}>{Icons.chevR({})}</span>
          </Row>
        </Card>
        <div style={{ height: 40 }} />
      </div>

      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />

      <SettlementPrefModal
        isOpen={prefModalOpen}
        onClose={() => setPrefModalOpen(false)}
        onSave={(data) => { onSaveSettlementPref(data, () => setPrefModalOpen(false)); }}
        isSaving={isSavingPref}
        allCurrencies={allCurrencies}
        initialChainId={activePref?.chainId}
        initialTokenIds={activePref?.tokens.map((t) => t.tokenId)}
        initialWalletAddress={activePref?.wallet?.address}
        mode={prefModalMode}
        onUpdateWallet={(addr) => { if (activePref) onUpdateSettlementWallet(addr, activePref.chainId, () => setPrefModalOpen(false)); }}
        isUpdatingWallet={isUpdatingWallet}
        existingChainIds={settlementPrefs.map((p) => p.chainId)}
      />

      <AnimatePresence>
        {isRemoveConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsRemoveConfirmOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="relative w-full max-w-md rounded-2xl shadow-2xl"
              style={{ background: "linear-gradient(145deg, #111 0%, #0d0d0d 100%)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "#F87171", display: "flex" }}>{Icons.trash({ size: 18 })}</span>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Remove Preference</h2>
                </div>
                <button type="button" onClick={() => setIsRemoveConfirmOpen(false)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.muted }}>✕</button>
              </div>
              <div style={{ padding: "16px 24px 24px" }}>
                <p style={{ color: T.body, fontSize: 14, lineHeight: 1.6 }}>You won&apos;t be able to receive crypto settlements until you set a new preference.</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                  <Btn variant="ghost" onClick={() => setIsRemoveConfirmOpen(false)}>Cancel</Btn>
                  <Btn variant="danger" onClick={() => { if (activeChainId) onRemoveSettlementPref(activeChainId); setIsRemoveConfirmOpen(false); }} style={{ opacity: isRemovingPref ? 0.7 : 1 }}>
                    {isRemovingPref ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Removing…</span></> : <span>Remove</span>}
                  </Btn>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
