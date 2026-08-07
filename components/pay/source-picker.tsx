"use client";

import { ArrowRight, Check, Zap } from "lucide-react";
import { Card, T, A } from "@/lib/splito-design";
import {
  assetSymbol,
  chainName,
  isDirectSource,
  type PaySource,
} from "@/lib/pay-sources";

/**
 * "What are you paying WITH?"
 *
 * The direct pair — payer already holds the destination asset on the
 * destination chain — is the happy path and is presented as such: first in
 * the list, accented, and the only one that can honestly promise an exact
 * amount (".specs/2026-08-06-request-money-design.md" → "Direct path first";
 * ".specs/2026-08-06-router-selection.md" → "The direct path is the only
 * exact one"). Everything else converts on the way; whether that conversion
 * is an ESTIMATE (Allbridge) or exact-output with the payer bearing a
 * ceiling instead (Stellar path payment / Jupiter,
 * ".specs/2026-08-07-router-alternatives.md") is decided per-quote, not
 * per-source, so this screen — which only ever sees a `{chain, asset}` pair,
 * never a quote — must not claim either; see the per-source copy below.
 *
 * This screen is only shown when there is a real choice to make. When the
 * payer connects a wallet on the destination chain and the direct pair is
 * available, the pay page auto-selects it and skips straight to the quote —
 * the happy path shows no routing vocabulary at all.
 */
export function SourcePicker({
  sources,
  destinationChain,
  destinationAsset,
  connectedChain,
  selected,
  onSelect,
  onSwitchWallet,
}: {
  sources: PaySource[];
  destinationChain: string;
  destinationAsset: string;
  /** The chain the connected wallet can actually sign on. */
  connectedChain: string;
  selected: PaySource | null;
  onSelect: (source: PaySource) => void;
  onSwitchWallet: () => void;
}) {
  // Only offer what the connected wallet can sign. Offering a Solana source
  // to a Stellar-connected payer would produce a transaction they cannot sign.
  const signable = sources.filter((s) => s.chain === connectedChain);
  const ordered = [...signable].sort((a, b) => {
    const ad = isDirectSource(a, destinationChain, destinationAsset) ? 0 : 1;
    const bd = isDirectSource(b, destinationChain, destinationAsset) ? 0 : 1;
    return ad - bd;
  });

  const hasDirect = ordered.some((s) => isDirectSource(s, destinationChain, destinationAsset));

  return (
    <Card className="p-5 sm:p-6" style={{ marginTop: 16 }}>
      <p
        className="text-[11px] font-bold tracking-[0.08em] uppercase mb-1"
        style={{ color: T.muted }}
      >
        Pay with
      </p>
      <p className="text-[12.5px] leading-relaxed mb-4" style={{ color: T.dim }}>
        {hasDirect
          ? `They asked for ${assetSymbol(destinationAsset)} on ${chainName(destinationChain)}.`
          : `They asked for ${assetSymbol(destinationAsset)} on ${chainName(destinationChain)}, which your connected wallet doesn't hold — anything you pick here has to be converted on the way.`}
      </p>

      {/* Nothing this wallet can sign. Reachable for real now that the source
          list is server-derived: with the routing kill switch off, the server
          offers ONLY the destination pair, so a wallet on another chain has no
          valid option. Say that plainly instead of rendering an empty list. */}
      {ordered.length === 0 && (
        <p className="text-[12.5px] leading-relaxed" style={{ color: T.dim }}>
          Your connected {chainName(connectedChain)} wallet can&rsquo;t pay this request — it only
          accepts {assetSymbol(destinationAsset)} on {chainName(destinationChain)} right now.{" "}
          <button
            type="button"
            onClick={onSwitchWallet}
            className="font-bold underline underline-offset-2"
            style={{ color: A }}
          >
            Switch wallet
          </button>
        </p>
      )}

      <div className="space-y-2">
        {ordered.map((source) => {
          const direct = isDirectSource(source, destinationChain, destinationAsset);
          const active =
            selected?.chain === source.chain && selected?.asset === source.asset;
          return (
            <button
              key={`${source.chain}:${source.asset}`}
              type="button"
              onClick={() => onSelect(source)}
              className="w-full text-left rounded-xl p-3.5 transition-all hover:bg-white/[0.04]"
              style={{
                border: `1px solid ${active ? A : "rgba(255,255,255,0.10)"}`,
                background: active ? "rgba(34,211,238,0.06)" : "rgba(255,255,255,0.02)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-extrabold" style={{ color: T.bright }}>
                    {assetSymbol(source.asset)}{" "}
                    <span className="font-semibold" style={{ color: T.muted }}>
                      on {chainName(source.chain)}
                    </span>
                  </p>
                  <p className="text-[11.5px] mt-1 leading-relaxed" style={{ color: direct ? A : T.dim }}>
                    {direct
                      ? "Direct — lands as the exact amount. Network fee only."
                      : "Converted on the way — exact amount and any tolerance are confirmed on the next screen."}
                  </p>
                </div>
                {direct ? (
                  <span
                    className="flex items-center gap-1 flex-shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em]"
                    style={{ background: "rgba(34,211,238,0.14)", color: A }}
                  >
                    <Zap className="h-3 w-3" /> Best
                  </span>
                ) : active ? (
                  <Check className="h-4 w-4 flex-shrink-0" style={{ color: A }} />
                ) : (
                  <ArrowRight className="h-4 w-4 flex-shrink-0" style={{ color: T.dim }} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {!hasDirect && ordered.length > 0 && (
        <p className="text-[11.5px] leading-relaxed mt-3.5" style={{ color: T.dim }}>
          Holding {assetSymbol(destinationAsset)} on {chainName(destinationChain)}? Connect that
          wallet instead — it skips the conversion entirely and lands the exact amount.{" "}
          <button
            type="button"
            onClick={onSwitchWallet}
            className="font-bold underline underline-offset-2"
            style={{ color: A }}
          >
            Switch wallet
          </button>
        </p>
      )}
    </Card>
  );
}
