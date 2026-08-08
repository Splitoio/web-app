"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { Currency } from "@/features/currencies/api/client";
import type { SettlementPreference } from "@/features/user/api/client";
import type { GroupAcceptedToken } from "@/features/groups/api/client";
import CurrencyDropdown from "@/components/currency-dropdown";
import { ChangePasswordModal } from "@/components/change-password-modal";
import type { User } from "@/api-helpers/modelSchema/UserSchema";
import type { Workspace } from "@/lib/workspace";
import {
  A, G, R, P, T, Icons, Btn, Toggle, Mono, Eyebrow, AvatarChip,
  getUserColor, card, pill, fmt, SURFACE, BORDER, INSET,
} from "@/lib/splito-design";
import { signOut } from "@/lib/auth";
import { useAuthStore } from "@/stores/authStore";
import {
  useUpdateUser,
  useGetSettlementPreference,
  useSaveSettlementPreference,
  useRemoveSettlementPreference,
  useUpdateSettlementWallet,
} from "@/features/user/hooks/use-update-profile";
import { useCurrencyDisplayStore } from "@/stores/currencyDisplayStore";
import { useGetAllCurrencies } from "@/features/currencies/hooks/use-currencies";
import {
  useUserWallets, useAvailableChains, useAddWallet, useRemoveWallet, useSetWalletAsPrimary,
} from "@/features/wallets/hooks/use-wallets";
import { useActiveWorkspace, useWorkspaces, useSetActiveWorkspace } from "@/contexts/workspace";
import {
  useGetGroupById, useUpdateGroup, useDeleteGroup,
  useGetGroupAcceptedTokens, useAddGroupAcceptedToken, useRemoveGroupAcceptedToken,
} from "@/features/groups/hooks/use-create-group";
import { useReminders } from "@/features/reminders/hooks/use-reminders";
import { QueryKeys } from "@/lib/constants";
import {
  StellarWalletsKit,
  allowAllModules,
  XBULL_ID,
} from "@creit.tech/stellar-wallets-kit";
import { STELLAR_WALLET_NETWORK } from "@/lib/chain-network";

export interface SettingsPageContentProps {
  /** Server-gated in page.tsx; only used to seed state before the store hydrates. */
  user: User;
}

type CurrencyDisplay = "both" | "real" | "converted";

// ─── Chain metadata (settlement rows + wallets share the same palette) ───────

const CHAIN_META: Record<string, { color: string; icon: string; label: string }> = {
  stellar: { color: G, icon: "✦", label: "Stellar" },
  solana: { color: P, icon: "◎", label: "Solana" },
  base: { color: "#3B82F6", icon: "\u{1F535}", label: "Base" },
};

function getChainMeta(chainId: string) {
  return CHAIN_META[chainId] || CHAIN_META[chainId.toLowerCase()] || { color: "#666", icon: "◆", label: chainId };
}

function truncateAddr(addr: string, front = 8, back = 6) {
  if (!addr) return "";
  return addr.length > front + back + 1 ? `${addr.slice(0, front)}…${addr.slice(-back)}` : addr;
}

// ─── Shared primitives ───────────────────────────────────────────────────────

function Row({ children, last = false, style = {} }: { children: React.ReactNode; last?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 13, padding: "14px 0", borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.05)", ...style }}>
      {children}
    </div>
  );
}

function Intro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{ margin: "0 0 3px", fontSize: 16, fontWeight: 800, color: "#fff" }}>{title}</p>
      <p style={{ margin: 0, fontSize: 12.5, color: T.sub }}>{subtitle}</p>
    </div>
  );
}

function FieldBox({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div style={{ borderRadius: 13, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.03)", padding: "12px 15px", fontSize: 14, color: muted ? T.sub : T.main, marginBottom: 18 }}>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", boxSizing: "border-box", borderRadius: 13, border: "1px solid rgba(255,255,255,0.09)",
        background: "rgba(255,255,255,0.03)", padding: "12px 15px", fontSize: 14, color: "#e8e8e8",
        outline: "none", fontFamily: "inherit", marginBottom: 18,
      }}
    />
  );
}

function Segmented<Id extends string>({ options, value, onChange }: { options: { id: Id; label: string }[]; value: Id; onChange: (v: Id) => void }) {
  return (
    <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 11, background: INSET, width: "fit-content" }}>
      {options.map((o) => {
        const sel = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={sel}
            onClick={() => onChange(o.id)}
            style={{ border: "none", margin: 0, fontFamily: "inherit", padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: sel ? A : "transparent", color: sel ? "#0a0a0a" : T.body, transition: "all .15s" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Divider({ mb = 20 }: { mb?: number }) {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: mb }} />;
}

function ToggleRow({ title, desc, on, onChange, disabled }: { title: string; desc?: string; on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.bright }}>{title}</p>
        {desc && <p style={{ margin: "5px 0 0", fontSize: 12, lineHeight: 1.55, color: T.sub, maxWidth: 420 }}>{desc}</p>}
      </div>
      <Toggle on={on} onChange={onChange} disabled={disabled} label={title} />
    </div>
  );
}

/** Un-buttons a <button> back down to plain inline text so it can carry the
 * design's small text-link affordances (Remove, Change, + Add, …) while
 * staying a real, keyboard-operable control. */
function textBtn(style: React.CSSProperties = {}): React.CSSProperties {
  return { background: "none", border: "none", padding: 0, margin: 0, fontFamily: "inherit", cursor: "pointer", ...style };
}

/** Shared visual for the ghost "ready to click" affordance — used on both a
 * real <button> (GhostButton) and, where the destination is a route rather
 * than an action, directly on a <Link> so we never nest a button inside an
 * anchor (invalid HTML, confuses keyboard/screen-reader focus). */
function ghostButtonStyle(style: React.CSSProperties = {}): React.CSSProperties {
  return {
    display: "block", width: "100%", boxSizing: "border-box", borderRadius: 12, padding: 11,
    textAlign: "center", fontSize: 13, fontWeight: 700, cursor: "pointer", background: INSET,
    color: T.body, border: "1px solid rgba(255,255,255,0.1)", transition: "all .2s", fontFamily: "inherit",
    textDecoration: "none", margin: 0, ...style,
  };
}

function GhostButton({ children, onClick, style = {} }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
  return (
    <button type="button" className="abtn" onClick={onClick} style={ghostButtonStyle(style)}>
      {children}
    </button>
  );
}

function DangerButton({ children, onClick, disabled = false }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="abtn"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "block", width: "100%", boxSizing: "border-box", borderRadius: 12, padding: 11, textAlign: "center",
        fontSize: 13, fontWeight: 700, cursor: disabled ? "default" : "pointer", background: "rgba(248,113,113,0.07)",
        color: R, border: "1px solid rgba(248,113,113,0.2)", transition: "all .2s", opacity: disabled ? 0.6 : 1, fontFamily: "inherit", margin: 0,
      }}
    >
      {children}
    </button>
  );
}

function ConfirmDialog({ open, title, body, confirmLabel = "Confirm", danger = true, working = false, onConfirm, onCancel }: {
  open: boolean; title: string; body: string; confirmLabel?: string; danger?: boolean; working?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}
            className="relative w-full max-w-md rounded-2xl shadow-2xl"
            style={{ background: SURFACE, border: BORDER, boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {danger && <span style={{ color: R, display: "flex" }}>{Icons.trash({ size: 18 })}</span>}
                <h2 style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>{title}</h2>
              </div>
              <button type="button" onClick={onCancel} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.muted }}>&times;</button>
            </div>
            <div style={{ padding: "16px 24px 24px" }}>
              <p style={{ color: T.body, fontSize: 14, lineHeight: 1.6 }}>{body}</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
                <Btn variant={danger ? "danger" : "primary"} onClick={onConfirm} style={{ opacity: working ? 0.7 : 1 }}>
                  {working ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Working…</span></> : <span>{confirmLabel}</span>}
                </Btn>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
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
      {uploadError && <p style={{ fontSize: 11, color: R, marginTop: 4, textAlign: "center" }}>{uploadError}</p>}
    </div>
  );
}

// ─── Rail ─────────────────────────────────────────────────────────────────────

const ACCOUNT_SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "display", label: "Display & currency" },
  { id: "wallets", label: "Wallets" },
  { id: "settlement", label: "Settlement" },
  { id: "reminders", label: "Reminders" },
  { id: "security", label: "Security" },
] as const;

const WORKSPACE_SECTIONS = [
  { id: "ws-general", label: "General" },
  { id: "ws-tokens", label: "Accepted tokens" },
  { id: "ws-approvals", label: "Approvals" },
  { id: "ws-members", label: "Members" },
] as const;

type SectionId = (typeof ACCOUNT_SECTIONS)[number]["id"] | (typeof WORKSPACE_SECTIONS)[number]["id"];

function RailGroup({ label, items, sec, setSec }: { label: string; items: readonly { id: SectionId; label: string }[]; sec: SectionId; setSec: (id: SectionId) => void }) {
  return (
    <div>
      <p style={{ margin: "0 0 6px", padding: "0 12px", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: T.faded, whiteSpace: "nowrap" }}>{label}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }} aria-label={label}>
        {items.map((i) => {
          const active = sec === i.id;
          return (
            <button
              key={i.id}
              type="button"
              aria-current={active ? "true" : undefined}
              className="nv"
              onClick={() => setSec(i.id)}
              style={{
                width: "100%", display: "block", textAlign: "left", border: "none", margin: 0,
                fontFamily: "inherit", padding: "8px 12px", borderRadius: 11, fontSize: 13, cursor: "pointer",
                transition: "all .2s", background: active ? "rgba(255,255,255,0.07)" : "transparent",
                color: active ? "#fff" : T.dim, fontWeight: active ? 700 : 500, whiteSpace: "nowrap",
              }}
            >
              {i.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Account: Profile ─────────────────────────────────────────────────────────

function ProfileSection({ user, displayName, setDisplayName, hasNameChange, isSavingName, onSaveName, preferredCurrency, onCurrencyChange, isUploadingImage, uploadProgress, uploadError, onImageUpload }: {
  user: User; displayName: string; setDisplayName: (v: string) => void; hasNameChange: boolean; isSavingName: boolean; onSaveName: () => void;
  preferredCurrency: string; onCurrencyChange: (v: string) => void;
  isUploadingImage: boolean; uploadProgress: number; uploadError: string; onImageUpload: (file: File) => void;
}) {
  const userColor = getUserColor(displayName || user.name || "You");
  const userInitial = (displayName || user.name || "Y").charAt(0).toUpperCase();
  return (
    <div>
      <Intro title="Profile" subtitle="Applies to every workspace you're in." />
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <AvatarUpload id="settings-avatar" size={56} isUploadingImage={isUploadingImage} uploadProgress={uploadProgress} uploadError={uploadError} handleImageUpload={onImageUpload} userColor={userColor} userInitial={userInitial} userImage={user.image} />
        <label htmlFor="settings-avatar" className="abtn" style={{ borderRadius: 11, padding: "9px 15px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: INSET, color: T.body, border: "1px solid rgba(255,255,255,0.1)", transition: "all .2s" }}>
          Upload photo
        </label>
      </div>

      <Eyebrow style={{ marginBottom: 8 }}>Display name</Eyebrow>
      <TextInput value={displayName} onChange={setDisplayName} placeholder="Your name" />

      <Eyebrow style={{ marginBottom: 8 }}>Email</Eyebrow>
      <FieldBox muted>{user.email || "—"}</FieldBox>

      <Eyebrow style={{ marginBottom: 8 }}>Preferred currency</Eyebrow>
      <CurrencyDropdown
        selectedCurrencies={preferredCurrency ? [preferredCurrency] : []}
        setSelectedCurrencies={(currencies) => onCurrencyChange(currencies[0] || "")}
        mode="single"
        showFiatCurrencies
        filterCurrencies={(c: Currency) => c.symbol !== "ETH" && c.symbol !== "USDC"}
        disableChainCurrencies
      />

      {hasNameChange && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
          <Btn variant="primary" onClick={onSaveName} disabled={isSavingName}>{isSavingName ? "Saving…" : "Save changes"}</Btn>
        </div>
      )}
    </div>
  );
}

// ─── Account: Display & currency ──────────────────────────────────────────────

function DisplaySection({ currencyDisplay, onCurrencyDisplayChange, lockIn, onToggleLockIn, isSavingLockIn }: {
  currencyDisplay: CurrencyDisplay; onCurrencyDisplayChange: (v: CurrencyDisplay) => void;
  lockIn: boolean; onToggleLockIn: () => void; isSavingLockIn: boolean;
}) {
  return (
    <div>
      <Intro title="Display & currency" subtitle="How amounts read, and who carries the price move." />
      <Eyebrow style={{ marginBottom: 8 }}>Show amounts as</Eyebrow>
      <Segmented<CurrencyDisplay>
        options={[{ id: "real", label: "Original" }, { id: "converted", label: "My currency" }, { id: "both", label: "Both" }]}
        value={currencyDisplay}
        onChange={onCurrencyDisplayChange}
      />
      <p style={{ margin: "8px 0 24px", fontSize: 12, color: T.dim }}>
        Both shows <Mono style={{ color: T.soft }}>$60.00 · 60.00 USDC</Mono> everywhere.
      </p>
      <Divider mb={22} />
      <ToggleRow
        title="Lock the rate by default"
        desc="New requests start with the exchange rate locked in, so a payer's move in the market doesn't change what you're owed."
        on={lockIn}
        onChange={onToggleLockIn}
        disabled={isSavingLockIn}
      />
    </div>
  );
}

// ─── Account: Wallets ──────────────────────────────────────────────────────────

interface WalletRow { id: string; chainId: string; address: string; isDefault: boolean; chain?: { name: string } }

function WalletsSection({ wallets, isLoading, chains, onSetDefault, isSettingDefault, onRemove, isRemoving, onAdd, isAdding }: {
  wallets: WalletRow[]; isLoading: boolean; chains: { id: string; name: string; enabled: boolean }[];
  onSetDefault: (chainId: string, address: string) => void; isSettingDefault: boolean;
  onRemove: (id: string) => void; isRemoving: boolean;
  onAdd: (data: { chainId: string; address: string }, onDone: () => void) => void; isAdding: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [chainId, setChainId] = useState("");
  const [address, setAddress] = useState("");
  const enabledChains = chains.filter((c) => c.enabled);

  return (
    <div>
      <Intro title="Wallets" subtitle="Where settled money lands. One default per chain." />
      {isLoading ? (
        <div style={{ padding: "20px 0", display: "flex", justifyContent: "center" }}><Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} /></div>
      ) : wallets.length === 0 ? (
        <p style={{ fontSize: 13, color: T.muted, padding: "8px 0 4px" }}>No wallets linked yet.</p>
      ) : (
        wallets.map((w, i) => {
          const meta = getChainMeta(w.chainId);
          return (
            <Row key={w.id} last={i === wallets.length - 1 && !adding}>
              <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0, flex: 1 }}>
                <AvatarChip init={(w.chain?.name || w.chainId).slice(0, 2).toUpperCase()} color={meta.color} size={36} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.bright }}>{w.chain?.name || meta.label}</p>
                  <Mono style={{ display: "block", marginTop: 2, fontSize: 11.5, color: T.sub }}>{truncateAddr(w.address)}</Mono>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                {w.isDefault ? (
                  <span style={pill(A)}>Default</span>
                ) : (
                  <button type="button" onClick={() => onSetDefault(w.chainId, w.address)} disabled={isSettingDefault} style={textBtn({ fontSize: 12, fontWeight: 700, color: A })}>Set default</button>
                )}
                <button type="button" onClick={() => onRemove(w.id)} disabled={isRemoving} style={textBtn({ fontSize: 12, fontWeight: 600, color: T.dim })}>Remove</button>
              </div>
            </Row>
          );
        })
      )}

      {adding ? (
        <div style={{ marginTop: 18, padding: 16, borderRadius: 14, border: BORDER, background: "rgba(255,255,255,0.02)" }}>
          <Eyebrow style={{ marginBottom: 8 }}>Chain</Eyebrow>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {enabledChains.map((c) => {
              const sel = chainId === c.id;
              return (
                <button key={c.id} type="button" aria-pressed={sel} onClick={() => setChainId(c.id)} style={{ fontFamily: "inherit", margin: 0, padding: "7px 13px", borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: "pointer", background: sel ? `${A}1a` : INSET, border: `1px solid ${sel ? `${A}55` : "rgba(255,255,255,0.09)"}`, color: sel ? A : T.body }}>
                  {c.name}
                </button>
              );
            })}
          </div>
          <Eyebrow style={{ marginBottom: 8 }}>Address</Eyebrow>
          <TextInput value={address} onChange={setAddress} placeholder="Wallet address" />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => { setAdding(false); setAddress(""); setChainId(""); }}>Cancel</Btn>
            <Btn
              variant="primary"
              disabled={!chainId || !address.trim() || isAdding}
              onClick={() => onAdd({ chainId, address: address.trim() }, () => { setAdding(false); setAddress(""); setChainId(""); })}
            >
              {isAdding ? "Adding…" : "Add wallet"}
            </Btn>
          </div>
        </div>
      ) : (
        <GhostButton onClick={() => setAdding(true)} style={{ marginTop: 18 }}>Connect a wallet</GhostButton>
      )}
    </div>
  );
}

// ─── Account: Settlement ───────────────────────────────────────────────────────

function SettlementPrefItem({ pref, isRemoving, onEdit, onEditWallet, onRemove, last }: {
  pref: SettlementPreference; isRemoving: boolean; onEdit: () => void; onEditWallet: () => void; onRemove: () => void; last: boolean;
}) {
  const meta = getChainMeta(pref.chainId);
  const tokenSymbols = pref.tokens.map((t) => t.token.symbol).join(", ");
  const addr = pref.wallet?.address || "";

  return (
    <Row last={last}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${meta.color}18`, border: `1.5px solid ${meta.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, color: "#fff" }}>{meta.icon}</div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.bright }}>{tokenSymbols} <span style={{ color: T.muted, fontWeight: 500, fontSize: 13 }}>on {pref.chain.name}</span></p>
          {addr && (
            <span title={addr} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <Mono style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{truncateAddr(addr)}</Mono>
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
        <button onClick={onEditWallet} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 10, padding: "7px 14px", color: T.body, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Edit wallet</button>
        <button onClick={onEdit} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 10, padding: "7px 14px", color: T.body, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Change</button>
        <button onClick={onRemove} disabled={isRemoving} style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 10, padding: "7px 10px", color: R, fontSize: 11, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center" }}>{Icons.trash({})}</button>
      </div>
    </Row>
  );
}

function SettlementSection({ prefs, isLoading, isRemoving, onEdit, onEditWallet, onRemove, onAdd, showInheritNote }: {
  prefs: SettlementPreference[]; isLoading: boolean; isRemoving: boolean;
  onEdit: (chainId: string) => void; onEditWallet: (chainId: string) => void; onRemove: (chainId: string) => void; onAdd: () => void;
  showInheritNote: boolean;
}) {
  return (
    <div>
      <Intro title="Settlement" subtitle="What you accept, and what every new request defaults to." />
      {isLoading ? (
        <div style={{ padding: "20px 0", display: "flex", justifyContent: "center" }}><Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} /></div>
      ) : prefs.length === 0 ? (
        <Row last>
          <p style={{ color: T.muted, fontSize: 13 }}>No settlement preference set yet.</p>
          <button type="button" onClick={onAdd} style={textBtn({ color: A, fontSize: 13, fontWeight: 700 })}>+ Add</button>
        </Row>
      ) : (
        <>
          {prefs.map((pref, i) => (
            <SettlementPrefItem
              key={pref.chainId}
              pref={pref}
              isRemoving={isRemoving}
              onEdit={() => onEdit(pref.chainId)}
              onEditWallet={() => onEditWallet(pref.chainId)}
              onRemove={() => onRemove(pref.chainId)}
              last={i === prefs.length - 1 && prefs.length >= 4}
            />
          ))}
          {prefs.length < 4 && (
            <Row last>
              <p style={{ color: T.muted, fontSize: 13 }}>Add another chain</p>
              <button type="button" onClick={onAdd} style={textBtn({ color: A, fontSize: 13, fontWeight: 700 })}>+ Add</button>
            </Row>
          )}
        </>
      )}

      {showInheritNote && prefs.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", marginTop: 18 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: A }}>Every workspace inherits this</p>
            <p style={{ margin: "3px 0 0", fontSize: 11.5, lineHeight: 1.5, color: T.muted }}>Business workspaces use your account default unless they override it.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settlement preference modal (add / edit-wallet) ──────────────────────────

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

  const cryptoTokens = allCurrencies.filter((c) => c.type !== "FIAT" && c.chainId);
  const chainIds = [...new Set(cryptoTokens.map((c) => c.chainId!))];
  const meta = getChainMeta(selectedChainId);

  React.useEffect(() => {
    if (!walletKitRef.current) {
      walletKitRef.current = new StellarWalletsKit({
        network: STELLAR_WALLET_NETWORK,
        selectedWalletId: XBULL_ID,
        modules: allowAllModules(),
      });
    }
    return () => { walletKitRef.current = null; };
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      if (mode === "edit-wallet") {
        setWalletAddress(initialWalletAddress || "");
        setSelectedChainId(initialChainId || "");
      } else {
        const availableChain = initialChainId || chainIds.find((c) => !existingChainIds.includes(c)) || chainIds[0] || "";
        setSelectedChainId(availableChain);
        const chainTokens = cryptoTokens.filter((c) => c.chainId === availableChain);
        if (initialTokenIds?.length) setSelectedTokenIds(new Set(initialTokenIds));
        else setSelectedTokenIds(new Set(chainTokens.map((c) => c.id)));
        setWalletAddress(initialWalletAddress || "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
          if (pk && typeof pk === "string") { setWalletAddress(pk); toast.success("Stellar wallet connected"); }
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
      if (!provider?.isPhantom) { toast.error("Phantom wallet not found. Install it from phantom.app"); setIsConnecting(false); return; }
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
      if (!eth) { toast.error("No EVM wallet found. Install MetaMask or Coinbase Wallet."); setIsConnecting(false); return; }
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (accounts?.[0]) { setWalletAddress(accounts[0]); toast.success("Base wallet connected"); }
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect wallet");
    } finally { setIsConnecting(false); }
  };

  const canSave = mode === "edit-wallet" ? walletAddress.trim().length > 0 : selectedChainId && selectedTokenIds.size > 0 && walletAddress.trim().length > 0;
  const handleSave = () => {
    if (mode === "edit-wallet") onUpdateWallet(walletAddress.trim());
    else onSave({ tokenIds: [...selectedTokenIds], chainId: selectedChainId, walletAddress: walletAddress.trim() });
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
            <div className="flex items-center justify-between mb-2">
              <p style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>{mode === "edit-wallet" ? "Edit wallet" : "Where you get paid"}</p>
              <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#bbb", width: 34, height: 34, borderRadius: "50%", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>&times;</button>
            </div>
            <p style={{ color: T.muted, fontSize: 13, marginBottom: 22, lineHeight: 1.5 }}>
              {mode === "edit-wallet" ? "Update the wallet address where you’ll receive payments." : "Choose a chain, the assets you’ll accept, and the wallet address your requests get paid into."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
                          transition: "all 0.2s", fontFamily: "inherit", boxShadow: sel ? `0 0 16px ${m.color}22` : "none", opacity: alreadyUsed ? 0.35 : 1,
                        }}>
                          <span style={{ fontSize: 20, color: "#fff" }}>{m.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: sel ? m.color : "#999" }}>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {mode !== "edit-wallet" && selectedChainId && (
                <div>
                  <label style={{ color: "#ccc", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10, display: "block" }}>Currencies on {meta.label}</label>
                  <CurrencyDropdown
                    selectedCurrencies={[...selectedTokenIds]}
                    setSelectedCurrencies={(ids) => setSelectedTokenIds(new Set(ids))}
                    mode="multi"
                    showFiatCurrencies={false}
                    filterCurrencies={(c: Currency) => c.chainId === selectedChainId}
                  />
                </div>
              )}

              {(mode === "edit-wallet" || selectedChainId) && (
                <div>
                  <label style={{ color: "#ccc", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10, display: "block" }}>
                    Wallet address <span style={{ color: R }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)}
                      style={{ width: "100%", background: INSET, border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: connectSupported ? "14px 140px 14px 16px" : "14px 16px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit" }}
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
                        style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: A, border: "none", borderRadius: 10, padding: "8px 14px", color: "#0a0a0a", fontSize: 12, fontWeight: 800, cursor: isConnecting ? "default" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", transition: "all 0.2s" }}
                      >
                        {isConnecting ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Connecting</>) : (<>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" /></svg>
                          Connect
                        </>)}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 7, alignItems: "center", paddingLeft: 2 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.dim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                <p style={{ color: T.muted, fontSize: 11, lineHeight: 1.4 }}>Settlements owed to you will be sent to this wallet in the selected currencies.</p>
              </div>

              <button onClick={handleSave} disabled={!canSave || isWorking} style={{ width: "100%", padding: "15px", background: canSave && !isWorking ? A : INSET, color: canSave && !isWorking ? "#0a0a0a" : "#555", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: canSave && !isWorking ? "pointer" : "default", fontFamily: "inherit", transition: "all 0.2s" }}>
                {isWorking ? "Saving…" : mode === "edit-wallet" ? "Update wallet" : "Save preference"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Account: Reminders ─────────────────────────────────────────────────────
// There's no reminder-*preference* store (no frequency/channel settings to
// persist), but GET /reminders is a real inbox: pending nudges other people
// sent you, which you can mark paid (accept) or dismiss (reject). That's the
// actual live feature here, so the section lists it rather than showing
// static "Weekly / On / Off" copy.

function reminderLabel(r: {
  reminderType: string;
  content?: string | null;
  split?: { name?: string; amount: number; expenseParticipants?: { amount: number }[] | null } | null;
}): { text: string; owed: number | null } {
  if (r.reminderType === "SPLIT" && r.split) {
    const owed = r.split.expenseParticipants?.[0]?.amount ?? r.split.amount;
    return { text: r.split.name ? `about "${r.split.name}"` : "about a shared expense", owed };
  }
  if (r.reminderType === "USER") return { text: "says you owe them", owed: null };
  return { text: r.content?.trim() || "sent you a nudge", owed: null };
}

function RemindersSection() {
  const { reminders, isLoading, acceptReminder, isAccepting, rejectReminder, isRejecting } = useReminders();
  const list = reminders ?? [];

  return (
    <div>
      <Intro title="Reminders" subtitle="Nudges people have sent you about money you owe." />
      {isLoading ? (
        <div style={{ padding: "20px 0", display: "flex", justifyContent: "center" }}><Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} /></div>
      ) : list.length === 0 ? (
        <p style={{ fontSize: 13, color: T.muted, padding: "8px 0 20px" }}>No nudges right now.</p>
      ) : (
        list.map((r, i) => {
          const senderName = r.sender?.name || "Someone";
          const { text, owed } = reminderLabel(r);
          const amount = typeof r.amount === "number" ? r.amount : owed;
          return (
            <Row key={r.id} last={i === list.length - 1}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <AvatarChip init={senderName.charAt(0).toUpperCase()} color={getUserColor(senderName)} size={36} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.bright }}>
                    {senderName} <span style={{ color: T.muted, fontWeight: 500, fontSize: 12.5 }}>{text}</span>
                  </p>
                  {typeof amount === "number" && <Mono style={{ display: "block", marginTop: 2, fontSize: 12, color: R }}>{fmt(amount)}</Mono>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                <button onClick={() => rejectReminder(r.id)} disabled={isRejecting} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 10, padding: "7px 12px", color: T.body, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Dismiss</button>
                <button onClick={() => acceptReminder(r.id)} disabled={isAccepting} style={{ background: `${G}1a`, border: `1px solid ${G}40`, borderRadius: 10, padding: "7px 12px", color: G, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Mark paid</button>
              </div>
            </Row>
          );
        })
      )}
      <Divider mb={16} />
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: T.dim }}>Automatic nudge scheduling isn't configurable yet — these are nudges people sent you directly.</p>
    </div>
  );
}

// ─── Account: Security ─────────────────────────────────────────────────────────

function SecuritySection({ onChangePassword, onLogout, isLoggingOut }: { onChangePassword: () => void; onLogout: () => void; isLoggingOut: boolean }) {
  return (
    <div>
      <Intro title="Security" subtitle="Sign-in and active sessions." />
      <Row>
        <div>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.bright }}>Password</p>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.sub }}>Change your password any time.</p>
        </div>
        <button type="button" onClick={onChangePassword} style={textBtn({ fontSize: 12.5, fontWeight: 700, color: A })}>Change</button>
      </Row>
      <Row>
        <div>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.bright }}>Active sessions</p>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.sub }}>Session management isn't available yet.</p>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.dim }}>—</span>
      </Row>
      <Row last>
        <div>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.bright }}>Product analytics</p>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.sub }}>Anonymous usage data</p>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: G }}>On</span>
      </Row>
      <DangerButton onClick={onLogout} disabled={isLoggingOut}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
          {isLoggingOut && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isLoggingOut ? "Signing out…" : "Sign out"}
        </span>
      </DangerButton>
    </div>
  );
}

// ─── Workspace: General ────────────────────────────────────────────────────────

function WsGeneralSection({ workspace, name, setName, hasChange, onSave, isSaving, onDelete, isDeleting }: {
  workspace: Workspace; name: string; setName: (v: string) => void; hasChange: boolean; onSave: () => void; isSaving: boolean;
  onDelete: () => void; isDeleting: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <div>
      <Intro title="Workspace" subtitle={`Applies to ${workspace.name} only.`} />
      <Eyebrow style={{ marginBottom: 8 }}>Name</Eyebrow>
      <TextInput value={name} onChange={setName} placeholder="Workspace name" />
      {hasChange && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
          <Btn variant="primary" onClick={onSave} disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</Btn>
        </div>
      )}
      <Eyebrow style={{ marginBottom: 8 }}>Invoice numbering</Eyebrow>
      <FieldBox muted>Not configurable yet</FieldBox>
      <DangerButton onClick={() => setConfirmOpen(true)}>Delete workspace</DangerButton>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete workspace"
        body={`This permanently deletes ${workspace.name} and everything in it — requests, members, contracts. This can't be undone.`}
        confirmLabel="Delete"
        working={isDeleting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={onDelete}
      />
    </div>
  );
}

// ─── Workspace: Accepted tokens ────────────────────────────────────────────
// A real override, backed by GET/POST/DELETE /groups/:groupId/accepted-tokens
// (features/groups/api/client.ts). Empty list = the workspace hasn't
// overridden anything, so it shows the inherited account default (from
// Settlement) with an "Override" affordance that reveals the same add-token
// form used once tokens already exist.

function WsTokensSection({ workspace, accountPrefs, groupTokens, isLoadingGroupTokens, allCurrencies, onAdd, isAdding, onRemove, isRemoving }: {
  workspace: Workspace; accountPrefs: SettlementPreference[];
  groupTokens: GroupAcceptedToken[]; isLoadingGroupTokens: boolean; allCurrencies: Currency[];
  onAdd: (data: { chainId: string; tokenId: string }, onDone: () => void) => void; isAdding: boolean;
  onRemove: (id: string) => void; isRemoving: boolean;
}) {
  const [overriding, setOverriding] = useState(false);
  const [chainId, setChainId] = useState("");
  const [tokenId, setTokenId] = useState("");

  const cryptoTokens = allCurrencies.filter((c) => c.type !== "FIAT" && c.chainId);
  const chainIds = [...new Set(cryptoTokens.map((c) => c.chainId!))];

  const accountSummary = accountPrefs.length === 0
    ? "You haven't set an account default yet — set one in Account → Settlement."
    : accountPrefs.map((p) => `${p.tokens.map((t) => t.token.symbol).join(", ")} on ${p.chain.name}`).join(" · ");
  const accountWallet = accountPrefs.find((p) => p.wallet)?.wallet;
  const showForm = overriding || groupTokens.length > 0;

  return (
    <div>
      <Intro title="Accepted tokens" subtitle={`What ${workspace.name} settles into.`} />

      {isLoadingGroupTokens ? (
        <div style={{ padding: "20px 0", display: "flex", justifyContent: "center" }}><Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} /></div>
      ) : groupTokens.length > 0 ? (
        groupTokens.map((t, i) => {
          const meta = getChainMeta(t.chainId);
          return (
            <Row key={t.id} last={i === groupTokens.length - 1 && !showForm}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={pill(meta.color)}>{t.symbol}</span>
                <span style={{ fontSize: 12.5, color: T.sub }}>on {t.chainName || meta.label}</span>
                {t.isDefault && <span style={pill(A)}>Default</span>}
              </div>
              <button type="button" onClick={() => onRemove(t.id)} disabled={isRemoving} style={textBtn({ fontSize: 12, fontWeight: 600, color: T.dim })}>Remove</button>
            </Row>
          );
        })
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: G }}>Using your account default</p>
            <p style={{ margin: "3px 0 0", fontSize: 11.5, color: T.muted }}>{accountSummary}{accountWallet ? `, into ${truncateAddr(accountWallet.address)}.` : "."}</p>
          </div>
          {!overriding && <button type="button" onClick={() => setOverriding(true)} style={textBtn({ fontSize: 12, fontWeight: 700, color: G, flexShrink: 0 })}>Override</button>}
        </div>
      )}

      {showForm && (
        <div style={{ marginTop: 18, padding: 16, borderRadius: 14, border: BORDER, background: "rgba(255,255,255,0.02)" }}>
          <Eyebrow style={{ marginBottom: 8 }}>Chain</Eyebrow>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {chainIds.map((cid) => {
              const meta = getChainMeta(cid);
              const sel = chainId === cid;
              return (
                <button key={cid} type="button" aria-pressed={sel} onClick={() => { setChainId(cid); setTokenId(""); }} style={{ fontFamily: "inherit", margin: 0, padding: "7px 13px", borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: "pointer", background: sel ? `${meta.color}1a` : INSET, border: `1px solid ${sel ? `${meta.color}55` : "rgba(255,255,255,0.09)"}`, color: sel ? meta.color : T.body }}>
                  {meta.label}
                </button>
              );
            })}
          </div>
          {chainId && (
            <>
              <Eyebrow style={{ marginBottom: 8 }}>Token</Eyebrow>
              <div style={{ marginBottom: 14 }}>
                <CurrencyDropdown
                  selectedCurrencies={tokenId ? [tokenId] : []}
                  setSelectedCurrencies={(ids) => setTokenId(ids[0] || "")}
                  mode="single"
                  showFiatCurrencies={false}
                  filterCurrencies={(c: Currency) => c.chainId === chainId}
                />
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {groupTokens.length === 0 && (
              <Btn variant="ghost" onClick={() => { setOverriding(false); setChainId(""); setTokenId(""); }}>Cancel</Btn>
            )}
            <Btn
              variant="primary"
              disabled={!chainId || !tokenId || isAdding}
              onClick={() => onAdd({ chainId, tokenId }, () => { setChainId(""); setTokenId(""); })}
            >
              {isAdding ? "Adding…" : "Add token"}
            </Btn>
          </div>
        </div>
      )}

      {groupTokens.length === 0 && !overriding && (
        <p style={{ margin: "16px 0 0", fontSize: 12, lineHeight: 1.6, color: T.dim }}>Overriding lets this workspace take a different token or wallet than your personal default — useful when business money shouldn't touch your personal one.</p>
      )}
    </div>
  );
}

// ─── Workspace: Approvals (no threshold/approver model on the backend yet) ────

function WsApprovalsSection({ workspace }: { workspace: Workspace }) {
  return (
    <div>
      <Intro title="Approvals" subtitle={`Money out of ${workspace.name} above a threshold needs a second pair of eyes.`} />
      <div style={{ opacity: 0.5, pointerEvents: "none" }}>
        <Eyebrow style={{ marginBottom: 8 }}>Threshold</Eyebrow>
        <FieldBox><Mono>—</Mono></FieldBox>
        <Eyebrow style={{ marginBottom: 8 }}>Approver</Eyebrow>
        <FieldBox>Not set</FieldBox>
      </div>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: T.dim }}>Approval routing isn't configurable yet — every request currently goes straight out.</p>
    </div>
  );
}

// ─── Workspace: Members (preview only — the full screen lives at /members) ──────

interface MemberPreview { userId: string; role?: string | null; user: { id: string; name: string | null; email: string | null } }

function WsMembersSection({ workspace, members, isLoading }: { workspace: Workspace; members: MemberPreview[]; isLoading: boolean }) {
  return (
    <div>
      <Intro title="Members & roles" subtitle="Admins manage roles, approvals and workspace settings." />
      {isLoading ? (
        <div style={{ padding: "16px 0", display: "flex", justifyContent: "center" }}><Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} /></div>
      ) : members.length === 0 ? (
        <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>No members yet.</p>
      ) : (
        <>
          <div style={{ display: "flex" }}>
            {members.slice(0, 6).map((m, i) => (
              <AvatarChip
                key={m.userId}
                init={(m.user.name || m.user.email || "?").charAt(0).toUpperCase()}
                color={getUserColor(m.user.name)}
                size={34}
                style={{ marginLeft: i === 0 ? 0 : -8, border: "2px solid #0d0d0d" }}
              />
            ))}
            {members.length > 6 && (
              <span style={{ marginLeft: -8, width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800, color: T.body, border: "2px solid #0d0d0d" }}>
                +{members.length - 6}
              </span>
            )}
          </div>
          <p style={{ margin: "14px 0 20px", fontSize: 12.5, color: T.sub }}>{members.length} {members.length === 1 ? "member" : "members"} in {workspace.name}.</p>
        </>
      )}
      <Link href="/members" className="abtn" style={ghostButtonStyle()}>
        Manage members
      </Link>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function SettingsPageContent({ user: initialUser }: SettingsPageContentProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: storeUser, setUser } = useAuthStore();
  const user = storeUser ?? initialUser;

  const [sec, setSec] = useState<SectionId>("profile");

  // ── Profile ──
  const { mutate: updateUser, isPending: isSavingProfile } = useUpdateUser();
  const [displayName, setDisplayName] = useState(user.name ?? "");
  const [preferredCurrency, setPreferredCurrency] = useState(user.currency ?? "USD");
  useEffect(() => {
    setDisplayName(user.name ?? "");
    setPreferredCurrency(user.currency ?? "USD");
  }, [user.id, user.name, user.currency]);

  const hasNameChange = displayName.trim().length > 0 && displayName.trim() !== (user.name ?? "");

  const saveProfileName = () => {
    const name = displayName.trim();
    updateUser({ name }, {
      onSuccess: () => { setUser({ ...user, name }); toast.success("Profile updated"); },
      onError: () => toast.error("Failed to update profile"),
    });
  };

  const changeCurrency = (currency: string) => {
    if (!currency || currency === user.currency) return;
    setPreferredCurrency(currency);
    updateUser({ currency }, {
      onSuccess: () => { setUser({ ...user, currency }); toast.success("Currency updated"); },
      onError: () => { toast.error("Failed to update currency"); setPreferredCurrency(user.currency); },
    });
  };

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    try {
      setIsUploadingImage(true);
      setUploadProgress(0);
      setUploadError("");

      const response = await fetch(`${API_URL}/api/files/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileType: file.type, fileName: file.name, folder: "profile-pictures" }),
      });
      if (!response.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, downloadUrl } = await response.json();

      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
      };
      await new Promise((resolve, reject) => {
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.response) : reject(new Error(`Upload failed with status ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      updateUser({ image: downloadUrl }, {
        onSuccess: () => { setUser({ ...user, image: downloadUrl }); toast.success("Profile picture updated successfully"); },
        onError: () => toast.error("Failed to update profile picture"),
      });
    } catch (error) {
      console.error("Image upload error:", error);
      setUploadError(error instanceof Error ? error.message : "Failed to upload image");
      toast.error("Failed to upload profile picture");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // ── Display & currency ──
  const currencyDisplay = useCurrencyDisplayStore((s) => s.mode) as CurrencyDisplay;
  const setCurrencyDisplayMode = useCurrencyDisplayStore((s) => s.setMode);
  const changeCurrencyDisplay = (mode: CurrencyDisplay) => {
    if (mode === currencyDisplay) return;
    const prev = currencyDisplay;
    setCurrencyDisplayMode(mode);
    updateUser({ currencyDisplay: mode }, {
      onSuccess: () => setUser({ ...user, currencyDisplay: mode }),
      onError: () => { setCurrencyDisplayMode(prev); toast.error("Failed to update currency display"); },
    });
  };

  const [lockIn, setLockIn] = useState(user.timeLockInDefault ?? true);
  useEffect(() => setLockIn(user.timeLockInDefault ?? true), [user.timeLockInDefault]);
  const [isSavingLockIn, setIsSavingLockIn] = useState(false);
  const toggleLockIn = () => {
    const next = !lockIn;
    setLockIn(next);
    setIsSavingLockIn(true);
    updateUser({ timeLockInDefault: next }, {
      onSuccess: () => { setUser({ ...user, timeLockInDefault: next }); setIsSavingLockIn(false); },
      onError: () => { setLockIn(!next); setIsSavingLockIn(false); toast.error("Failed to update"); },
    });
  };

  const { data: currencyData } = useGetAllCurrencies();
  const allCurrencies = currencyData?.currencies || [];

  // ── Wallets ──
  const { data: walletsData, isLoading: isLoadingWallets } = useUserWallets();
  const { data: chainsData } = useAvailableChains();
  const { mutate: addWalletMutate, isPending: isAddingWallet } = useAddWallet();
  const { mutate: removeWalletMutate, isPending: isRemovingWallet } = useRemoveWallet();
  const { mutate: setPrimaryWalletMutate, isPending: isSettingPrimary } = useSetWalletAsPrimary();

  // ── Settlement ──
  const { data: settlementPrefs = [], isLoading: isLoadingPref } = useGetSettlementPreference();
  const { mutate: savePref, isPending: isSavingPref } = useSaveSettlementPreference();
  const { mutate: removePref, isPending: isRemovingPref } = useRemoveSettlementPreference();
  const { mutate: updateWalletPref, isPending: isUpdatingWalletPref } = useUpdateSettlementWallet();
  const [prefModalOpen, setPrefModalOpen] = useState(false);
  const [prefModalMode, setPrefModalMode] = useState<"add" | "edit-wallet">("add");
  const [activeChainId, setActiveChainId] = useState<string | null>(null);
  const [removePrefConfirmOpen, setRemovePrefConfirmOpen] = useState(false);
  const activePref = activeChainId ? settlementPrefs.find((p) => p.chainId === activeChainId) : null;
  const openPrefModalForChain = (mode: "add" | "edit-wallet", chainId?: string) => {
    setActiveChainId(chainId ?? null);
    setPrefModalMode(mode);
    setPrefModalOpen(true);
  };

  // ── Security ──
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      setUser(null);
      toast.success("Logged out successfully");
      router.push("/login");
    } catch {
      toast.error("Failed to log out. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  // ── Workspace ──
  const workspace = useActiveWorkspace();
  const { businessCount } = useWorkspaces();
  const setActiveWorkspace = useSetActiveWorkspace();
  const isBusiness = workspace.kind === "business";

  useEffect(() => {
    if (!isBusiness && (sec === "ws-general" || sec === "ws-tokens" || sec === "ws-approvals" || sec === "ws-members")) {
      setSec("profile");
    }
  }, [isBusiness, sec]);

  const { data: groupDetail, isLoading: isLoadingGroup } = useGetGroupById(isBusiness ? workspace.id : "", { type: "BUSINESS" });
  const [wsName, setWsName] = useState(workspace.name);
  useEffect(() => setWsName(workspace.name), [workspace.id, workspace.name]);
  const { mutate: updateGroupMutate, isPending: isSavingWsName } = useUpdateGroup();
  const { mutate: deleteGroupMutate, isPending: isDeletingWs } = useDeleteGroup();

  const { data: groupAcceptedTokens = [], isLoading: isLoadingGroupTokens } = useGetGroupAcceptedTokens(isBusiness ? workspace.id : "");
  const { mutate: addGroupTokenMutate, isPending: isAddingGroupToken } = useAddGroupAcceptedToken();
  const { mutate: removeGroupTokenMutate, isPending: isRemovingGroupToken } = useRemoveGroupAcceptedToken();

  const saveWsName = () => {
    const name = wsName.trim();
    if (!name || name === workspace.name) return;
    updateGroupMutate({ groupId: workspace.id, payload: { name } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [QueryKeys.WORKSPACES] });
        toast.success("Workspace renamed");
      },
      onError: () => toast.error("Failed to rename workspace"),
    });
  };

  const deleteWorkspace = () => {
    deleteGroupMutate(workspace.id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [QueryKeys.WORKSPACES] });
        setActiveWorkspace("personal");
        toast.success("Workspace deleted");
        router.push("/");
      },
      onError: (result: unknown) => {
        const message = (result as { message?: string } | undefined)?.message;
        toast.error(message || "Failed to delete workspace — check for uncleared balances");
      },
    });
  };

  const wallets: WalletRow[] = walletsData?.accounts ?? [];

  return (
    <div className="flex-1 p-4 sm:p-7 overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[216px_1fr] gap-4 lg:gap-[26px] items-start">
        <div className="flex flex-row lg:flex-col gap-5 lg:gap-[18px] overflow-x-auto lg:overflow-visible lg:sticky pb-1 lg:pb-0" style={{ top: 100 }}>
          <RailGroup label="Account" items={ACCOUNT_SECTIONS} sec={sec} setSec={setSec} />
          {isBusiness && <RailGroup label="Workspace" items={WORKSPACE_SECTIONS} sec={sec} setSec={setSec} />}
        </div>

        <div style={{ minWidth: 0, ...card({ padding: "20px 22px" }) }}>
          {sec === "profile" && (
            <ProfileSection
              user={user}
              displayName={displayName}
              setDisplayName={setDisplayName}
              hasNameChange={hasNameChange}
              isSavingName={isSavingProfile}
              onSaveName={saveProfileName}
              preferredCurrency={preferredCurrency}
              onCurrencyChange={changeCurrency}
              isUploadingImage={isUploadingImage}
              uploadProgress={uploadProgress}
              uploadError={uploadError}
              onImageUpload={handleImageUpload}
            />
          )}
          {sec === "display" && (
            <DisplaySection
              currencyDisplay={currencyDisplay}
              onCurrencyDisplayChange={changeCurrencyDisplay}
              lockIn={lockIn}
              onToggleLockIn={toggleLockIn}
              isSavingLockIn={isSavingLockIn}
            />
          )}
          {sec === "wallets" && (
            <WalletsSection
              wallets={wallets}
              isLoading={isLoadingWallets}
              chains={chainsData?.chains ?? []}
              onSetDefault={(chainId, address) => setPrimaryWalletMutate({ chainId, address })}
              isSettingDefault={isSettingPrimary}
              onRemove={(id) => removeWalletMutate(id)}
              isRemoving={isRemovingWallet}
              onAdd={(data, onDone) => addWalletMutate(data, { onSuccess: onDone })}
              isAdding={isAddingWallet}
            />
          )}
          {sec === "settlement" && (
            <SettlementSection
              prefs={settlementPrefs}
              isLoading={isLoadingPref}
              isRemoving={isRemovingPref}
              onEdit={(chainId) => openPrefModalForChain("add", chainId)}
              onEditWallet={(chainId) => openPrefModalForChain("edit-wallet", chainId)}
              onRemove={(chainId) => { setActiveChainId(chainId); setRemovePrefConfirmOpen(true); }}
              onAdd={() => openPrefModalForChain("add")}
              showInheritNote={businessCount > 0}
            />
          )}
          {sec === "reminders" && <RemindersSection />}
          {sec === "security" && (
            <SecuritySection
              onChangePassword={() => setIsChangePasswordOpen(true)}
              onLogout={handleLogout}
              isLoggingOut={isLoggingOut}
            />
          )}
          {isBusiness && sec === "ws-general" && (
            <WsGeneralSection
              workspace={workspace}
              name={wsName}
              setName={setWsName}
              hasChange={wsName.trim().length > 0 && wsName.trim() !== workspace.name}
              onSave={saveWsName}
              isSaving={isSavingWsName}
              onDelete={deleteWorkspace}
              isDeleting={isDeletingWs}
            />
          )}
          {isBusiness && sec === "ws-tokens" && (
            <WsTokensSection
              workspace={workspace}
              accountPrefs={settlementPrefs}
              groupTokens={groupAcceptedTokens}
              isLoadingGroupTokens={isLoadingGroupTokens}
              allCurrencies={allCurrencies}
              onAdd={(data, onDone) => addGroupTokenMutate({ groupId: workspace.id, payload: data }, { onSuccess: () => { toast.success("Token added"); onDone(); }, onError: () => toast.error("Failed to add token — only the workspace creator can change this") })}
              isAdding={isAddingGroupToken}
              onRemove={(id) => removeGroupTokenMutate({ groupId: workspace.id, id }, { onError: () => toast.error("Failed to remove token — only the workspace creator can change this") })}
              isRemoving={isRemovingGroupToken}
            />
          )}
          {isBusiness && sec === "ws-approvals" && <WsApprovalsSection workspace={workspace} />}
          {isBusiness && sec === "ws-members" && (
            <WsMembersSection workspace={workspace} members={groupDetail?.groupUsers ?? []} isLoading={isLoadingGroup} />
          )}
        </div>
      </div>

      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />

      <SettlementPrefModal
        isOpen={prefModalOpen}
        onClose={() => setPrefModalOpen(false)}
        onSave={(data) => savePref(data, { onSuccess: () => { toast.success("Settlement preference saved"); setPrefModalOpen(false); } })}
        isSaving={isSavingPref}
        allCurrencies={allCurrencies}
        initialChainId={activePref?.chainId}
        initialTokenIds={activePref?.tokens.map((t) => t.tokenId)}
        initialWalletAddress={activePref?.wallet?.address}
        mode={prefModalMode}
        onUpdateWallet={(addr) => { if (activePref) updateWalletPref({ walletAddress: addr, chainId: activePref.chainId }, { onSuccess: () => { toast.success("Wallet address updated"); setPrefModalOpen(false); } }); }}
        isUpdatingWallet={isUpdatingWalletPref}
        existingChainIds={settlementPrefs.map((p) => p.chainId)}
      />

      <ConfirmDialog
        open={removePrefConfirmOpen}
        title="Remove preference"
        body="You won't be able to receive crypto settlements on this chain until you set a new preference."
        confirmLabel={isRemovingPref ? "Removing…" : "Remove"}
        working={isRemovingPref}
        onCancel={() => setRemovePrefConfirmOpen(false)}
        onConfirm={() => {
          if (activeChainId) removePref(activeChainId, { onSuccess: () => toast.success("Settlement preference removed"), onError: () => toast.error("Failed to remove settlement preference") });
          setRemovePrefConfirmOpen(false);
        }}
      />
    </div>
  );
}
