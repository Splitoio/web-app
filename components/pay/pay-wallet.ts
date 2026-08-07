// Chain-specific sign/broadcast helpers for the public payer flow.
// Destinations in scope: stellar, solana only (per contract §0.1 / plan
// "Receive on two chains. Pay from many").
//
// Per the contract (§0.2):
// - Stellar: client signs the server-built XDR; SERVER broadcasts. Client
//   returns the signed XDR as `signedTx`.
// - Solana: client signs AND broadcasts; client returns the tx signature as
//   `signedTx`. Server never broadcasts Solana.

"use client";

import {
  StellarWalletsKit,
  allowAllModules,
  XBULL_ID,
  ISupportedWallet,
} from "@creit.tech/stellar-wallets-kit";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { UnsignedTransaction } from "@/api-helpers/requests";
import {
  SOLANA_CLUSTER,
  STELLAR_WALLET_NETWORK,
  STELLAR_HORIZON_URL,
  CHAIN_NETWORK,
} from "@/lib/chain-network";

export type PayWalletChain = "stellar" | "solana";

export interface ConnectedPayWallet {
  chain: PayWalletChain;
  address: string;
}

// ── Stellar ──────────────────────────────────────────────────────────────

export async function connectStellarWallet(): Promise<{
  kit: StellarWalletsKit;
  address: string;
}> {
  const kit = new StellarWalletsKit({
    // Driven by NEXT_PUBLIC_CHAIN_NETWORK, which must mirror the backend's
    // CHAIN_NETWORK. Hardcoding PUBLIC here while the backend built a TESTNET
    // XDR is how the wallet ends up signing against the wrong passphrase.
    network: STELLAR_WALLET_NETWORK,
    selectedWalletId: XBULL_ID,
    modules: allowAllModules(),
  });

  return new Promise((resolve, reject) => {
    kit
      .openModal({
        onWalletSelected: async (option: ISupportedWallet) => {
          try {
            kit.setWallet(option.id);
            const response = await kit.getAddress();
            const address =
              typeof response === "object" && response !== null
                ? response.address
                : response;
            if (typeof address !== "string" || !address) {
              reject(new Error("Stellar wallet returned no address"));
              return;
            }
            resolve({ kit, address });
          } catch (err) {
            reject(err);
          }
        },
        onClosed: () => reject(new Error("Wallet selection cancelled")),
      })
      .catch(reject);
  });
}

export async function signStellarUnsignedTx(
  kit: StellarWalletsKit,
  unsignedTxXdr: string
): Promise<string> {
  // Same source as the kit was constructed with — do NOT read it back off the
  // kit's internal config (undocumented shape, and it silently fell back to a
  // hardcoded TESTNET default when the read failed).
  const signed = await kit.signTransaction(unsignedTxXdr, {
    networkPassphrase: STELLAR_WALLET_NETWORK,
  });
  return signed.signedTxXdr;
}

// ── Solana (Phantom) ────────────────────────────────────────────────────

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString: () => string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  signAndSendTransaction: (
    tx: Transaction | VersionedTransaction
  ) => Promise<{ signature: string }>;
};

function getPhantom(): PhantomProvider {
  const phantom = (window as unknown as Record<string, unknown>).phantom as
    | Record<string, unknown>
    | undefined;
  const provider = phantom?.solana as PhantomProvider | undefined;
  if (!provider?.isPhantom) {
    throw new Error("Phantom wallet not found. Install it from phantom.app.");
  }
  return provider;
}

export async function connectSolanaWallet(): Promise<{ address: string }> {
  const phantom = getPhantom();
  if (!phantom.publicKey) {
    await phantom.connect();
  }
  const address = phantom.publicKey?.toString();
  if (!address) throw new Error("Phantom did not return a public key");
  return { address };
}

interface SolanaUnsignedTxEnvelope {
  cluster: "mainnet-beta" | "devnet";
  rpcUrl: string;
  to: string;
  tokenAmount: number;
  decimals: number;
  symbol: string;
  mint: string | null;
  serializedTx: string; // base64 partial tx (no signature)
}

/** Signs AND broadcasts (Solana never goes through server broadcast). Returns the tx signature. */
export async function signAndBroadcastSolanaUnsignedTx(
  sourceAddress: string,
  unsignedTxJson: string
): Promise<string> {
  const phantom = getPhantom();
  const intent: SolanaUnsignedTxEnvelope = JSON.parse(unsignedTxJson);

  // The server envelope carries the authoritative cluster + RPC URL (it built
  // the transaction). If it disagrees with this deployment's configured
  // network, the two halves are pointed at different chains — the Solana twin
  // of the Stellar passphrase bug. Surface it loudly; the envelope still wins,
  // because the transaction it describes is the one being signed.
  if (intent.cluster !== SOLANA_CLUSTER) {
    console.warn(
      `[pay-wallet] Cluster mismatch: server built for "${intent.cluster}", ` +
        `this frontend is configured for "${SOLANA_CLUSTER}" ` +
        `(NEXT_PUBLIC_CHAIN_NETWORK=${CHAIN_NETWORK}). Check that it matches the backend's CHAIN_NETWORK.`
    );
  }

  if (!phantom.publicKey) {
    await phantom.connect();
  }
  if (phantom.publicKey?.toString() !== sourceAddress) {
    throw new Error(
      `Connected Phantom wallet (${phantom.publicKey?.toString().slice(0, 6)}…) does not match the wallet you connected with. Switch wallets in Phantom and retry.`
    );
  }

  const txBuf = Uint8Array.from(atob(intent.serializedTx), (c) => c.charCodeAt(0));
  const tx = Transaction.from(txBuf);

  const connection = new Connection(intent.rpcUrl, "confirmed");
  const { blockhash } = await connection.getLatestBlockhash("finalized");
  tx.recentBlockhash = blockhash;
  tx.feePayer = new PublicKey(sourceAddress);

  const { signature } = await phantom.signAndSendTransaction(tx);

  try {
    await connection.confirmTransaction(signature, "confirmed");
  } catch (err) {
    console.warn("[pay-wallet] confirmTransaction warning:", err);
  }

  return signature;
}

// ── Routed payments: an ORDERED ARRAY of transactions ────────────────────
//
// Contract §3 (changed 2026-08-07): a routed quote returns
// `unsignedTransactions[]`, signed IN ARRAY ORDER — an "approve" leg may
// precede the "transfer" leg, so the payer can be prompted more than once.
// The direct path is unaffected and still single-signature.
//
// On a routed payment the CLIENT broadcasts on every chain, including Stellar.
// The backend's routed submit branch holds no verifier for an arbitrary source
// chain: it records what it is handed as `transactionHash` and gives it to the
// poller as a tx id (contract §4). So each leg here must return a broadcast tx
// id, never a signed-but-unbroadcast payload — which is why Stellar goes to
// Horizon here rather than relying on the server fee-bump submit used by the
// direct path.

/** Signs a routed Stellar XDR and broadcasts it to Horizon. Returns the tx hash. */
async function signAndBroadcastStellarPayload(
  kit: StellarWalletsKit,
  xdr: string
): Promise<string> {
  const signed = await kit.signTransaction(xdr, {
    networkPassphrase: STELLAR_WALLET_NETWORK,
  });

  const body = new URLSearchParams({ tx: signed.signedTxXdr });
  const response = await fetch(`${STELLAR_HORIZON_URL}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.hash) {
    // Surface Horizon's own reason rather than a generic failure — a routed
    // Stellar leg most often fails on a missing trustline or sequence, and
    // both are actionable by the payer.
    const reason =
      payload?.extras?.result_codes
        ? JSON.stringify(payload.extras.result_codes)
        : payload?.detail || payload?.title || `HTTP ${response.status}`;
    throw new Error(`Stellar rejected the transaction: ${reason}`);
  }
  return payload.hash as string;
}

/** Signs a routed Solana payload (base64 legacy or versioned tx) and broadcasts it. */
async function signAndBroadcastSolanaPayload(
  sourceAddress: string,
  base64Tx: string
): Promise<string> {
  const phantom = getPhantom();
  if (!phantom.publicKey) {
    await phantom.connect();
  }
  if (phantom.publicKey?.toString() !== sourceAddress) {
    throw new Error(
      `Connected Phantom wallet (${phantom.publicKey?.toString().slice(0, 6)}…) does not match the wallet you connected with. Switch wallets in Phantom and retry.`
    );
  }

  const bytes = Uint8Array.from(atob(base64Tx), (c) => c.charCodeAt(0));
  // The router builds the transaction, including its blockhash. Deserialize
  // whichever form it used and sign it AS BUILT — rewriting the blockhash or
  // fee payer here would invalidate a router-constructed instruction set.
  let tx: Transaction | VersionedTransaction;
  try {
    tx = VersionedTransaction.deserialize(bytes);
  } catch {
    tx = Transaction.from(bytes);
  }

  const { signature } = await phantom.signAndSendTransaction(tx);
  return signature;
}

export interface RoutedSigningContext {
  /** Chain the payer signs on — `quote.chain`, the SOURCE chain when routed. */
  chain: string;
  address: string;
  /** Required when `chain === "stellar"`. */
  stellarKit?: StellarWalletsKit | null;
  /**
   * Called before each wallet prompt with the 1-based index and that leg's
   * kind, so the UI can count the prompts off instead of the payer meeting an
   * unexplained second one.
   */
  onStep?: (step: number, kind: string) => void;
}

/**
 * Sign and broadcast every leg of a routed payment, in order.
 *
 * Returns the tx id of the "transfer" leg — the one that actually moves the
 * funds and the only one the backend can track. An "approve" leg is broadcast
 * and awaited but its hash is not what submit wants.
 *
 * A throw partway through is honest and important: if leg 1 (approve) went out
 * and leg 2 (transfer) did not, NO funds moved — an allowance is not a
 * payment. The caller can safely offer a retry.
 */
export async function signRoutedTransactions(
  ctx: RoutedSigningContext,
  transactions: UnsignedTransaction[]
): Promise<string> {
  if (!transactions.length) {
    throw new Error("The router returned no transaction to sign");
  }

  let transferHash: string | null = null;
  let lastHash: string | null = null;

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    // Every leg of a routed payment is on the source chain; a payload for a
    // different chain means the wallet cannot sign it and must not try.
    if (tx.chain !== ctx.chain) {
      throw new Error(
        `This payment needs a ${tx.chain} signature but your wallet is connected to ${ctx.chain}.`
      );
    }
    ctx.onStep?.(i + 1, tx.kind);

    let hash: string;
    if (tx.chain === "stellar") {
      if (!ctx.stellarKit) throw new Error("Stellar wallet not connected");
      hash = await signAndBroadcastStellarPayload(ctx.stellarKit, tx.payload);
    } else if (tx.chain === "solana") {
      hash = await signAndBroadcastSolanaPayload(ctx.address, tx.payload);
    } else {
      // Only reachable if the backend offers a source chain this app has no
      // adapter for. Say so by name rather than failing opaquely mid-signature.
      throw new Error(
        `This app cannot sign on ${tx.chain} yet. Pay with a Stellar or Solana wallet instead.`
      );
    }

    lastHash = hash;
    if (tx.kind === "transfer") transferHash = hash;
  }

  // `transferHash` is the correct answer; `lastHash` only covers a provider
  // that labels its legs differently, and the array is ordered so the funds-
  // moving leg is last either way.
  const result = transferHash ?? lastHash;
  if (!result) throw new Error("No transaction hash was produced");
  return result;
}
