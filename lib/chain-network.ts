// Single source of truth for "which network is this deployment on" on the client.
//
// This MIRRORS the backend's `CHAIN_NETWORK` (backend/src/config/env.ts — a
// `z.enum(["testnet","mainnet"]).optional().default("testnet")`) and the
// derived `stellarConfig` / `solanaConfig` in backend/src/config/chains.ts.
// The backend builds unsigned transactions against whichever network it is
// configured for; if the browser tells the wallet a different network, the
// signature is produced against the wrong passphrase/cluster and the payment
// either fails outright or is signed against the wrong chain.
//
// Set NEXT_PUBLIC_CHAIN_NETWORK to the SAME value as the backend's
// CHAIN_NETWORK. Both default to "testnet" when unset, so the defaults agree.

import { WalletNetwork } from "@creit.tech/stellar-wallets-kit";

export type ChainNetwork = "testnet" | "mainnet";

export const CHAIN_NETWORK: ChainNetwork =
  process.env.NEXT_PUBLIC_CHAIN_NETWORK === "mainnet" ? "mainnet" : "testnet";

export const IS_MAINNET = CHAIN_NETWORK === "mainnet";

/**
 * The Stellar network passphrase to hand StellarWalletsKit — both at
 * construction time and at `signTransaction` time. Must match
 * `stellarConfig.networkPassphrase` on the backend
 * (Networks.PUBLIC on mainnet, Networks.TESTNET otherwise).
 */
export const STELLAR_WALLET_NETWORK: WalletNetwork = IS_MAINNET
  ? WalletNetwork.PUBLIC
  : WalletNetwork.TESTNET;

/** Matches `solanaConfig.cluster` on the backend. */
export const SOLANA_CLUSTER: "mainnet-beta" | "devnet" = IS_MAINNET
  ? "mainnet-beta"
  : "devnet";

/**
 * Horizon endpoint, mirroring `stellarConfig.horizonUrl` on the backend
 * (config/chains.ts:31 / :39).
 *
 * The client needs this ONLY on the routed path. On the direct path the
 * backend broadcasts the signed XDR itself (contract §0.2) and the browser
 * never talks to Horizon. On a routed payment the backend holds no verifier
 * for the source chain and `submit` only records the hash it is given — so the
 * payer's own browser must broadcast and report back the resulting tx id.
 */
export const STELLAR_HORIZON_URL = IS_MAINNET
  ? "https://horizon.stellar.org"
  : "https://horizon-testnet.stellar.org";

// ── Explorer links (mirror backend/src/config/chains.ts `blockExplorer`) ──

const STELLAR_EXPLORER = IS_MAINNET
  ? "https://stellar.expert/explorer/public"
  : "https://stellar.expert/explorer/testnet";

const SOLANA_EXPLORER = "https://explorer.solana.com";

/**
 * Explorer URL for a transaction hash, or null when we cannot build one
 * honestly (unknown chain, or no hash). Never returns a guessed URL.
 */
export function explorerTxUrl(chain: string, hash: string | null | undefined): string | null {
  if (!hash) return null;
  if (chain === "stellar") return `${STELLAR_EXPLORER}/tx/${hash}`;
  if (chain === "solana") {
    const qs = IS_MAINNET ? "" : `?cluster=${SOLANA_CLUSTER}`;
    return `${SOLANA_EXPLORER}/tx/${hash}${qs}`;
  }
  return null;
}
