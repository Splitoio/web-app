"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { T, A, R } from "@/lib/splito-design";
import {
  connectSolanaWallet,
  connectStellarWallet,
  type PayWalletChain,
} from "@/components/pay/pay-wallet";
import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";

export interface ConnectedWallet {
  chain: PayWalletChain;
  address: string;
  stellarKit?: StellarWalletsKit;
}

/** "GABCDEF…UVWXYZ" — recognisable at a glance, never the full string. */
function shortAddress(address: string): string {
  return address.length > 16 ? `${address.slice(0, 6)}…${address.slice(-6)}` : address;
}

const CHAIN_LABEL: Record<PayWalletChain, string> = {
  stellar: "Stellar",
  solana: "Solana",
};

/**
 * Lowest-intimidation wallet step. Destinations in scope are Stellar and
 * Solana only (contract §0.1) — offer whichever wallet the payer already
 * has, not a long chain picker.
 */
export function WalletConnect({
  onConnected,
  savedWallet = null,
}: {
  onConnected: (wallet: ConnectedWallet) => void;
  /**
   * The signed-in payer's saved address for this request's destination chain,
   * when exactly one is unambiguous — see use-payer-identity.ts. Null for a
   * guest, and when it is null this component renders EXACTLY what it always
   * did, down to the button styling.
   *
   * It is a pre-selection, not a shortcut. Paying requires a signature and a
   * signature requires the live wallet (Stellar Wallets Kit / Phantom), so a
   * stored address can never stand in for connecting — see pay-wallet.ts,
   * where signing needs the `StellarWalletsKit` instance the connect step
   * builds, and where Phantom refuses to sign for an address it isn't
   * currently unlocked to. What this DOES remove is the "which chain am I
   * paying from?" decision, and it tells the payer up front which of their
   * accounts we expect — instead of making them work it out from scratch.
   */
  savedWallet?: { chain: PayWalletChain; address: string } | null;
}) {
  const [connecting, setConnecting] = useState<PayWalletChain | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStellar = async () => {
    setError(null);
    setConnecting("stellar");
    try {
      const { kit, address } = await connectStellarWallet();
      onConnected({ chain: "stellar", address, stellarKit: kit });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect wallet");
    } finally {
      setConnecting(null);
    }
  };

  const handleSolana = async () => {
    setError(null);
    setConnecting("solana");
    try {
      const { address } = await connectSolanaWallet();
      onConnected({ chain: "solana", address });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect wallet");
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="w-full">
      <p
        className="text-[11px] font-bold tracking-[0.08em] uppercase mb-1"
        style={{ color: T.muted }}
      >
        Step 1 · Choose how you&rsquo;re paying
      </p>
      <p className="text-[12.5px] mb-4" style={{ color: T.dim }}>
        Pay from wherever your money already is.
      </p>

      {/* The saved-wallet block and the demotion below it are BOTH gated on
          `savedWallet`. A guest renders the original two-button grid with the
          original styling — this whole branch is invisible to them. */}
      {savedWallet && (
        <div className="mb-5">
          <button
            type="button"
            onClick={savedWallet.chain === "stellar" ? handleStellar : handleSolana}
            disabled={connecting !== null}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-[13.5px] font-extrabold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: A, color: "#0a0a0a" }}
          >
            {connecting === savedWallet.chain ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Continue with your saved wallet
          </button>
          <p
            className="text-[11.5px] mt-2 text-center font-mono truncate"
            style={{ color: T.dim }}
          >
            {CHAIN_LABEL[savedWallet.chain]} · {shortAddress(savedWallet.address)}
          </p>
          {/* Said plainly, because the button above does NOT skip the wallet:
              it opens the same connect step, already pointed at the right
              chain. Promising less friction than that would be a lie the
              signature prompt immediately exposes. */}
          <p className="text-[11.5px] mt-1.5 text-center" style={{ color: T.muted }}>
            You&rsquo;ll still approve the payment in your wallet.
          </p>
          <p
            className="text-[11px] font-bold tracking-[0.08em] uppercase mt-5 mb-2.5"
            style={{ color: T.muted }}
          >
            Or use a different wallet
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleStellar}
          disabled={connecting !== null}
          className={
            savedWallet
              ? "flex items-center justify-center gap-2 rounded-xl py-3.5 text-[13.5px] font-extrabold border transition-all hover:bg-white/5 disabled:opacity-50"
              : "flex items-center justify-center gap-2 rounded-xl py-3.5 text-[13.5px] font-extrabold transition-all hover:opacity-90 disabled:opacity-50"
          }
          // With a saved wallet suggested above, the accent belongs to THAT
          // button — two primaries would be two "do this first"s.
          style={
            savedWallet
              ? { borderColor: "rgba(255,255,255,0.14)", color: T.bright }
              : { background: A, color: "#0a0a0a" }
          }
        >
          {connecting === "stellar" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Connect Stellar wallet
        </button>
        <button
          type="button"
          onClick={handleSolana}
          disabled={connecting !== null}
          className="flex items-center justify-center gap-2 rounded-xl py-3.5 text-[13.5px] font-extrabold border transition-all hover:bg-white/5 disabled:opacity-50"
          style={{ borderColor: "rgba(255,255,255,0.14)", color: T.bright }}
        >
          {connecting === "solana" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Connect Phantom (Solana)
        </button>
      </div>
      {error && (
        <p className="text-[12px] mt-2.5 text-center" style={{ color: R }}>
          {error}
        </p>
      )}
    </div>
  );
}
