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

/**
 * Lowest-intimidation wallet step. Destinations in scope are Stellar and
 * Solana only (contract §0.1) — offer whichever wallet the payer already
 * has, not a long chain picker.
 */
export function WalletConnect({
  onConnected,
}: {
  onConnected: (wallet: ConnectedWallet) => void;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleStellar}
          disabled={connecting !== null}
          className="flex items-center justify-center gap-2 rounded-xl py-3.5 text-[13.5px] font-extrabold transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: A, color: "#0a0a0a" }}
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
