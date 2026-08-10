import { apiClient } from "@/api-helpers/client";
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { STELLAR_WALLET_NETWORK } from "@/lib/chain-network";
import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";

type UnsignedTxResponse = {
  serializedTx: string;
  txHash: string;
  settlementId: string;
  tokenSymbol?: string;
  chainName?: string;
  amount?: number;
};

type StellarWallet = StellarWalletsKit;

const settleDebtStellar = async (
  payload: {
    groupId: string;
    address: string;
    settleWithId?: string;
    selectedTokenId?: string;
    selectedChainId?: string;
    amount?: number;
    expenseId?: string;
  },
  unsignedTx: UnsignedTxResponse,
  wallet: StellarWallet
) => {
  // Same source the kit was constructed with, driven by NEXT_PUBLIC_CHAIN_NETWORK
  // to mirror the backend's CHAIN_NETWORK — never sniffed off the kit's
  // undocumented internal config.
  const signedTx = await wallet.signTransaction(unsignedTx.serializedTx, {
    networkPassphrase: STELLAR_WALLET_NETWORK,
  });

  const submitPayload = {
    signedTx: signedTx.signedTxXdr,
    groupId: payload.groupId,
    settlementId: unsignedTx.settlementId,
    settleWithId: payload.settleWithId,
  };

  const submitTx = await apiClient.post("/groups/settle-transaction/submit", submitPayload);
  return submitTx.data;
};

// ── Base / EVM ─────────────────────────────────────────────────────────────

type BaseIntent = {
  chainId: number;
  chainHexId: string;
  rpcUrl: string;
  chainName: string;
  to: string;
  tokenAmount: number;
  tokenContract: string | null;
  decimals: number;
  symbol?: string;
};

function toHex(n: bigint): string {
  return "0x" + n.toString(16);
}

function parseUnits(value: string, decimals: number): bigint {
  const [wholeRaw, fracRaw = ""] = value.split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const frac = (fracRaw + "0".repeat(decimals)).slice(0, decimals);
  const combined = (whole + frac).replace(/^0+(?=\d)/, "") || "0";
  return BigInt(combined);
}

function encodeERC20Transfer(to: string, amount: bigint): string {
  const SELECTOR = "a9059cbb";
  const paddedTo = to.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const paddedAmount = amount.toString(16).padStart(64, "0");
  return "0x" + SELECTOR + paddedTo + paddedAmount;
}

async function ensureEvmChain(intent: BaseIntent) {
  const eth = window.ethereum;
  if (!eth) throw new Error("No EVM wallet found. Install MetaMask or Coinbase Wallet.");

  const current = (await eth.request({ method: "eth_chainId" })) as string;
  if (current?.toLowerCase() === intent.chainHexId.toLowerCase()) return;

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: intent.chainHexId }],
    });
  } catch (err: any) {
    if (err?.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: intent.chainHexId,
          chainName: intent.chainName,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [intent.rpcUrl],
          blockExplorerUrls: [intent.chainId === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org"],
        }],
      });
    } else {
      throw err;
    }
  }
}

const settleDebtBase = async (
  payload: {
    groupId: string;
    address: string;
    settleWithId?: string;
    selectedTokenId?: string;
    selectedChainId?: string;
    amount?: number;
    expenseId?: string;
  },
  unsignedTx: UnsignedTxResponse
) => {
  const eth = window.ethereum;
  if (!eth) throw new Error("No EVM wallet found. Install MetaMask or Coinbase Wallet.");

  const intent: BaseIntent = JSON.parse(unsignedTx.serializedTx);
  await ensureEvmChain(intent);

  const amountUnits = parseUnits(intent.tokenAmount.toFixed(intent.decimals), intent.decimals);

  const txParams: Record<string, string> = { from: payload.address.toLowerCase() };
  if (intent.tokenContract) {
    txParams.to = intent.tokenContract;
    txParams.data = encodeERC20Transfer(intent.to, amountUnits);
    txParams.value = "0x0";
  } else {
    txParams.to = intent.to;
    txParams.value = toHex(amountUnits);
  }

  const txHash = (await eth.request({
    method: "eth_sendTransaction",
    params: [txParams],
  })) as string;

  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new Error("Wallet did not return a transaction hash");
  }

  const submitPayload = {
    signedTx: txHash,
    groupId: payload.groupId,
    settlementId: unsignedTx.settlementId,
    settleWithId: payload.settleWithId,
  };

  const submitTx = await apiClient.post("/groups/settle-transaction/submit", submitPayload);
  return submitTx.data;
};

// ── Solana ────────────────────────────────────────────────────────────────

type SolanaIntent = {
  cluster: "mainnet-beta" | "devnet";
  rpcUrl: string;
  to: string;
  tokenAmount: number;
  decimals: number;
  symbol: string;
  mint: string | null;
  serializedTx: string; // base64 partial tx (no signature)
};

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString: () => string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  signAndSendTransaction: (tx: Transaction) => Promise<{ signature: string }>;
};

function getPhantom(): PhantomProvider {
  const phantom = (window as any).phantom?.solana as PhantomProvider | undefined;
  if (!phantom?.isPhantom) {
    throw new Error("Phantom wallet not found. Install it from phantom.app.");
  }
  return phantom;
}

const settleDebtSolana = async (
  payload: {
    groupId: string;
    address: string;
    settleWithId?: string;
    selectedTokenId?: string;
    selectedChainId?: string;
    amount?: number;
    expenseId?: string;
  },
  unsignedTx: UnsignedTxResponse
) => {
  const phantom = getPhantom();
  const intent: SolanaIntent = JSON.parse(unsignedTx.serializedTx);

  if (!phantom.publicKey) {
    await phantom.connect();
  }
  if (phantom.publicKey?.toString() !== payload.address) {
    throw new Error(
      `Connected Phantom wallet (${phantom.publicKey?.toString().slice(0, 6)}\u2026) does not match your saved Solana address. Switch wallets in Phantom and retry.`
    );
  }

  const txBuf = Uint8Array.from(atob(intent.serializedTx), (c) => c.charCodeAt(0));
  const tx = Transaction.from(txBuf);

  // Refresh blockhash close to send time so the tx isn't expired by the wallet popup.
  const connection = new Connection(intent.rpcUrl, "confirmed");
  const { blockhash } = await connection.getLatestBlockhash("finalized");
  tx.recentBlockhash = blockhash;
  tx.feePayer = new PublicKey(payload.address);

  const { signature } = await phantom.signAndSendTransaction(tx);

  // Wait briefly for confirmation so the backend's getParsedTransaction returns it.
  try {
    await connection.confirmTransaction(signature, "confirmed");
  } catch (err) {
    console.warn("[settleDebtSolana] confirmTransaction warning:", err);
  }

  const submitPayload = {
    signedTx: signature,
    groupId: payload.groupId,
    settlementId: unsignedTx.settlementId,
    settleWithId: payload.settleWithId,
  };

  const submitTx = await apiClient.post("/groups/settle-transaction/submit", submitPayload);
  return submitTx.data;
};

export const settleDebt = async (
  payload: {
    groupId: string;
    address: string;
    settleWithId?: string;
    selectedTokenId?: string;
    selectedChainId?: string;
    amount?: number;
    expenseId?: string;
  },
  wallet: StellarWallet | undefined
) => {
  const unsignedTx: UnsignedTxResponse = await apiClient.post(
    "/groups/settle-transaction/create",
    payload
  );

  if (payload.selectedChainId === "base") {
    return settleDebtBase(payload, unsignedTx);
  }

  if (payload.selectedChainId === "solana") {
    return settleDebtSolana(payload, unsignedTx);
  }

  if (!wallet) {
    throw new Error("Wallet is not connected. Please connect your Stellar wallet first.");
  }

  return settleDebtStellar(payload, unsignedTx, wallet);
};
