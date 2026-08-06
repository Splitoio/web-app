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
  WalletNetwork,
  allowAllModules,
  XBULL_ID,
  ISupportedWallet,
} from "@creit.tech/stellar-wallets-kit";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

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
    network: WalletNetwork.PUBLIC,
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
  let networkPassphrase = WalletNetwork.TESTNET;
  try {
    const walletConfig = (kit as unknown as { config?: { network?: WalletNetwork } }).config;
    if (walletConfig?.network) {
      networkPassphrase = walletConfig.network;
    }
  } catch {
    // Fall back to TESTNET default above.
  }

  const signed = await kit.signTransaction(unsignedTxXdr, { networkPassphrase });
  return signed.signedTxXdr;
}

// ── Solana (Phantom) ────────────────────────────────────────────────────

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString: () => string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  signAndSendTransaction: (tx: Transaction) => Promise<{ signature: string }>;
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
