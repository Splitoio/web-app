"use client";

import React from "react";
import { useHandleEscapeToCloseModal } from "@/hooks/useHandleEscape";
import { A, T, MONO, FADE_UP, Btn, Mono, avatarChip } from "@/lib/splito-design";
import { Row } from "@/components/shell/row";

export interface PersonBreakdownPerson {
  name: string;
  sub?: string;
  init: string;
  /** Avatar chip accent — defaults to `A` (cyan). */
  color?: string;
  netLabel?: string;
  /** Formatted net-balance figure, e.g. "+$310.00". */
  net: string;
  /** Defaults to `T.main` — pass `G`/`R` to signal owed-to-you / you-owe. */
  netColor?: string;
}

export interface PersonBalance {
  init: string;
  cur: string;
  chain?: string;
  sub?: string;
  amount: string;
  color?: string;
}

export interface PersonHistoryItem {
  id: string;
  color?: string;
  title: string;
  meta?: string;
  status?: string;
  statusColor?: string;
  amount: string;
  href?: string;
  onClick?: () => void;
}

export interface PersonBreakdownModalProps {
  open: boolean;
  onClose: () => void;
  person: PersonBreakdownPerson;
  balances: PersonBalance[];
  items: PersonHistoryItem[];
  onRequest?: () => void;
  onSettle?: () => void;
}

/**
 * Person-breakdown modal (design lines 1425-1479): full-screen dim+blur
 * backdrop, centered card, net-balance figure, per-currency balances, and
 * itemized history, ending in a Request/Settle-up action row. Presentational
 * only — the dashboard and People screens own the data and pass it in.
 */
export function PersonBreakdownModal({
  open,
  onClose,
  person,
  balances,
  items,
  onRequest,
  onSettle,
}: PersonBreakdownModalProps) {
  useHandleEscapeToCloseModal(open, onClose);

  if (!open) return null;

  const accent = person.color ?? A;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(14px)",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 560,
          maxHeight: "86vh",
          overflowY: "auto",
          borderRadius: 26,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "linear-gradient(160deg,#141414 0%,#0f0f0f 100%)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
          animation: FADE_UP,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
            padding: "24px 24px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <span style={{ ...avatarChip(accent, 48), fontSize: 14 }}>{person.init}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: T.white }}>
              {person.name}
            </p>
            {person.sub != null && (
              <p style={{ margin: "3px 0 0", fontSize: 12.5, color: T.sub }}>{person.sub}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: T.muted,
              fontSize: 17,
            }}
          >
            ×
          </button>
        </div>

        {/* Net balance */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}>
            {person.netLabel ?? "Net balance"}
          </p>
          <p
            style={{
              margin: "7px 0 0",
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: person.netColor ?? T.main,
              fontFamily: MONO,
              lineHeight: 1,
            }}
          >
            {person.net}
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: T.dim }}>
            Balances don&apos;t net across currencies — each one settles on its own.
          </p>
        </div>

        {/* By currency */}
        {balances.length > 0 && (
          <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.soft }}>
              By currency
            </p>
            {balances.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
                <span style={{ ...avatarChip(b.color ?? accent, 32), fontSize: 10 }}>{b.init}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.bright, fontFamily: MONO }}>
                    {b.cur}{" "}
                    {b.chain != null && (
                      <span style={{ fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, color: T.dim }}>
                        on {b.chain}
                      </span>
                    )}
                  </p>
                  {b.sub != null && (
                    <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.sub }}>{b.sub}</p>
                  )}
                </div>
                <Mono style={{ fontSize: 14, fontWeight: 800, color: b.color ?? T.main }}>{b.amount}</Mono>
              </div>
            ))}
          </div>
        )}

        {/* Between you */}
        <div style={{ padding: "18px 24px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.soft }}>
            Between you
          </p>
          {items.map((it, i) => (
            <Row
              key={it.id}
              href={it.href}
              onClick={it.onClick}
              noDivider={i === items.length - 1}
              style={{ padding: "11px 0" }}
              leading={
                <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: it.color ?? accent }} />
              }
              title={it.title}
              meta={it.meta}
              trailing={
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {it.status != null && (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: it.statusColor ?? it.color ?? T.sub }}>
                      {it.status}
                    </span>
                  )}
                  <Mono style={{ fontSize: 13, fontWeight: 800, color: T.main, width: 74, textAlign: "right" }}>
                    {it.amount}
                  </Mono>
                </div>
              }
            />
          ))}

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <Btn
              variant="primary"
              onClick={onRequest}
              style={{ flex: 1, justifyContent: "center", padding: 11 }}
            >
              Request from {person.init}
            </Btn>
            <Btn
              variant="ghost"
              onClick={onSettle}
              style={{ flex: 1, justifyContent: "center", padding: 11 }}
            >
              Settle up
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
