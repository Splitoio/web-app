// What a payer is allowed to pay WITH.
//
// THERE IS NO HARDCODED LIST HERE, deliberately. `GET
// /api/public/requests/:token/sources` (contract §2b) is the only source of
// truth, because the answer is request-specific and server-owned: it depends
// on the request's own destination pair, on whether the ROUTING_ENABLED kill
// switch is on, and on what the live router actually supports. A constant in
// this file cannot know any of those, and the previous fallback list
// ("usdc-stellar" + "usdc-solana" for every request) offered a routed source
// even with routing off — which `quoteRequest` then rejects with a 400.
//
// Before that call resolves — and if it fails — the pay screen uses
// `directSourceFor()` below, which is derived from the request the payer is
// actually looking at and is guaranteed quotable on every configuration.
//
// Note the payer flow can only SIGN on chains it has a wallet adapter for —
// Stellar (Stellar Wallets Kit) and Solana (Phantom), see
// components/pay/pay-wallet.ts. The server may legitimately return more; the
// source picker filters to the connected wallet's chain, so an unsignable
// pair is never offered.

export interface PaySource {
  /** lowercase chain id, matches backend SupportedChain.id */
  chain: string;
  /** lowercase `symbol-chain` token id, matches backend Token id */
  asset: string;
}

/**
 * The one source that is ALWAYS valid for a request: its own destination pair.
 * Paying it is the direct path — no router, exact amount — so this is correct
 * whether routing is on, off, or unreachable.
 */
export function directSourceFor(request: {
  destinationChain: string;
  destinationAsset: string;
}): PaySource {
  return { chain: request.destinationChain, asset: request.destinationAsset };
}

/** "usdc-stellar" → "USDC" */
export function assetSymbol(assetId: string): string {
  const [symbol] = assetId.split("-");
  return symbol.toUpperCase();
}

/** "stellar" → "Stellar" */
export function chainName(chainId: string): string {
  if (chainId === "mainnet-beta") return "Solana";
  return chainId.charAt(0).toUpperCase() + chainId.slice(1);
}

/**
 * A payment is DIRECT when the payer sends the exact asset the recipient
 * asked for, on the exact chain they asked for. No router, no conversion
 * between assets, and the amount that lands is the amount sent — exactly.
 * Everything else is ROUTED and can only ever be an estimate.
 */
export function isDirectSource(
  source: Pick<PaySource, "chain" | "asset"> | null,
  destinationChain: string,
  destinationAsset: string
): boolean {
  if (!source) return false;
  return source.chain === destinationChain && source.asset === destinationAsset;
}

/**
 * The slippage tolerance band shown on a ROUTED payment when the backend does
 * not return one of its own. Not a guess: the design fixes the starting band
 * at ±0.5% (".specs/2026-08-06-request-money-design.md" → "Edge cases,
 * decided" → Slippage: "tolerance band, start at ±0.5%"), and the router
 * selection spec repeats it as the honest disclosure on routed payments
 * (".specs/2026-08-06-router-selection.md" → "There is no firm quote").
 * A backend-supplied `slippageBps` always wins over this.
 */
export const DEFAULT_SLIPPAGE_PCT = 0.5;
