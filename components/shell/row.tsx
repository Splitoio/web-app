"use client";

import React from "react";
import Link from "next/link";
import { T, TYPE } from "@/lib/splito-design";

export interface RowShellProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  /** Suppress the bottom divider — e.g. the last row in a card. */
  noDivider?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The bare `.rw` wrapper — hover chrome, divider, and click/href handling
 * with no opinion on internal layout. `Row` (flex, 3-slot) and
 * `DataTable` (CSS grid, N columns) both build their rows on this.
 */
export function RowShell({
  children,
  onClick,
  href,
  noDivider = false,
  className = "",
  style = {},
}: RowShellProps) {
  const clickable = Boolean(onClick || href);
  const rowStyle: React.CSSProperties = {
    borderBottom: noDivider ? "none" : "1px solid rgba(255,255,255,0.05)",
    cursor: clickable ? "pointer" : "default",
    textDecoration: "none",
    ...style,
  };

  if (href) {
    return (
      <Link href={href} className={`rw ${className}`} style={rowStyle}>
        {children}
      </Link>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`rw ${className}`}
      style={rowStyle}
      role={onClick ? "button" : undefined}
    >
      {children}
    </div>
  );
}

export interface RowProps {
  /** Avatar, AvatarChip, or a small status dot — rendered flush-left. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** Amount, status pill, chevron — rendered flush-right, never shrinks. */
  trailing?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  /** Suppress the bottom divider — e.g. the last row in a card. */
  noDivider?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The `.rw` row pattern (design §3 / INDEX.md "Repeated card/table/pill
 * patterns"): horizontal flex row with an optional leading avatar/dot, a
 * title+meta stack, and a trailing value/status slot. Reused verbatim by
 * list rows, activity feeds, payer rows, group balances/requests, and
 * treasury streams — screens supply the slot content, this owns the layout,
 * the `.rw` hover class, and the divider.
 */
export function Row({
  leading,
  title,
  meta,
  trailing,
  onClick,
  href,
  noDivider = false,
  className = "",
  style = {},
}: RowProps) {
  return (
    <RowShell
      onClick={onClick}
      href={href}
      noDivider={noDivider}
      className={className}
      style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 20px", ...style }}
    >
      {leading}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            ...TYPE.rowTitle,
            color: T.bright,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </p>
        {meta != null && (
          <p style={{ margin: "3px 0 0", fontSize: 11.5, color: T.sub }}>{meta}</p>
        )}
      </div>
      {trailing != null && <div style={{ flexShrink: 0 }}>{trailing}</div>}
    </RowShell>
  );
}
