"use client";

import {
  A,
  P,
  T,
  BORDER,
  HERO_SURFACE,
  MONO,
  RADIUS,
  SHADOW,
  avatarChip,
  eyebrow,
} from "@/lib/splito-design";
import { formatCurrency } from "@/utils/formatters";
import { assetSymbol, chainName, isDirectSource, type PaySource } from "@/lib/pay-sources";

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function Hop({
  label,
  sub,
  color = T.main,
  accentBg,
  accentBorder,
}: {
  label: string;
  sub: string;
  color?: string;
  accentBg?: string;
  accentBorder?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        textAlign: "center",
        padding: "10px 6px",
        borderRadius: 12,
        background: accentBg ?? "rgba(255,255,255,0.04)",
        border: `1px solid ${accentBorder ?? "rgba(255,255,255,0.08)"}`,
        minWidth: 0,
      }}
    >
      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color, fontFamily: MONO }}>{label}</p>
      <p style={{ margin: "2px 0 0", fontSize: 10, color: T.sub }}>{sub}</p>
    </div>
  );
}

function Arrow() {
  return <span style={{ fontSize: 14, color: T.faint, flexShrink: 0 }}>→</span>;
}

/**
 * The sticky right-hand panel on the public pay page
 * (.design/splito-finance.dc.html:1520-1567) — request summary header, a
 * route visualization once a source is known, and whatever comes next
 * (wallet-connect nudge / quote breakdown+CTA) as `children`.
 *
 * Pure presentation: it derives nothing about payment state itself, only
 * formats props the page already computed.
 */
export function SummaryPanel({
  requesterName,
  amount,
  requestName,
  paidCount,
  totalCount,
  source,
  destinationChain,
  destinationAsset,
  isRouted,
  providerName,
  children,
}: {
  requesterName: string | null;
  amount: number;
  requestName: string | null;
  paidCount: number;
  totalCount: number;
  /** The chosen pay-with source, once a wallet is connected. */
  source: PaySource | null;
  destinationChain: string;
  destinationAsset: string;
  /** Server's verdict from the quote, once there is one. Falls back to a
   *  same-chain/same-asset check against `source` before that. */
  isRouted?: boolean | null;
  /** Humanized provider id (e.g. "Allbridge"), null on the direct path. */
  providerName?: string | null;
  children?: React.ReactNode;
}) {
  const routed =
    isRouted ?? (source ? !isDirectSource(source, destinationChain, destinationAsset) : false);

  return (
    <div style={{ position: "sticky", top: 20 }}>
      <div
        style={{
          borderRadius: RADIUS.hero,
          border: BORDER,
          overflow: "hidden",
          background: HERO_SURFACE,
          boxShadow: SHADOW.hero,
        }}
      >
        <div style={{ padding: "24px 22px", textAlign: "center", borderBottom: BORDER }}>
          <span style={{ ...avatarChip(A, 44, RADIUS.tile), margin: "0 auto 12px", fontSize: 13 }}>
            {initials(requesterName)}
          </span>
          <p style={{ margin: 0, fontSize: 12.5, color: T.muted }}>
            <span style={{ color: T.main, fontWeight: 700 }}>{requesterName ?? "Someone"}</span>{" "}
            requested
          </p>
          <p
            style={{
              margin: "10px 0 3px",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: T.white,
              fontFamily: MONO,
            }}
          >
            {formatCurrency(amount, "USD")}
          </p>
          {requestName && (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.soft }}>
              {requestName}
              {totalCount > 1 ? " · your share" : ""}
            </p>
          )}
          {totalCount > 1 && (
            <p style={{ margin: "10px 0 0", fontSize: 11, fontWeight: 600, color: T.dim }}>
              {paidCount} of {totalCount} people have paid
            </p>
          )}
        </div>

        {source && (
          <div style={{ padding: "18px 22px", borderBottom: children ? BORDER : "none" }}>
            <p style={{ ...eyebrow(T.muted), marginBottom: 12 }}>Route</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Hop label={assetSymbol(source.asset)} sub={chainName(source.chain)} color={T.main} />
              {routed && (
                <>
                  <Arrow />
                  <Hop
                    label="Bridge"
                    sub={providerName ?? "Routing"}
                    color={P}
                    accentBg="rgba(167,139,250,0.07)"
                    accentBorder="rgba(167,139,250,0.2)"
                  />
                </>
              )}
              <Arrow />
              <Hop
                label={assetSymbol(destinationAsset)}
                sub={chainName(destinationChain)}
                color={A}
                accentBg="rgba(34,211,238,0.07)"
                accentBorder="rgba(34,211,238,0.2)"
              />
            </div>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
